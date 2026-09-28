/**
 * page.boxReview.test.tsx (#677, "fold Photo review and Sponsor requests
 * into the Blessing Boxes tab") — new file rather than adding to
 * page.test.tsx (an existing test file, write-guarded on fix/* branches):
 * covers ONLY resolveBoxReviewItems()'s D1 wiring and BoxReviewBox's
 * render. Card-level behavior is already covered by
 * PhotoReviewCard.test.tsx / SponsorRequestCard.test.tsx / BoxReviewBox.test.tsx;
 * this file only proves the page loads the right rows for the right venue
 * and renders them.
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AdminVenueRow } from "@/types/venue";

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

vi.mock("@/components/AddVenueForm", () => ({
  default: () => <div data-testid="add-venue-form-stub" />,
}));

vi.mock("@/components/ArchiveVenueButton", () => ({
  default: () => <div data-testid="archive-button-stub" />,
}));

// Both call useRouter() (real app-router hook, not mounted in a plain
// render()) — stub them the same way page.waitingToPublish.test.tsx stubs
// AddVenueForm/ArchiveVenueButton, since neither is what this file tests.
vi.mock("@/components/BoxCheckinsAdminPanel", () => ({
  default: () => <div data-testid="box-checkins-panel-stub" />,
}));

vi.mock("@/components/HostAlertsAdminPanel", () => ({
  default: () => <div data-testid="host-alerts-panel-stub" />,
}));

// Real card behavior (PhotoReviewCard/SponsorRequestCard's own
// useRouter().refresh() calls) is covered elsewhere — stub useRouter here
// too, since this file's plain render() has no mounted app router.
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    forbidden: vi.fn(),
    notFound: vi.fn(),
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  };
});

import EditVenuePage from "@/app/(site)/admin/venues/[id]/edit/page";

function makeRow(overrides: Partial<AdminVenueRow> = {}): AdminVenueRow {
  return {
    id: "box-1",
    name: "216 W Routt Blessing Box",
    category: "blessing_box",
    lat: 38.27,
    lng: -104.6,
    address: "216 W Routt Ave, Pueblo, CO",
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
    status: "published",
    source_type: "manual",
    outside_county: 0,
    created_at: "2026-07-01T00:00:00.000Z",
    created_by: "admin@pueblofoodmap.com",
    updated_at: "2026-08-01T00:00:00.000Z",
    updated_by: "editor@pueblofoodmap.com",
    published_at: "2026-01-01T00:00:00.000Z",
    published_by: "admin@pueblofoodmap.com",
    ...overrides,
  };
}

/**
 * Dispatches on SQL text: venues SELECT (.first), box_photos review-queue
 * SELECT and box_adopters pending SELECT (.all). loadReviewQueue() and
 * loadPendingAdopters() (boxPhotos.ts/boxAdopters.ts) call `.all()`
 * DIRECTLY on the prepared statement with no `.bind()` first (unlike this
 * page's own bound queries) — so `.first`/`.all` must exist both before AND
 * after `.bind()`, matching D1's real chainable-or-not shape.
 */
function makeDb(
  venueRow: AdminVenueRow | null,
  photoRows: unknown[] = [],
  adopterRows: unknown[] = [],
) {
  return {
    prepare: (sql: string) => {
      const first = async () => (sql.includes("FROM venues") ? venueRow : null);
      const all = async () => {
        if (sql.includes("FROM box_photos")) return { results: photoRows };
        if (sql.includes("FROM box_adopters")) return { results: adopterRows };
        return { results: [] };
      };
      return { first, all, bind: () => ({ first, all }) };
    },
  } as unknown as object;
}

function photoRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    venue_id: "box-1",
    venue_name: "216 W Routt Blessing Box",
    checkin_id: null,
    checkin_kind: null,
    status: "pending",
    flag_count: 0,
    created_at: "2026-09-18T15:00:00.000Z",
    ...overrides,
  };
}

function adopterRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    venue_id: "box-1",
    venue_name: "216 W Routt Blessing Box",
    display_name: "The Martinez Family",
    email: "martinez@example.com",
    note: null,
    status: "pending",
    email_confirmed_at: "2026-09-18T15:00:00.000Z",
    created_at: "2026-09-18T14:00:00.000Z",
    ...overrides,
  };
}

describe("EditVenuePage — box review items (#677)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("a blessing_box with a pending photo and a pending sponsor request renders both cards", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: makeDb(makeRow(), [photoRow()], [adopterRow()]),
      identity: { email: "admin@example.com" },
    });

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "box-1" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByText("Things to review (2)")).toBeDefined();
    expect(screen.getByRole("button", { name: "Approve" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Approve sponsor" })).toBeDefined();
  });

  test("only THIS venue's review items show — another box's rows are filtered out", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: makeDb(
        makeRow(),
        [photoRow({ id: 9, venue_id: "some-other-box" })],
        [adopterRow({ id: 9, venue_id: "some-other-box" })],
      ),
      identity: { email: "admin@example.com" },
    });

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "box-1" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.queryByText(/Things to review/)).toBeNull();
  });

  test("a box removed from service still shows and can resolve its review items", async () => {
    // removed_on isn't a venues column read by this page directly — the
    // Risk this proves is that resolveBoxReviewItems() has no removedOn/
    // status filter of its own that would hide a removed box's items.
    mockGetAdminDb.mockResolvedValue({
      db: makeDb(makeRow({ status: "draft" }), [photoRow()], []),
      identity: { email: "admin@example.com" },
    });

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "box-1" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByText("Things to review (1)")).toBeDefined();
  });

  test("a non-box venue never renders the review box, even if box_photos/box_adopters had matching rows", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: makeDb(makeRow({ category: "pantry" }), [photoRow({ venue_id: "box-1" })], []),
      identity: { email: "admin@example.com" },
    });

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "box-1" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.queryByText(/Things to review/)).toBeNull();
  });

  test("a D1 failure reading review items degrades to no box, never crashes the page", async () => {
    const throwingDb = {
      prepare: (sql: string) => {
        const first = async () => (sql.includes("FROM venues") ? makeRow() : null);
        const all = async () => {
          throw new Error("D1 unavailable");
        };
        return { first, all, bind: () => ({ first, all }) };
      },
    } as unknown as object;
    mockGetAdminDb.mockResolvedValue({ db: throwingDb, identity: { email: "admin@example.com" } });

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "box-1" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.queryByText(/Things to review/)).toBeNull();
    expect(screen.getByTestId("add-venue-form-stub")).toBeDefined();
  });
});
