// @vitest-environment node
/**
 * Route-level tests for POST /api/public/blessing-boxes/[id]/needs
 * (migration 0012, "What would help you next time?" ask). Same layered-mock
 * convention as the checkins route's own tests — mocks Turnstile
 * verification, the rate limiter, @opennextjs/cloudflare's
 * getCloudflareContext, and a fake D1Database.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mockVerifyTurnstileToken = vi.fn();
vi.mock("@/lib/turnstile", () => ({
  verifyTurnstileToken: (...args: unknown[]) => mockVerifyTurnstileToken(...args),
}));

const mockCheckAndIncrement = vi.fn();
// hmacHex is real (not mocked) — src/lib/boxNeedsToken.ts needs it to mint
// the SAME token this test computes independently to prove ownership.
vi.mock("@/lib/checkinRateLimit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/checkinRateLimit")>();
  return { ...actual, checkAndIncrement: (...args: unknown[]) => mockCheckAndIncrement(...args) };
});

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

import { POST } from "@/app/api/public/blessing-boxes/[id]/needs/route";
import { computeNeedsToken } from "@/lib/boxNeedsToken";

const BOX_ID = "plentiful-blessing-box-216-w-routt-plentiful-1454";
const SECRET = "test-rate-limit-secret";
const CHECKIN_ID = 42;
const NOW_ISO = "2026-09-19T12:00:00.000Z";

interface FakeDbOptions {
  /** Simulates the UPDATE's WHERE clause: how many rows it would match. */
  matchedRows?: number;
  updateShouldThrow?: boolean;
}

function makeFakeDb(opts: FakeDbOptions = {}) {
  const { matchedRows = 1, updateShouldThrow = false } = opts;
  const updateCalls: unknown[][] = [];
  let updateSql = "";
  const prepare = (sql: string) => {
    if (sql.includes("UPDATE box_checkins")) {
      updateSql = sql;
      return {
        bind: (...args: unknown[]) => ({
          run: async () => {
            if (updateShouldThrow) throw new Error("update failed");
            updateCalls.push(args);
            return { success: true, meta: { changes: matchedRows } };
          },
        }),
      };
    }
    throw new Error("unexpected SQL in fake db: " + sql);
  };
  // getUpdateSql() reads AFTER the route calls prepare() — a plain string
  // captured at makeFakeDb() call time would always be empty.
  return { db: { prepare } as unknown as D1Database, updateCalls, getUpdateSql: () => updateSql };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(`https://pueblofoodmap.com/api/public/blessing-boxes/${BOX_ID}/needs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function callPost(body: unknown, id: string = BOX_ID) {
  return POST(makeRequest(body), { params: Promise.resolve({ id }) });
}

async function validBody(overrides: Record<string, unknown> = {}) {
  const clientToken = "clientToken" in overrides ? (overrides.clientToken as string | null) : "client-abc";
  const checkinId = "checkinId" in overrides ? (overrides.checkinId as number) : CHECKIN_ID;
  // Reviewer fix pass (2026-09-19) — must be computed from the SAME
  // checkinId/clientToken this body actually sends, not a hardcoded pair:
  // the route now verifies this HMAC before anything else, so a stale
  // computation here (e.g. a test overriding clientToken to undefined) was
  // silently failing ownership verification instead of testing what its own
  // name claimed.
  const needsToken = await computeNeedsToken(SECRET, checkinId, clientToken ?? null);
  return {
    checkinId,
    needsToken,
    needs: ["canned_food", "diapers"],
    turnstileToken: "t",
    clientToken,
    ...overrides,
  };
}

describe("POST /api/public/blessing-boxes/[id]/needs", () => {
  const originalCaches = (globalThis as { caches?: unknown }).caches;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockVerifyTurnstileToken.mockReset();
    mockCheckAndIncrement.mockReset();
    mockGetCloudflareContext.mockReset();
    delete (globalThis as { caches?: unknown }).caches;

    process.env.TURNSTILE_BOX_SECRET_KEY = "test-secret";
    process.env.CHECKIN_RATE_LIMIT_SECRET = SECRET;

    mockVerifyTurnstileToken.mockResolvedValue(true);
    mockCheckAndIncrement.mockResolvedValue(true);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_ISO));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    (globalThis as { caches?: unknown }).caches = originalCaches;
    process.env = { ...originalEnv };
  });

  test("non-JSON content-type -> 400", async () => {
    const req = new NextRequest(`https://pueblofoodmap.com/api/public/blessing-boxes/${BOX_ID}/needs`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "hi",
    });
    const res = await POST(req, { params: Promise.resolve({ id: BOX_ID }) });
    expect(res.status).toBe(400);
  });

  test("Turnstile rejection -> 400, never reaches D1", async () => {
    mockVerifyTurnstileToken.mockResolvedValue(false);
    const res = await callPost(await validBody());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("turnstile_failed");
    expect(mockGetCloudflareContext).not.toHaveBeenCalled();
  });

  test("honeypot filled -> 200 ok (bots think it worked), never reaches D1", async () => {
    const res = await callPost(await validBody({ website: "http://spam.example" }));
    expect(res.status).toBe(200);
    expect(mockGetCloudflareContext).not.toHaveBeenCalled();
  });

  test("box rate limit exceeded -> 429 rate_limit_box", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    mockCheckAndIncrement.mockResolvedValueOnce(true).mockResolvedValueOnce(false); // visitor cap passes, box cap fails
    const res = await callPost(await validBody());
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limit_box");
  });

  test("per-visitor rate limit exceeded -> 429 rate_limit_visitor, checked BEFORE the box cap", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    mockCheckAndIncrement.mockResolvedValueOnce(false);
    const res = await callPost(await validBody());
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limit_visitor");
    expect(mockCheckAndIncrement).toHaveBeenCalledTimes(1);
    expect(mockCheckAndIncrement.mock.calls[0][2]).toEqual({ scope: "needs-visitor-box", id: "client-abc:" + BOX_ID });
  });

  test("rate limit scopes are 'needs-visitor-box' then 'needs-box', independent of checkins'/photos' own scopes", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    await callPost(await validBody());
    expect(mockCheckAndIncrement).toHaveBeenCalledTimes(2);
    expect(mockCheckAndIncrement.mock.calls[0][2]).toEqual({ scope: "needs-visitor-box", id: "client-abc:" + BOX_ID });
    expect(mockCheckAndIncrement.mock.calls[1][2]).toEqual({ scope: "needs-box", id: BOX_ID });
  });

  test("no clientToken -> only the box cap is checked, never a visitor cap", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    await callPost(await validBody({ clientToken: undefined }));
    expect(mockCheckAndIncrement).toHaveBeenCalledTimes(1);
    expect(mockCheckAndIncrement.mock.calls[0][2]).toEqual({ scope: "needs-box", id: BOX_ID });
  });

  test("invalid checkinId (missing/non-integer) -> 422", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    const res1 = await callPost(await validBody({ checkinId: undefined }));
    expect(res1.status).toBe(422);
    const res2 = await callPost(await validBody({ checkinId: 1.5 }));
    expect(res2.status).toBe(422);
    const res3 = await callPost(await validBody({ checkinId: -1 }));
    expect(res3.status).toBe(422);
  });

  test("missing/empty needsToken -> 422", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    const res1 = await callPost(await validBody({ needsToken: undefined }));
    expect(res1.status).toBe(422);
    const res2 = await callPost(await validBody({ needsToken: "" }));
    expect(res2.status).toBe(422);
  });

  test("an unknown need key -> 400", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    const res = await callPost(await validBody({ needs: ["canned_food", "not-a-real-key"] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_need_key");
  });

  test("needs omitted entirely -> ok (typed-text-only case)", async () => {
    const { db, updateCalls } = makeFakeDb();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost(await validBody({ needs: undefined, note: "Just diapers please" }));
    expect(res.status).toBe(200);
    expect(updateCalls[0]?.[0]).toBeNull(); // needsJson is null when no keys picked
  });

  test("a note over the length cap -> 422, never reaches the UPDATE", async () => {
    const { db, updateCalls } = makeFakeDb();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost(await validBody({ note: "x".repeat(281) }));
    expect(res.status).toBe(422);
    expect(updateCalls).toHaveLength(0);
  });

  test("a mismatched needsToken (wrong device / tampered) -> 403, never reaches the UPDATE", async () => {
    const { db, updateCalls } = makeFakeDb();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost(await validBody({ needsToken: "0".repeat(64) }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("invalid_needs_token");
    expect(updateCalls).toHaveLength(0);
  });

  // Reviewer fix pass (2026-09-19) — checkinId/needsToken shape validation
  // and the HMAC ownership check now run BEFORE rate limiting (both are
  // pure compute, no D1 write of their own), so a garbage/forged request
  // can never burn the box's shared 300/hr needs budget or cost D1 the
  // read+write checkAndIncrement itself does.
  test("a bad needsToken is rejected WITHOUT ever touching the rate limiter or Cloudflare context", async () => {
    const res = await callPost(await validBody({ needsToken: "0".repeat(64) }));
    expect(res.status).toBe(403);
    expect(mockCheckAndIncrement).not.toHaveBeenCalled();
    expect(mockGetCloudflareContext).not.toHaveBeenCalled();
  });

  test("an invalid checkinId is rejected WITHOUT ever touching the rate limiter or Cloudflare context", async () => {
    const res = await callPost(await validBody({ checkinId: -1 }));
    expect(res.status).toBe(422);
    expect(mockCheckAndIncrement).not.toHaveBeenCalled();
    expect(mockGetCloudflareContext).not.toHaveBeenCalled();
  });

  test("a needsToken computed with the wrong clientToken -> 403 (proves the token is bound to the exact clientToken used at mint time)", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    const wrongToken = await computeNeedsToken(SECRET, CHECKIN_ID, "someone-elses-client-token");
    const res = await callPost(await validBody({ needsToken: wrongToken }));
    expect(res.status).toBe(403);
  });

  test("a valid request updates needs (JSON array, canonical order) and note on the matched row", async () => {
    const { db, updateCalls } = makeFakeDb();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost(await validBody({ needs: ["diapers", "canned_food"], note: "Extra formula too" }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    const [needsJson, note, checkinId, venueId] = updateCalls[0] as [string, string, number, string];
    expect(JSON.parse(needsJson)).toEqual(["canned_food", "diapers"]); // canonical order, not submission order
    expect(note).toBe("Extra formula too");
    expect(checkinId).toBe(CHECKIN_ID);
    expect(venueId).toBe(BOX_ID);
  });

  test("the UPDATE's window bind is 15 minutes before now", async () => {
    const { db, updateCalls } = makeFakeDb();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    await callPost(await validBody());
    const cutoff = updateCalls[0]?.[4] as string;
    expect(cutoff).toBe(new Date(new Date(NOW_ISO).getTime() - 15 * 60 * 1000).toISOString());
  });

  test("0 rows matched (unknown checkinId, wrong box, wrong kind, or expired window) -> 404", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb({ matchedRows: 0 }).db } });
    const res = await callPost(await validBody());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("not_found_or_expired");
  });

  // Reviewer fix pass (2026-09-19) — an admin hiding a 'took' row
  // (BoxCheckinsAdminPanel) must close the needs-attach window on it too,
  // not just the 15-minute timer: the SAME device could otherwise rewrite
  // a moderated-away row's needs/note behind the admin's back.
  test("an admin-hidden row reads identically to not-found — the guarded UPDATE requires visibility = 'visible'", async () => {
    const { db, getUpdateSql } = makeFakeDb({ matchedRows: 0 }); // hidden row -> WHERE excludes it -> 0 changes
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost(await validBody());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("not_found_or_expired");
    expect(getUpdateSql()).toContain("visibility = 'visible'");
  });

  test("D1 update failure -> 502, never throws", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb({ updateShouldThrow: true }).db } });
    const res = await callPost(await validBody());
    expect(res.status).toBe(502);
  });

  test("on success, deletes the list endpoint's cache entry for the current colo", async () => {
    const del = vi.fn().mockResolvedValue(true);
    (globalThis as { caches?: CacheStorage }).caches = { default: { delete: del } as unknown as Cache } as unknown as CacheStorage;
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    await callPost(await validBody());
    expect(del).toHaveBeenCalledTimes(1);
  });

  test("CHECKIN_RATE_LIMIT_SECRET missing -> throws, never reaches D1", async () => {
    delete process.env.CHECKIN_RATE_LIMIT_SECRET;
    await expect(callPost(await validBody())).rejects.toThrow("CHECKIN_RATE_LIMIT_SECRET not configured");
    expect(mockGetCloudflareContext).not.toHaveBeenCalled();
  });

  test("no Cloudflare context available -> 503, never throws", async () => {
    mockGetCloudflareContext.mockImplementation(() => {
      throw new Error("no cloudflare context");
    });
    const res = await callPost(await validBody());
    expect(res.status).toBe(503);
  });
});
