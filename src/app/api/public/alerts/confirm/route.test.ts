// @vitest-environment node
/**
 * Route-level tests for POST /api/public/alerts/confirm — the shared
 * double-opt-in confirm endpoint for both adopter applications and
 * giver/host subscriptions (Blessing Boxes slice 6, see that route's own
 * header). Fake-D1 convention matching adopt/route.test.ts.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const mockFetch = vi.fn();

import { POST } from "@/app/api/public/alerts/confirm/route";

const OLD_ISO = (daysAgo: number) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

interface FakeDbOptions {
  adopterRow?: Record<string, unknown> | null;
  subscriptionRow?: Record<string, unknown> | null;
  alreadyConfirmedAdopter?: boolean;
  alreadyConfirmedSubscription?: boolean;
}

function makeFakeDb(opts: FakeDbOptions = {}) {
  const { adopterRow = null, subscriptionRow = null, alreadyConfirmedAdopter = false, alreadyConfirmedSubscription = false } = opts;
  const updateCalls: string[] = [];

  const prepare = (sql: string) => {
    if (sql === "SELECT * FROM box_adopters WHERE confirm_token = ?") {
      return { bind: () => ({ first: async () => adopterRow }) };
    }
    if (sql.startsWith("UPDATE box_adopters SET email_confirmed_at")) {
      return {
        bind: () => ({
          run: async () => {
            updateCalls.push("adopter");
            return { success: true, meta: { changes: alreadyConfirmedAdopter ? 0 : 1 } };
          },
        }),
      };
    }
    if (sql.includes("SELECT name FROM venues")) {
      return { bind: () => ({ first: async () => ({ name: "Test Box" }) }) };
    }
    if (sql === "SELECT * FROM alert_subscriptions WHERE confirm_token = ?") {
      return { bind: () => ({ first: async () => subscriptionRow }) };
    }
    if (sql.startsWith("UPDATE alert_subscriptions SET confirmed_at")) {
      return {
        bind: () => ({
          run: async () => {
            updateCalls.push("subscription");
            return { success: true, meta: { changes: alreadyConfirmedSubscription ? 0 : 1 } };
          },
        }),
      };
    }
    throw new Error("unexpected SQL in fake db: " + sql);
  };

  return { db: { prepare } as unknown as D1Database, updateCalls };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("https://pueblofoodmap.com/api/public/alerts/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/public/alerts/confirm", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockGetCloudflareContext.mockReset();
    mockFetch.mockReset();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    process.env.RESEND_API_KEY = "test-resend-key";
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  test("non-JSON content-type -> 400", async () => {
    const req = new NextRequest("https://pueblofoodmap.com/api/public/alerts/confirm", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "hi",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test("missing token -> 200 {ok:false, error:invalid_token}, never reaches D1", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, error: "invalid_token" });
    expect(mockGetCloudflareContext).not.toHaveBeenCalled();
  });

  test("unknown token (neither table has it) -> 200 invalid_token", async () => {
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: makeFakeDb().db } });
    const res = await POST(makeRequest({ token: "no-such-token" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, error: "invalid_token" });
  });

  test("adopter token, within the 7-day window, first confirm -> ok:true, marks confirmed, sends admin notice", async () => {
    const { db, updateCalls } = makeFakeDb({
      adopterRow: {
        id: 1,
        venue_id: "box-1",
        display_name: "The Smiths",
        email: "smiths@example.com",
        note: null,
        created_at: OLD_ISO(1),
      },
    });
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await POST(makeRequest({ token: "adopter-token" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(updateCalls).toEqual(["adopter"]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const sentBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(sentBody.to).toEqual(["issues@pueblofoodmap.com"]);
  });

  test("adopter token, already confirmed (re-click) -> ok:true, no admin notice re-sent", async () => {
    const { db } = makeFakeDb({
      adopterRow: {
        id: 1,
        venue_id: "box-1",
        display_name: "The Smiths",
        email: "smiths@example.com",
        note: null,
        created_at: OLD_ISO(1),
      },
      alreadyConfirmedAdopter: true,
    });
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await POST(makeRequest({ token: "adopter-token" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("adopter token past the 7-day window -> invalid_token, never marks confirmed", async () => {
    const { db, updateCalls } = makeFakeDb({
      adopterRow: { id: 1, venue_id: "box-1", display_name: "x", email: "x@example.com", note: null, created_at: OLD_ISO(8) },
    });
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await POST(makeRequest({ token: "stale-token" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, error: "invalid_token" });
    expect(updateCalls).toHaveLength(0);
  });

  test("a failed admin-notice send does not fail the confirm response", async () => {
    mockFetch.mockResolvedValue(new Response("boom", { status: 500 }));
    const { db } = makeFakeDb({
      adopterRow: { id: 1, venue_id: "box-1", display_name: "x", email: "x@example.com", note: null, created_at: OLD_ISO(1) },
    });
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await POST(makeRequest({ token: "adopter-token" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("subscription token, within window -> ok:true, confirms it", async () => {
    const { db, updateCalls } = makeFakeDb({
      subscriptionRow: { id: 1, role: "giver", venue_id: "box-1", email: "g@example.com", created_at: OLD_ISO(1) },
    });
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await POST(makeRequest({ token: "sub-token" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(updateCalls).toEqual(["subscription"]);
  });

  test("subscription token past the 7-day window -> invalid_token", async () => {
    const { db } = makeFakeDb({
      subscriptionRow: { id: 1, role: "giver", venue_id: "box-1", email: "g@example.com", created_at: OLD_ISO(10) },
    });
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await POST(makeRequest({ token: "sub-token" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, error: "invalid_token" });
  });

  test("no Cloudflare context available -> 503, never throws", async () => {
    mockGetCloudflareContext.mockImplementation(() => {
      throw new Error("no cloudflare context");
    });
    const res = await POST(makeRequest({ token: "any-token" }));
    expect(res.status).toBe(503);
  });

  // 2026-09-18 security review, item 9: a D1 exception on either table's
  // lookup (a transient outage, or "no such table" if migration 0010 hasn't
  // landed on this environment) used to bubble up as an unhandled 500.
  test("D1 error on the adopter/subscription lookup -> 502 db_unavailable, not an unhandled 500 (item 9)", async () => {
    const db = {
      prepare: (sql: string) => {
        if (sql === "SELECT * FROM box_adopters WHERE confirm_token = ?") {
          return { bind: () => ({ first: async () => { throw new Error("no such table: box_adopters"); } }) };
        }
        throw new Error("unexpected SQL in fake db: " + sql);
      },
    } as unknown as D1Database;
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: db } });
    const res = await POST(makeRequest({ token: "any-token" }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("db_unavailable");
  });
});
