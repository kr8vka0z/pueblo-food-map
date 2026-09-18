// @vitest-environment node
/**
 * Route-level tests for POST/GET /api/public/blessing-boxes/[id]/photos
 * (Blessing Boxes slice 5). Same layered-mock convention as the checkins
 * route's own tests: mocks boxTurnstile, the rate limiter,
 * @opennextjs/cloudflare's getCloudflareContext (D1 + R2 + fetch for the
 * admin email), and builds a real, small, synthetic JPEG (same technique as
 * jpegSegments.test.ts) so the EXIF-stripping/dimension-reading integration
 * is exercised for real, not mocked away.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mockResolveBoxTurnstileKey = vi.fn();
const mockVerifyBoxTurnstile = vi.fn();
vi.mock("@/lib/boxTurnstile", () => ({
  resolveBoxTurnstileKey: (...args: unknown[]) => mockResolveBoxTurnstileKey(...args),
  verifyBoxTurnstile: (...args: unknown[]) => mockVerifyBoxTurnstile(...args),
}));

const mockCheckAndIncrement = vi.fn();
vi.mock("@/lib/checkinRateLimit", () => ({
  checkAndIncrement: (...args: unknown[]) => mockCheckAndIncrement(...args),
}));

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const mockFetch = vi.fn();

import { GET, POST } from "@/app/api/public/blessing-boxes/[id]/photos/route";

const BOX_ID = "plentiful-blessing-box-216-w-routt-plentiful-1454";
const URL_BASE = `https://pueblofoodmap.com/api/public/blessing-boxes/${BOX_ID}/photos`;

/** Builds one JPEG marker segment's bytes — same helper as jpegSegments.test.ts. */
function segment(marker: number, payload: number[]): number[] {
  const length = 2 + payload.length;
  return [0xff, marker, (length >> 8) & 0xff, length & 0xff, ...payload];
}

/** A small, structurally valid JPEG: SOI, APP1 (fake EXIF, must be stripped), SOF0 (10x10, 1 component), SOS, tiny scan, EOI. */
function buildFakeJpegBlob(extraScanBytes = 0): Blob {
  const bytes = [
    0xff,
    0xd8,
    ...segment(0xe1, Array.from(new TextEncoder().encode("Exif\0\0GPS_SECRET"))),
    ...segment(0xc0, [8, 0, 10, 0, 10, 1, 1, 0x11, 0]),
    ...segment(0xda, [1, 1, 0, 0, 63, 0]),
    ...Array(Math.max(extraScanBytes, 2)).fill(0x11),
    0xff,
    0xd9,
  ];
  return new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });
}

interface FakeDbOptions {
  boxRow?: { id: string } | null;
  checkinRow?: { id: number; venue_id: string } | null;
  insertMeta?: { last_row_id?: number };
  insertShouldThrow?: boolean;
  approvedPhotos?: { id: number; created_at: string }[];
}

function makeFakeDb(opts: FakeDbOptions = {}) {
  const {
    boxRow = { id: BOX_ID },
    checkinRow = null,
    insertMeta = { last_row_id: 99 },
    insertShouldThrow = false,
    approvedPhotos = [],
  } = opts;
  const insertCalls: unknown[][] = [];

  const prepare = (sql: string) => {
    if (sql.includes("FROM venues WHERE id = ? AND category")) {
      return { bind: (...args: unknown[]) => ({ first: async () => (args[0] === BOX_ID ? boxRow : null) }) };
    }
    if (sql.includes("SELECT name FROM venues")) {
      return { bind: () => ({ first: async () => ({ name: "216 W Routt Blessing Box" }) }) };
    }
    if (sql.includes("FROM box_checkins WHERE id")) {
      return { bind: () => ({ first: async () => checkinRow }) };
    }
    if (sql.includes("INSERT INTO box_photos")) {
      return {
        bind: (...args: unknown[]) => ({
          run: async () => {
            if (insertShouldThrow) throw new Error("insert failed");
            insertCalls.push(args);
            return { success: true, meta: insertMeta };
          },
        }),
      };
    }
    if (sql.includes("FROM box_photos")) {
      return { bind: () => ({ all: async () => ({ results: approvedPhotos }) }) };
    }
    throw new Error("unexpected SQL in fake db: " + sql);
  };

  return { db: { prepare } as unknown as D1Database, insertCalls };
}

function makeR2() {
  const put = vi.fn().mockResolvedValue(undefined);
  return { put, r2: { put } as unknown as R2Bucket };
}

/**
 * Builds a real multipart POST request with a genuine, correct
 * `Content-Length` header. A real browser upload always sends one; handing
 * `NextRequest` a live `FormData` object directly (instead of going through
 * an actual `fetch()`) leaves Content-Length unset (confirmed empirically —
 * see the fix-2026-09-18 commit), which would trip the route's new
 * pre-parse size gate on every one of these otherwise-legitimate test
 * uploads. Serializing through `Response` first computes the real byte
 * length and boundary the same way a browser would, then that exact body +
 * headers are handed to `NextRequest`.
 */
async function makeFormRequest(fields: Record<string, string | Blob>): Promise<NextRequest> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value as string | Blob);
  }
  const serialized = new Response(form);
  const bodyBytes = await serialized.arrayBuffer();
  const contentType = serialized.headers.get("content-type")!;
  return new NextRequest(URL_BASE, {
    method: "POST",
    headers: { "Content-Type": contentType, "Content-Length": String(bodyBytes.byteLength) },
    body: bodyBytes,
  });
}

async function callPost(fields: Record<string, string | Blob>, id: string = BOX_ID) {
  return POST(await makeFormRequest(fields), { params: Promise.resolve({ id }) });
}

function baseFields(overrides: Record<string, string | Blob> = {}) {
  return { turnstileToken: "t", photo: buildFakeJpegBlob(), ...overrides };
}

describe("POST /api/public/blessing-boxes/[id]/photos", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockResolveBoxTurnstileKey.mockReset();
    mockVerifyBoxTurnstile.mockReset();
    mockCheckAndIncrement.mockReset();
    mockGetCloudflareContext.mockReset();
    mockFetch.mockReset();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    process.env.CHECKIN_RATE_LIMIT_SECRET = "test-rate-limit-secret";
    process.env.RESEND_API_KEY = "test-resend-key";

    mockResolveBoxTurnstileKey.mockReturnValue("box");
    mockVerifyBoxTurnstile.mockResolvedValue(true);
    mockCheckAndIncrement.mockResolvedValue(true);
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  function mockContext(db: D1Database, r2: R2Bucket) {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db, BOX_PHOTOS: r2 } });
  }

  test("non-multipart content-type -> 400", async () => {
    const req = new NextRequest(URL_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const res = await POST(req, { params: Promise.resolve({ id: BOX_ID }) });
    expect(res.status).toBe(400);
  });

  test("Content-Length over the pre-parse cap -> 413, formData() never called (no D1/context reached)", async () => {
    const req = new NextRequest(URL_BASE, {
      method: "POST",
      headers: { "Content-Type": "multipart/form-data; boundary=x", "Content-Length": "999999999" },
      body: "small",
    });
    const res = await POST(req, { params: Promise.resolve({ id: BOX_ID }) });
    expect(res.status).toBe(413);
    expect(mockGetCloudflareContext).not.toHaveBeenCalled();
  });

  // Review finding (PR #490): a missing header silently became 0 and a junk
  // header silently became NaN, both sailing past the old `> MAX_REQUEST_BYTES`
  // check and letting formData() buffer an unbounded body before any size
  // check ever fired. All three (missing/junk/zero) are now a hard 411,
  // before formData() is ever called.
  test("missing Content-Length header -> 411, formData() never called", async () => {
    const req = new NextRequest(URL_BASE, {
      method: "POST",
      headers: { "Content-Type": "multipart/form-data; boundary=x" },
      body: "small",
    });
    const res = await POST(req, { params: Promise.resolve({ id: BOX_ID }) });
    expect(res.status).toBe(411);
    expect((await res.json()).error).toBe("content_length_required");
    expect(mockGetCloudflareContext).not.toHaveBeenCalled();
  });

  test("junk (non-numeric) Content-Length header -> 411, formData() never called", async () => {
    const req = new NextRequest(URL_BASE, {
      method: "POST",
      headers: { "Content-Type": "multipart/form-data; boundary=x", "Content-Length": "not-a-number" },
      body: "small",
    });
    const res = await POST(req, { params: Promise.resolve({ id: BOX_ID }) });
    expect(res.status).toBe(411);
    expect((await res.json()).error).toBe("content_length_required");
    expect(mockGetCloudflareContext).not.toHaveBeenCalled();
  });

  test("zero Content-Length header -> 411, formData() never called", async () => {
    const req = new NextRequest(URL_BASE, {
      method: "POST",
      headers: { "Content-Type": "multipart/form-data; boundary=x", "Content-Length": "0" },
      body: "",
    });
    const res = await POST(req, { params: Promise.resolve({ id: BOX_ID }) });
    expect(res.status).toBe(411);
    expect((await res.json()).error).toBe("content_length_required");
    expect(mockGetCloudflareContext).not.toHaveBeenCalled();
  });

  test("honeypot filled -> 200 ok (bots think it worked), never reaches D1", async () => {
    const res = await callPost(baseFields({ website: "http://spam.example" }));
    expect(res.status).toBe(200);
    expect(mockGetCloudflareContext).not.toHaveBeenCalled();
  });

  test("Turnstile rejection -> 400, never reaches D1", async () => {
    mockVerifyBoxTurnstile.mockResolvedValue(false);
    const res = await callPost(baseFields());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("turnstile_failed");
    expect(mockGetCloudflareContext).not.toHaveBeenCalled();
  });

  test("CHECKIN_RATE_LIMIT_SECRET missing -> throws before verifying Turnstile", async () => {
    delete process.env.CHECKIN_RATE_LIMIT_SECRET;
    await expect(callPost(baseFields())).rejects.toThrow("CHECKIN_RATE_LIMIT_SECRET not configured");
    expect(mockVerifyBoxTurnstile).not.toHaveBeenCalled();
  });

  test("per-visitor cap checked before the box cap, and rejects before the box counter is touched", async () => {
    const { db } = makeFakeDb();
    const { r2 } = makeR2();
    mockContext(db, r2);
    mockCheckAndIncrement.mockResolvedValueOnce(false);
    const res = await callPost(baseFields({ clientToken: "abc-123" }));
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toBe("rate_limit_visitor");
    expect(mockCheckAndIncrement).toHaveBeenCalledTimes(1);
    expect(mockCheckAndIncrement.mock.calls[0][2]).toEqual({ scope: "photo-visitor-box", id: `abc-123:${BOX_ID}` });
  });

  test("no clientToken -> only the box cap is checked", async () => {
    const { db } = makeFakeDb();
    const { r2 } = makeR2();
    mockContext(db, r2);
    await callPost(baseFields());
    expect(mockCheckAndIncrement).toHaveBeenCalledTimes(1);
    expect(mockCheckAndIncrement.mock.calls[0][2]).toEqual({ scope: "photo-box", id: BOX_ID });
  });

  test("box cap exceeded -> 429 rate_limit_box", async () => {
    const { db } = makeFakeDb();
    const { r2 } = makeR2();
    mockContext(db, r2);
    mockCheckAndIncrement.mockResolvedValueOnce(false);
    const res = await callPost(baseFields());
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limit_box");
  });

  test("unknown/archived box id -> 404", async () => {
    const { db } = makeFakeDb({ boxRow: null });
    const { r2 } = makeR2();
    mockContext(db, r2);
    const res = await callPost(baseFields());
    expect(res.status).toBe(404);
  });

  test("checkinId referencing a check-in on a DIFFERENT box -> 422, never reaches R2/D1 insert", async () => {
    const { db } = makeFakeDb({ checkinRow: { id: 5, venue_id: "some-other-box" } });
    const { r2, put } = makeR2();
    mockContext(db, r2);
    const res = await callPost(baseFields({ checkinId: "5" }));
    expect(res.status).toBe(422);
    expect(put).not.toHaveBeenCalled();
  });

  test("checkinId that doesn't exist at all -> 422", async () => {
    const { db } = makeFakeDb({ checkinRow: null });
    const { r2 } = makeR2();
    mockContext(db, r2);
    const res = await callPost(baseFields({ checkinId: "999" }));
    expect(res.status).toBe(422);
  });

  test("no photo field -> 422", async () => {
    const { db } = makeFakeDb();
    const { r2 } = makeR2();
    mockContext(db, r2);
    const res = await callPost({ turnstileToken: "t" });
    expect(res.status).toBe(422);
  });

  test("photo larger than the max -> 413", async () => {
    const { db } = makeFakeDb();
    const { r2 } = makeR2();
    mockContext(db, r2);
    const huge = new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: "image/jpeg" });
    const res = await callPost(baseFields({ photo: huge }));
    expect(res.status).toBe(413);
  });

  test("non-JPEG magic bytes -> 422 unsupported_image_type", async () => {
    const { db } = makeFakeDb();
    const { r2, put } = makeR2();
    mockContext(db, r2);
    const notJpeg = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])], { type: "image/jpeg" });
    const res = await callPost(baseFields({ photo: notJpeg }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("unsupported_image_type");
    expect(put).not.toHaveBeenCalled();
  });

  test("a JPEG-magic file that fails to parse as valid JPEG -> 422 unsupported_image", async () => {
    const { db } = makeFakeDb();
    const { r2 } = makeR2();
    mockContext(db, r2);
    // Real SOI+marker lead bytes, but truncated immediately after — parses
    // far enough to pass verifyJpegMagic, fails the full segment walk.
    const truncated = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe1])], { type: "image/jpeg" });
    const res = await callPost(baseFields({ photo: truncated }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("unsupported_image");
  });

  test("success: strips EXIF before writing to R2, inserts a pending D1 row, returns photoId", async () => {
    const { db, insertCalls } = makeFakeDb({ insertMeta: { last_row_id: 77 } });
    const { r2, put } = makeR2();
    mockContext(db, r2);

    const res = await callPost(baseFields());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.photoId).toBe(77);

    expect(put).toHaveBeenCalledTimes(1);
    const [key, body, opts] = put.mock.calls[0];
    expect(key).toMatch(new RegExp(`^box-photos/${BOX_ID}/[0-9a-f-]+\\.jpg$`));
    expect((opts as { httpMetadata: { contentType: string } }).httpMetadata.contentType).toBe("image/jpeg");
    const writtenBytes = new Uint8Array(body as ArrayBuffer);
    const writtenText = new TextDecoder("latin1").decode(writtenBytes);
    expect(writtenText).not.toContain("GPS_SECRET"); // EXIF stripped before the R2 write

    expect(insertCalls).toHaveLength(1);
    const [venueId, checkinId, r2Key, width, height, bytes] = insertCalls[0];
    expect(venueId).toBe(BOX_ID);
    expect(checkinId).toBeNull();
    expect(r2Key).toBe(key);
    expect(width).toBe(10);
    expect(height).toBe(10);
    expect(bytes).toBe(writtenBytes.length);
  });

  test("success with a checkinId belonging to this box -> linked on the insert", async () => {
    const { db, insertCalls } = makeFakeDb({ checkinRow: { id: 5, venue_id: BOX_ID } });
    const { r2 } = makeR2();
    mockContext(db, r2);
    const res = await callPost(baseFields({ checkinId: "5" }));
    expect(res.status).toBe(200);
    expect(insertCalls[0][1]).toBe(5);
  });

  test("R2 put failure -> 502, never reaches the D1 insert", async () => {
    const { db, insertCalls } = makeFakeDb();
    const put = vi.fn().mockRejectedValue(new Error("R2 down"));
    mockContext(db, { put } as unknown as R2Bucket);
    const res = await callPost(baseFields());
    expect(res.status).toBe(502);
    expect(insertCalls).toHaveLength(0);
  });

  test("D1 insert failure -> 502", async () => {
    const { db } = makeFakeDb({ insertShouldThrow: true });
    const { r2 } = makeR2();
    mockContext(db, r2);
    const res = await callPost(baseFields());
    expect(res.status).toBe(502);
  });

  test("sends an admin alert email on success", async () => {
    const { db } = makeFakeDb();
    const { r2 } = makeR2();
    mockContext(db, r2);
    await callPost(baseFields());
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.to).toEqual(["issues@pueblofoodmap.com"]);
    expect(body.text).toContain("/admin/box-photos");
  });

  test("a failed alert email does not fail the upload itself", async () => {
    mockFetch.mockResolvedValue(new Response("boom", { status: 500 }));
    const { db } = makeFakeDb();
    const { r2 } = makeR2();
    mockContext(db, r2);
    const res = await callPost(baseFields());
    expect(res.status).toBe(200);
  });

  test("no Cloudflare context available -> 503, never throws", async () => {
    mockGetCloudflareContext.mockImplementation(() => {
      throw new Error("no cloudflare context");
    });
    const res = await callPost(baseFields());
    expect(res.status).toBe(503);
  });
});

describe("GET /api/public/blessing-boxes/[id]/photos", () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete (globalThis as { caches?: unknown }).caches;
  });

  function callGet(id: string = BOX_ID) {
    return GET(new NextRequest(URL_BASE), { params: Promise.resolve({ id }) });
  }

  test("returns approved photos, newest first, as provided by the query", async () => {
    const { db } = makeFakeDb({
      approvedPhotos: [
        { id: 2, created_at: "2026-09-18T10:00:00.000Z" },
        { id: 1, created_at: "2026-09-17T10:00:00.000Z" },
      ],
    });
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callGet();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.photos).toEqual([
      { id: 2, createdAt: "2026-09-18T10:00:00.000Z" },
      { id: 1, createdAt: "2026-09-17T10:00:00.000Z" },
    ]);
  });

  test("a D1 failure degrades to an empty list, not a 500", async () => {
    mockGetCloudflareContext.mockImplementation(() => {
      throw new Error("boom");
    });
    const res = await callGet();
    expect(res.status).toBe(200);
    expect((await res.json()).photos).toEqual([]);
  });
});
