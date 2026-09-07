// @vitest-environment node
/**
 * Route-level tests for POST /api/admin/proposals/[id]/approve.
 *
 * Same full-stack pattern as src/app/api/admin/venues/[id]/archive/route.test.ts:
 * mocks @opennextjs/cloudflare for a fake D1 binding and requireAdminSession()
 * as a controllable mock, then inspects db.batch()'s bound statements
 * directly. The fake DB's `.first()` is keyed by SQL prefix so the same
 * fake can answer both the change_proposals lookup and the venues lookup
 * with different fixtures.
 *
 * Covers this issue's three correctness requirements as they apply to
 * approve specifically:
 *   1. Supersede race — a non-pending proposal never applies, 404/409.
 *   2. Stale-apply — a venue that moved since the proposal was generated
 *      refuses to apply and marks the proposal superseded instead.
 *   3. (Rejection memory is reject's own concern — covered in that route's
 *      test file.)
 * Plus the atomic-batch guarantee: every mutating path is one db.batch()
 * call, never separate awaited writes that could partially land.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { AccessDeniedError, ADMIN_ORIGIN } from "@/lib/cfAccess";
import type { AdminVenueRow } from "@/types/venue";
import type { ChangeProposalRow, ProposedDiff } from "@/lib/adminProposals";

const ADMIN_EMAIL = "admin@pueblofoodmap.com";
const PROPOSAL_ID = 7;
const VENUE_ID = "osm-node-1";

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const mockRequireAdminSession = vi.fn();
vi.mock("@/lib/adminSession", () => ({
  requireAdminSession: (...args: unknown[]) => mockRequireAdminSession(...args),
}));

import { POST } from "@/app/api/admin/proposals/[id]/approve/route";

// ─── Fixtures / helpers ─────────────────────────────────────────────────────

interface BoundStatement {
  sql: string;
  args: unknown[];
}

function makeProposal(overrides: Partial<ChangeProposalRow> = {}): ChangeProposalRow {
  // Real diffEngine.ts proposals always carry `before.last_verified` /
  // `after.last_verified` explicitly (buildProposal's update branch sets it
  // unconditionally, separate from the changed-fields loop) — matching that
  // shape here so this fixture doesn't itself trip the stale-apply guard.
  const diff: ProposedDiff = {
    before: { phone: "719-555-0100", last_verified: "2026-08-01" },
    after: { phone: "719-555-0199", last_verified: "2026-09-02" },
    fields_changed: ["phone", "last_verified"],
  };
  return {
    id: PROPOSAL_ID,
    source: "osm",
    target_venue_id: VENUE_ID,
    change_type: "update",
    proposed_diff: JSON.stringify(diff),
    diff_hash: "hash1",
    run_id: "local-1",
    anomaly: 0,
    status: "pending",
    created_at: "2026-09-01T00:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    applied_at: null,
    ...overrides,
  };
}

function makeVenue(overrides: Partial<AdminVenueRow> = {}): AdminVenueRow {
  return {
    id: VENUE_ID,
    name: "Eastside Grocery",
    category: "grocery",
    lat: 38.25,
    lng: -104.6,
    address: "123 Test St, Pueblo, CO",
    hours_weekly: null,
    accepts_snap: null,
    accepts_wic: null,
    phone: "719-555-0100",
    email: null,
    url: "https://example.com",
    notes: null,
    operator: null,
    source: "OpenStreetMap (node/1)",
    last_verified: "2026-08-01",
    status: "published",
    source_type: "osm",
    outside_county: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    created_by: "seed",
    updated_at: "2026-01-01T00:00:00.000Z",
    updated_by: "seed",
    published_at: "2026-01-02T00:00:00.000Z",
    published_by: "seed",
    ...overrides,
  };
}

/**
 * Fake D1: `.first()` is keyed by which table the SQL selects from (the
 * only two SELECTs this route ever issues), `.run()` and `.batch()` are
 * spies. `batchResults` lets a test control what db.batch() resolves with
 * per-statement (specifically the approve UPDATE's meta.changes, for the
 * TOCTOU-race test).
 */
function makeFakeDb(opts: {
  proposal: ChangeProposalRow | null;
  venue: AdminVenueRow | null;
  approveChanges?: number;
}) {
  const runCalls: BoundStatement[] = [];
  const run = vi.fn(async (sql: string, args: unknown[]) => {
    runCalls.push({ sql, args });
    return { success: true, results: [], meta: { changes: 1 } };
  });
  const batch = vi.fn(async (stmts: BoundStatement[]) =>
    stmts.map((s) => ({
      success: true,
      results: [],
      meta: { changes: s.sql.includes("UPDATE change_proposals") ? (opts.approveChanges ?? 1) : 1 },
    })),
  );
  const prepare = (sql: string) => ({
    bind: (...args: unknown[]) => ({
      sql,
      args,
      first: async <T,>(): Promise<T | null> => {
        if (sql.includes("FROM change_proposals")) return opts.proposal as unknown as T | null;
        if (sql.includes("FROM venues")) return opts.venue as unknown as T | null;
        return null;
      },
      run: () => run(sql, args),
    }),
  });
  return { db: { prepare, batch } as unknown as D1Database, batch, run };
}

function makeRequest(opts: { origin?: string } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.origin !== undefined) headers["Origin"] = opts.origin;
  return new NextRequest(`https://pueblofoodmap.com/api/admin/proposals/${PROPOSAL_ID}/approve`, {
    method: "POST",
    headers,
  });
}

function callApprove(req: NextRequest, id: string = String(PROPOSAL_ID)) {
  return POST(req, { params: Promise.resolve({ id }) });
}

describe("POST /api/admin/proposals/[id]/approve", () => {
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
    const { db, batch } = makeFakeDb({ proposal: makeProposal(), venue: makeVenue() });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(401);
    expect(batch).not.toHaveBeenCalled();
  });

  test("valid session but wrong/missing Origin -> 403, D1 never touched", async () => {
    const { db, batch } = makeFakeDb({ proposal: makeProposal(), venue: makeVenue() });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    expect((await callApprove(makeRequest({ origin: "https://evil.example.com" }))).status).toBe(403);
    expect((await callApprove(makeRequest())).status).toBe(403);
    expect(batch).not.toHaveBeenCalled();
  });

  test("unknown proposal id -> 404, D1 batch never called", async () => {
    const { db, batch } = makeFakeDb({ proposal: null, venue: makeVenue() });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(404);
    expect(batch).not.toHaveBeenCalled();
  });

  // ── Correctness requirement 1: supersede race ──────────────────────────
  test("proposal already superseded (not 'pending') -> 409 'stale', batch never called — never a silent success", async () => {
    const { db, batch } = makeFakeDb({ proposal: makeProposal({ status: "superseded" }), venue: makeVenue() });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(409);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toBe("stale");
    expect(batch).not.toHaveBeenCalled();
  });

  test("proposal already approved -> 409 'stale', batch never called", async () => {
    const { db, batch } = makeFakeDb({ proposal: makeProposal({ status: "approved" }), venue: makeVenue() });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(409);
    expect(batch).not.toHaveBeenCalled();
  });

  test("the change_proposals UPDATE inside the batch affects 0 rows (a race lost between the pre-check and the batch) -> 409 'stale', not a 200", async () => {
    const { db } = makeFakeDb({ proposal: makeProposal(), venue: makeVenue(), approveChanges: 0 });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(409);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.error).toBe("stale");
  });

  // ── link_health carve-out ───────────────────────────────────────────────
  test("link_health source -> 400, never applied blindly (routed to venue edit instead)", async () => {
    const { db, batch } = makeFakeDb({
      proposal: makeProposal({ source: "link_health", change_type: "update" }),
      venue: makeVenue(),
    });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(400);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.error).toBe("link_health_requires_edit");
    expect(batch).not.toHaveBeenCalled();
  });

  // ── Correctness requirement 2: stale-apply (§6.10c) ─────────────────────
  test("update proposal, target venue's changed field diverged since the proposal was generated -> 409 'stale', proposal marked superseded, batch (the apply) never called", async () => {
    // The proposal's `before.phone` says the venue's phone was
    // "719-555-0100" when scraped. The venue's CURRENT phone is something
    // else entirely — an admin hand-edited it since.
    const { db, batch, run } = makeFakeDb({
      proposal: makeProposal(),
      venue: makeVenue({ phone: "719-555-9999" }),
    });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(409);
    const data = (await res.json()) as { ok: boolean; error: string; message: string };
    expect(data.error).toBe("stale");
    expect(data.message).toMatch(/phone/);
    expect(batch).not.toHaveBeenCalled(); // the apply (venue mutation) never runs
    expect(run).toHaveBeenCalledTimes(1); // only the standalone supersede UPDATE ran
    expect(run.mock.calls[0][0]).toContain("status = 'superseded'");
  });

  test("update proposal, target venue archived since the proposal was generated -> 409 'stale', not applied", async () => {
    const { db, batch } = makeFakeDb({ proposal: makeProposal(), venue: makeVenue({ status: "archived" }) });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(409);
    expect(batch).not.toHaveBeenCalled();
  });

  test("remove proposal, target already gone -> 409 'stale', not applied", async () => {
    const removeDiff: ProposedDiff = { before: { id: VENUE_ID, name: "Eastside Grocery" }, after: null, fields_changed: [] };
    const { db, batch } = makeFakeDb({
      proposal: makeProposal({ change_type: "remove", proposed_diff: JSON.stringify(removeDiff) }),
      venue: null,
    });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(409);
    expect(batch).not.toHaveBeenCalled();
  });

  // ── Happy paths, one per change_type ────────────────────────────────────
  test("update proposal, field still matches 'before' -> 200, db.batch() applies ONLY the changed fields + audit + proposal-approve, atomically", async () => {
    const { db, batch } = makeFakeDb({ proposal: makeProposal(), venue: makeVenue() });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean; changeType: string };
    expect(data.ok).toBe(true);
    expect(data.changeType).toBe("update");

    expect(batch).toHaveBeenCalledTimes(1);
    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    expect(stmts).toHaveLength(3);
    const [venueStmt, auditStmt, approveStmt] = stmts;

    expect(venueStmt.sql).toContain("UPDATE venues SET");
    expect(venueStmt.sql).toContain("phone = ?");
    expect(venueStmt.sql).toContain("last_verified = ?");
    // Only the proposal's own fields_changed are touched — not a full-row overwrite.
    expect(venueStmt.sql).not.toContain("name = ?");
    expect(venueStmt.args).toContain("719-555-0199");

    expect(auditStmt.sql).toContain("INSERT INTO audit_log");
    expect(auditStmt.args[3]).toBe("update");

    expect(approveStmt.sql).toContain("UPDATE change_proposals");
    expect(approveStmt.sql).toContain("status = 'approved'");
    expect(approveStmt.sql).toContain("status = 'pending'");
    expect(approveStmt.args).toContain(PROPOSAL_ID);
  });

  test("remove proposal -> 200, db.batch() archives the venue (never DELETEs) + audit action='archive' + proposal-approve", async () => {
    const removeDiff: ProposedDiff = { before: { id: VENUE_ID, name: "Eastside Grocery" }, after: null, fields_changed: [] };
    const { db, batch } = makeFakeDb({
      proposal: makeProposal({ change_type: "remove", proposed_diff: JSON.stringify(removeDiff) }),
      venue: makeVenue(),
    });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(200);

    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    const [venueStmt, auditStmt] = stmts;
    expect(venueStmt.sql).toContain("status = 'archived'");
    expect(venueStmt.sql).not.toContain("DELETE");
    expect(auditStmt.args[3]).toBe("archive");
  });

  test("add proposal, fresh id (no existing row) -> 200, db.batch() INSERTs a new draft venue + audit action='create'", async () => {
    const addDiff: ProposedDiff = {
      before: null,
      after: {
        id: "osm-node-99",
        name: "New Corner Pantry",
        category: "pantry",
        lat: 38.26,
        lng: -104.61,
        address: "456 New Ave, Pueblo, CO",
        source: "OpenStreetMap (node/99)",
        last_verified: "2026-09-02",
      },
      fields_changed: ["id", "name", "category", "lat", "lng", "address", "source", "last_verified"],
    };
    const { db, batch } = makeFakeDb({
      proposal: makeProposal({
        change_type: "add",
        target_venue_id: "osm-node-99",
        proposed_diff: JSON.stringify(addDiff),
      }),
      venue: null,
    });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(200);

    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    const [venueStmt, auditStmt] = stmts;
    expect(venueStmt.sql).toContain("INSERT INTO venues");
    expect(venueStmt.args).toContain("New Corner Pantry");
    expect(venueStmt.args).toContain("draft");
    expect(auditStmt.args[3]).toBe("create");
    expect(auditStmt.args[4]).toBeNull(); // before_json NULL on a genuine create
  });

  test("add proposal whose target id already exists ARCHIVED -> 200, db.batch() RESTORES it (UPDATE, not INSERT) + audit action='update'", async () => {
    const addDiff: ProposedDiff = {
      before: null,
      after: { id: VENUE_ID, name: "Eastside Grocery Restored" },
      fields_changed: ["id", "name"],
    };
    const { db, batch } = makeFakeDb({
      proposal: makeProposal({ change_type: "add", proposed_diff: JSON.stringify(addDiff) }),
      venue: makeVenue({ status: "archived" }),
    });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(200);

    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    const [venueStmt, auditStmt] = stmts;
    expect(venueStmt.sql).toContain("UPDATE venues SET");
    expect(venueStmt.sql).not.toContain("INSERT");
    expect(venueStmt.sql).toContain("status = 'draft'");
    expect(auditStmt.args[3]).toBe("update");
  });

  test("add proposal whose target id already exists NON-archived -> 409 'stale' (real conflict), not applied", async () => {
    const addDiff: ProposedDiff = { before: null, after: { id: VENUE_ID, name: "X" }, fields_changed: ["id", "name"] };
    const { db, batch } = makeFakeDb({
      proposal: makeProposal({ change_type: "add", proposed_diff: JSON.stringify(addDiff) }),
      venue: makeVenue({ status: "published" }),
    });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(409);
    expect(batch).not.toHaveBeenCalled();
  });

  test("a non-numeric id -> 400, D1 never touched", async () => {
    const { db, batch } = makeFakeDb({ proposal: makeProposal(), venue: makeVenue() });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }), "not-a-number");
    expect(res.status).toBe(400);
    expect(batch).not.toHaveBeenCalled();
  });

  test("corrupted proposed_diff JSON -> 422, batch never called", async () => {
    const { db, batch } = makeFakeDb({ proposal: makeProposal({ proposed_diff: "{not valid" }), venue: makeVenue() });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callApprove(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(422);
    expect(batch).not.toHaveBeenCalled();
  });
});
