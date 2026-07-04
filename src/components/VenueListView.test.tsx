/**
 * Tests for the "Edit" affordance added to VenueListView (#255). Pre-#255
 * rendering (search/filter behavior) shipped in #253 with no dedicated test
 * file of its own; this file covers only the new per-row Edit link rather
 * than retroactively writing full regression coverage for #253's own
 * behavior — out of scope for this slice.
 */

import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VenueListView from "@/components/VenueListView";
import type { AdminVenueRow } from "@/types/venue";

function makeVenue(overrides: Partial<AdminVenueRow> = {}): AdminVenueRow {
  return {
    id: "manual-abc",
    name: "Eastside Pantry",
    category: "pantry",
    lat: 38.25,
    lng: -104.6,
    address: "123 Test St, Pueblo, CO",
    hours_weekly: null,
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

describe("VenueListView — Edit affordance (#255)", () => {
  test("each row renders an Edit link pointing at /admin/venues/<id>/edit", () => {
    render(<VenueListView venues={[makeVenue({ id: "manual-abc" }), makeVenue({ id: "manual-xyz", name: "Westside Grocery" })]} />);

    const links = screen.getAllByRole("link", { name: /Edit/i });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/admin/venues/manual-abc/edit");
    expect(links[1]).toHaveAttribute("href", "/admin/venues/manual-xyz/edit");
  });

  test("no Edit link is rendered when the filtered list is empty", () => {
    render(<VenueListView venues={[]} />);
    expect(screen.queryByRole("link", { name: /Edit/i })).toBeNull();
  });
});
