/**
 * WalkingRoute tests — issue #134 in-app walking route layer on Map.
 *
 * The walking route is a GeoJSON LineString drawn as a layer on the Mapbox map.
 * State (walkingRoute GeoJSON) is passed as a prop to Map.tsx so MapWrapper
 * owns the fetch and clearing logic.
 *
 * The distance + duration readout was moved from a map overlay pill to the
 * in-card DirectionButtons component (FIX 1: overlay was hidden behind the
 * mobile BottomSheet). See DirectionButtons.test.tsx for readout tests.
 *
 * Verifies:
 *   1. Map renders without error when walkingRoute is null (default).
 *   2. Walking route source is NOT rendered when walkingRoute is null.
 *   3. Walking route source IS rendered when walkingRoute GeoJSON is provided.
 *   4. Map renders correctly with all props including walking route.
 *   5. buildWalkingRouteUrl includes steps=true and language= params (#134 enhancement).
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import MapComponent from "@/components/Map";
import { buildWalkingRouteUrl } from "@/components/MapWrapper";
import type { Venue } from "@/types/venue";

// ─── Reuse the Map.test.tsx mock strategy ─────────────────────────────────────
vi.mock("mapbox-gl/dist/mapbox-gl.css", () => ({}));

const mockFlyTo = vi.fn();
const mockJumpTo = vi.fn();

vi.mock("react-map-gl/mapbox", async () => {
  const React = await import("react");
  const MapGLMock = React.forwardRef(function MapGLMock(
    { children }: { children: React.ReactNode; onLoad?: (e: { target: object }) => void },
    ref: React.Ref<{ flyTo: typeof mockFlyTo; jumpTo: typeof mockJumpTo }>,
  ) {
    React.useImperativeHandle(ref, () => ({ flyTo: mockFlyTo, jumpTo: mockJumpTo }));
    return React.createElement("div", { "data-testid": "mapgl-root" }, children);
  });
  return {
    default: MapGLMock,
    Marker: vi.fn(({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "mapbox-marker" }, children),
    ),
    Popup: vi.fn(() => null),
    AttributionControl: vi.fn(() => null),
    Source: vi.fn(
      ({ children, id }: { children?: React.ReactNode; id?: string }) =>
        React.createElement("div", { "data-testid": `mapbox-source-${id ?? "unknown"}` }, children),
    ),
    Layer: vi.fn(() => null),
  };
});

function makeVenue(id: string, name: string): Venue {
  return {
    id,
    name,
    category: "pantry",
    lat: 38.2544,
    lng: -104.6091,
    address: `${id} Test St`,
    source: "test",
    last_verified: "2026-01-01",
  };
}

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    venues: [makeVenue("v1", "Test Pantry")],
    selectedVenueId: null,
    userLocation: null,
    userDistances: new Map<string, number>(),
    onSelectVenue: vi.fn(),
    ...overrides,
  };
}

// Sample walking route GeoJSON (Mapbox Directions API geometry response)
const SAMPLE_ROUTE_GEOJSON = {
  type: "Feature" as const,
  properties: {},
  geometry: {
    type: "LineString" as const,
    coordinates: [
      [-104.6091, 38.2544],
      [-104.6085, 38.255],
      [-104.608, 38.2556],
    ],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ features: [] }),
    }),
  );
});

describe("Map — walking route layer (#134)", () => {
  test("renders without error when walkingRoute is null", () => {
    const { container } = render(
      <MapComponent {...makeProps({ walkingRoute: null })} />,
    );
    expect(container.querySelector("[data-testid='mapgl-root']")).not.toBeNull();
  });

  test("walking route source is NOT rendered when walkingRoute is null", () => {
    const { container } = render(
      <MapComponent {...makeProps({ walkingRoute: null })} />,
    );
    expect(
      container.querySelector("[data-testid='mapbox-source-pfm-walking-route']"),
    ).toBeNull();
  });

  test("walking route source IS rendered when walkingRoute GeoJSON is provided", () => {
    const { container } = render(
      <MapComponent
        {...makeProps({ walkingRoute: SAMPLE_ROUTE_GEOJSON })}
      />,
    );
    expect(
      container.querySelector("[data-testid='mapbox-source-pfm-walking-route']"),
    ).not.toBeNull();
  });

  test("renders correctly with walking route prop", () => {
    const { container } = render(
      <MapComponent
        {...makeProps({ walkingRoute: SAMPLE_ROUTE_GEOJSON })}
      />,
    );
    expect(container.querySelector("[data-testid='mapgl-root']")).not.toBeNull();
  });

  test("walking-route-info is NOT rendered in Map (readout moved to DirectionButtons card)", () => {
    // The distance/time overlay was removed from Map.tsx (FIX 1: it was hidden
    // behind the mobile BottomSheet). The readout now lives in DirectionButtons.
    const { container } = render(
      <MapComponent
        {...makeProps({ walkingRoute: SAMPLE_ROUTE_GEOJSON })}
      />,
    );
    expect(container.querySelector("[data-testid='walking-route-info']")).toBeNull();
  });
});

// ─── buildWalkingRouteUrl — URL param contract (#134 enhancement) ─────────────
//
// These tests assert on the URL params added for turn-by-turn (#134 enhancement)
// without mounting MapWrapper (which requires WebGL / Mapbox GL in jsdom).

describe("buildWalkingRouteUrl — URL params (#134 enhancement)", () => {
  const ORIGIN_LNG = -104.6091;
  const ORIGIN_LAT = 38.2544;
  const DEST_LNG = -104.6080;
  const DEST_LAT = 38.2555;
  const TOKEN = "pk.test_token";

  test("URL includes steps=true", () => {
    const url = buildWalkingRouteUrl(ORIGIN_LNG, ORIGIN_LAT, DEST_LNG, DEST_LAT, TOKEN, "en");
    expect(url).toContain("steps=true");
  });

  test("URL includes language= param (en)", () => {
    const url = buildWalkingRouteUrl(ORIGIN_LNG, ORIGIN_LAT, DEST_LNG, DEST_LAT, TOKEN, "en");
    expect(url).toContain("language=en");
  });

  test("URL includes language= param (es)", () => {
    const url = buildWalkingRouteUrl(ORIGIN_LNG, ORIGIN_LAT, DEST_LNG, DEST_LAT, TOKEN, "es");
    expect(url).toContain("language=es");
  });

  test("URL includes geometries=geojson and overview=full", () => {
    const url = buildWalkingRouteUrl(ORIGIN_LNG, ORIGIN_LAT, DEST_LNG, DEST_LAT, TOKEN, "en");
    expect(url).toContain("geometries=geojson");
    expect(url).toContain("overview=full");
  });

  test("URL includes origin and destination coordinates", () => {
    const url = buildWalkingRouteUrl(ORIGIN_LNG, ORIGIN_LAT, DEST_LNG, DEST_LAT, TOKEN, "en");
    expect(url).toContain(`${ORIGIN_LNG},${ORIGIN_LAT}`);
    expect(url).toContain(`${DEST_LNG},${DEST_LAT}`);
  });

  test("URL includes access_token", () => {
    const url = buildWalkingRouteUrl(ORIGIN_LNG, ORIGIN_LAT, DEST_LNG, DEST_LAT, TOKEN, "en");
    expect(url).toContain(`access_token=${TOKEN}`);
  });

  test("URL targets Mapbox walking profile", () => {
    const url = buildWalkingRouteUrl(ORIGIN_LNG, ORIGIN_LAT, DEST_LNG, DEST_LAT, TOKEN, "en");
    expect(url).toContain("mapbox/walking");
  });
});
