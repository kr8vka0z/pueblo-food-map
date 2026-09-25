// @vitest-environment node
/**
 * Route-level tests for /api/admin/blessing-boxes/[id]/host-alerts (Blessing
 * Boxes slice 6). Same full-stack mock pattern as
 * box-adopters/[id]/approve/route.test.ts.
 *
 * 2026-09-18 security review, item 8: the route now batches its write with
 * an audit_log INSERT via db.batch() instead of a plain awaited run() —
 * makeFakeDb's write assertions ("insert"/"update" in `writeCalls`) are
 * rewritten to assert on `batch()` calls instead, per item 8's own
 * instruction authorizing this rewrite.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { AccessDeniedError, ADMIN_ORIGIN } from "@/lib/adminOrigin";

const ADMIN_EMAIL = "admin@pueblofoodmap.com";
const BOX_ID = "test-box-1";

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const mockRequireAdminSession = vi.fn();
vi.mock("@/lib/adminSession", () => ({
  requireAdminSession: (...args: unknown[]) => mockRequireAdminSession(...args),
}));

const mockFetch = vi.fn();

import { DELETE, POST } from "@/app/api/admin/blessing-boxes/[id]/host-alerts/route";

interface FakeDbOptions {
  existingHost?: { id: number; unsubscribed_at: string | null } | null;
  hosts?: { id: number; email: string }[];
}

/** A prepared-but-not-yet-run statement, the shape db.batch() below expects — mirrors what boxAlerts.ts's insertHostSubscriptionStatement/removeHostSubscriptionStatement actually return (a bound D1PreparedStatement, never executed by the lib function itself; see those functions' own headers, item 8). */
function fakeStatement(kind: string, args: unknown[]) {
  return { __kind: kind, __args: args };
}

function makeFakeDb(opts: FakeDbOptions = {}) {
  const { existingHost = null, hosts = [] } = opts;
  const auditInserts: unknown[][] = [];
  const batchCalls: unknown[][] = [];
  const prepare = (sql: string) => {
    if (sql.includes("SELECT id, unsubscribed_at FROM alert_subscriptions")) {
      return { bind: () => ({ first: async () => existingHost }) };
    }
    if (sql.startsWith("INSERT INTO alert_subscriptions")) {
      return { bind: (...args: unknown[]) => fakeStatement("insertHost", args) };
    }
    if (sql.startsWith("UPDATE alert_subscriptions SET unsubscribed_at")) {
      return { bind: (...args: unknown[]) => fakeStatement("removeHost", args) };
    }
    if (sql.startsWith("INSERT INTO audit_log")) {
      return { bind: (...args: unknown[]) => { auditInserts.push(args); return fakeStatement("audit", args); } };
    }
    if (sql.includes("SELECT unsubscribe_token FROM alert_subscriptions")) {
      return { bind: () => ({ first: async () => ({ unsubscribe_token: "the-token" }) }) };
    }
    if (sql.includes("SELECT name FROM venues")) {
      return { bind: () => ({ first: async () => ({ name: "Test Box" }) }) };
    }
    if (sql.includes("SELECT id, email FROM alert_subscriptions")) {
      return { bind: () => ({ all: async () => ({ results: hosts }) }) };
    }
    throw new Error("unexpected SQL in fake db: " + sql);
  };
  const batch = async (statements: unknown[]) => {
    batchCalls.push(statements);
    return statements.map(() => ({ success: true, meta: { changes: 1 } }));
  };
  return { db: { prepare, batch } as unknown as D1Database, auditInserts, batchCalls };
}

function makeRequest(method: "POST" | "DELETE", opts: { origin?: string; body?: unknown } = {}): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.origin !== undefined) headers["Origin"] = opts.origin;
  return new NextRequest(`https://pueblofoodmap.com/api/admin/blessing-boxes/${BOX_ID}/host-alerts`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

describe("/api/admin/blessing-boxes/[id]/host-alerts", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mockGetCloudflareContext.mockReset();
    mockRequireAdminSession.mockReset();
    mockRequireAdminSession.mockResolvedValue({ email: ADMIN_EMAIL });
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    process.env.RESEND_API_KEY = "test-resend-key";
  });

  afterEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = originalFetch;
  });

  test("POST: no Better Auth session -> 401", async () => {
    mockRequireAdminSession.mockRejectedValue(new AccessDeniedError("no_session"));
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: makeFakeDb().db } });
    const res = await POST(makeRequest("POST", { origin: ADMIN_ORIGIN, body: { email: "host@example.com" } }), {
      params: Promise.resolve({ id: BOX_ID }),
    });
    expect(res.status).toBe(401);
  });

  test("POST: wrong Origin -> 403", async () => {
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: makeFakeDb().db } });
    const res = await POST(
      makeRequest("POST", { origin: "https://evil.example.com", body: { email: "host@example.com" } }),
      { params: Promise.resolve({ id: BOX_ID }) },
    );
    expect(res.status).toBe(403);
  });

  test("POST: invalid email -> 422", async () => {
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: makeFakeDb().db } });
    const res = await POST(makeRequest("POST", { origin: ADMIN_ORIGIN, body: { email: "not-an-email" } }), {
      params: Promise.resolve({ id: BOX_ID }),
    });
    expect(res.status).toBe(422);
  });

  test("POST: new host -> added, sends a welcome email, returns the refreshed host list", async () => {
    const { db, batchCalls, auditInserts } = makeFakeDb({ hosts: [{ id: 1, email: "host@example.com" }] });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const res = await POST(makeRequest("POST", { origin: ADMIN_ORIGIN, body: { email: "host@example.com" } }), {
      params: Promise.resolve({ id: BOX_ID }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result).toBe("added");
    expect(data.hosts).toEqual([{ id: 1, email: "host@example.com" }]);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // item 8: the insert and its audit_log row ride the SAME db.batch().
    expect(batchCalls).toHaveLength(1);
    expect((batchCalls[0][0] as { __kind: string }).__kind).toBe("insertHost");
    expect((batchCalls[0][1] as { __kind: string }).__kind).toBe("audit");
    expect(auditInserts).toHaveLength(1);
    const [actorEmail, entity, entityId, action, , afterJson] = auditInserts[0];
    expect(actorEmail).toBe(ADMIN_EMAIL);
    expect(entity).toBe("box_host_alert");
    expect(entityId).toBe(BOX_ID);
    expect(action).toBe("update");
    expect(JSON.parse(afterJson as string)).toEqual({ venue_id: BOX_ID, email: "host@example.com" });
  });

  // Single-language alert emails: the admin's own language pick on the
  // "add a host" panel is stored on the row and used for the welcome email.
  test("POST: lang 'es' is stored on the row and used for the welcome email", async () => {
    const { db } = makeFakeDb({ hosts: [{ id: 1, email: "host@example.com" }] });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const res = await POST(
      makeRequest("POST", { origin: ADMIN_ORIGIN, body: { email: "host@example.com", lang: "es" } }),
      { params: Promise.resolve({ id: BOX_ID }) },
    );
    expect(res.status).toBe(200);
    const sentBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(sentBody.subject).toContain("Ahora recibirás alertas");
  });

  test("POST: missing/garbage lang defaults to 'en' (strict resolution)", async () => {
    const { db, batchCalls } = makeFakeDb({ hosts: [{ id: 1, email: "host@example.com" }] });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    await POST(makeRequest("POST", { origin: ADMIN_ORIGIN, body: { email: "host@example.com", lang: "ES" } }), {
      params: Promise.resolve({ id: BOX_ID }),
    });
    expect((batchCalls[0][0] as { __args: unknown[] }).__args).toContain("en");
  });

  test("POST: email is normalized (trim + lowercase) before lookup/storage (item 3)", async () => {
    const { db } = makeFakeDb({ existingHost: { id: 1, unsubscribed_at: null } });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const res = await POST(makeRequest("POST", { origin: ADMIN_ORIGIN, body: { email: "  Host@Example.com  " } }), {
      params: Promise.resolve({ id: BOX_ID }),
    });
    // existingHost fixture matches regardless of exact args passed to the
    // fake SELECT (it's keyed on venue only) — this test proves parseEmail
    // doesn't reject/mangle the value; the route-level normalization is
    // covered directly by email.test.ts's normalizeEmail suite.
    expect(res.status).toBe(200);
    expect((await res.json()).result).toBe("already");
  });

  test("POST: previously unsubscribed host -> 409, refused, never re-added", async () => {
    const { db, batchCalls } = makeFakeDb({ existingHost: { id: 1, unsubscribed_at: "2026-01-01T00:00:00Z" } });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const res = await POST(makeRequest("POST", { origin: ADMIN_ORIGIN, body: { email: "host@example.com" } }), {
      params: Promise.resolve({ id: BOX_ID }),
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("previously_unsubscribed");
    expect(batchCalls).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("POST: already-added active host -> already, no duplicate write, no email re-sent", async () => {
    const { db, batchCalls } = makeFakeDb({ existingHost: { id: 1, unsubscribed_at: null } });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const res = await POST(makeRequest("POST", { origin: ADMIN_ORIGIN, body: { email: "host@example.com" } }), {
      params: Promise.resolve({ id: BOX_ID }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).result).toBe("already");
    expect(batchCalls).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("DELETE: stops a host's alerts, rotates its token via db.batch() with an audit_log row, and returns the refreshed list", async () => {
    const { db, batchCalls, auditInserts } = makeFakeDb({ hosts: [] });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const res = await DELETE(makeRequest("DELETE", { origin: ADMIN_ORIGIN, body: { email: "host@example.com" } }), {
      params: Promise.resolve({ id: BOX_ID }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).hosts).toEqual([]);

    expect(batchCalls).toHaveLength(1);
    expect((batchCalls[0][0] as { __kind: string }).__kind).toBe("removeHost");
    expect((batchCalls[0][1] as { __kind: string }).__kind).toBe("audit");
    expect(auditInserts).toHaveLength(1);
    const [actorEmail, entity, entityId, action] = auditInserts[0];
    expect(actorEmail).toBe(ADMIN_EMAIL);
    expect(entity).toBe("box_host_alert");
    expect(entityId).toBe(BOX_ID);
    expect(action).toBe("update");
  });

  test("DELETE: wrong Origin -> 403", async () => {
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: makeFakeDb().db } });
    const res = await DELETE(
      makeRequest("DELETE", { origin: "https://evil.example.com", body: { email: "host@example.com" } }),
      { params: Promise.resolve({ id: BOX_ID }) },
    );
    expect(res.status).toBe(403);
  });
});
