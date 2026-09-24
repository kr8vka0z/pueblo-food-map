// @vitest-environment node
/**
 * PATCH /api/admin/venues/[id] — irregular schedule (`hours_irregular`)
 * coverage (#400). New, scoped file — same convention as this directory's
 * own route.archivedGuard.test.ts; see route.test.ts's header for the full
 * fake-D1 rationale this file reuses verbatim.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { ADMIN_ORIGIN } from "@/lib/adminOrigin";
import type { AdminVenueRow } from "@/types/venue";

const ADMIN_EMAIL = "admin@pueblofoodmap.com";
const VENUE_ID = "manual-existing-1";

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
    name: "Lynn Gardens Baptist Church",
    category: "pantry",
    lat: 38.223992,
    lng: -104.656767,
    address: "3804 W. Pueblo Blvd, Pueblo, CO 81005",
    hours_weekly: JSON.stringify({ thu: ["11:00 AM - 12:45 PM"] }),
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
    updated_at: "2026-01-01T00:00:00.000Z",
    updated_by: ADMIN_EMAIL,
    published_at: null,
    published_by: null,
    ...overrides,
  };
}

function makeFakeDb(existingRow: AdminVenueRow | null) {
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

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Lynn Gardens Baptist Church",
    category: "pantry",
    lat: 38.223992,
    lng: -104.656767,
    address: "3804 W. Pueblo Blvd, Pueblo, CO 81005",
    source: "Manual entry",
    last_verified: "2026-07-03",
    ...overrides,
  };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(`https://pueblofoodmap.com/api/admin/venues/${VENUE_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Origin: ADMIN_ORIGIN },
    body: JSON.stringify(body),
  });
}

function callPatch(req: NextRequest) {
  return PATCH(req, { params: Promise.resolve({ id: VENUE_ID }) });
}

describe("PATCH /api/admin/venues/[id] — hours_irregular", () => {
  beforeEach(() => {
    mockGetCloudflareContext.mockReset();
    mockRequireAdminSession.mockReset();
    mockRequireAdminSession.mockResolvedValue({ email: ADMIN_EMAIL });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("hours_irregular is bound as JSON text on the venue UPDATE, weekly + monthly together (Lynn Gardens shape)", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow());
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const irregular = [
      { recurrence: "monthly_ordinal", ordinal: 2, weekday: "thu", slots: ["11:00 AM - 12:45 PM"] },
      { recurrence: "monthly_ordinal", ordinal: 4, weekday: "thu", slots: ["11:00 AM - 12:45 PM"] },
    ];
    const res = await callPatch(
      makeRequest(validPayload({ hours_weekly: { thu: ["11:00 AM - 12:45 PM"] }, hours_irregular: irregular })),
    );
    expect(res.status).toBe(200);

    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    const [venueStmt] = stmts;
    expect(venueStmt.args).toContain(JSON.stringify({ thu: ["11:00 AM - 12:45 PM"] }));
    // Compares parsed content, not raw string — see the sibling create-route
    // test's own comment on why (validateIrregularSchedule's own key order).
    const bound = venueStmt.args.find((a) => typeof a === "string" && a.includes("monthly_ordinal"));
    expect(bound).toBeDefined();
    expect(JSON.parse(bound as string)).toEqual(irregular);
  });

  test("clearing hours_irregular on an edit binds null", async () => {
    const { db, batch } = makeFakeDb(
      makeExistingRow({
        hours_irregular: JSON.stringify([
          { recurrence: "monthly_ordinal", ordinal: 4, weekday: "tue", slots: ["11:00-12:00"] },
        ]),
      }),
    );
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callPatch(makeRequest(validPayload())); // no hours_irregular in the payload
    expect(res.status).toBe(200);

    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    const [venueStmt] = stmts;
    expect(venueStmt.args).toContain(null);
  });
});
