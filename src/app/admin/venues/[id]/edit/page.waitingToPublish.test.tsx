/**
 * page.waitingToPublish.test.tsx (#673 pt.3) — new file rather than adding
 * to page.test.tsx (an existing test file, write-guarded on fix/*
 * branches): covers ONLY the "Waiting to publish" box's D1 wiring
 * (resolveWaitingToPublishChanges — audit_log + change_proposals reads,
 * displayStatusOf gating, staging suppression). The field-diff and
 * attribution RULES themselves (diffPublishedFields, attributeFieldChange)
 * are unit-tested directly in src/lib/adminVenues.test.ts; this file only
 * proves the page calls them with the right data and renders the result.
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

vi.mock("@/components/AddVenueForm", () => ({
  default: () => <div data-testid="add-venue-form-stub" />,
}));

vi.mock("@/components/ArchiveVenueButton", () => ({
  default: () => <div data-testid="archive-button-stub" />,
}));

// The real published-venues.ts holds ~2000 real entries; this venue id
// never matches any of them, so mocking to one controlled entry is the only
// way to pin "what's live" for this test's diff.
vi.mock("@/data/published-venues", () => ({
  publishedVenues: [
    {
      id: "manual-abc",
      name: "Eastside Pantry",
      category: "pantry",
      lat: 38.25,
      lng: -104.6,
      address: "123 Test St, Pueblo, CO",
      source: "Manual entry",
      last_verified: "2026-07-03",
    },
  ],
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

/** Dispatches on SQL text: venues SELECT (.first), audit_log SELECT (.all), change_proposals SELECT (.all). */
function makeDb(
  venueRow: AdminVenueRow | null,
  auditRows: Array<{ actor_email: string; before_json: string | null; after_json: string; timestamp: string }> = [],
  proposalRows: Array<{ actor_email: string | null; applied_at: string }> = [],
) {
  return {
    prepare: (sql: string) => ({
      bind: () => ({
        first: async () => (sql.includes("FROM venues") ? venueRow : null),
        all: async () => {
          if (sql.includes("FROM audit_log")) return { results: auditRows };
          if (sql.includes("FROM change_proposals")) return { results: proposalRows };
          return { results: [] };
        },
      }),
    }),
  } as unknown as object;
}

describe("EditVenuePage — Waiting to publish box (#673 pt.3)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("a place with real content differences from what's live renders the box with field diffs and attribution", async () => {
    mockGetCloudflareContext.mockResolvedValue({ env: { BETTER_AUTH_RP_ID: undefined } }); // production
    mockGetAdminDb.mockResolvedValue({
      db: makeDb(
        makeRow({ name: "Eastside Food Pantry" }),
        [
          {
            actor_email: "editor@pueblofoodmap.com",
            before_json: JSON.stringify({ name: "Eastside Pantry" }),
            after_json: JSON.stringify({ name: "Eastside Food Pantry" }),
            timestamp: "2026-08-01T00:00:00.000Z",
          },
        ],
        [],
      ),
      identity: { email: "editor@pueblofoodmap.com" },
    });

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "manual-abc" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByText("Waiting to publish")).toBeDefined();
    expect(screen.getByText("Eastside Pantry")).toBeDefined();
    expect(screen.getByText("Eastside Food Pantry")).toBeDefined();
    expect(screen.getByText("Changed by You")).toBeDefined();
  });

  test("a place identical to what's live shows no Waiting-to-publish box", async () => {
    mockGetCloudflareContext.mockResolvedValue({ env: { BETTER_AUTH_RP_ID: undefined } });
    mockGetAdminDb.mockResolvedValue({
      db: makeDb(makeRow()), // name matches the mocked published snapshot exactly
      identity: { email: "editor@pueblofoodmap.com" },
    });

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "manual-abc" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.queryByText("Waiting to publish")).toBeNull();
  });

  // #673 pt.4 — a last_verified-only bump must never show the box.
  test("a place whose only difference is last_verified shows no box", async () => {
    mockGetCloudflareContext.mockResolvedValue({ env: { BETTER_AUTH_RP_ID: undefined } });
    mockGetAdminDb.mockResolvedValue({
      db: makeDb(makeRow({ last_verified: "2026-08-15" })),
      identity: { email: "editor@pueblofoodmap.com" },
    });

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "manual-abc" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.queryByText("Waiting to publish")).toBeNull();
  });

  // #673 pt.5 — boxes are live without publishing; never "edits waiting."
  test("a blessing_box never shows the box, even with content differences", async () => {
    mockGetCloudflareContext.mockResolvedValue({ env: { BETTER_AUTH_RP_ID: undefined } });
    mockGetAdminDb.mockResolvedValue({
      db: makeDb(makeRow({ category: "blessing_box", status: "draft", name: "A Different Name" })),
      identity: { email: "editor@pueblofoodmap.com" },
    });

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "manual-abc" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.queryByText("Waiting to publish")).toBeNull();
  });

  // #673 pt.6 — staging can never Publish; never show a false "edits waiting."
  test("on staging, no box renders even for a place whose content really differs", async () => {
    mockGetCloudflareContext.mockResolvedValue({ env: { BETTER_AUTH_RP_ID: "dev.pueblofoodmap.com" } });
    mockGetAdminDb.mockResolvedValue({
      db: makeDb(makeRow({ name: "Eastside Food Pantry" })),
      identity: { email: "editor@pueblofoodmap.com" },
    });

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "manual-abc" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.queryByText("Waiting to publish")).toBeNull();
  });

  test("labels an approved Data Refresh proposal correctly when applied_at matches the audit timestamp", async () => {
    mockGetCloudflareContext.mockResolvedValue({ env: { BETTER_AUTH_RP_ID: undefined } });
    mockGetAdminDb.mockResolvedValue({
      db: makeDb(
        makeRow({ name: "Eastside Food Pantry" }),
        [
          {
            actor_email: "editor@pueblofoodmap.com",
            before_json: JSON.stringify({ name: "Eastside Pantry" }),
            after_json: JSON.stringify({ name: "Eastside Food Pantry" }),
            timestamp: "2026-08-01T00:00:00.000Z",
          },
        ],
        [{ actor_email: "editor@pueblofoodmap.com", applied_at: "2026-08-01T00:00:00.000Z" }],
      ),
      // A DIFFERENT viewer than the one who approved — proves this reads
      // "who acted," not "who's viewing," for the approval-attribution branch.
      identity: { email: "someone-else@pueblofoodmap.com" },
    });

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "manual-abc" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByText("Changed by Approved from Data refresh by editor@pueblofoodmap.com")).toBeDefined();
  });
});
