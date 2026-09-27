/**
 * page.staging.test.tsx (#673 pt.6) — new file rather than adding to
 * page.test.tsx (an existing test file, write-guarded on fix/* branches):
 * covers ONLY the staging banner / Publish-panel-hiding behavior added to
 * /admin/places by #673. page.test.tsx's own auth-guard coverage is
 * untouched.
 *
 * On staging (BETTER_AUTH_RP_ID set — the same signal isProductionWorker()
 * uses, publishVenues.ts), Publish always 403s (#591) and every "edits
 * waiting" status would be a false alarm (staging's D1 test data has no
 * bearing on what production will show), so the Publish panel is replaced
 * by a plain banner and displayStatusOf() is passed isStaging: true.
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { AdminVenueRow } from "@/types/venue";

const mockGetAdminDb = vi.fn();
vi.mock("@/lib/adminDb", () => ({
  getAdminDb: (...args: unknown[]) => mockGetAdminDb(...args),
}));

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: () => null })),
}));

import PlacesPage from "@/app/admin/places/page";

function makeVenueRow(overrides: Partial<AdminVenueRow> = {}): AdminVenueRow {
  return {
    id: "venue-a",
    name: "Eastside Pantry",
    category: "pantry",
    lat: 38.25,
    lng: -104.6,
    address: "123 Test St",
    hours_weekly: null,
    hours_irregular: null,
    accepts_snap: null,
    accepts_wic: null,
    phone: null,
    email: null,
    url: null,
    notes: null,
    operator: null,
    source: "test",
    last_verified: "2026-01-01",
    status: "published",
    source_type: "manual",
    outside_county: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    created_by: "admin@example.com",
    updated_at: "2026-08-01T00:00:00.000Z", // edited after publish -> would be "edits waiting" in production
    updated_by: "admin@example.com",
    published_at: "2026-01-01T00:00:00.000Z",
    published_by: "admin@example.com",
    ...overrides,
  };
}

function makeFakeDb(seedRows: AdminVenueRow[]) {
  return {
    prepare: () => ({
      all: async () => ({ success: true, results: seedRows, meta: {} }),
    }),
  } as unknown as D1Database;
}

describe("PlacesPage — staging banner (#673 pt.6)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("on staging, shows the 'Test site' banner and hides the Publish panel", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: makeFakeDb([makeVenueRow()]),
      identity: { email: "admin@example.com" },
    });
    mockGetCloudflareContext.mockResolvedValue({ env: { BETTER_AUTH_RP_ID: "dev.pueblofoodmap.com" } });

    render(await PlacesPage());

    expect(screen.getByText(/test site: publishing is turned off here/i)).toBeDefined();
    expect(screen.queryByRole("button", { name: /publish/i })).toBeNull();
  });

  test("on staging, no place shows 'Live · edits waiting' even when its D1 content differs from what's published", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: makeFakeDb([makeVenueRow()]),
      identity: { email: "admin@example.com" },
    });
    mockGetCloudflareContext.mockResolvedValue({ env: { BETTER_AUTH_RP_ID: "dev.pueblofoodmap.com" } });

    render(await PlacesPage());

    // "Live · edits waiting" legitimately appears in the status key legend
    // and the status filter's <option> regardless of staging — scoped to
    // the table body (the actual per-row badges) to prove no ROW shows it.
    const table = screen.getByRole("table");
    expect(within(table).queryByText("Live · edits waiting")).toBeNull();
  });

  test("in production, renders the Publish panel and no staging banner", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: makeFakeDb([makeVenueRow()]),
      identity: { email: "admin@example.com" },
    });
    mockGetCloudflareContext.mockResolvedValue({ env: { BETTER_AUTH_RP_ID: undefined } });

    render(await PlacesPage());

    expect(screen.queryByText(/test site: publishing is turned off here/i)).toBeNull();
    expect(screen.getByRole("button", { name: /publish/i })).toBeDefined();
  });
});
