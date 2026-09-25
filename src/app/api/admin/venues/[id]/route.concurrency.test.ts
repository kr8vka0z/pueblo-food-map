// @vitest-environment node
/**
 * Concurrency-specific tests for PATCH /api/admin/venues/[id] (#265,
 * "optimistic-concurrency guard"). Split from the sibling route.test.ts
 * rather than added there, since the fake DB in this file needs to answer
 * `meta.changes` differently per test (0 for a rejected precondition, a
 * real number for a match) — route.test.ts's fake batch() always returns a
 * fixed `meta: {}` for every statement, which is the correct default for
 * every OTHER test in that file (a real D1 batch's meta shape simply isn't
 * exercised there) and must stay that way.
 *
 * Same auth-mock pattern as route.test.ts (@opennextjs/cloudflare + the
 * requireAdminSession() identity gate) — see that file's own header.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { ADMIN_ORIGIN } from "@/lib/adminOrigin";
import type { AdminVenueRow } from "@/types/venue";

const ADMIN_EMAIL = "admin@pueblofoodmap.com";
const VENUE_ID = "manual-existing-1";
const EXISTING_UPDATED_AT = "2026-01-01T00:00:00.000Z";

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const mockRequireAdminSession = vi.fn();
vi.mock("@/lib/adminSession", () => ({
  requireAdminSession: (...args: unknown[]) => mockRequireAdminSession(...args),
}));

import { PATCH } from "@/app/api/admin/venues/[id]/route";

interface BoundStatement {
  sql: string;
  args: unknown[];
}

function makeExistingRow(overrides: Partial<AdminVenueRow> = {}): AdminVenueRow {
  return {
    id: VENUE_ID,
    name: "Old Name",
    category: "pantry",
    lat: 38.1,
    lng: -104.5,
    address: "Old Address",
    hours_weekly: null,
    hours_irregular: null,
    accepts_snap: null,
    accepts_wic: null,
    phone: null,
    email: null,
    url: null,
    notes: null,
    operator: null,
    source: "Old source",
    last_verified: "2026-01-01",
    status: "draft",
    source_type: "manual",
    outside_county: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    created_by: ADMIN_EMAIL,
    updated_at: EXISTING_UPDATED_AT,
    updated_by: ADMIN_EMAIL,
    published_at: null,
    published_by: null,
    ...overrides,
  };
}

/**
 * `venueUpdateChanges` controls what statement 0 (always updateVenue —
 * route.ts's own invariant) reports back: 0 simulates a real D1 rejecting
 * the `WHERE ... AND updated_at = ?` precondition (another write landed
 * first); 1 simulates a normal match. Every OTHER statement in the batch
 * reports `meta: {}` — this file only needs to prove the ROUTE reads
 * `results[0].meta.changes` correctly; whether D1 itself would also skip
 * the dependent SELECT-gated writes is proven separately, against real
 * SQLite, not through this mock (see route.ts's own header).
 */
function makeFakeDb(existingRow: AdminVenueRow | null, venueUpdateChanges: number) {
  const batch = vi.fn(async (stmts: BoundStatement[]) =>
    stmts.map((_, i) => ({ success: true, results: [], meta: i === 0 ? { changes: venueUpdateChanges } : {} })),
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
  return new NextRequest(`https://pueblofoodmap.com/api/admin/venues/${VENUE_ID}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(opts.body ?? validPayload()),
  });
}

function callPatch(req: NextRequest, id: string = VENUE_ID) {
  return PATCH(req, { params: Promise.resolve({ id }) });
}

describe("PATCH /api/admin/venues/[id] — optimistic concurrency (#265)", () => {
  beforeEach(() => {
    mockGetCloudflareContext.mockReset();
    mockRequireAdminSession.mockReset();
    mockRequireAdminSession.mockResolvedValue({ email: ADMIN_EMAIL });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("stale expectedUpdatedAt -> the UPDATE's WHERE clause carries the precondition, bound to the client's value", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow(), 0);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callPatch(
      makeRequest({ origin: ADMIN_ORIGIN, body: validPayload({ expectedUpdatedAt: "2025-06-01T00:00:00.000Z" }) }),
    );

    expect(batch).toHaveBeenCalledTimes(1);
    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    const [updateStmt] = stmts;
    expect(updateStmt.sql).toContain("WHERE id = ? AND updated_at = ?");
    // The precondition is the CLIENT's stale value, not the existing row's
    // real one — proves the WHERE clause is doing the check, not a
    // separate pre-fetched comparison in JS.
    expect(updateStmt.args).toContain("2025-06-01T00:00:00.000Z");

    // D1 (real behavior, verified against real SQLite in src/lib/adminVenueEditSql.sql.test.ts — see route.ts's
    // header) would report 0 rows matched here; this mock simulates exactly
    // that outcome for statement 0.
    expect(res.status).toBe(409);
    const data = (await res.json()) as { ok: boolean; error: string; message: string };
    expect(data.ok).toBe(false);
    expect(data.error).toBe("conflict");
    expect(data.message).toBe("Someone else changed this place since you opened it. Reload to see their changes.");
  });

  test("stale precondition -> the audit_log INSERT is SELECT-form, gated on WHERE EXISTS (venues.updated_at = the NEW timestamp) — proven not to insert when 0 rows matched, see src/lib/adminVenueEditSql.sql.test.ts", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow(), 0);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    await callPatch(makeRequest({ origin: ADMIN_ORIGIN, body: validPayload({ expectedUpdatedAt: "wrong" }) }));

    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    const auditStmt = stmts.find((s) => s.sql.includes("INSERT INTO audit_log"));
    expect(auditStmt).toBeDefined();
    expect(auditStmt!.sql).toContain("SELECT ?, ?, ?, ?, ?, ?, ?");
    expect(auditStmt!.sql).toContain("WHERE EXISTS (SELECT 1 FROM venues WHERE id = ? AND updated_at = ?)");
    expect(auditStmt!.sql).not.toContain("VALUES");
  });

  test("matching expectedUpdatedAt (D1 reports 1 row matched) -> 200, no conflict body", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow(), 1);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callPatch(
      makeRequest({ origin: ADMIN_ORIGIN, body: validPayload({ expectedUpdatedAt: EXISTING_UPDATED_AT }) }),
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; id: string };
    expect(data.ok).toBe(true);
    expect(data.id).toBe(VENUE_ID);

    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    const [updateStmt] = stmts;
    expect(updateStmt.args).toContain(EXISTING_UPDATED_AT);
  });

  test("missing expectedUpdatedAt -> falls back to existing.updated_at (still bound as the precondition), edit still succeeds", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow(), 1);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callPatch(makeRequest({ origin: ADMIN_ORIGIN, body: validPayload() }));
    expect(res.status).toBe(200);

    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    const [updateStmt] = stmts;
    // No expectedUpdatedAt in the body -> resolveExpectedUpdatedAt() falls
    // back to the row's OWN updated_at, read by this same request's SELECT.
    expect(updateStmt.args).toContain(EXISTING_UPDATED_AT);
  });

  test("missing expectedUpdatedAt logs a warning (backward-compat visibility — #265's 'log it' instruction)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { db } = makeFakeDb(makeExistingRow(), 1);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    await callPatch(makeRequest({ origin: ADMIN_ORIGIN, body: validPayload() }));

    expect(warnSpy).toHaveBeenCalledWith(
      JSON.stringify({ event: "admin_venue_edit_missing_precondition", venueId: VENUE_ID }),
    );
    warnSpy.mockRestore();
  });

  test("present expectedUpdatedAt does NOT log the missing-precondition warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { db } = makeFakeDb(makeExistingRow(), 1);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    await callPatch(
      makeRequest({ origin: ADMIN_ORIGIN, body: validPayload({ expectedUpdatedAt: EXISTING_UPDATED_AT }) }),
    );

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("admin_venue_edit_missing_precondition"),
    );
    warnSpy.mockRestore();
  });

  describe("dependent writes are ALSO guarded (blessing_boxes row lifecycle)", () => {
    test("box DELETE/INSERT/box_events are SELECT/EXISTS-gated on the same (id, new updated_at) pair — a stale edit must not half-apply box changes", async () => {
      const existing = makeExistingRow({ category: "blessing_box", name: "Eastside Pantry", address: "123 Test St, Pueblo, CO" });
      const { db, batch } = makeFakeDb(existing, 0);
      mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

      await callPatch(
        makeRequest({
          origin: ADMIN_ORIGIN,
          body: validPayload({ category: "blessing_box", host_name: "New Host", expectedUpdatedAt: "wrong" }),
        }),
      );

      const stmts = batch.mock.calls[0][0] as BoundStatement[];
      const deleteStmt = stmts.find((s) => s.sql.startsWith("DELETE FROM blessing_boxes"));
      const insertStmt = stmts.find((s) => s.sql.includes("INSERT INTO blessing_boxes"));
      expect(deleteStmt).toBeDefined();
      expect(deleteStmt!.sql).toContain("EXISTS (SELECT 1 FROM venues WHERE id = ? AND updated_at = ?)");
      expect(insertStmt).toBeDefined();
      expect(insertStmt!.sql).toContain("WHERE EXISTS (SELECT 1 FROM venues WHERE id = ? AND updated_at = ?)");
      expect(insertStmt!.sql).not.toContain("VALUES");
    });

    test("approveProposal (proposalId hand-off) is ALSO EXISTS-gated — a stale edit must not approve a proposal for a fix that never wrote", async () => {
      const existing = makeExistingRow();
      const { db, batch } = makeFakeDb(existing, 0);
      mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

      await callPatch(
        makeRequest({ origin: ADMIN_ORIGIN, body: validPayload({ proposalId: 748, expectedUpdatedAt: "wrong" }) }),
      );

      const stmts = batch.mock.calls[0][0] as BoundStatement[];
      const approveStmt = stmts.find((s) => s.sql.includes("UPDATE change_proposals"));
      expect(approveStmt).toBeDefined();
      expect(approveStmt!.sql).toContain("AND EXISTS (SELECT 1 FROM venues WHERE id = ? AND updated_at = ?)");
    });
  });
});
