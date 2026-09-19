// @vitest-environment node
/**
 * Route-level tests for POST /api/public/blessing-boxes/[id]/checkins
 * (Blessing Boxes slice 2). Mocks Turnstile verification, the rate limiter,
 * @opennextjs/cloudflare's getCloudflareContext, and a fake D1Database —
 * same layered-mock convention as report/submit/route.test.ts and
 * src/app/api/public/blessing-boxes/route.test.ts.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mockVerifyTurnstileToken = vi.fn();
vi.mock("@/lib/turnstile", () => ({
  verifyTurnstileToken: (...args: unknown[]) => mockVerifyTurnstileToken(...args),
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

const mockNotifyBoxAlerts = vi.fn();
vi.mock("@/lib/boxAlerts", () => ({
  notifyBoxAlerts: (...args: unknown[]) => mockNotifyBoxAlerts(...args),
}));

import { POST } from "@/app/api/public/blessing-boxes/[id]/checkins/route";

const BOX_ID = "plentiful-blessing-box-216-w-routt-plentiful-1454";

interface FakeDbOptions {
  boxRow?: { id: string; removed_on: string | null } | null;
  checkinRows?: { kind: string; visibility: string; created_at: string }[];
  insertShouldThrow?: boolean;
}

function makeFakeDb(opts: FakeDbOptions = {}) {
  const { boxRow = { id: BOX_ID, removed_on: null }, checkinRows = [], insertShouldThrow = false } = opts;
  const insertCalls: unknown[][] = [];

  const prepare = (sql: string) => {
    if (sql.includes("JOIN blessing_boxes")) {
      return { bind: (...args: unknown[]) => ({ first: async () => (args[0] === BOX_ID ? boxRow : null) }) };
    }
    if (sql.includes("INSERT INTO box_checkins")) {
      return {
        bind: (...args: unknown[]) => ({
          run: async () => {
            if (insertShouldThrow) throw new Error("insert failed");
            insertCalls.push(args);
            return { success: true, meta: { last_row_id: 42 } };
          },
        }),
      };
    }
    if (sql.includes("SELECT name FROM venues")) {
      return { bind: () => ({ first: async () => ({ name: "216 W Routt Blessing Box" }) }) };
    }
    if (sql.includes("FROM box_checkins")) {
      return { bind: () => ({ all: async () => ({ results: checkinRows }) }) };
    }
    throw new Error("unexpected SQL in fake db: " + sql);
  };

  return { db: { prepare } as unknown as D1Database, insertCalls };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(`https://pueblofoodmap.com/api/public/blessing-boxes/${BOX_ID}/checkins`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function callPost(body: unknown, id: string = BOX_ID) {
  return POST(makeRequest(body), { params: Promise.resolve({ id }) });
}

describe("POST /api/public/blessing-boxes/[id]/checkins", () => {
  const originalCaches = (globalThis as { caches?: unknown }).caches;
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockVerifyTurnstileToken.mockReset();
    mockCheckAndIncrement.mockReset();
    mockGetCloudflareContext.mockReset();
    mockFetch.mockReset();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    delete (globalThis as { caches?: unknown }).caches;

    process.env.TURNSTILE_BOX_SECRET_KEY = "test-secret";
    process.env.CHECKIN_RATE_LIMIT_SECRET = "test-rate-limit-secret";
    process.env.RESEND_API_KEY = "test-resend-key";

    mockVerifyTurnstileToken.mockResolvedValue(true);
    mockCheckAndIncrement.mockResolvedValue(true);
    mockNotifyBoxAlerts.mockReset();
    mockNotifyBoxAlerts.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    (globalThis as { caches?: unknown }).caches = originalCaches;
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  test("non-JSON content-type -> 400", async () => {
    const req = new NextRequest(`https://pueblofoodmap.com/api/public/blessing-boxes/${BOX_ID}/checkins`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "hi",
    });
    const res = await POST(req, { params: Promise.resolve({ id: BOX_ID }) });
    expect(res.status).toBe(400);
  });

  test("Turnstile rejection -> 400, never reaches D1", async () => {
    mockVerifyTurnstileToken.mockResolvedValue(false);
    const res = await callPost({ kind: "took", turnstileToken: "bad" });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("turnstile_failed");
    expect(mockGetCloudflareContext).not.toHaveBeenCalled();
  });

  test("honeypot filled -> 200 ok (bots think it worked), never reaches D1", async () => {
    const res = await callPost({ kind: "took", turnstileToken: "t", website: "http://spam.example" });
    expect(res.status).toBe(200);
    expect(mockGetCloudflareContext).not.toHaveBeenCalled();
  });

  test("box rate limit exceeded (no clientToken, so only the box cap runs) -> 429 rate_limit_box", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    mockCheckAndIncrement.mockResolvedValueOnce(false); // box cap fails (only check that runs)
    const res = await callPost({ kind: "took", turnstileToken: "t" });
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toBe("rate_limit_box");
  });

  test("per-visitor-per-box rate limit exceeded -> 429 rate_limit_visitor, box counter never touched", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    mockCheckAndIncrement.mockResolvedValueOnce(false); // visitor cap fails FIRST
    const res = await callPost({ kind: "took", turnstileToken: "t", clientToken: "abc-123" });
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toBe("rate_limit_visitor");
    // 2026-09-17 review correction (item 1): the visitor check must run and
    // reject BEFORE the box counter is ever touched, so an over-tapping
    // visitor never burns the shared box-wide budget on their own rejected
    // attempts.
    expect(mockCheckAndIncrement).toHaveBeenCalledTimes(1);
    expect(mockCheckAndIncrement.mock.calls[0][2]).toEqual({ scope: "visitor-box", id: "abc-123:" + BOX_ID });
  });

  test("clientToken present and under cap -> visitor check runs first, then box check", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    mockCheckAndIncrement.mockResolvedValueOnce(true).mockResolvedValueOnce(true);
    const res = await callPost({ kind: "took", turnstileToken: "t", clientToken: "abc-123" });
    expect(res.status).toBe(200);
    expect(mockCheckAndIncrement).toHaveBeenCalledTimes(2);
    expect(mockCheckAndIncrement.mock.calls[0][2]).toEqual({ scope: "visitor-box", id: "abc-123:" + BOX_ID });
    expect(mockCheckAndIncrement.mock.calls[1][2]).toEqual({ scope: "box", id: BOX_ID });
  });

  test("no clientToken -> only the box cap is checked, never a visitor cap", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    await callPost({ kind: "took", turnstileToken: "t" });
    expect(mockCheckAndIncrement).toHaveBeenCalledTimes(1);
    expect(mockCheckAndIncrement.mock.calls[0][2]).toEqual({ scope: "box", id: BOX_ID });
  });

  test("rate-limit checks use CHECKIN_RATE_LIMIT_SECRET, not TURNSTILE_SECRET_KEY", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    await callPost({ kind: "took", turnstileToken: "t" });
    expect(mockCheckAndIncrement.mock.calls[0][1]).toBe("test-rate-limit-secret");
  });

  test("CHECKIN_RATE_LIMIT_SECRET missing -> throws, never reaches D1", async () => {
    delete process.env.CHECKIN_RATE_LIMIT_SECRET;
    await expect(callPost({ kind: "took", turnstileToken: "t" })).rejects.toThrow(
      "CHECKIN_RATE_LIMIT_SECRET not configured",
    );
    expect(mockGetCloudflareContext).not.toHaveBeenCalled();
  });

  test("TURNSTILE_BOX_SECRET_KEY missing -> throws, never verifies Turnstile", async () => {
    delete process.env.TURNSTILE_BOX_SECRET_KEY;
    await expect(callPost({ kind: "took", turnstileToken: "t" })).rejects.toThrow(
      "TURNSTILE_BOX_SECRET_KEY not configured",
    );
    expect(mockVerifyTurnstileToken).not.toHaveBeenCalled();
  });

  test("Turnstile verification is checked against TURNSTILE_BOX_SECRET_KEY, not TURNSTILE_SECRET_KEY", async () => {
    delete process.env.TURNSTILE_SECRET_KEY; // the managed-mode secret the other 3 forms use — must be irrelevant here
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    const res = await callPost({ kind: "took", turnstileToken: "t" });
    expect(res.status).toBe(200);
    expect(mockVerifyTurnstileToken).toHaveBeenCalledWith("t", "test-secret", expect.any(String));
  });

  // ─── Fallback to a visible checkbox (BoxCheckinPanel.tsx follow-up,
  // 2026-09-18) — turnstileKey: "fallback" picks TURNSTILE_SECRET_KEY, the
  // ordinary managed-mode secret every other public form already verifies
  // against, instead of the dedicated TURNSTILE_BOX_SECRET_KEY. ───────────
  describe("turnstileKey — which secret gets verified against", () => {
    test("turnstileKey: 'fallback' verifies against TURNSTILE_SECRET_KEY, not TURNSTILE_BOX_SECRET_KEY", async () => {
      process.env.TURNSTILE_SECRET_KEY = "test-managed-secret";
      mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
      const res = await callPost({ kind: "took", turnstileToken: "t", turnstileKey: "fallback" });
      expect(res.status).toBe(200);
      expect(mockVerifyTurnstileToken).toHaveBeenCalledWith("t", "test-managed-secret", expect.any(String));
    });

    test("turnstileKey: 'fallback' with TURNSTILE_SECRET_KEY missing -> throws, never verifies", async () => {
      delete process.env.TURNSTILE_SECRET_KEY;
      await expect(
        callPost({ kind: "took", turnstileToken: "t", turnstileKey: "fallback" }),
      ).rejects.toThrow("TURNSTILE_SECRET_KEY not configured");
      expect(mockVerifyTurnstileToken).not.toHaveBeenCalled();
    });

    test("turnstileKey missing -> verifies against TURNSTILE_BOX_SECRET_KEY (the original default)", async () => {
      mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
      const res = await callPost({ kind: "took", turnstileToken: "t" });
      expect(res.status).toBe(200);
      expect(mockVerifyTurnstileToken).toHaveBeenCalledWith("t", "test-secret", expect.any(String));
    });

    test("an unrecognized turnstileKey value is treated as 'box', never as 'fallback'", async () => {
      process.env.TURNSTILE_SECRET_KEY = "test-managed-secret";
      mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
      const res = await callPost({ kind: "took", turnstileToken: "t", turnstileKey: "tampered-value" });
      expect(res.status).toBe(200);
      expect(mockVerifyTurnstileToken).toHaveBeenCalledWith("t", "test-secret", expect.any(String));
    });
  });

  test("invalid kind -> 422", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    const res = await callPost({ kind: "not-a-real-kind", turnstileToken: "t" });
    expect(res.status).toBe(422);
  });

  test("unknown/archived box id -> 404", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb({ boxRow: null }).db } });
    const res = await callPost({ kind: "took", turnstileToken: "t" });
    expect(res.status).toBe(404);
  });

  test("'took' with no note -> succeeds, note stored as null", async () => {
    const { db, insertCalls } = makeFakeDb();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost({ kind: "took", turnstileToken: "t" });
    expect(res.status).toBe(200);
    expect(insertCalls[0]).toEqual([BOX_ID, "took", null]);
  });

  test("a note sent on 'took' (not filled/problem) is silently dropped, not rejected", async () => {
    const { db, insertCalls } = makeFakeDb();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost({ kind: "took", note: "should be ignored", turnstileToken: "t" });
    expect(res.status).toBe(200);
    expect(insertCalls[0]).toEqual([BOX_ID, "took", null]);
  });

  test("'filled' with a note within the length cap -> stored", async () => {
    const { db, insertCalls } = makeFakeDb();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost({ kind: "filled", note: "Topped it off with canned soup", turnstileToken: "t" });
    expect(res.status).toBe(200);
    expect(insertCalls[0]).toEqual([BOX_ID, "filled", "Topped it off with canned soup"]);
  });

  test("a note over the length cap -> 422, never reaches D1 insert", async () => {
    const { db, insertCalls } = makeFakeDb();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost({ kind: "filled", note: "x".repeat(281), turnstileToken: "t" });
    expect(res.status).toBe(422);
    expect(insertCalls).toHaveLength(0);
  });

  test("D1 insert failure -> 502, logged, never throws", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb({ insertShouldThrow: true }).db } });
    const res = await callPost({ kind: "took", turnstileToken: "t" });
    expect(res.status).toBe(502);
  });

  test("'problem' check-in sends a Resend email to issues@pueblofoodmap.com", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    const { db } = makeFakeDb();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost({ kind: "problem", note: "Door is broken", turnstileToken: "t" });
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const sentBody = JSON.parse((init as RequestInit).body as string);
    expect(sentBody.to).toEqual(["issues@pueblofoodmap.com"]);
    expect(sentBody.text).toContain("Door is broken");
  });

  test("a failed problem-report email does not fail the check-in itself", async () => {
    mockFetch.mockResolvedValue(new Response("boom", { status: 500 }));
    const { db, insertCalls } = makeFakeDb();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost({ kind: "problem", note: "Door is broken", turnstileToken: "t" });
    expect(res.status).toBe(200);
    expect(insertCalls).toHaveLength(1);
  });

  test("a non-'problem' check-in never sends an email", async () => {
    const { db } = makeFakeDb();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    await callPost({ kind: "filled", turnstileToken: "t" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("success response carries the box's freshly computed status and lastFilledAt", async () => {
    const now = new Date();
    const { db } = makeFakeDb({
      checkinRows: [{ kind: "filled", visibility: "visible", created_at: now.toISOString() }],
    });
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost({ kind: "filled", turnstileToken: "t" });
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.status).toBe("stocked");
    expect(data.lastFilledAt).toBe(now.toISOString());
  });

  // ─── Slice 5 (photos): the response returns the new check-in's id so a
  // photo can be attached to it in a follow-up request. ───────────────────
  test("success response carries the new check-in's id (from D1's meta.last_row_id)", async () => {
    const { db } = makeFakeDb();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost({ kind: "took", turnstileToken: "t" });
    const data = await res.json();
    expect(data.checkinId).toBe(42);
  });

  test("checkinId is null when D1 doesn't hand back a usable last_row_id (defensive, never a crash)", async () => {
    const prepare = (sql: string) => {
      if (sql.includes("JOIN blessing_boxes")) {
        return { bind: () => ({ first: async () => ({ id: BOX_ID, removed_on: null }) }) };
      }
      if (sql.includes("INSERT INTO box_checkins")) {
        return { bind: () => ({ run: async () => ({ success: true }) }) }; // no meta at all
      }
      return { bind: () => ({ all: async () => ({ results: [] }) }) };
    };
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: { prepare } as unknown as D1Database } });
    const res = await callPost({ kind: "took", turnstileToken: "t" });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.checkinId).toBeNull();
  });

  test("a box with a non-null removed_on -> response status is out_of_service", async () => {
    const { db } = makeFakeDb({ boxRow: { id: BOX_ID, removed_on: "2026-09-10" } });
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost({ kind: "took", turnstileToken: "t" });
    const data = await res.json();
    expect(data.status).toBe("out_of_service");
  });

  test("on success, deletes the list endpoint's cache entry for the current colo", async () => {
    const del = vi.fn().mockResolvedValue(true);
    (globalThis as { caches?: CacheStorage }).caches = { default: { delete: del } as unknown as Cache } as unknown as CacheStorage;
    const { db } = makeFakeDb();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    await callPost({ kind: "took", turnstileToken: "t" });
    expect(del).toHaveBeenCalledTimes(1);
    const deletedRequest = del.mock.calls[0][0] as Request;
    expect(deletedRequest.url).toBe("https://pueblofoodmap.com/api/public/blessing-boxes");
  });

  test("no caches global -> still succeeds, degrades to no cache bust", async () => {
    delete (globalThis as { caches?: unknown }).caches;
    const { db } = makeFakeDb();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await callPost({ kind: "took", turnstileToken: "t" });
    expect(res.status).toBe(200);
  });

  test("no Cloudflare context available -> 503, never throws", async () => {
    mockGetCloudflareContext.mockImplementation(() => {
      throw new Error("no cloudflare context");
    });
    const res = await callPost({ kind: "took", turnstileToken: "t" });
    expect(res.status).toBe(503);
  });

  // ─── Slice 6 (alerts): notifyBoxAlerts wiring — see boxAlerts.ts's own
  // header for who-gets-what; this route's own job is only to compute
  // prevStatus correctly and never let a failure here affect the response. ──
  describe("slice 6 — notifyBoxAlerts wiring", () => {
    test("'filled'/'took' never compute a prevStatus read — no extra box_checkins query beyond the response's own", async () => {
      const { db } = makeFakeDb();
      const waitUntil = vi.fn((p: Promise<unknown>) => p);
      mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db }, ctx: { waitUntil } });
      await callPost({ kind: "filled", turnstileToken: "t" });
      expect(mockNotifyBoxAlerts).toHaveBeenCalledTimes(1);
      expect(mockNotifyBoxAlerts.mock.calls[0][1]).toMatchObject({ kind: "filled", prevStatus: null });
    });

    test("'empty' check-in with no prior status-setting check-ins -> prevStatus computed as 'unknown', not null", async () => {
      const { db } = makeFakeDb({ checkinRows: [] });
      const waitUntil = vi.fn((p: Promise<unknown>) => p);
      mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db }, ctx: { waitUntil } });
      await callPost({ kind: "empty", turnstileToken: "t" });
      expect(mockNotifyBoxAlerts).toHaveBeenCalledTimes(1);
      const [, input] = mockNotifyBoxAlerts.mock.calls[0];
      expect(input).toMatchObject({ venueId: BOX_ID, kind: "empty", prevStatus: "unknown" });
      expect(input.origin).toBe("https://pueblofoodmap.com");
    });

    test("'low' check-in already low (a prior visible 'low' check-in) -> prevStatus computed as 'low'", async () => {
      const priorLow = new Date().toISOString();
      const { db } = makeFakeDb({ checkinRows: [{ kind: "low", visibility: "visible", created_at: priorLow }] });
      const waitUntil = vi.fn((p: Promise<unknown>) => p);
      mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db }, ctx: { waitUntil } });
      await callPost({ kind: "low", turnstileToken: "t" });
      expect(mockNotifyBoxAlerts.mock.calls[0][1]).toMatchObject({ kind: "low", prevStatus: "low" });
    });

    // 2026-09-18 security review, item 10: the prevStatus pre-read must
    // never fail the check-in itself. This fake throws ONLY on the FIRST
    // box_checkins SELECT (the prevStatus pre-read, before the insert) —
    // the SECOND (the post-insert response computation, unguarded, out of
    // item 10's scope — see this file's Surprises in the handoff report)
    // still succeeds normally, proving the check-in completes end to end.
    test("prevStatus pre-read throwing -> treated as unknown, check-in still succeeds (item 10)", async () => {
      const { db: baseDb } = makeFakeDb({ checkinRows: [] });
      let selectCount = 0;
      const db = {
        prepare: (sql: string) => {
          if (sql.includes("FROM box_checkins") && !sql.includes("INSERT")) {
            selectCount += 1;
            if (selectCount === 1) {
              return { bind: () => ({ all: async () => { throw new Error("D1 outage"); } }) };
            }
          }
          return baseDb.prepare(sql);
        },
      } as unknown as D1Database;
      const waitUntil = vi.fn((p: Promise<unknown>) => p);
      mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db }, ctx: { waitUntil } });

      const res = await callPost({ kind: "empty", turnstileToken: "t" });
      expect(res.status).toBe(200);
      expect((await res.clone().json()).ok).toBe(true);
      // rolesToNotify treats null the same as "not already this status" —
      // an alert still fires, just without a known prior status.
      expect(mockNotifyBoxAlerts.mock.calls[0][1]).toMatchObject({ kind: "empty", prevStatus: null });
    });

    test("dispatched via ctx.waitUntil() when a live ExecutionContext is present", async () => {
      const { db } = makeFakeDb();
      const waitUntil = vi.fn((p: Promise<unknown>) => p);
      mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db }, ctx: { waitUntil } });
      const res = await callPost({ kind: "empty", turnstileToken: "t" });
      expect(res.status).toBe(200);
      expect(waitUntil).toHaveBeenCalledTimes(1);
    });

    test("no ctx.waitUntil available (e.g. local dev) -> still succeeds, alert dispatch degrades silently", async () => {
      const { db } = makeFakeDb();
      mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } }); // no ctx at all
      const res = await callPost({ kind: "empty", turnstileToken: "t" });
      expect(res.status).toBe(200);
      expect(mockNotifyBoxAlerts).toHaveBeenCalledTimes(1);
    });

    test("notifyBoxAlerts rejecting never fails or slows the check-in response", async () => {
      mockNotifyBoxAlerts.mockRejectedValue(new Error("Resend outage"));
      const { db } = makeFakeDb();
      const waitUntil = vi.fn((p: Promise<unknown>) => p);
      mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db }, ctx: { waitUntil } });
      const res = await callPost({ kind: "empty", turnstileToken: "t" });
      expect(res.status).toBe(200);
      // The rejection is awaited here only so the test can assert it never
      // threw past the route — the route itself never awaits this promise.
      await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
    });
  });
});
