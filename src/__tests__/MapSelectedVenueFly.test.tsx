/**
 * Map — the selected-venue camera move fires once per selection (#894 item 1).
 *
 * MapWrapper rebuilds the `venues` array on every location refresh (distances
 * change), so a venue fly keyed on that array yanked the map back off a
 * walking turn. The deep-link case still needs one fly once the venue shows up.
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { render } from "@testing-library/react";
import MapComponent from "@/components/Map";
import type { Venue } from "@/types/venue";

vi.mock("mapbox-gl/dist/mapbox-gl.css", () => ({}));

const mockFlyTo = vi.fn();

vi.mock("react-map-gl/mapbox", async () => {
  const React = await import("react");
  const MapGLMock = React.forwardRef(function MapGLMock(
    { children }: { children: React.ReactNode },
    ref: React.Ref<{ flyTo: typeof mockFlyTo; jumpTo: () => void; fitBounds: () => void }>,
  ) {
    React.useImperativeHandle(ref, () => ({ flyTo: mockFlyTo, jumpTo: vi.fn(), fitBounds: vi.fn() }));
    return React.createElement("div", null, children);
  });
  return {
    default: MapGLMock,
    Marker: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
    Popup: () => null,
    AttributionControl: () => null,
    Source: ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children),
    Layer: () => null,
  };
});

const venue = (id: string, lat: number): Venue => ({
  id,
  name: id,
  category: "pantry",
  lat,
  lng: -104.6,
  address: `${id} St`,
  source: "test",
  last_verified: "2026-01-01",
});

const props = (venues: Venue[], extra: Record<string, unknown> = {}) => ({
  venues,
  selectedVenueId: "v1",
  userLocation: null,
  onSelectVenue: vi.fn(),
  ...extra,
});

const venueFlights = () => mockFlyTo.mock.calls.filter(([arg]) => arg.zoom === 16);

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: vi.fn().mockResolvedValue({ features: [] }) }));
});

describe("Map — selected-venue fly", () => {
  test("a new venues array for the same selection (location refresh) does not fly back to the venue", () => {
    const { rerender } = render(<MapComponent {...props([venue("v1", 38.25)])} />);
    expect(venueFlights()).toHaveLength(1);

    // Walk stepper flies to a turn, then the location refresh rebuilds venues.
    rerender(<MapComponent {...props([venue("v1", 38.25)], { focusPoint: { lng: -104.61, lat: 38.26 }, focusRequestId: 1 })} />);
    rerender(<MapComponent {...props([venue("v1", 38.25), venue("v2", 38.3)], { focusPoint: { lng: -104.61, lat: 38.26 }, focusRequestId: 1 })} />);

    expect(venueFlights()).toHaveLength(1);
    expect(mockFlyTo.mock.calls.at(-1)![0]).toMatchObject({ zoom: 17 });
  });

  test("a selection whose venue arrives later (deep link) flies once it appears, and a reselect flies again", () => {
    const { rerender } = render(<MapComponent {...props([])} />);
    expect(venueFlights()).toHaveLength(0);

    rerender(<MapComponent {...props([venue("v1", 38.25)])} />);
    expect(venueFlights()).toHaveLength(1);

    rerender(<MapComponent {...props([venue("v1", 38.25)], { selectedVenueId: null })} />);
    rerender(<MapComponent {...props([venue("v1", 38.25)])} />);
    expect(venueFlights()).toHaveLength(2);
  });
});
