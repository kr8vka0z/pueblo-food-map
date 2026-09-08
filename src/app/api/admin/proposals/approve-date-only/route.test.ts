// @vitest-environment node
/**
 * Route-level tests for POST /api/admin/proposals/approve-date-only.
 *
 * Same full-stack mocking pattern as
 * src/app/api/admin/proposals/[id]/approve/route.test.ts: fakes
 * @opennextjs/cloudflare's D1 binding and requireAdminSession() as a
 * controllable mock, then inspects db.batch() calls (one per approved
 * proposal — this route calls the shared applyApprovedProposal() engine
 * once per valid id, not one combined batch across ids).
 *
 * Covers the issue's own required cases: a clean happy path, a mixed batch
 * where each invalid shape is skipped with its own reason while the valid
 * ones still apply, the per-request id cap, and the same auth failure
 * shapes the single-proposal route returns.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { AccessDeniedError, ADMIN_ORIGIN } from "@/lib/cfAccess";
import type { AdminVenueRow } from "@/types/venue";
import type { ChangeProposalRow, ProposedDiff } from "@/lib/adminProposals";

const ADMIN_EMAIL = "admin@pueblofoodmap.com";

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const mockRequireAdminSession = vi.fn();
vi.mock("@/lib/adminSession", () => ({
  requireAdminSession: (...args: unknown[]) => mockRequireAdminSession(...args),
}));

import { POST } from "@/app/api/admin/proposals/approve-date-only/route";

// ─── Fixtures / helpers ─────────────────────────────────────────────────────

interface BoundStatement {
  sql: string;
  args: unknown[];
}

/** A date-only update: change_type 'update', source osm/plentiful, fields_changed exactly ["last_verified"] — the one shape this route ever applies. */
function makeDateOnlyProposal(id: number, overrides: Partial<ChangeProposalRow> = {}): ChangeProposalRow {
  const diff: ProposedDiff = {
    before: { last_verified: "2026-08-01" },
    after: { last_verified: "2026-09-05" },
    fields_changed: ["last_verified"],
  };
  return {
    id,
    source: "plentiful",
    target_venue_id: `venue-${id}`,
    change_type: "update",
    proposed_diff: JSON.stringify(diff),
    diff_hash: `hash-${id}`,
    run_id: "run-1",
    anomaly: 0,
    status: "pending",
    created_at: "2026-09-01T00:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    applied_at: null,
    ...overrides,
  };
}

function makeVenueFor(id: number, overrides: Partial<AdminVenueRow> = {}): AdminVenueRow {
  return {
    id: `venue-${id}`,
    name: `Venue ${id}`,
    category: "pantry",
    lat: 38.25,
    lng: -104.6,
    address: "1 Test St, Pueblo, CO",
    hours_weekly: null,
    accepts_snap: null,
    accepts_wic: null,
    phone: null,
    email: null,
    url: null,
    notes: null,
    operator: null,
    source: "Plentiful",
    last_verified: "2026-08-01", // matches makeDateOnlyProposal's diff.before — not stale
    status: "published",
    source_type: "plentiful",
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
 * Fake D1: the `IN (...)` proposal pre-fetch reads from `proposals` (and
 * records each bound arg list so the chunking test can assert on it), the
 * per-proposal venue lookup inside applyApprovedProposal() reads from
 * `venuesById`, and `.run()`/`.batch()` are spies that always report
 * success — none of these fixtures are meant to exercise the stale-apply
 * 409 path (that's this route's shared-engine dependency, already covered
 * by adminProposals.test.ts and the single-approve route's own tests).
 */
function makeFakeDb(opts: { proposals: ChangeProposalRow[]; venuesById?: Record<string, AdminVenueRow | undefined> }) {
  const proposalsById = new Map(opts.proposals.map((p) => [p.id, p]));
  const venuesById = opts.venuesById ?? {};
  const inQueryBindCounts: number[] = [];
  const inQueryCount = { value: 0 };

  const batch = vi.fn(async (stmts: BoundStatement[]) => stmts.map(() => ({ success: true, results: [], meta: { changes: 1 } })));

  const prepare = (sql: string) => ({
    bind: (...args: unknown[]) => ({
      sql,
      args,
      first: async <T,>(): Promise<T | null> => {
        if (sql.includes("FROM venues")) {
          return (venuesById[args[0] as string] ?? null) as unknown as T | null;
        }
        return null;
      },
      all: async <T,>(): Promise<{ success: true; results: T[]; meta: object }> => {
        if (sql.includes("FROM change_proposals WHERE id IN")) {
          inQueryCount.value += 1;
          inQueryBindCounts.push(args.length);
          const results = (args as number[]).map((id) => proposalsById.get(id)).filter((r): r is ChangeProposalRow => r !== undefined);
          return { success: true, results: results as unknown as T[], meta: {} };
        }
        return { success: true, results: [] as T[], meta: {} };
      },
      run: async () => ({ success: true, results: [], meta: { changes: 1 } }),
    }),
  });

  return {
    db: { prepare, batch } as unknown as D1Database,
    batch,
    getInQueryCount: () => inQueryCount.value,
    getInQueryBindCounts: () => inQueryBindCounts,
  };
}

function makeRequest(opts: { origin?: string; body?: unknown; rawBody?: string } = {}): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.origin !== undefined) headers["Origin"] = opts.origin;
  return new NextRequest("https://pueblofoodmap.com/api/admin/proposals/approve-date-only", {
    method: "POST",
    headers,
    body: opts.rawBody ?? JSON.stringify(opts.body ?? { ids: [] }),
  });
}

describe("POST /api/admin/proposals/approve-date-only", () => {
  beforeEach(() => {
    mockGetCloudflareContext.mockReset();
    mockRequireAdminSession.mockReset();
    mockRequireAdminSession.mockResolvedValue({ email: ADMIN_EMAIL });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Auth — same shapes the single-proposal route returns ───────────────
  test("no Better Auth session -> 401, D1 never touched", async () => {
    mockRequireAdminSession.mockRejectedValue(new AccessDeniedError("no_session"));
    const { db, batch } = makeFakeDb({ proposals: [] });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await POST(makeRequest({ origin: ADMIN_ORIGIN, body: { ids: [1] } }));
    expect(res.status).toBe(401);
    expect(batch).not.toHaveBeenCalled();
  });

  test("valid session but wrong/missing Origin -> 403, D1 never touched", async () => {
    const { db, batch } = makeFakeDb({ proposals: [] });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    expect((await POST(makeRequest({ origin: "https://evil.example.com", body: { ids: [1] } }))).status).toBe(403);
    expect((await POST(makeRequest({ body: { ids: [1] } }))).status).toBe(403);
    expect(batch).not.toHaveBeenCalled();
  });

  // ── Malformed / oversized requests ──────────────────────────────────────
  test("malformed JSON body -> 400, D1 never touched", async () => {
    const { db, batch } = makeFakeDb({ proposals: [] });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await POST(makeRequest({ origin: ADMIN_ORIGIN, rawBody: "{not valid json" }));
    expect(res.status).toBe(400);
    expect(batch).not.toHaveBeenCalled();
  });

  test("ids missing/not-an-array/empty/non-integer -> 400, D1 never touched", async () => {
    const { db, batch } = makeFakeDb({ proposals: [] });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    expect((await POST(makeRequest({ origin: ADMIN_ORIGIN, body: {} }))).status).toBe(400);
    expect((await POST(makeRequest({ origin: ADMIN_ORIGIN, body: { ids: "not-an-array" } }))).status).toBe(400);
    expect((await POST(makeRequest({ origin: ADMIN_ORIGIN, body: { ids: [] } }))).status).toBe(400);
    expect((await POST(makeRequest({ origin: ADMIN_ORIGIN, body: { ids: [1, "two"] } }))).status).toBe(400);
    expect((await POST(makeRequest({ origin: ADMIN_ORIGIN, body: { ids: [1, -1] } }))).status).toBe(400);
    expect(batch).not.toHaveBeenCalled();
  });

  test("more than 200 ids -> 400, D1 never touched", async () => {
    const { db, batch } = makeFakeDb({ proposals: [] });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const ids = Array.from({ length: 201 }, (_, i) => i + 1);
    const res = await POST(makeRequest({ origin: ADMIN_ORIGIN, body: { ids } }));
    expect(res.status).toBe(400);
    expect(batch).not.toHaveBeenCalled();
  });

  // ── Happy path ───────────────────────────────────────────────────────────
  test("3 valid date-only ids -> 200, all 3 approved, one db.batch() call per proposal", async () => {
    const proposals = [1, 2, 3].map((id) => makeDateOnlyProposal(id));
    const venuesById = Object.fromEntries([1, 2, 3].map((id) => [`venue-${id}`, makeVenueFor(id)]));
    const { db, batch } = makeFakeDb({ proposals, venuesById });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await POST(makeRequest({ origin: ADMIN_ORIGIN, body: { ids: [1, 2, 3] } }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { approved: number; skipped: { id: number; reason: string }[] };
    expect(data.approved).toBe(3);
    expect(data.skipped).toEqual([]);
    expect(batch).toHaveBeenCalledTimes(3);
  });

  // ── Mixed batch — every invalid shape skipped with its own reason ──────
  test("mixed batch: link_health source, extra changed field, and already-approved status are all skipped; the 2 valid ones still approve", async () => {
    const proposals: ChangeProposalRow[] = [
      makeDateOnlyProposal(1),
      makeDateOnlyProposal(2, { source: "link_health" }),
      makeDateOnlyProposal(3, {
        proposed_diff: JSON.stringify({
          before: { last_verified: "2026-08-01", phone: "719-555-0100" },
          after: { last_verified: "2026-09-05", phone: "719-555-0199" },
          fields_changed: ["last_verified", "phone"],
        } satisfies ProposedDiff),
      }),
      makeDateOnlyProposal(4, { status: "approved" }),
      makeDateOnlyProposal(5),
    ];
    const venuesById = Object.fromEntries([1, 2, 3, 4, 5].map((id) => [`venue-${id}`, makeVenueFor(id)]));
    const { db, batch } = makeFakeDb({ proposals, venuesById });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await POST(makeRequest({ origin: ADMIN_ORIGIN, body: { ids: [1, 2, 3, 4, 5] } }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { approved: number; skipped: { id: number; reason: string }[] };

    expect(data.approved).toBe(2); // ids 1 and 5
    expect(data.skipped).toHaveLength(3);
    const reasonsById = Object.fromEntries(data.skipped.map((s) => [s.id, s.reason]));
    expect(reasonsById[2]).toBeTruthy(); // link_health
    expect(reasonsById[3]).toBeTruthy(); // extra changed field
    expect(reasonsById[4]).toBeTruthy(); // not pending
    // Only the 2 approvable proposals ever reach the apply engine's db.batch().
    expect(batch).toHaveBeenCalledTimes(2);
  });

  test("an id with no matching proposal row -> skipped with a reason, doesn't block the rest", async () => {
    const proposals = [makeDateOnlyProposal(1)];
    const venuesById = { "venue-1": makeVenueFor(1) };
    const { db, batch } = makeFakeDb({ proposals, venuesById });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await POST(makeRequest({ origin: ADMIN_ORIGIN, body: { ids: [1, 999] } }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { approved: number; skipped: { id: number; reason: string }[] };
    expect(data.approved).toBe(1);
    expect(data.skipped).toEqual([{ id: 999, reason: expect.any(String) }]);
    expect(batch).toHaveBeenCalledTimes(1);
  });

  // ── D1 100-bound-parameter reuse (#397) ─────────────────────────────────
  test("150 ids -> the change_proposals pre-fetch chunks at D1's 100 bound-parameter cap, never one 150-param statement", async () => {
    const ids = Array.from({ length: 150 }, (_, i) => i + 1);
    const proposals = ids.map((id) => makeDateOnlyProposal(id));
    const venuesById = Object.fromEntries(ids.map((id) => [`venue-${id}`, makeVenueFor(id)]));
    const { db, getInQueryCount, getInQueryBindCounts } = makeFakeDb({ proposals, venuesById });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await POST(makeRequest({ origin: ADMIN_ORIGIN, body: { ids } }));
    expect(res.status).toBe(200);
    expect(getInQueryCount()).toBe(2);
    expect(getInQueryBindCounts()).toEqual([100, 50]);
    for (const count of getInQueryBindCounts()) {
      expect(count).toBeLessThanOrEqual(100);
    }
  });

  test("duplicate ids in the request are deduped — approved once, not twice", async () => {
    const proposals = [makeDateOnlyProposal(1)];
    const venuesById = { "venue-1": makeVenueFor(1) };
    const { db, batch } = makeFakeDb({ proposals, venuesById });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await POST(makeRequest({ origin: ADMIN_ORIGIN, body: { ids: [1, 1, 1] } }));
    const data = (await res.json()) as { approved: number; skipped: unknown[] };
    expect(data.approved).toBe(1);
    expect(batch).toHaveBeenCalledTimes(1);
  });
});
