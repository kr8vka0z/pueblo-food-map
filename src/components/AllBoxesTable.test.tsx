/**
 * AllBoxesTable render tests (admin dashboard build) — fixture-props
 * coverage: empty state, one row's columns (name/address, status badge,
 * last report, caretaker, edit link), and the "Removed from service" note
 * for a box whose removedOn is set.
 */

import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import AllBoxesTable from "@/components/AllBoxesTable";
import type { BoxHealthEntry } from "@/lib/boxHealth";

function makeEntry(overrides: Partial<BoxHealthEntry> = {}): BoxHealthEntry {
  return {
    venueId: "box-1",
    name: "Blessing Box - Routt",
    address: "216 W Routt Ave, Pueblo, CO",
    lat: 38.27,
    lng: -104.6,
    health: { status: "ok", latest: null, daysSinceLastReport: 2 },
    caretaker: null,
    removedOn: null,
    ...overrides,
  };
}

describe("AllBoxesTable", () => {
  test("empty state, no table", () => {
    render(<AllBoxesTable entries={[]} />);
    expect(screen.getByText("No blessing boxes yet.")).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
  });

  test("renders a row with name/address, status badge, last report, caretaker, and an Edit link", () => {
    render(
      <AllBoxesTable
        entries={[
          makeEntry({
            health: { status: "problem", latest: null, daysSinceLastReport: 1 },
            caretaker: "Jamie R.",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Blessing Box - Routt")).toBeDefined();
    expect(screen.getByText("216 W Routt Ave, Pueblo, CO")).toBeDefined();
    expect(screen.getByText("Problem")).toBeDefined();
    expect(screen.getByText("1 day ago")).toBeDefined();
    expect(screen.getByText("Jamie R.")).toBeDefined();
    expect(screen.getByRole("link", { name: "Edit" }).getAttribute("href")).toBe("/admin/venues/box-1/edit");
  });

  test("no caretaker reads 'No caretaker', no reports reads 'No reports yet'", () => {
    render(<AllBoxesTable entries={[makeEntry({ health: { status: "quiet", latest: null, daysSinceLastReport: null } })]} />);
    expect(screen.getByText("No caretaker")).toBeDefined();
    expect(screen.getByText("No reports yet")).toBeDefined();
  });

  test("a removed box shows a 'Removed from service' note", () => {
    render(<AllBoxesTable entries={[makeEntry({ removedOn: "2026-08-01" })]} />);
    expect(screen.getByText("Removed from service")).toBeDefined();
  });
});
