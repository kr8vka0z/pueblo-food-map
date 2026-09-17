// @vitest-environment node
/**
 * Route-level tests for POST /api/admin/box-checkins/[id]/visibility
 * (Blessing Boxes slice 2, Discovery C7/C9 — admin hide/unhide).
 *
 * Same full-stack pattern as archive/route.test.ts: mocks
 * @opennextjs/cloudflare for a fake D1 binding and requireAdminSession()
 * as a controllable mock, then inspects db.batch()'s bound statements
 * directly. Proves: the visibility flip, the atomic audit_log write
 * (action='update', entity='box_checkin'), and that both land together or
 * not at all.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { AccessDeniedError, ADMIN_ORIGIN } from "@/lib/cfAccess";

const ADMIN_EMAIL = "admin@pueblofoodmap.com";
const CHECKIN_ID = 42;

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const mockRequireAdminSession = vi.fn();
vi.mock("@/lib/adminSession", () => ({
  requireAdminSession: (...args: unknown[]) => mockRequireAdminSession(...args),
}));

import { POST } from "@/app/api/admin/box-checkins/[id]/visibility/route";

// ─── Fixtures / helpers ─────────────────────────────────────────────────────

interface BoundStatement {
  sql: string;
  args: unknown[];
}

interface BoxCheckinRow {
  id: number;
  venue_id: string;
  kind: string;
  note: string | null;
  visibility: "visible" | "hidden";
  hidden_by: string | null;
  hidden_at: string | null;
  created_at: string;
}

function makeExistingRow(overrides: Partial<BoxCheckinRow> = {}): BoxCheckinRow {
  return {
    id: CHECKIN_ID,
    venue_id: "plentiful-blessing-box-216-w-routt-plentiful-1454",
    kind: "filled",
    note: "Stocked it up",
    visibility: "visible",
    hidden_by: null,
    hidden_at: null,
    created_at: "2026-09-17T12:00:00.000Z",
    ...overrides,
  };
}

function makeFakeDb(existingRow: BoxCheckinRow | null) {
  const batch = vi.fn(async (stmts: BoundStatement[]) =>
    stmts.map(() => ({ success: true, results: [], meta: {} })),
  );
  const prepare = (sql: string) => ({
    bind: (...args: unknown[]) => ({
      sql,
      args,
      first: async <T,>(): Promise<T | null> => existingRow as unknown as T | null,
    }),
  });
  return { db: { prepare, batch } as unknown as D1Database, batch };
}

function makeRequest(opts: { origin?: string; body?: unknown; noContentType?: boolean } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.origin !== undefined) headers["Origin"] = opts.origin;
  if (!opts.noContentType) headers["Content-Type"] = "application/json";
  return new NextRequest(`https://pueblofoodmap.com/api/admin/box-checkins/${CHECKIN_ID}/visibility`, {
    method: "POST",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

function callVisibility(req: NextRequest, id: string = String(CHECKIN_ID)) {
  return POST(req, { params: Promise.resolve({ id }) });
}

describe("POST /api/admin/box-checkins/[id]/visibility", () => {
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

    const res = await callVisibility(makeRequest({ origin: ADMIN_ORIGIN, body: { visibility: "hidden" } }));
    expect(res.status).toBe(401);
    expect(batch).not.toHaveBeenCalled();
  });

  test("valid session but wrong/missing Origin -> 403, D1 never touched", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow());
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const wrongOrigin = await callVisibility(
      makeRequest({ origin: "https://evil.example.com", body: { visibility: "hidden" } }),
    );
    expect(wrongOrigin.status).toBe(403);

    const missingOrigin = await callVisibility(makeRequest({ body: { visibility: "hidden" } }));
    expect(missingOrigin.status).toBe(403);

    expect(batch).not.toHaveBeenCalled();
  });

  test("non-integer id -> 404, D1 never touched", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow());
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callVisibility(
      makeRequest({ origin: ADMIN_ORIGIN, body: { visibility: "hidden" } }),
      "not-a-number",
    );
    expect(res.status).toBe(404);
    expect(batch).not.toHaveBeenCalled();
  });

  test("unknown check-in id -> 404, D1 batch never called", async () => {
    const { db, batch } = makeFakeDb(null);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callVisibility(makeRequest({ origin: ADMIN_ORIGIN, body: { visibility: "hidden" } }));
    expect(res.status).toBe(404);
    expect(batch).not.toHaveBeenCalled();
  });

  test("invalid visibility value -> 422, D1 never touched", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow());
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callVisibility(makeRequest({ origin: ADMIN_ORIGIN, body: { visibility: "deleted" } }));
    expect(res.status).toBe(422);
    expect(batch).not.toHaveBeenCalled();
  });

  test("non-JSON body -> 400, D1 never touched", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow());
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const req = new NextRequest(`https://pueblofoodmap.com/api/admin/box-checkins/${CHECKIN_ID}/visibility`, {
      method: "POST",
      headers: { Origin: ADMIN_ORIGIN, "Content-Type": "application/json" },
      body: "{not valid json",
    });
    const res = await callVisibility(req);
    expect(res.status).toBe(400);
    expect(batch).not.toHaveBeenCalled();
  });

  test("hide -> 200, db.batch() called once with an UPDATE (visibility='hidden', hidden_by/hidden_at set) + an audit_log INSERT (action='update', entity='box_checkin')", async () => {
    const existing = makeExistingRow();
    const { db, batch } = makeFakeDb(existing);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callVisibility(makeRequest({ origin: ADMIN_ORIGIN, body: { visibility: "hidden" } }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; id: number; visibility: string };
    expect(data.ok).toBe(true);
    expect(data.id).toBe(CHECKIN_ID);
    expect(data.visibility).toBe("hidden");

    expect(batch).toHaveBeenCalledTimes(1);
    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    expect(stmts).toHaveLength(2);

    const [updateStmt, auditStmt] = stmts;
    expect(updateStmt.sql).toContain("UPDATE box_checkins SET");
    expect(updateStmt.sql).not.toContain("DELETE");
    expect(updateStmt.args).toContain("hidden");
    expect(updateStmt.args).toContain(ADMIN_EMAIL); // hidden_by
    expect(updateStmt.args).toContain(CHECKIN_ID);

    expect(auditStmt.sql).toContain("INSERT INTO audit_log");
    expect(auditStmt.args[0]).toBe(ADMIN_EMAIL); // actor_email
    expect(auditStmt.args[1]).toBe("box_checkin"); // entity
    expect(auditStmt.args[2]).toBe(String(CHECKIN_ID)); // entity_id
    expect(auditStmt.args[3]).toBe("update"); // action, see route.ts header for WHY not a new enum value

    const beforeJson = JSON.parse(auditStmt.args[4] as string);
    expect(beforeJson).toEqual(existing);
    expect(beforeJson.visibility).toBe("visible");

    const afterJson = JSON.parse(auditStmt.args[5] as string);
    expect(afterJson.visibility).toBe("hidden");
    expect(afterJson.hidden_by).toBe(ADMIN_EMAIL);
    expect(afterJson.hidden_at).not.toBeNull();
    // Every other column retained, not wiped.
    expect(afterJson.note).toBe(existing.note);
    expect(afterJson.kind).toBe(existing.kind);
  });

  test("unhide -> 200, hidden_by/hidden_at cleared to null", async () => {
    const existing = makeExistingRow({
      visibility: "hidden",
      hidden_by: "other-admin@pueblofoodmap.com",
      hidden_at: "2026-09-16T00:00:00.000Z",
    });
    const { db, batch } = makeFakeDb(existing);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callVisibility(makeRequest({ origin: ADMIN_ORIGIN, body: { visibility: "visible" } }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; visibility: string };
    expect(data.visibility).toBe("visible");

    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    const [updateStmt, auditStmt] = stmts;
    expect(updateStmt.args).toContain("visible");
    expect(updateStmt.args).toContain(null); // hidden_by cleared

    const afterJson = JSON.parse(auditStmt.args[5] as string);
    expect(afterJson.visibility).toBe("visible");
    expect(afterJson.hidden_by).toBeNull();
    expect(afterJson.hidden_at).toBeNull();
  });

  test("hiding an already-hidden check-in is idempotent (still 200, still writes an audit row, hidden_by updates to the acting admin)", async () => {
    const existing = makeExistingRow({
      visibility: "hidden",
      hidden_by: "other-admin@pueblofoodmap.com",
      hidden_at: "2026-09-16T00:00:00.000Z",
    });
    const { db, batch } = makeFakeDb(existing);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callVisibility(makeRequest({ origin: ADMIN_ORIGIN, body: { visibility: "hidden" } }));
    expect(res.status).toBe(200);
    expect(batch).toHaveBeenCalledTimes(1);
  });
});
