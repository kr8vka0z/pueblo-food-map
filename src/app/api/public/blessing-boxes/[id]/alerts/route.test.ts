// @vitest-environment node
/**
 * Route-level tests for POST /api/public/blessing-boxes/[id]/alerts (the
 * giver alert sign-up route, Blessing Boxes slice 6). Same layered-mock
 * convention as the adopt route's own tests (that file's header) — mocks
 * src/lib/boxTurnstile, src/lib/checkinRateLimit, @opennextjs/cloudflare,
 * global fetch (Resend), and a fake D1Database.
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

import { POST } from "@/app/api/public/blessing-boxes/[id]/alerts/route";

const BOX_ID = "test-box-1";

interface FakeDbOptions {
  boxRow?: { id: string; name: string } | null;
  existingGiver?: { id: number; confirmed_at: string | null; unsubscribed_at: string | null } | null;
  upsertShouldThrow?: boolean;
}

function makeFakeDb(opts: FakeDbOptions = {}) {
  const { boxRow = { id: BOX_ID, name: "Test Blessing Box" }, existingGiver = null, upsertShouldThrow = false } = opts;
  const writeCalls: { sql: string; args: unknown[] }[] = [];

  const prepare = (sql: string) => {
    if (sql.includes("FROM venues WHERE id")) {
      return { bind: (...args: unknown[]) => ({ first: async () => (args[0] === BOX_ID ? boxRow : null) }) };
    }
    if (sql.includes("SELECT id, confirmed_at, unsubscribed_at FROM alert_subscriptions")) {
      return { bind: () => ({ first: async () => existingGiver }) };
    }
    if (sql.startsWith("INSERT INTO alert_subscriptions") || sql.startsWith("UPDATE alert_subscriptions")) {
      return {
        bind: (...args: unknown[]) => ({
          run: async () => {
            if (upsertShouldThrow) throw new Error("upsert failed");
            writeCalls.push({ sql, args });
            return { success: true, meta: { changes: 1 } };
          },
        }),
      };
    }
    throw new Error("unexpected SQL in fake db: " + sql);
  };

  return { db: { prepare } as unknown as D1Database, writeCalls };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(`https://pueblofoodmap.com/api/public/blessing-boxes/${BOX_ID}/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function callPost(body: unknown, id: string = BOX_ID) {
  return POST(makeRequest(body), { params: Promise.resolve({ id }) });
}

const VALID_BODY = { email: "giver@example.com", turnstileToken: "t" };

describe("POST /api/public/blessing-boxes/[id]/alerts", () => {
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
    const req = new NextRequest(`https://pueblofoodmap.com/api/public/blessing-boxes/${BOX_ID}/alerts`, {
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

  test("CHECKIN_RATE_LIMIT_SECRET missing -> throws", async () => {
    delete process.env.CHECKIN_RATE_LIMIT_SECRET;
    await expect(callPost(VALID_BODY)).rejects.toThrow("CHECKIN_RATE_LIMIT_SECRET not configured");
  });

  test("clientToken present -> visitor cap (scope alert-visitor) checked before the shared email caps", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    await callPost({ ...VALID_BODY, clientToken: "abc" });
    expect(mockCheckAndIncrement.mock.calls[0][2]).toEqual({ scope: "alert-visitor", id: `abc:${BOX_ID}` });
    expect(mockCheckAndIncrement.mock.calls[1][2]).toEqual({ scope: "alert-email-target", id: "giver@example.com" });
    expect(mockCheckAndIncrement.mock.calls[2][2]).toEqual({ scope: "alert-email-global", id: "global" });
  });

  test("no clientToken -> visitor cap never checked", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    await callPost(VALID_BODY);
    expect(mockCheckAndIncrement).toHaveBeenCalledTimes(2);
    expect(mockCheckAndIncrement.mock.calls[0][2]).toEqual({ scope: "alert-email-target", id: "giver@example.com" });
  });

  test("visitor rate limit exceeded -> 429 rate_limit_visitor", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    mockCheckAndIncrement.mockResolvedValueOnce(false);
    const res = await callPost({ ...VALID_BODY, clientToken: "abc" });
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limit_visitor");
  });

  test("email-target rate limit exceeded -> 429 rate_limit_email", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    mockCheckAndIncrement.mockResolvedValueOnce(false);
    const res = await callPost(VALID_BODY);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limit_email");
  });

  test("email-global rate limit exceeded -> 429 rate_limit_global", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    mockCheckAndIncrement.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const res = await callPost(VALID_BODY);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limit_global");
  });

  test("invalid email -> 422, never reaches box lookup", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    const res = await callPost({ email: "not-an-email", turnstileToken: "t" });
    expect(res.status).toBe(422);
  });

  test("unknown/archived box id -> 404", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb({ boxRow: null }).db } });
    const res = await callPost(VALID_BODY);
    expect(res.status).toBe(404);
  });

  test("new signup -> inserts an unconfirmed row and sends a confirm email", async () => {
    const { db, writeCalls } = makeFakeDb();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost(VALID_BODY);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(writeCalls).toHaveLength(1);
    expect(writeCalls[0].sql).toContain("INSERT INTO alert_subscriptions");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const sentBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(sentBody.to).toEqual(["giver@example.com"]);
  });

  test("already-confirmed, still-active giver -> noop action, no email sent, still {ok:true}", async () => {
    const { db } = makeFakeDb({ existingGiver: { id: 1, confirmed_at: "2026-01-01T00:00:00Z", unsubscribed_at: null } });
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost(VALID_BODY);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("previously unsubscribed -> reactivate action, sends a fresh confirm email", async () => {
    const { db, writeCalls } = makeFakeDb({
      existingGiver: { id: 1, confirmed_at: "2026-01-01T00:00:00Z", unsubscribed_at: "2026-02-01T00:00:00Z" },
    });
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost(VALID_BODY);
    expect(res.status).toBe(200);
    expect(writeCalls[0].sql).toContain("UPDATE alert_subscriptions");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("Resend failure -> 502 send_failed", async () => {
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
