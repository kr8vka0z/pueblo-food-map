// @vitest-environment node
/**
 * Route-level tests for POST /api/public/blessing-boxes/[id]/adopt
 * (Blessing Boxes slice 6). Same layered-mock convention as the checkins
 * route's own tests: mocks src/lib/boxTurnstile, src/lib/checkinRateLimit,
 * @opennextjs/cloudflare, global fetch (Resend), and a fake D1Database.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mockVerifyBoxTurnstile = vi.fn();
vi.mock("@/lib/boxTurnstile", () => ({
  resolveBoxTurnstileKey: (raw: unknown) => (raw === "fallback" ? "fallback" : "box"),
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

import { POST } from "@/app/api/public/blessing-boxes/[id]/adopt/route";

const BOX_ID = "test-box-1";

interface FakeDbOptions {
  boxRow?: { id: string; name: string } | null;
  insertShouldThrow?: boolean;
}

function makeFakeDb(opts: FakeDbOptions = {}) {
  const { boxRow = { id: BOX_ID, name: "Test Blessing Box" }, insertShouldThrow = false } = opts;
  const insertCalls: unknown[][] = [];

  const prepare = (sql: string) => {
    if (sql.includes("FROM venues WHERE id")) {
      return { bind: (...args: unknown[]) => ({ first: async () => (args[0] === BOX_ID ? boxRow : null) }) };
    }
    if (sql.includes("INSERT INTO box_adopters")) {
      return {
        bind: (...args: unknown[]) => ({
          run: async () => {
            if (insertShouldThrow) throw new Error("insert failed");
            insertCalls.push(args);
            return { success: true, meta: { last_row_id: 7 } };
          },
        }),
      };
    }
    throw new Error("unexpected SQL in fake db: " + sql);
  };

  return { db: { prepare } as unknown as D1Database, insertCalls };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(`https://pueblofoodmap.com/api/public/blessing-boxes/${BOX_ID}/adopt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function callPost(body: unknown, id: string = BOX_ID) {
  return POST(makeRequest(body), { params: Promise.resolve({ id }) });
}

const VALID_BODY = { displayName: "The Martinez Family", email: "adopter@example.com", turnstileToken: "t" };

describe("POST /api/public/blessing-boxes/[id]/adopt", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockVerifyBoxTurnstile.mockReset();
    mockCheckAndIncrement.mockReset();
    mockGetCloudflareContext.mockReset();
    mockFetch.mockReset();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    process.env.CHECKIN_RATE_LIMIT_SECRET = "test-rate-limit-secret";
    process.env.RESEND_API_KEY = "test-resend-key";

    mockVerifyBoxTurnstile.mockResolvedValue(true);
    mockCheckAndIncrement.mockResolvedValue(true);
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  test("non-JSON content-type -> 400", async () => {
    const req = new NextRequest(`https://pueblofoodmap.com/api/public/blessing-boxes/${BOX_ID}/adopt`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "hi",
    });
    const res = await POST(req, { params: Promise.resolve({ id: BOX_ID }) });
    expect(res.status).toBe(400);
  });

  test("Turnstile rejection -> 400, never reaches D1", async () => {
    mockVerifyBoxTurnstile.mockResolvedValue(false);
    const res = await callPost(VALID_BODY);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("turnstile_failed");
    expect(mockGetCloudflareContext).not.toHaveBeenCalled();
  });

  test("honeypot filled -> 200 ok, never reaches D1", async () => {
    const res = await callPost({ ...VALID_BODY, website: "http://spam.example" });
    expect(res.status).toBe(200);
    expect(mockGetCloudflareContext).not.toHaveBeenCalled();
  });

  test("CHECKIN_RATE_LIMIT_SECRET missing -> throws, never verifies Turnstile", async () => {
    delete process.env.CHECKIN_RATE_LIMIT_SECRET;
    await expect(callPost(VALID_BODY)).rejects.toThrow("CHECKIN_RATE_LIMIT_SECRET not configured");
  });

  test("clientToken present -> visitor cap checked before box/email caps, using scope adopt-visitor", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    await callPost({ ...VALID_BODY, clientToken: "abc" });
    expect(mockCheckAndIncrement.mock.calls[0][2]).toEqual({ scope: "adopt-visitor", id: `abc:${BOX_ID}` });
    expect(mockCheckAndIncrement.mock.calls[1][2]).toEqual({ scope: "adopt-box", id: BOX_ID });
    expect(mockCheckAndIncrement.mock.calls[2][2]).toEqual({
      scope: "alert-email-target",
      id: "adopter@example.com",
    });
    expect(mockCheckAndIncrement.mock.calls[3][2]).toEqual({ scope: "alert-email-global", id: "global" });
  });

  test("no clientToken -> visitor cap never checked", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    await callPost(VALID_BODY);
    expect(mockCheckAndIncrement).toHaveBeenCalledTimes(3);
    expect(mockCheckAndIncrement.mock.calls[0][2]).toEqual({ scope: "adopt-box", id: BOX_ID });
  });

  test("visitor rate limit exceeded -> 429 rate_limit_visitor", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    mockCheckAndIncrement.mockResolvedValueOnce(false);
    const res = await callPost({ ...VALID_BODY, clientToken: "abc" });
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limit_visitor");
  });

  test("box rate limit exceeded -> 429 rate_limit_box", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    mockCheckAndIncrement.mockResolvedValueOnce(false);
    const res = await callPost(VALID_BODY);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limit_box");
  });

  test("email-target rate limit exceeded -> 429 rate_limit_email", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    mockCheckAndIncrement.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const res = await callPost(VALID_BODY);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limit_email");
  });

  test("email-global rate limit exceeded -> 429 rate_limit_global", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    mockCheckAndIncrement.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const res = await callPost(VALID_BODY);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limit_global");
  });

  test("missing displayName -> 422", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    const res = await callPost({ email: "a@example.com", turnstileToken: "t" });
    expect(res.status).toBe(422);
  });

  test("displayName over the length cap -> 422", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    const res = await callPost({ ...VALID_BODY, displayName: "x".repeat(61) });
    expect(res.status).toBe(422);
  });

  test("invalid email -> 422", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    const res = await callPost({ ...VALID_BODY, email: "not-an-email" });
    expect(res.status).toBe(422);
  });

  test("note over the length cap -> 422, never reaches D1 insert", async () => {
    const { db, insertCalls } = makeFakeDb();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost({ ...VALID_BODY, note: "x".repeat(281) });
    expect(res.status).toBe(422);
    expect(insertCalls).toHaveLength(0);
  });

  test("unknown/archived box id -> 404", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb({ boxRow: null }).db } });
    const res = await callPost(VALID_BODY);
    expect(res.status).toBe(404);
  });

  test("success -> inserts a pending application and sends a confirm email to the applicant", async () => {
    const { db, insertCalls } = makeFakeDb();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost(VALID_BODY);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].slice(0, 3)).toEqual([BOX_ID, "The Martinez Family", "adopter@example.com"]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const sentBody = JSON.parse((init as RequestInit).body as string);
    expect(sentBody.to).toEqual(["adopter@example.com"]);
    expect(sentBody.subject).toContain("Test Blessing Box");
  });

  test("D1 insert failure -> 502 db_write_failed, no email sent", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb({ insertShouldThrow: true }).db } });
    const res = await callPost(VALID_BODY);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("db_write_failed");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("Resend failure -> 502 send_failed (fatal, per the task's own spec)", async () => {
    mockFetch.mockResolvedValue(new Response("boom", { status: 500 }));
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    const res = await callPost(VALID_BODY);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("send_failed");
  });

  test("no Cloudflare context available -> 503, never throws", async () => {
    mockGetCloudflareContext.mockImplementation(() => {
      throw new Error("no cloudflare context");
    });
    const res = await callPost(VALID_BODY);
    expect(res.status).toBe(503);
  });
});
