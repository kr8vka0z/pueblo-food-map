// @vitest-environment node
/**
 * Regression test for #568 item 1 — new file because
 * src/app/api/admin/venues/[id]/route.test.ts is an existing test file
 * (write-guarded on fix/* branches); this covers ONLY the new
 * archived-venue 409 guard, not the rest of the route (see that file for
 * auth/validation/the ordinary edit's batch shape).
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
    status: "archived",
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
  const prepare = () => ({
    bind: () => ({
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

describe("PATCH /api/admin/venues/[id] — archived-venue guard (#568 item 1)", () => {
  beforeEach(() => {
    mockGetCloudflareContext.mockReset();
    mockRequireAdminSession.mockReset();
    mockRequireAdminSession.mockResolvedValue({ email: ADMIN_EMAIL });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("editing an archived venue -> 409 with a clear message, D1 batch never called", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow({ status: "archived" }));
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callPatch(makeRequest({ origin: ADMIN_ORIGIN }));

    expect(res.status).toBe(409);
    const data = (await res.json()) as { ok: boolean; error: string; message: string };
    expect(data.ok).toBe(false);
    expect(data.error).toBe("archived");
    expect(data.message).toMatch(/archived/i);
    expect(batch).not.toHaveBeenCalled();
  });

  test("editing a draft or published venue is unaffected by the guard", async () => {
    const { db, batch } = makeFakeDb(makeExistingRow({ status: "draft" }));
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callPatch(makeRequest({ origin: ADMIN_ORIGIN }));

    expect(res.status).toBe(200);
    expect(batch).toHaveBeenCalledTimes(1);
  });
});
