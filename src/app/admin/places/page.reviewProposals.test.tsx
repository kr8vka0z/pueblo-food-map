/**
 * page.reviewProposals.test.tsx (#674) — new file rather than adding to
 * page.test.tsx/page.staging.test.tsx (existing files), same convention the
 * venue edit page already established (page.waitingToPublish.test.tsx):
 * covers ONLY the new "fold Data refresh into Places" D1 wiring — grouping
 * pending change_proposals by target (existing venue vs. genuinely-new
 * add), the reviewRowCount passed to ToReviewSummaryBox, and `?show=review`
 * reaching VenueListView. VenueListView's/ProposalCard's own rendering is
 * covered in their own test files.
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AdminVenueRow } from "@/types/venue";
import type { ChangeProposalRow } from "@/lib/adminProposals";

const mockGetAdminDb = vi.fn();
vi.mock("@/lib/adminDb", () => ({
  getAdminDb: (...args: unknown[]) => mockGetAdminDb(...args),
}));

const mockGetCloudflareContext = vi.fn();
mockGetCloudflareContext.mockResolvedValue({ env: { BETTER_AUTH_RP_ID: undefined } });
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: () => null })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
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
    updated_at: "2026-01-01T00:00:00.000Z",
    updated_by: "admin@example.com",
    published_at: "2026-01-01T00:00:00.000Z",
    published_by: "admin@example.com",
    ...overrides,
  };
}

function makeProposalRow(overrides: Partial<ChangeProposalRow> = {}): ChangeProposalRow {
  return {
    id: 1,
    source: "osm",
    target_venue_id: "venue-a",
    change_type: "update",
    proposed_diff: JSON.stringify({ before: { phone: "1" }, after: { phone: "2" }, fields_changed: ["phone"] }),
    diff_hash: "h1",
    run_id: "run-1",
    anomaly: 0,
    status: "pending",
    created_at: "2026-09-01T12:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    applied_at: null,
    ...overrides,
  };
}

function makeFakeDb(venueRows: AdminVenueRow[], proposalRows: ChangeProposalRow[]) {
  return {
    prepare: (sql: string) => ({
      all: async () => ({
        success: true,
        results: sql.includes("FROM change_proposals") ? proposalRows : venueRows,
        meta: {},
      }),
    }),
  } as unknown as D1Database;
}

describe("PlacesPage — folding Data refresh in (#674)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("a proposal targeting an existing venue attaches to that row, not a synthetic one", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: makeFakeDb([makeVenueRow()], [makeProposalRow()]),
      identity: { email: "admin@example.com" },
    });

    render(await PlacesPage());

    expect(screen.getByText("1 to review · 1 from the data refresh")).toBeDefined();
    expect(screen.queryByText("Suggested new place")).toBeNull();
  });

  test("a proposal with no matching venue renders as its own 'Suggested new place' row", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: makeFakeDb(
        [makeVenueRow()],
        [
          makeProposalRow({
            id: 2,
            target_venue_id: "osm-node-new",
            change_type: "add",
            proposed_diff: JSON.stringify({
              before: null,
              after: { name: "Northside Pantry", category: "pantry", address: "900 Elm St" },
              fields_changed: ["name", "category", "address"],
            }),
          }),
        ],
      ),
      identity: { email: "admin@example.com" },
    });

    render(await PlacesPage());

    expect(screen.getByRole("link", { name: "Northside Pantry" }).getAttribute("href")).toBe("/admin/venues/new?proposal=2");
    expect(screen.getByText("1 to review · 1 from the data refresh")).toBeDefined();
  });

  test("no pending proposals -> no ToReviewSummaryBox at all", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: makeFakeDb([makeVenueRow()], []),
      identity: { email: "admin@example.com" },
    });

    render(await PlacesPage());

    expect(screen.queryByText(/to review ·/)).toBeNull();
  });

  test("?show=review pre-selects the To review chip", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: makeFakeDb([makeVenueRow(), makeVenueRow({ id: "venue-b", name: "Main Street Grocery" })], [makeProposalRow()]),
      identity: { email: "admin@example.com" },
    });

    render(await PlacesPage({ searchParams: Promise.resolve({ show: "review" }) }));

    expect(screen.getByRole("link", { name: "Eastside Pantry" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Main Street Grocery" })).toBeNull();
  });
});
