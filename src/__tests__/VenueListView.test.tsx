/**
 * VenueListView tests (#253) — the admin's read-only, searchable/filterable
 * venue table. Covers rendering, search, status/category filters, the
 * status key, the name-as-edit-link (#672), and the empty state. #673
 * replaced the old status column + separate "Unpublished changes" column
 * with a single Status column driven by a precomputed `statusByVenueId`
 * map (see VenueListView.tsx's own header for why that map is computed by
 * the page, not this component). The Server Component page that fetches D1
 * rows (src/app/admin/places/page.tsx) is intentionally not tested here —
 * see that file's own comment; RSC page tests are hard in this stack, so
 * coverage concentrates on this presentational component.
 */

import { describe, test, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import VenueListView from "@/components/VenueListView";
import type { AdminVenueRow } from "@/types/venue";
import type { AdminDisplayStatus } from "@/lib/adminVenues";

// ─── Fixture ─────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<AdminVenueRow> = {}): AdminVenueRow {
  return {
    id: "venue-a",
    name: "Venue A",
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
    created_by: "admin@pueblofoodmap.com",
    updated_at: "2026-01-01T00:00:00.000Z",
    updated_by: "admin@pueblofoodmap.com",
    published_at: "2026-01-01T00:00:00.000Z",
    published_by: "admin@pueblofoodmap.com",
    ...overrides,
  };
}

const VENUES: AdminVenueRow[] = [
  makeRow({
    id: "v1",
    name: "Eastside Pantry",
    category: "pantry",
    address: "101 E 5th St, Pueblo, CO 81001",
    status: "published",
  }),
  makeRow({
    id: "v2",
    name: "Main Street Grocery",
    category: "grocery",
    address: "200 N Main St, Pueblo, CO 81003",
    status: "published",
  }),
  makeRow({
    id: "v3",
    name: "Westside Garden",
    category: "garden",
    address: "300 W 4th St, Pueblo, CO 81003",
    status: "draft",
    published_at: null,
  }),
  makeRow({
    id: "v4",
    name: "Old Convenience Stop",
    category: "convenience",
    address: "400 S Elm St, Pueblo, CO 81003",
    status: "archived",
    published_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  }),
];

// v1: unedited (live). v2: edited since publish (live · edits waiting).
// v3: draft. v4: archived (removed).
const STATUS_BY_ID: Record<string, AdminDisplayStatus> = {
  v1: "live",
  v2: "live_edits_waiting",
  v3: "draft",
  v4: "removed",
};

// ─── Rendering ───────────────────────────────────────────────────────────────

describe("VenueListView — renders venue table", () => {
  test("renders a row for every venue", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    expect(screen.getByText("Eastside Pantry")).toBeDefined();
    expect(screen.getByText("Main Street Grocery")).toBeDefined();
    expect(screen.getByText("Westside Garden")).toBeDefined();
    expect(screen.getByText("Old Convenience Stop")).toBeDefined();
  });

  test("renders a real table with column headers, and no Actions/Edit column (#672)", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    expect(screen.getByRole("table")).toBeDefined();
    expect(screen.getByRole("columnheader", { name: /name/i })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: /category/i })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: /status/i })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: /address/i })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: /last verified/i })).toBeDefined();
    expect(screen.queryByRole("columnheader", { name: /actions/i })).toBeNull();
  });

  test("renders the human category label, not the raw category key", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    // Scoped to the table: "Grocery / Supermarket" / "grocery" also appear as
    // an <option> in the category filter select, which would otherwise make
    // this query ambiguous.
    const table = screen.getByRole("table");
    expect(within(table).getByText("Grocery / Supermarket")).toBeDefined();
    expect(within(table).queryByText("grocery")).toBeNull();
  });

  test("renders one status badge per row, with human labels (#673)", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    const table = screen.getByRole("table");
    expect(within(within(table).getByRole("row", { name: /Eastside Pantry/i })).getByText("Live")).toBeDefined();
    expect(
      within(within(table).getByRole("row", { name: /Main Street Grocery/i })).getByText("Live · edits waiting"),
    ).toBeDefined();
    expect(within(within(table).getByRole("row", { name: /Westside Garden/i })).getByText("Draft")).toBeDefined();
    expect(
      within(within(table).getByRole("row", { name: /Old Convenience Stop/i })).getByText("Removed"),
    ).toBeDefined();
  });

  test("formats last_verified readably", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    expect(screen.getAllByText("Jan 1, 2026").length).toBeGreaterThan(0);
  });
});

// ─── Status key (#673 pt.2) ──────────────────────────────────────────────────

describe("VenueListView — status key", () => {
  test("shows one line per status above the table", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    expect(screen.getByText("New, not on the public map yet.")).toBeDefined();
    expect(screen.getByText("On the public map, exactly as shown.")).toBeDefined();
    expect(screen.getByText("Approved or saved changes the map doesn't show until Publish.")).toBeDefined();
    expect(screen.getByText("Taken off the map, kept for the record.")).toBeDefined();
  });
});

// ─── Name-as-edit-link (#672) ────────────────────────────────────────────────

describe("VenueListView — name-as-edit-link", () => {
  test("a non-archived row's name links to its edit page", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    expect(screen.getByRole("link", { name: "Eastside Pantry" })).toHaveAttribute(
      "href",
      "/admin/venues/v1/edit",
    );
  });

  test("an archived row's name is not a link", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    expect(screen.queryByRole("link", { name: "Old Convenience Stop" })).toBeNull();
    expect(screen.getByText("Old Convenience Stop")).toBeDefined();
  });
});

// ─── Search ──────────────────────────────────────────────────────────────────

describe("VenueListView — search", () => {
  test("has an accessible search input", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    expect(screen.getByLabelText(/search/i)).toBeDefined();
  });

  test("narrows results by name", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    fireEvent.change(screen.getByLabelText(/search/i), { target: { value: "garden" } });
    expect(screen.getByText("Westside Garden")).toBeDefined();
    expect(screen.queryByText("Eastside Pantry")).toBeNull();
    expect(screen.queryByText("Main Street Grocery")).toBeNull();
    expect(screen.queryByText("Old Convenience Stop")).toBeNull();
  });

  test("narrows results by address", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    fireEvent.change(screen.getByLabelText(/search/i), { target: { value: "Elm" } });
    expect(screen.getByText("Old Convenience Stop")).toBeDefined();
    expect(screen.queryByText("Eastside Pantry")).toBeNull();
  });

  test("search is case-insensitive", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    fireEvent.change(screen.getByLabelText(/search/i), { target: { value: "GARDEN" } });
    expect(screen.getByText("Westside Garden")).toBeDefined();
  });
});

// ─── Filters ─────────────────────────────────────────────────────────────────

describe("VenueListView — status filter", () => {
  test("has an accessible status filter with the four #673 statuses", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    const select = screen.getByLabelText(/status/i) as HTMLSelectElement;
    const optionText = Array.from(select.options).map((o) => o.textContent);
    expect(optionText).toEqual(["All", "Draft", "Live", "Live · edits waiting", "Removed"]);
  });

  test("filtering to Draft shows only draft venues", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: "draft" } });
    expect(screen.getByText("Westside Garden")).toBeDefined();
    expect(screen.queryByText("Eastside Pantry")).toBeNull();
    expect(screen.queryByText("Main Street Grocery")).toBeNull();
    expect(screen.queryByText("Old Convenience Stop")).toBeNull();
  });

  test("filtering to Live shows only unedited live venues", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: "live" } });
    expect(screen.getByText("Eastside Pantry")).toBeDefined();
    expect(screen.queryByText("Main Street Grocery")).toBeNull();
    expect(screen.queryByText("Westside Garden")).toBeNull();
    expect(screen.queryByText("Old Convenience Stop")).toBeNull();
  });

  test("filtering to Live · edits waiting shows only that status", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: "live_edits_waiting" } });
    expect(screen.getByText("Main Street Grocery")).toBeDefined();
    expect(screen.queryByText("Eastside Pantry")).toBeNull();
  });

  test("filtering to Removed shows only archived venues", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: "removed" } });
    expect(screen.getByText("Old Convenience Stop")).toBeDefined();
    expect(screen.queryByText("Eastside Pantry")).toBeNull();
  });
});

describe("VenueListView — category filter", () => {
  test("has an accessible category filter", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    expect(screen.getByLabelText(/category/i)).toBeDefined();
  });

  test("filtering to Grocery / Supermarket shows only that category", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: "grocery" } });
    expect(screen.getByText("Main Street Grocery")).toBeDefined();
    expect(screen.queryByText("Eastside Pantry")).toBeNull();
    expect(screen.queryByText("Westside Garden")).toBeNull();
  });
});

// ─── Empty state ─────────────────────────────────────────────────────────────

describe("VenueListView — empty state", () => {
  test("shows a friendly message when no venues match", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    fireEvent.change(screen.getByLabelText(/search/i), { target: { value: "no-such-venue-xyz" } });
    expect(screen.getByText(/no venues match your search/i)).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
  });

  test("renders the empty state when the venues prop itself is empty", () => {
    render(<VenueListView venues={[]} statusByVenueId={{}} />);
    expect(screen.getByText(/no venues match your search/i)).toBeDefined();
  });
});

// ─── Count summary ───────────────────────────────────────────────────────────

describe("VenueListView — result count", () => {
  test("shows a count of filtered vs total venues that updates on filter", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    expect(screen.getByText(/4 of 4 venues/i)).toBeDefined();
    fireEvent.change(screen.getByLabelText(/search/i), { target: { value: "garden" } });
    expect(screen.getByText(/1 of 4 venues/i)).toBeDefined();
  });
});
