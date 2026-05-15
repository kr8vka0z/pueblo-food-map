import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Sidebar from "@/components/Sidebar";
import type { Venue } from "@/types/venue";

const sampleVenues: Array<Venue & { distanceMiles: number | null }> = [
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

describe("Sidebar", () => {
  test("renders every venue with its formatted distance", () => {
    render(
      <Sidebar
        venues={sampleVenues}
        selectedVenueId={null}
        onSelect={() => {}}
        locationStatus="granted"
      />,
    );

    expect(screen.getByText("Riverwalk Pantry")).toBeInTheDocument();
    expect(screen.getByText("East Side Grocery")).toBeInTheDocument();
    expect(screen.getByText("0.4 mi")).toBeInTheDocument();
    expect(screen.getByText("1.8 mi")).toBeInTheDocument();
  });

  test("shows the location-status banner appropriate to the current state", () => {
    render(
      <Sidebar
        venues={sampleVenues}
        selectedVenueId={null}
        onSelect={() => {}}
        locationStatus="denied"
      />,
    );

    expect(
      screen.getByText(/Location permission denied/i),
    ).toBeInTheDocument();
  });

  test("fires onSelect with the clicked venue id", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <Sidebar
        venues={sampleVenues}
        selectedVenueId={null}
        onSelect={onSelect}
        locationStatus="granted"
      />,
    );

    await user.click(screen.getByRole("button", { name: /East Side Grocery/i }));
    expect(onSelect).toHaveBeenCalledWith("v2");
  });
});
