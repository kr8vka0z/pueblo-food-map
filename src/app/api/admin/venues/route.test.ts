// @vitest-environment node
/**
 * Route-level tests for POST /api/admin/venues (#254).
 *
 * Mocks @opennextjs/cloudflare's getCloudflareContext for a fake D1 binding
 * and requireAdminSession() (src/lib/adminSession.ts, the sole identity
 * check getAdminDb() runs post Better-Auth-sole-gate cutover —
 * auth/betterauth-sole-gate) as a controllable mock, then inspects
 * db.batch()'s bound statements directly instead of executing real SQL —
 * proving THIS route's call sequence (auth -> validate -> atomic batch) is
 * the goal, not re-implementing SQLite or Better Auth's own session logic
 * (covered separately by adminSession.test.ts). Field-level validation rules
 * themselves are proved in adminVenueValidation.test.ts; this file only
 * proves the route wires validation + auth + D1 together in the right order
 * and shape.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { AccessDeniedError } from "@/lib/cfAccess";

const ADMIN_ORIGIN = "https://pueblofoodmap.com";
const ADMIN_EMAIL = "admin@pueblofoodmap.com";

// Vitest hoists vi.mock() above this file's own imports, so route.ts (via
// adminDb.ts) picks up the mocked @opennextjs/cloudflare with no dynamic
// import needed.
const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

// Sole identity gate (post Better-Auth-sole-gate cutover): a controllable
// mock, not a fixed resolved value, so the "no session" test below can flip
// it to reject for one call — same pattern as src/lib/adminDb.test.ts.
const mockRequireAdminSession = vi.fn();
vi.mock("@/lib/adminSession", () => ({
  requireAdminSession: (...args: unknown[]) => mockRequireAdminSession(...args),
}));

import { POST } from "@/app/api/admin/venues/route";

// ─── Fixtures / helpers ─────────────────────────────────────────────────────

interface BoundStatement {
  sql: string;
  args: unknown[];
}

/** Fake D1: batch() is a spy; prepare().bind() returns an inspectable {sql, args} record. */
function makeFakeDb() {
  const batch = vi.fn(async (stmts: BoundStatement[]) =>
    stmts.map(() => ({ success: true, results: [], meta: {} })),
  );
  const prepare = (sql: string) => ({
    bind: (...args: unknown[]): BoundStatement => ({ sql, args }),
  });
  return { db: { prepare, batch } as unknown as D1Database, batch };
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Eastside Pantry",
    category: "pantry",
    lat: 38.25,
    lng: -104.6,
    address: "123 Test St, Pueblo, CO",
    source: "Manual entry",
    last_verified: "2026-07-03",
    ...overrides,
  };
}

function makeRequest(opts: { origin?: string; body?: unknown } = {}): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.origin !== undefined) headers["Origin"] = opts.origin;
  return new NextRequest("https://pueblofoodmap.com/api/admin/venues", {
    method: "POST",
    headers,
    body: JSON.stringify(opts.body ?? validPayload()),
  });
}

describe("POST /api/admin/venues", () => {
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
    const { db, batch } = makeFakeDb();
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await POST(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(401);
    expect(batch).not.toHaveBeenCalled();
  });

  test("valid session but wrong/missing Origin -> 403 (bad_origin), D1 never touched", async () => {
    const { db, batch } = makeFakeDb();
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const wrongOrigin = await POST(makeRequest({ origin: "https://evil.example.com" }));
    expect(wrongOrigin.status).toBe(403);

    const missingOrigin = await POST(makeRequest());
    expect(missingOrigin.status).toBe(403);

    expect(batch).not.toHaveBeenCalled();
  });

  test("invalid payload (bad category, missing name, non-numeric lat) -> 422 with per-field errors, D1 never touched", async () => {
    const { db, batch } = makeFakeDb();
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await POST(
      makeRequest({
        origin: ADMIN_ORIGIN,
        body: validPayload({ name: "", category: "not-a-real-category", lat: "abc" }),
      }),
    );

    expect(res.status).toBe(422);
    const data = (await res.json()) as { ok: boolean; errors: Record<string, string> };
    expect(data.ok).toBe(false);
    expect(data.errors.name).toBeTruthy();
    expect(data.errors.category).toBeTruthy();
    expect(data.errors.lat).toBeTruthy();
    expect(batch).not.toHaveBeenCalled();
  });

  test("malformed JSON body -> 400, D1 never touched", async () => {
    const { db, batch } = makeFakeDb();
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const req = new NextRequest("https://pueblofoodmap.com/api/admin/venues", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: ADMIN_ORIGIN,
      },
      body: "{not valid json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(batch).not.toHaveBeenCalled();
  });

  test("valid payload -> 201 + {id}, db.batch() called once with a venue INSERT + an audit_log INSERT", async () => {
    const { db, batch } = makeFakeDb();
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await POST(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(201);
    const data = (await res.json()) as { id: string };
    expect(data.id).toMatch(/^manual-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    expect(batch).toHaveBeenCalledTimes(1);
    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    expect(stmts).toHaveLength(2);

    const [venueStmt, auditStmt] = stmts;
    expect(venueStmt.sql).toContain("INSERT INTO venues");
    expect(venueStmt.args).toContain(data.id);
    expect(venueStmt.args).toContain("draft");
    expect(venueStmt.args).toContain("manual");
    expect(venueStmt.args).toContain(ADMIN_EMAIL);
    // created_at/updated_at are deliberately absent from the column list —
    // D1's own DEFAULT (strftime(...)) fills them (matches
    // scripts/seed-admin-db.ts's established convention).
    expect(venueStmt.sql).not.toContain("created_at");
    expect(venueStmt.sql).not.toContain("updated_at");

    expect(auditStmt.sql).toContain("INSERT INTO audit_log");
    expect(auditStmt.args[0]).toBe(ADMIN_EMAIL); // actor_email
    expect(auditStmt.args[1]).toBe("venue"); // entity
    expect(auditStmt.args[2]).toBe(data.id); // entity_id
    expect(auditStmt.args[3]).toBe("create"); // action
    expect(auditStmt.args[4]).toBeNull(); // before_json
    expect(typeof auditStmt.args[5]).toBe("string"); // after_json
    const afterJson = JSON.parse(auditStmt.args[5] as string);
    expect(afterJson.status).toBe("draft");
    expect(afterJson.source_type).toBe("manual");
    expect(afterJson.created_by).toBe(ADMIN_EMAIL);
    expect(afterJson.updated_by).toBe(ADMIN_EMAIL);
  });

  test("valid payload + submissionId -> db.batch() called once with THREE statements, the 3rd approving the submission (#259)", async () => {
    const { db, batch } = makeFakeDb();
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await POST(
      makeRequest({ origin: ADMIN_ORIGIN, body: validPayload({ submissionId: 42 }) }),
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as { id: string };

    expect(batch).toHaveBeenCalledTimes(1);
    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    expect(stmts).toHaveLength(3);

    const [venueStmt, auditStmt, approveStmt] = stmts;
    expect(venueStmt.sql).toContain("INSERT INTO venues");
    expect(auditStmt.sql).toContain("INSERT INTO audit_log");

    // The submission approval piggybacks on the SAME atomic batch as the
    // venue create — see route.ts header for why (venue + submission-approval
    // commit together, or neither does).
    expect(approveStmt.sql).toContain("UPDATE public_submissions");
    expect(approveStmt.sql).toContain("status = 'approved'");
    expect(approveStmt.sql).toContain("WHERE id = ?");
    expect(approveStmt.sql).toContain("status = 'pending'");
    // A create can only legitimately approve a 'new_venue' submission — see
    // route.ts's APPROVE_SUBMISSION_SQL comment for why this guard exists.
    expect(approveStmt.sql).toContain("kind = 'new_venue'");
    expect(approveStmt.args).toContain(ADMIN_EMAIL);
    expect(approveStmt.args).toContain(42);
    expect(data.id).toBeTruthy();
  });

  test("submissionId is ignored when not a positive integer (string, zero, negative, float) — still 2 statements", async () => {
    const { db, batch } = makeFakeDb();
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    for (const badSubmissionId of ["42", 0, -1, 1.5]) {
      batch.mockClear();
      const res = await POST(
        makeRequest({ origin: ADMIN_ORIGIN, body: validPayload({ submissionId: badSubmissionId }) }),
      );
      expect(res.status).toBe(201);
      const stmts = batch.mock.calls[0][0] as BoundStatement[];
      expect(stmts).toHaveLength(2);
    }
  });

  test("optional fields (hours_weekly, tri-state, contact info) are bound correctly when provided", async () => {
    const { db, batch } = makeFakeDb();
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await POST(
      makeRequest({
        origin: ADMIN_ORIGIN,
        body: validPayload({
          hours_weekly: { mon: ["09:00-17:00"] },
          accepts_snap: 1,
          accepts_wic: 0,
          phone: "719-555-0100",
          outside_county: true,
        }),
      }),
    );
    expect(res.status).toBe(201);

    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    const [venueStmt] = stmts;
    expect(venueStmt.args).toContain(JSON.stringify({ mon: ["09:00-17:00"] }));
    expect(venueStmt.args).toContain(1); // accepts_snap
    expect(venueStmt.args).toContain(0); // accepts_wic
    expect(venueStmt.args).toContain("719-555-0100");
  });
});
