/**
 * Regression test for the #568 review finding (2026-09-24) — new file
 * because src/components/VenueListView.test.tsx is an existing test file
 * (write-guarded on fix/* branches); this covers ONLY the archived row's
 * name-vs-link swap, not the rest of the component (see that file for the
 * baseline #255/#672 name-link coverage this mirrors the fixture of).
 *
 * PATCH /api/admin/venues/[id] refuses an archived-row edit with a 409
 * (src/app/api/admin/venues/[id]/route.ts) — a name link that always
 * dead-ends into that 409 isn't a real action, so an archived row's name
 * stays plain text instead. #672 moved this from a separate Actions column
 * onto the name cell itself (the Actions column no longer exists).
 */

import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VenueListView from "@/components/VenueListView";
import type { AdminVenueRow } from "@/types/venue";
import type { AdminDisplayStatus } from "@/lib/adminVenues";

function makeVenue(overrides: Partial<AdminVenueRow> = {}): AdminVenueRow {
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

function makeStatusMap(venues: AdminVenueRow[]): Record<string, AdminDisplayStatus> {
  return Object.fromEntries(venues.map((v) => [v.id, v.status === "archived" ? "removed" : "draft"]));
}

describe("VenueListView — archived row's name", () => {
  test("an archived row's name is plain text, not a link", () => {
    const venues = [makeVenue({ id: "archived-1", status: "archived" })];
    render(<VenueListView venues={venues} statusByVenueId={makeStatusMap(venues)} />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Eastside Pantry")).toBeDefined();
  });

  test("a draft/published row alongside an archived row still gets its own name link", () => {
    const venues = [
      makeVenue({ id: "draft-1", status: "draft" }),
      makeVenue({ id: "archived-1", name: "Closed Site", status: "archived" }),
    ];
    render(<VenueListView venues={venues} statusByVenueId={makeStatusMap(venues)} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/admin/venues/draft-1/edit");
    expect(screen.getByText("Closed Site")).toBeDefined();
  });
});
