/**
 * StalePlacesList render tests (admin dashboard build) — fixture-props
 * coverage for the Dashboard's "Places due for a check" panel: empty state,
 * one row's content/link, and the "See all N →" link only appearing when
 * totalCount exceeds the number of rows actually shown.
 */

import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import StalePlacesList from "@/components/StalePlacesList";
import type { StalePlace } from "@/lib/adminDashboard";

function makePlace(overrides: Partial<StalePlace> = {}): StalePlace {
  return {
    id: "venue-1",
    name: "Eastside Pantry",
    category: "pantry",
    lastVerified: "2025-06-01",
    monthsSince: 15,
    ...overrides,
  };
}

describe("StalePlacesList", () => {
  test("empty state renders a reassuring message, no list", () => {
    render(<StalePlacesList items={[]} totalCount={0} />);
    expect(screen.getByText(/Every published place has been checked recently/)).toBeDefined();
    expect(screen.queryByRole("list")).toBeNull();
  });

  test("renders a place's name, last-checked date, and months-since, linking to its edit screen", () => {
    render(<StalePlacesList items={[makePlace()]} totalCount={1} />);

    expect(screen.getByText("Eastside Pantry")).toBeDefined();
    expect(screen.getByText(/last checked/)).toBeDefined();
    expect(screen.getByText(/15 months ago/)).toBeDefined();
    const link = screen.getByRole("link", { name: /Eastside Pantry/ });
    expect(link.getAttribute("href")).toBe("/admin/venues/venue-1/edit");
  });

  test("singular month reads '1 month ago', not '1 months ago'", () => {
    render(<StalePlacesList items={[makePlace({ monthsSince: 1 })]} totalCount={1} />);
    expect(screen.getByText(/1 month ago/)).toBeDefined();
  });

  test("'See all N →' link appears only when there are more matches than shown rows", () => {
    const { rerender } = render(<StalePlacesList items={[makePlace()]} totalCount={1} />);
    expect(screen.queryByText(/See all/)).toBeNull();

    rerender(<StalePlacesList items={[makePlace()]} totalCount={5} />);
    const seeAll = screen.getByText(/See all 5/);
    expect(seeAll.closest("a")?.getAttribute("href")).toBe("/admin/places");
  });
});
