import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Sidebar from "@/components/Sidebar";
import type { Venue, VenueCategory } from "@/types/venue";

const sampleVenues: Array<Venue & { distanceMiles?: number }> = [
  {
    id: "v1",
    name: "Riverwalk Pantry",
    category: "pantry",
    lat: 38.27,
    lng: -104.61,
    address: "100 Main St, Pueblo, CO",
    source: "test-fixture",
    last_verified: "2026-05-14",
    distanceMiles: 0.4,
  },
  {
    id: "v2",
    name: "East Side Grocery",
    category: "grocery",
    lat: 38.26,
    lng: -104.59,
    address: "2200 E 4th St, Pueblo, CO",
    source: "test-fixture",
    last_verified: "2026-05-14",
    distanceMiles: 1.8,
  },
];

const baseProps = {
  selectedCategories: null as Set<VenueCategory> | null,
  categoryCounts: { pantry: 1, grocery: 1 } as Partial<Record<VenueCategory, number>>,
  totalCount: sampleVenues.length,
  onToggleCategory: () => {},
  showCategoryChips: false,
};

describe("Sidebar", () => {
  test("renders every venue with its formatted distance", () => {
    render(
      <Sidebar
        {...baseProps}
        venues={sampleVenues}
        selectedVenueId={null}
        onSelectVenue={() => {}}
        locationStatus="granted"
      />,
    );

    expect(screen.getByText("Riverwalk Pantry")).toBeInTheDocument();
    expect(screen.getByText("East Side Grocery")).toBeInTheDocument();
    expect(screen.getByText("0.4 mi")).toBeInTheDocument();
    expect(screen.getByText("1.8 mi")).toBeInTheDocument();
  });

  test("shows the location-status banner appropriate to the current state", () => {
    const { rerender } = render(
      <Sidebar
        {...baseProps}
        venues={sampleVenues}
        selectedVenueId={null}
        onSelectVenue={() => {}}
        locationStatus="granted"
      />,
    );

    expect(
      screen.getByText(/Sorted by distance from your location/i),
    ).toBeInTheDocument();

    rerender(
      <Sidebar
        {...baseProps}
        venues={sampleVenues}
        selectedVenueId={null}
        onSelectVenue={() => {}}
        locationStatus="denied"
      />,
    );

    expect(
      screen.getByText(/Showing distance from downtown Pueblo/i),
    ).toBeInTheDocument();
  });

  test("fires onSelectVenue with the clicked venue id", async () => {
    const user = userEvent.setup();
    const onSelectVenue = vi.fn();

    render(
      <Sidebar
        {...baseProps}
        venues={sampleVenues}
        selectedVenueId={null}
        onSelectVenue={onSelectVenue}
        locationStatus="granted"
      />,
    );

    await user.click(screen.getByRole("button", { name: /East Side Grocery/i }));
    expect(onSelectVenue).toHaveBeenCalledWith("v2");
  });
});
