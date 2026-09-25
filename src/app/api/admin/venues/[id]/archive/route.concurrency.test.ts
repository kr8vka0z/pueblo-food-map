// @vitest-environment node
/**
 * Concurrency-specific tests for POST /api/admin/venues/[id]/archive (#265,
 * the route-internal optimistic-concurrency precondition — see route.ts's
 * own header for the full reasoning). Split from the sibling
 * route.test.ts for the same reason as the edit route's own
 * route.concurrency.test.ts: this file's fake batch() must answer
 * `meta.changes` differently per test, where route.test.ts's fixed
 * `meta: {}` default is correct for every one of its own (non-race) cases.
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

import { POST } from "@/app/api/admin/venues/[id]/archive/route";

interface BoundStatement {
  sql: string;
  args: unknown[];
}

function makeExistingRow(overrides: Partial<AdminVenueRow> = {}): AdminVenueRow {
  return {
    id: VENUE_ID,
    name: "Eastside Pantry",
    category: "pantry",
    lat: 38.25,
    lng: -104.6,
    address: "123 Test St, Pueblo, CO",
    hours_weekly: null,
    accepts_snap: null,
    accepts_wic: null,
    phone: null,
    email: null,
    url: null,
    notes: null,
    operator: null,
    source: "Manual entry",
    last_verified: "2026-01-01",
    status: "published",
    source_type: "manual",
    outside_county: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    created_by: ADMIN_EMAIL,
    updated_at: EXISTING_UPDATED_AT,
    updated_by: ADMIN_EMAIL,
    published_at: "2026-01-02T00:00:00.000Z",
    published_by: ADMIN_EMAIL,
    ...overrides,
  };
}

/** Same technique as the sibling edit route's own concurrency test file — statement 0 (archiveVenue) answers `venueUpdateChanges`, everything else gets `meta: {}`. */
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

function makeRequest(opts: { origin?: string } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.origin !== undefined) headers["Origin"] = opts.origin;
  return new NextRequest(`https://pueblofoodmap.com/api/admin/venues/${VENUE_ID}/archive`, {
    method: "POST",
    headers,
  });
}

function callArchive(req: NextRequest, id: string = VENUE_ID) {
  return POST(req, { params: Promise.resolve({ id }) });
}

describe("POST /api/admin/venues/[id]/archive — optimistic concurrency (#265)", () => {
  beforeEach(() => {
    mockGetCloudflareContext.mockReset();
    mockRequireAdminSession.mockReset();
    mockRequireAdminSession.mockResolvedValue({ email: ADMIN_EMAIL });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("the archive UPDATE's WHERE clause carries the row's own updated_at as its precondition", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow(), 1);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    await callArchive(makeRequest({ origin: ADMIN_ORIGIN }));

    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    const [archiveStmt] = stmts;
    expect(archiveStmt.sql).toContain("WHERE id = ? AND updated_at = ?");
    expect(archiveStmt.args).toContain(EXISTING_UPDATED_AT);
  });

  test("D1 reports 0 rows matched (a concurrent write landed between this route's SELECT and its own UPDATE) -> 409, conflict message, no crash", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow(), 0);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callArchive(makeRequest({ origin: ADMIN_ORIGIN }));

    expect(batch).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(409);
    const data = (await res.json()) as { ok: boolean; error: string; message: string };
    expect(data.ok).toBe(false);
    expect(data.error).toBe("conflict");
    expect(data.message).toBe("Someone else changed this place since you opened it. Reload to see their changes.");
  });

  test("0 rows matched -> the audit_log INSERT is SELECT-form, gated on WHERE EXISTS (venues.updated_at = the new timestamp)", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow(), 0);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    await callArchive(makeRequest({ origin: ADMIN_ORIGIN }));

    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    const auditStmt = stmts.find((s) => s.sql.includes("INSERT INTO audit_log"));
    expect(auditStmt).toBeDefined();
    expect(auditStmt!.sql).toContain("SELECT ?, ?, ?, ?, ?, ?, ?");
    expect(auditStmt!.sql).toContain("WHERE EXISTS (SELECT 1 FROM venues WHERE id = ? AND updated_at = ?)");
    expect(auditStmt!.sql).not.toContain("VALUES");
  });

  test("matching precondition (D1 reports 1 row matched) -> 200, audit after_json is exactly the fresh existing row plus the archived fields (fresh by construction)", async () => {
    const existing = makeExistingRow({ phone: "719-555-0199" });
    const { db, batch } = makeFakeDb(existing, 1);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callArchive(makeRequest({ origin: ADMIN_ORIGIN }));
    expect(res.status).toBe(200);

    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    const auditStmt = stmts.find((s) => s.sql.includes("INSERT INTO audit_log"))!;
    const afterJson = JSON.parse(auditStmt.args[5] as string);
    expect(afterJson.status).toBe("archived");
    // The precondition having matched proves `existing` (read moments
    // earlier in this same request) was still fresh — its phone field
    // survives into after_json unchanged, same as every other untouched
    // column (see route.ts's own header, "correct by construction").
    expect(afterJson.phone).toBe("719-555-0199");
  });

  test("submissionId's approve statement is ALSO EXISTS-gated — a stale archive must not approve a closure report for a removal that never wrote", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow(), 0);
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const req = new NextRequest(`https://pueblofoodmap.com/api/admin/venues/${VENUE_ID}/archive`, {
      method: "POST",
      headers: { Origin: ADMIN_ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId: 7 }),
    });

    await callArchive(req);

    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    const approveStmt = stmts.find((s) => s.sql.includes("UPDATE public_submissions"));
    expect(approveStmt).toBeDefined();
    expect(approveStmt!.sql).toContain("AND EXISTS (SELECT 1 FROM venues WHERE id = ? AND updated_at = ?)");
  });
});
