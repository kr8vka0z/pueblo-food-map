// @vitest-environment node
/**
 * Route-level tests for POST /api/admin/box-adopters/[id]/reject (Blessing
 * Boxes slice 6). Same full-stack mock pattern as
 * box-photos/[id]/reject/route.test.ts.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { AccessDeniedError, ADMIN_ORIGIN } from "@/lib/adminOrigin";
import type { BoxAdopterRow } from "@/lib/boxAdopters";

const ADMIN_EMAIL = "admin@pueblofoodmap.com";
const ADOPTER_ID = 7;

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const mockRequireAdminSession = vi.fn();
vi.mock("@/lib/adminSession", () => ({
  requireAdminSession: (...args: unknown[]) => mockRequireAdminSession(...args),
}));

import { POST } from "@/app/api/admin/box-adopters/[id]/reject/route";

interface BoundStatement {
  sql: string;
  args: unknown[];
}

function makeExistingRow(overrides: Partial<BoxAdopterRow> = {}): BoxAdopterRow {
  return {
    id: ADOPTER_ID,
    venue_id: "test-box-1",
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

function makeFakeDb(existingRow: BoxAdopterRow | null) {
  const batch = vi.fn(async (stmts: BoundStatement[]) => stmts.map(() => ({ success: true, results: [], meta: {} })));
  const prepare = (sql: string) => ({
    bind: (...args: unknown[]) => ({ sql, args, first: async () => existingRow }),
  });
  return { db: { prepare, batch } as unknown as D1Database, batch };
}

function makeRequest(opts: { origin?: string; body?: unknown } = {}): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.origin !== undefined) headers["Origin"] = opts.origin;
  return new NextRequest(`https://pueblofoodmap.com/api/admin/box-adopters/${ADOPTER_ID}/reject`, {
    method: "POST",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

function callReject(req: NextRequest, id: string = String(ADOPTER_ID)) {
  return POST(req, { params: Promise.resolve({ id }) });
}

describe("POST /api/admin/box-adopters/[id]/reject", () => {
  beforeEach(() => {
    mockGetCloudflareContext.mockReset();
    mockRequireAdminSession.mockReset();
    mockRequireAdminSession.mockResolvedValue({ email: ADMIN_EMAIL });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("no Better Auth session -> 401, D1 never touched", async () => {
    mockRequireAdminSession.mockRejectedValue(new AccessDeniedError("no_session"));
    const { db, batch } = makeFakeDb(makeExistingRow());
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const res = await callReject(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(401);
    expect(batch).not.toHaveBeenCalled();
  });

  test("wrong Origin -> 403", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow());
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const res = await callReject(makeRequest({ origin: "https://evil.example.com" }));
    expect(res.status).toBe(403);
    expect(batch).not.toHaveBeenCalled();
  });

  test("unknown adopter id -> 404", async () => {
    const { db, batch } = makeFakeDb(null);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const res = await callReject(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(404);
    expect(batch).not.toHaveBeenCalled();
  });

  test("a bodyless reject (plain button click) does not throw, reason stays null", async () => {
    const existing = makeExistingRow();
    const { db, batch } = makeFakeDb(existing);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const req = new NextRequest(`https://pueblofoodmap.com/api/admin/box-adopters/${ADOPTER_ID}/reject`, {
      method: "POST",
      headers: { Origin: ADMIN_ORIGIN },
    });
    const res = await callReject(req);
    expect(res.status).toBe(200);
    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    expect(stmts[0].args).toContain(null);
  });

  test("rejecting a pending application -> 200, batch writes UPDATE + audit_log + unsubscribe statement", async () => {
    const existing = makeExistingRow();
    const { db, batch } = makeFakeDb(existing);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const res = await callReject(makeRequest({ origin: ADMIN_ORIGIN, body: { reason: "Never responded" } }));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("rejected");

    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    expect(stmts).toHaveLength(3);
    const [updateStmt, auditStmt, unsubStmt] = stmts;
    expect(updateStmt.sql).toContain("'rejected'");
    expect(updateStmt.args).toContain("Never responded");
    expect(auditStmt.args[1]).toBe("box_adopter");
    expect(unsubStmt.sql).toContain("UPDATE alert_subscriptions SET unsubscribed_at");
    expect(unsubStmt.sql).toContain("role = 'adopter'");
  });

  test("removing a previously-approved adopter also rides the reject route", async () => {
    const existing = makeExistingRow({ status: "approved" });
    const { db, batch } = makeFakeDb(existing);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });
    const res = await callReject(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(200);
    const afterJson = JSON.parse((batch.mock.calls[0][0] as BoundStatement[])[1].args[5] as string);
    expect(afterJson.status).toBe("rejected");
  });
});
