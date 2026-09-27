/**
 * Tests for VenueListView's name-as-edit-link affordance (#255, moved onto
 * the name and the separate Actions column removed by #672). Pre-#255
 * rendering (search/filter behavior) shipped in #253 with no dedicated test
 * file of its own; this file covers only the per-row name link rather than
 * retroactively writing full regression coverage for #253's own behavior —
 * out of scope for this slice.
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

function makeStatusMap(venues: AdminVenueRow[], status: AdminDisplayStatus = "draft"): Record<string, AdminDisplayStatus> {
  return Object.fromEntries(venues.map((v) => [v.id, status]));
}

describe("VenueListView — name-as-edit-link affordance (#255, #672)", () => {
  test("each row's name links to /admin/venues/<id>/edit", () => {
    const venues = [makeVenue({ id: "manual-abc" }), makeVenue({ id: "manual-xyz", name: "Westside Grocery" })];
    render(<VenueListView venues={venues} statusByVenueId={makeStatusMap(venues)} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Eastside Pantry" })).toHaveAttribute(
      "href",
      "/admin/venues/manual-abc/edit",
    );
    expect(screen.getByRole("link", { name: "Westside Grocery" })).toHaveAttribute(
      "href",
      "/admin/venues/manual-xyz/edit",
    );
  });

  test("no name link is rendered when the filtered list is empty", () => {
    render(<VenueListView venues={[]} statusByVenueId={{}} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  test("there is no separate Edit column or link — the name IS the link", () => {
    const venues = [makeVenue()];
    render(<VenueListView venues={venues} statusByVenueId={makeStatusMap(venues)} />);
    expect(screen.queryByText(/^Edit$/)).toBeNull();
    expect(screen.queryByRole("columnheader", { name: /actions/i })).toBeNull();
  });
});
