// @vitest-environment node
/**
 * Route-level tests for POST /api/public/box-photos/[id]/flag (Blessing
 * Boxes slice 5). Mocks the rate limiter, @opennextjs/cloudflare, and
 * global fetch (the best-effort admin alert email) — same layered-mock
 * convention as the checkins route's own test file.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mockCheckAndIncrement = vi.fn();
vi.mock("@/lib/checkinRateLimit", () => ({
  checkAndIncrement: (...args: unknown[]) => mockCheckAndIncrement(...args),
}));

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const mockFetch = vi.fn();

import { POST } from "@/app/api/public/box-photos/[id]/flag/route";

const PHOTO_ID = 42;
const VENUE_ID = "plentiful-blessing-box-216-w-routt-plentiful-1454";

interface FakePhotoRow {
  id: number;
  venue_id: string;
  status: string;
  flag_count: number;
}

function makeFakeDb(opts: { photoRow?: FakePhotoRow | null } = {}) {
  const photoRow = opts.photoRow === undefined ? { id: PHOTO_ID, venue_id: VENUE_ID, status: "approved", flag_count: 0 } : opts.photoRow;
  const updateCalls: unknown[][] = [];

  const prepare = (sql: string) => {
    if (sql.includes("SELECT * FROM box_photos WHERE id = ? AND status = 'approved'")) {
      return { bind: (...args: unknown[]) => ({ first: async () => (photoRow && args[0] === photoRow.id ? photoRow : null) }) };
    }
    if (sql.includes("UPDATE box_photos SET status = 'flagged'")) {
      return {
        bind: (...args: unknown[]) => ({
          run: async () => {
            updateCalls.push(args);
            return { success: true, meta: { changes: 1 } };
          },
        }),
      };
    }
    if (sql.includes("SELECT name FROM venues")) {
      return { bind: () => ({ first: async () => ({ name: "216 W Routt Blessing Box" }) }) };
    }
    throw new Error("unexpected SQL in fake db: " + sql);
  };

  return { db: { prepare } as unknown as D1Database, updateCalls };
}

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest(`https://pueblofoodmap.com/api/public/box-photos/${PHOTO_ID}/flag`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function callPost(body?: unknown, id: string = String(PHOTO_ID)) {
  return POST(makeRequest(body), { params: Promise.resolve({ id }) });
}

describe("POST /api/public/box-photos/[id]/flag", () => {
  const originalFetch = global.fetch;
  const originalResendKey = process.env.RESEND_API_KEY;
  const originalRateLimitSecret = process.env.CHECKIN_RATE_LIMIT_SECRET;

  beforeEach(() => {
    mockCheckAndIncrement.mockReset().mockResolvedValue(true);
    mockGetCloudflareContext.mockReset();
    mockFetch.mockReset().mockResolvedValue(new Response(null, { status: 200 }));
    global.fetch = mockFetch as unknown as typeof fetch;
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.CHECKIN_RATE_LIMIT_SECRET = "test-secret";
    delete (globalThis as { caches?: unknown }).caches;
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
    process.env.RESEND_API_KEY = originalResendKey;
    process.env.CHECKIN_RATE_LIMIT_SECRET = originalRateLimitSecret;
    delete (globalThis as { caches?: unknown }).caches;
  });

  test("non-numeric id -> 404, never touches D1", async () => {
    const { db } = makeFakeDb();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost(undefined, "not-a-number");
    expect(res.status).toBe(404);
  });

  test("no matching APPROVED row -> 404 (also covers a non-existent id, structurally identical)", async () => {
    const { db } = makeFakeDb({ photoRow: null });
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost();
    expect(res.status).toBe(404);
  });

  test("over the per-visitor cap -> 429, D1 never reaches the photo lookup", async () => {
    mockCheckAndIncrement.mockResolvedValueOnce(false);
    const { db } = makeFakeDb();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost({ clientToken: "visitor-abc" });
    expect(res.status).toBe(429);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("rate_limit_visitor");
  });

  test("no clientToken -> rate limiter is never called, request still succeeds", async () => {
    const { db, updateCalls } = makeFakeDb();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost({});
    expect(res.status).toBe(200);
    expect(mockCheckAndIncrement).not.toHaveBeenCalled();
    expect(updateCalls).toHaveLength(1);
  });

  test("success: flags the photo, sends the admin alert email", async () => {
    const { db, updateCalls } = makeFakeDb();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost({ clientToken: "visitor-abc" });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; id: number };
    expect(data.ok).toBe(true);
    expect(data.id).toBe(PHOTO_ID);

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0][0]).toBe(PHOTO_ID);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.subject).toContain("Photo reported");
  });

  test("email send failure does not fail the request — the flag already committed", async () => {
    mockFetch.mockResolvedValueOnce(new Response("boom", { status: 502 }));
    const { db } = makeFakeDb();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost({});
    expect(res.status).toBe(200);
  });

  test("no live Cloudflare context -> 503, never throws", async () => {
    mockGetCloudflareContext.mockImplementation(() => {
      throw new Error("no cloudflare context");
    });
    const res = await callPost({});
    expect(res.status).toBe(503);
  });
});
