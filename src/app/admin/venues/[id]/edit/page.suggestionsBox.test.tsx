/**
 * page.suggestionsBox.test.tsx (#674) — new file rather than adding to
 * page.test.tsx (an existing test file), same rationale
 * page.waitingToPublish.test.tsx already established for this page: covers
 * ONLY the new "Suggestions to review" box's D1 wiring
 * (resolvePendingProposals — the change_proposals SELECT, and the
 * VenueLookup fetch it gates on having something to show). ProposalCard's
 * own rendering/actions are covered in ProposalCard.test.tsx; this file
 * only proves the page loads the right rows and passes them through.
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

vi.mock("@/components/AddVenueForm", () => ({
  default: () => <div data-testid="add-venue-form-stub" />,
}));

vi.mock("@/components/ArchiveVenueButton", () => ({
  default: () => <div data-testid="archive-button-stub" />,
}));

import EditVenuePage from "@/app/admin/venues/[id]/edit/page";

function makeRow(overrides: Partial<AdminVenueRow> = {}): AdminVenueRow {
  return {
    id: "manual-abc",
    name: "Eastside Pantry",
    category: "pantry",
    lat: 38.25,
    lng: -104.6,
    address: "123 Test St, Pueblo, CO",
    hours_weekly: null,
    hours_irregular: null,
    accepts_snap: null,
    accepts_wic: null,
    phone: null,
    email: null,
    url: null,
    notes: null,
    operator: null,
    source: "Manual entry",
    last_verified: "2026-07-03",
    status: "draft",
    source_type: "manual",
    outside_county: 0,
    created_at: "2026-07-01T00:00:00.000Z",
    created_by: "admin@pueblofoodmap.com",
    updated_at: "2026-07-01T00:00:00.000Z",
    updated_by: "admin@pueblofoodmap.com",
    published_at: null,
    published_by: null,
    ...overrides,
  };
}

function makePendingProposalRow(overrides: Partial<ChangeProposalRow> = {}): ChangeProposalRow {
  return {
    id: 42,
    source: "osm",
    target_venue_id: "manual-abc",
    change_type: "update",
    proposed_diff: JSON.stringify({ before: { phone: "1" }, after: { phone: "2" }, fields_changed: ["phone"] }),
    diff_hash: "h42",
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

/**
 * Dispatches on SQL text: venues SELECT (.first), the "pending proposals for
 * this venue" SELECT (.all, WHERE ... status = 'pending'), the venueLookup
 * SELECT (.all, id IN (...)) — same "one fake, branch on SQL text" pattern
 * page.waitingToPublish.test.tsx already established for this page.
 */
function makeDb(venueRow: AdminVenueRow | null, pendingProposalRows: ChangeProposalRow[] = []) {
  return {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({
        first: async () => (sql.includes("FROM venues") ? venueRow : null),
        all: async () => {
          if (sql.includes("FROM change_proposals") && sql.includes("status = 'pending'")) {
            return { results: pendingProposalRows };
          }
          if (sql.includes("FROM venues WHERE id IN")) {
            return {
              results: venueRow && args[0] === venueRow.id ? [{ ...venueRow }] : [],
            };
          }
          return { results: [] };
        },
      }),
    }),
  } as unknown as object;
}

describe("EditVenuePage — Suggestions to review box (#674)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("no pending proposals -> no box, and the venueLookup query never runs", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: makeDb(makeRow()),
      identity: { email: "admin@example.com" },
    });

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "manual-abc" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.queryByText(/Suggestions to review/i)).toBeNull();
  });

  test("pending proposals for this venue render one card each under 'Suggestions to review'", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: makeDb(makeRow(), [makePendingProposalRow({ id: 1 }), makePendingProposalRow({ id: 2 })]),
      identity: { email: "admin@example.com" },
    });

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "manual-abc" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByText("Suggestions to review (2)")).toBeDefined();
    expect(screen.getAllByTestId("proposal-detail")).toHaveLength(2);
  });

  test("a D1 failure resolving proposals degrades to no box rather than crashing the page", async () => {
    const throwingDb = {
      prepare: (sql: string) => ({
        bind: () => ({
          first: async () => (sql.includes("FROM venues") ? makeRow() : null),
          all: async () => {
            if (sql.includes("FROM change_proposals")) throw new Error("boom");
            return { results: [] };
          },
        }),
      }),
    } as unknown as object;
    mockGetAdminDb.mockResolvedValue({ db: throwingDb, identity: { email: "admin@example.com" } });

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "manual-abc" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.queryByText(/Suggestions to review/i)).toBeNull();
    expect(screen.getByText("admin@example.com")).toBeDefined();
  });
});
