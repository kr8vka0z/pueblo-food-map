// @vitest-environment node
/**
 * Route-level tests for POST /api/admin/box-adopters/[id]/approve (Blessing
 * Boxes slice 6). Same full-stack mock pattern as
 * box-photos/[id]/approve/route.test.ts.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { AccessDeniedError, ADMIN_ORIGIN } from "@/lib/cfAccess";
import type { BoxAdopterRow } from "@/lib/boxAdopters";

const ADMIN_EMAIL = "admin@pueblofoodmap.com";
const ADOPTER_ID = 7;
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

import { POST } from "@/app/api/admin/box-adopters/[id]/approve/route";

interface BoundStatement {
  sql: string;
  args: unknown[];
}

function makeExistingRow(overrides: Partial<BoxAdopterRow> = {}): BoxAdopterRow {
  return {
    id: ADOPTER_ID,
    venue_id: BOX_ID,
    display_name: "The Martinez Family",
    email: "martinez@example.com",
    note: null,
    status: "pending",
    email_confirmed_at: "2026-09-17T12:00:00.000Z",
    confirm_token: "sometoken",
    reviewed_by: null,
    reviewed_at: null,
    review_reason: null,
    created_at: "2026-09-17T11:00:00.000Z",
    lang: "en",
    ...overrides,
  };
}

function makeFakeDb(existingRow: BoxAdopterRow | null, subscriptionToken: string | null = "unsub-token") {
  const batch = vi.fn(async (stmts: BoundStatement[]) => stmts.map(() => ({ success: true, results: [], meta: {} })));
  const prepare = (sql: string) => {
    if (sql === "SELECT * FROM box_adopters WHERE id = ?") {
      return { bind: (...args: unknown[]) => ({ first: async () => existingRow, sql, args }) };
    }
    if (sql.includes("SELECT unsubscribe_token FROM alert_subscriptions")) {
      return { bind: () => ({ first: async () => (subscriptionToken ? { unsubscribe_token: subscriptionToken } : null) }) };
    }
    if (sql.includes("SELECT name FROM venues")) {
      return { bind: () => ({ first: async () => ({ name: "Test Box" }) }) };
    }
    return { bind: (...args: unknown[]) => ({ sql, args }) };
  };
  return { db: { prepare, batch } as unknown as D1Database, batch };
}

function makeRequest(opts: { origin?: string } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.origin !== undefined) headers["Origin"] = opts.origin;
  return new NextRequest(`https://pueblofoodmap.com/api/admin/box-adopters/${ADOPTER_ID}/approve`, {
    method: "POST",
    headers,
  });
}

function callApprove(req: NextRequest, id: string = String(ADOPTER_ID)) {
  return POST(req, { params: Promise.resolve({ id }) });
}

describe("POST /api/admin/box-adopters/[id]/approve", () => {
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

  test("no Better Auth session -> 401, D1 never touched", async () => {
    mockRequireAdminSession.mockRejectedValue(new AccessDeniedError("no_session"));
    const { db, batch } = makeFakeDb(makeExistingRow());
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(401);
    expect(batch).not.toHaveBeenCalled();
  });

  test("wrong/missing Origin -> 403, D1 never touched", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow());
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const res = await callApprove(makeRequest({ origin: "https://evil.example.com" }));
    expect(res.status).toBe(403);
    expect(batch).not.toHaveBeenCalled();
  });

  test("unknown adopter id -> 404, batch never called", async () => {
    const { db, batch } = makeFakeDb(null);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(404);
    expect(batch).not.toHaveBeenCalled();
  });

  test("unconfirmed application -> 409, batch never called", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow({ email_confirmed_at: null }));
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("unconfirmed");
    expect(batch).not.toHaveBeenCalled();
  });

  test("confirmed pending application -> 200, batch writes UPDATE + audit_log + subscription upsert", async () => {
    const existing = makeExistingRow();
    const { db, batch } = makeFakeDb(existing);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("approved");

    expect(batch).toHaveBeenCalledTimes(1);
    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    expect(stmts).toHaveLength(3);
    const [updateStmt, auditStmt, subStmt] = stmts;
    expect(updateStmt.sql).toContain("UPDATE box_adopters SET");
    expect(updateStmt.sql).toContain("'approved'");
    expect(auditStmt.sql).toContain("INSERT INTO audit_log");
    expect(auditStmt.args[1]).toBe("box_adopter");
    expect(subStmt.sql).toContain("INSERT INTO alert_subscriptions");
    expect(subStmt.sql).toContain("ON CONFLICT");
  });

  // Single-language alert emails (Blessing Boxes slice 6 follow-up): "On
  // adopter approval, the alert_subscriptions row inherits the adopter
  // row's `lang`."
  test("the subscription upsert inherits the applicant's OWN lang, not a fixed default", async () => {
    const existing = makeExistingRow({ lang: "es" });
    const { db, batch } = makeFakeDb(existing);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));

    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    const subStmt = stmts[2];
    expect(subStmt.args).toContain("es");
    expect(subStmt.sql).toContain("lang = excluded.lang");
  });

  test("the approved email renders in the applicant's OWN lang", async () => {
    const { db } = makeFakeDb(makeExistingRow({ lang: "es" }), "the-unsub-token");
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    const sentBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(sentBody.subject).toContain("Fuiste aprobado");
    expect(sentBody.text).not.toContain("Good news");
  });

  test("sends an approved email to the adopter when a subscription row exists", async () => {
    const { db } = makeFakeDb(makeExistingRow(), "the-unsub-token");
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const sentBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(sentBody.to).toEqual(["martinez@example.com"]);
  });

  test("a failed approval email never fails the response", async () => {
    mockFetch.mockResolvedValue(new Response("boom", { status: 500 }));
    const { db } = makeFakeDb(makeExistingRow());
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(200);
  });
});
