// @vitest-environment node
/**
 * POST /api/admin/venues — irregular schedule (`hours_irregular`) coverage
 * (#400). New, scoped file rather than an addition to route.test.ts — same
 * "one small file per slice of behavior" convention this repo already uses
 * (route.archivedGuard.test.ts, route.messages.test.ts, etc.), and keeps
 * this PR from touching that existing test file at all.
 *
 * Same fake-D1 (`{sql, args}` bound-statement inspection) and auth-mock
 * pattern as route.test.ts's own header — see that file for the full
 * rationale.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { ADMIN_ORIGIN } from "@/lib/adminOrigin";

const ADMIN_EMAIL = "admin@pueblofoodmap.com";

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const mockRequireAdminSession = vi.fn();
vi.mock("@/lib/adminSession", () => ({
  requireAdminSession: (...args: unknown[]) => mockRequireAdminSession(...args),
}));

import { POST } from "@/app/api/admin/venues/route";

interface BoundStatement {
  sql: string;
  args: unknown[];
}

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
  return new NextRequest("https://pueblofoodmap.com/api/admin/venues", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ADMIN_ORIGIN },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/venues — hours_irregular", () => {
  beforeEach(() => {
    mockGetCloudflareContext.mockReset();
    mockRequireAdminSession.mockReset();
    mockRequireAdminSession.mockResolvedValue({ email: ADMIN_EMAIL });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("hours_irregular is bound as JSON text on the venue INSERT", async () => {
    const { db, batch } = makeFakeDb();
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const irregular = [
      { recurrence: "monthly_ordinal", ordinal: 4, weekday: "tue", slots: ["11:00-12:00"] },
    ];
    const res = await POST(
      makeRequest(validPayload({ hours_irregular: irregular })),
    );
    expect(res.status).toBe(201);

    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    const [venueStmt] = stmts;
    // Compares parsed content, not raw string — validateIrregularSchedule
    // re-serializes with its OWN key order (recurrence, slots, then
    // weekday/ordinal), which needn't match this test's literal's order.
    const bound = venueStmt.args.find((a) => typeof a === "string" && a.includes("monthly_ordinal"));
    expect(bound).toBeDefined();
    expect(JSON.parse(bound as string)).toEqual(irregular);
  });

  test("hours_irregular omitted -> bound as null, not undefined or '[]'", async () => {
    const { db, batch } = makeFakeDb();
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(201);

    const stmts = batch.mock.calls[0][0] as BoundStatement[];
    const [venueStmt] = stmts;
    expect(venueStmt.args).toContain(null);
    expect(venueStmt.args).not.toContain("[]");
    expect(venueStmt.args).not.toContain(undefined);
  });

  test("an invalid hours_irregular shape is rejected with 422, same trust boundary as hours_weekly", async () => {
    const { db } = makeFakeDb();
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await POST(
      makeRequest(validPayload({ hours_irregular: [{ recurrence: "not_a_real_kind" }] })),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { errors: Record<string, string> };
    expect(body.errors.hours_irregular).toBeDefined();
  });
});
