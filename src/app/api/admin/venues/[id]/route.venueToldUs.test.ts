// @vitest-environment node
/**
 * "The venue told us" checkbox on the edit form (Venue Data Rebuild step 1):
 * which venue_direct pins a save writes. The guarded SQL itself (a stale
 * edit writes no pin) is proved against real SQLite in
 * src/lib/adminVenueEditSql.sql.test.ts.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { ADMIN_ORIGIN } from "@/lib/adminOrigin";
import type { AdminVenueRow } from "@/types/venue";

const ADMIN_EMAIL = "admin@pueblofoodmap.com";
const VENUE_ID = "manual-existing-1";

const mockGetCloudflareContext = vi.fn();
vi.mock("@/lib/cloudflareContext", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const mockRequireAdminSession = vi.fn();
vi.mock("@/lib/adminSession", () => ({
  requireAdminSession: (...args: unknown[]) => mockRequireAdminSession(...args),
}));

import { PATCH } from "@/app/api/admin/venues/[id]/route";

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
    status: "published",
    source_type: "manual",
    outside_county: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    created_by: ADMIN_EMAIL,
    updated_at: "2026-01-01T00:00:00.000Z",
    updated_by: ADMIN_EMAIL,
    published_at: "2026-01-01T00:00:00.000Z",
    published_by: ADMIN_EMAIL,
    ...overrides,
  };
}

function makeFakeDb(existingRow: AdminVenueRow | null) {
  const batch = vi.fn(async (stmts: unknown[]) => stmts.map(() => ({ success: true, results: [], meta: {} })));
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

type Stmt = { sql: string; args: unknown[] };
const pinStatements = (batch: ReturnType<typeof vi.fn>) =>
  (batch.mock.calls[0][0] as Stmt[]).filter((s) => s.sql.includes("venue_observations"));

describe("PATCH /api/admin/venues/[id] — venue-told-us pins", () => {
  beforeEach(() => {
    mockGetCloudflareContext.mockReset();
    mockRequireAdminSession.mockReset();
    mockRequireAdminSession.mockResolvedValue({ email: ADMIN_EMAIL });
  });
  afterEach(() => vi.clearAllMocks());

  test("ticked: pins exactly the fields this save changed, with the note", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow({ address: "123 Test St, Pueblo, CO", phone: "719-555-0100" }));
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callPatch(
      makeRequest({
        origin: ADMIN_ORIGIN,
        body: validPayload({ phone: "719-555-0199", venueToldUs: true, venueToldUsNote: "  Heather, by email  " }),
      }),
    );

    expect(res.status).toBe(200);
    const pins = pinStatements(batch);
    expect(pins).toHaveLength(1);
    expect(pins[0].args.slice(0, 2)).toEqual([VENUE_ID, "phone"]);
    expect(pins[0].args[2]).toBe(JSON.stringify("719-555-0199"));
    expect(pins[0].args[5]).toBe("Heather, by email");
  });

  test("ticked with nothing changed: pins every hours/contact field that has a value", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow({ address: "123 Test St, Pueblo, CO", phone: "719-555-0100" }));
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    await callPatch(makeRequest({ origin: ADMIN_ORIGIN, body: validPayload({ phone: "719-555-0100", venueToldUs: true }) }));

    expect(pinStatements(batch).map((s) => s.args[1])).toEqual(["address", "phone"]);
  });

  test("not ticked: no pin statements at all", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow());
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    await callPatch(makeRequest({ origin: ADMIN_ORIGIN, body: validPayload({ phone: "719-555-0199" }) }));

    expect(pinStatements(batch)).toHaveLength(0);
  });

  test("a blessing box never gets a pin, even ticked", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow({ category: "blessing_box" }));
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callPatch(
      makeRequest({ origin: ADMIN_ORIGIN, body: validPayload({ category: "blessing_box", phone: "719-555-0199", venueToldUs: true }) }),
    );

    expect(res.status).toBe(200);
    expect(pinStatements(batch)).toHaveLength(0);
  });
});
