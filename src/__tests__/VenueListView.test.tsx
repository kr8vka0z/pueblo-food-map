/**
 * VenueListView tests (#253) — the admin's read-only, searchable/filterable
 * venue table. Covers rendering, search, status/category filters, the
 * "Unpublished changes" marker, and the empty state. The Server Component
 * page that fetches D1 rows (src/app/admin/page.tsx) is intentionally not
 * tested here — see that file's own comment; RSC page tests are hard in
 * this stack, so coverage concentrates on this presentational component.
 */

import { describe, test, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import VenueListView from "@/components/VenueListView";
import type { AdminVenueRow } from "@/types/venue";

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
    published_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z", // unedited since publish -> no marker
  }),
  makeRow({
    id: "v2",
    name: "Main Street Grocery",
    category: "grocery",
    address: "200 N Main St, Pueblo, CO 81003",
    status: "published",
    published_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-02-01T00:00:00.000Z", // edited after publish -> marker
  }),
  makeRow({
    id: "v3",
    name: "Westside Garden",
    category: "garden",
    address: "300 W 4th St, Pueblo, CO 81003",
    status: "draft",
    published_at: null, // draft -> marker
    updated_at: "2026-01-15T00:00:00.000Z",
  }),
  makeRow({
    id: "v4",
    name: "Old Convenience Stop",
    category: "convenience",
    address: "400 S Elm St, Pueblo, CO 81003",
    status: "archived",
    published_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z", // unedited -> no marker
  }),
];

// ─── Rendering ───────────────────────────────────────────────────────────────

describe("VenueListView — renders venue table", () => {
  test("renders a row for every venue", () => {
    render(<VenueListView venues={VENUES} />);
    expect(screen.getByText("Eastside Pantry")).toBeDefined();
    expect(screen.getByText("Main Street Grocery")).toBeDefined();
    expect(screen.getByText("Westside Garden")).toBeDefined();
    expect(screen.getByText("Old Convenience Stop")).toBeDefined();
  });

  test("renders a real table with column headers", () => {
    render(<VenueListView venues={VENUES} />);
    expect(screen.getByRole("table")).toBeDefined();
    expect(screen.getByRole("columnheader", { name: /name/i })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: /category/i })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: /status/i })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: /address/i })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: /last verified/i })).toBeDefined();
  });

  test("renders the human category label, not the raw category key", () => {
    render(<VenueListView venues={VENUES} />);
    // Scoped to the table: "Grocery / Supermarket" / "grocery" also appear as
    // an <option> in the category filter select, which would otherwise make
    // this query ambiguous.
    const table = screen.getByRole("table");
    expect(within(table).getByText("Grocery / Supermarket")).toBeDefined();
    expect(within(table).queryByText("grocery")).toBeNull();
  });

  test("renders status badges with human labels", () => {
    render(<VenueListView venues={VENUES} />);
    const table = screen.getByRole("table");
    // Two rows (Eastside Pantry, Main Street Grocery) are "Live" — the
    // status filter's own <option>Live</option> is outside the table.
    expect(within(table).getAllByText("Live").length).toBe(2);
    expect(within(table).getByText("Draft")).toBeDefined();
    expect(within(table).getByText("Removed")).toBeDefined();
  });

  test("formats last_verified readably", () => {
    render(<VenueListView venues={VENUES} />);
    expect(screen.getAllByText("Jan 1, 2026").length).toBeGreaterThan(0);
  });
});

// ─── Search ──────────────────────────────────────────────────────────────────

describe("VenueListView — search", () => {
  test("has an accessible search input", () => {
    render(<VenueListView venues={VENUES} />);
    expect(screen.getByLabelText(/search/i)).toBeDefined();
  });

  test("narrows results by name", () => {
    render(<VenueListView venues={VENUES} />);
    fireEvent.change(screen.getByLabelText(/search/i), { target: { value: "garden" } });
    expect(screen.getByText("Westside Garden")).toBeDefined();
    expect(screen.queryByText("Eastside Pantry")).toBeNull();
    expect(screen.queryByText("Main Street Grocery")).toBeNull();
    expect(screen.queryByText("Old Convenience Stop")).toBeNull();
  });

  test("narrows results by address", () => {
    render(<VenueListView venues={VENUES} />);
    fireEvent.change(screen.getByLabelText(/search/i), { target: { value: "Elm" } });
    expect(screen.getByText("Old Convenience Stop")).toBeDefined();
    expect(screen.queryByText("Eastside Pantry")).toBeNull();
  });

  test("search is case-insensitive", () => {
    render(<VenueListView venues={VENUES} />);
    fireEvent.change(screen.getByLabelText(/search/i), { target: { value: "GARDEN" } });
    expect(screen.getByText("Westside Garden")).toBeDefined();
  });
});

// ─── Filters ─────────────────────────────────────────────────────────────────

describe("VenueListView — status filter", () => {
  test("has an accessible status filter with All/Live/Draft/Removed options", () => {
    render(<VenueListView venues={VENUES} />);
    const select = screen.getByLabelText(/status/i) as HTMLSelectElement;
    const optionText = Array.from(select.options).map((o) => o.textContent);
    expect(optionText).toEqual(["All", "Live", "Draft", "Removed"]);
  });

  test("filtering to Draft shows only draft venues", () => {
    render(<VenueListView venues={VENUES} />);
    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: "draft" } });
    expect(screen.getByText("Westside Garden")).toBeDefined();
    expect(screen.queryByText("Eastside Pantry")).toBeNull();
    expect(screen.queryByText("Main Street Grocery")).toBeNull();
    expect(screen.queryByText("Old Convenience Stop")).toBeNull();
  });

  test("filtering to Live shows only published venues", () => {
    render(<VenueListView venues={VENUES} />);
    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: "published" } });
    expect(screen.getByText("Eastside Pantry")).toBeDefined();
    expect(screen.getByText("Main Street Grocery")).toBeDefined();
    expect(screen.queryByText("Westside Garden")).toBeNull();
    expect(screen.queryByText("Old Convenience Stop")).toBeNull();
  });

  test("filtering to Removed shows only archived venues", () => {
    render(<VenueListView venues={VENUES} />);
    fireEvent.change(screen.getByLabelText(/status/i), { target: { value: "archived" } });
    expect(screen.getByText("Old Convenience Stop")).toBeDefined();
    expect(screen.queryByText("Eastside Pantry")).toBeNull();
  });
});

describe("VenueListView — category filter", () => {
  test("has an accessible category filter", () => {
    render(<VenueListView venues={VENUES} />);
    expect(screen.getByLabelText(/category/i)).toBeDefined();
  });

  test("filtering to Grocery / Supermarket shows only that category", () => {
    render(<VenueListView venues={VENUES} />);
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: "grocery" } });
    expect(screen.getByText("Main Street Grocery")).toBeDefined();
    expect(screen.queryByText("Eastside Pantry")).toBeNull();
    expect(screen.queryByText("Westside Garden")).toBeNull();
  });
});

// ─── Unpublished-changes marker ─────────────────────────────────────────────

describe("VenueListView — unpublished changes marker", () => {
  test("shows the marker for a draft row", () => {
    render(<VenueListView venues={VENUES} />);
    const row = screen.getByRole("row", { name: /Westside Garden/i });
    expect(within(row).getByText(/unpublished changes/i)).toBeDefined();
  });

  test("shows the marker for a published row edited since its last publish", () => {
    render(<VenueListView venues={VENUES} />);
    const row = screen.getByRole("row", { name: /Main Street Grocery/i });
    expect(within(row).getByText(/unpublished changes/i)).toBeDefined();
  });

  test("does NOT show the marker for an unedited published row", () => {
    render(<VenueListView venues={VENUES} />);
    const row = screen.getByRole("row", { name: /Eastside Pantry/i });
    expect(within(row).queryByText(/unpublished changes/i)).toBeNull();
  });

  test("does NOT show the marker for an unedited archived row", () => {
    render(<VenueListView venues={VENUES} />);
    const row = screen.getByRole("row", { name: /Old Convenience Stop/i });
    expect(within(row).queryByText(/unpublished changes/i)).toBeNull();
  });
});

// ─── Empty state ─────────────────────────────────────────────────────────────

describe("VenueListView — empty state", () => {
  test("shows a friendly message when no venues match", () => {
    render(<VenueListView venues={VENUES} />);
    fireEvent.change(screen.getByLabelText(/search/i), { target: { value: "no-such-venue-xyz" } });
    expect(screen.getByText(/no venues match your search/i)).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
  });

  test("renders the empty state when the venues prop itself is empty", () => {
    render(<VenueListView venues={[]} />);
    expect(screen.getByText(/no venues match your search/i)).toBeDefined();
  });
});

// ─── Count summary ───────────────────────────────────────────────────────────

describe("VenueListView — result count", () => {
  test("shows a count of filtered vs total venues that updates on filter", () => {
    render(<VenueListView venues={VENUES} />);
    expect(screen.getByText(/4 of 4 venues/i)).toBeDefined();
    fireEvent.change(screen.getByLabelText(/search/i), { target: { value: "garden" } });
    expect(screen.getByText(/1 of 4 venues/i)).toBeDefined();
  });
});
