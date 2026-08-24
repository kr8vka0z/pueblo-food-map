import { describe, test, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import VenueMarker from "@/components/VenueMarker";
import type { Venue } from "@/types/venue";

vi.mock("react-map-gl/mapbox", () => ({
  Marker: ({ children }: { children: React.ReactNode }) => <div data-testid="marker-container">{children}</div>,
}));

const mockVenue: Venue = {
  id: "test-venue-1",
  name: "Test Venue",
  category: "pantry",
  lat: 38.25,
  lng: -104.60,
  address: "123 Main St, Pueblo, CO 81003",
  source: "pfp",
  last_verified: "2026-05-14",
};

describe("VenueMarker memoization (#291)", () => {
  test("VenueMarker is a memoized component", () => {
    expect(VenueMarker).toHaveProperty("type");
    expect(typeof VenueMarker).toBe("object");
  });

  test("preserves DOM node when re-rendered with identical props", () => {
    const onSelect = vi.fn();
    const { rerender, getByRole } = render(
      <VenueMarker
        venue={mockVenue}
        selected={false}
        onSelect={onSelect}
      />,
    );

    const initialButton = getByRole("button");

    rerender(
      <VenueMarker
        venue={mockVenue}
        selected={false}
        onSelect={onSelect}
      />,
    );

    const afterButton = getByRole("button");
    expect(afterButton).toBe(initialButton);
  });
});