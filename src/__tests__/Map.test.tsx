/**
 * Map tests — basic render coverage for the Mapbox-based Map component.
 *
 * react-map-gl/mapbox requires a live WebGL context. We mock the entire module
 * so vitest/jsdom can render the Map component tree without a real canvas:
 *   - MapGL (default export) → renders children inside a <div>
 *   - Marker                → renders children inside a <div>
 *   - Popup                 → renders null (tooltips are visual-only)
 *   - AttributionControl    → renders null
 *
 * We also stub mapbox-gl/dist/mapbox-gl.css so jsdom doesn't try to parse CSS.
 *
 * Coverage:
 *   - Map renders without error (no venues)
 *   - Map renders VenueMarker buttons for each venue
 *   - User-location dot is absent when userLocation is null
 *   - User-location dot is present when userLocation is set
 *   - onSelectVenue is called when a VenueMarker button is clicked
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MapComponent from "@/components/Map";
import type { Venue } from "@/types/venue";

// ─── Stub mapbox-gl CSS (no-op in jsdom) ─────────────────────────────────────
vi.mock("mapbox-gl/dist/mapbox-gl.css", () => ({}));

// ─── Mock react-map-gl/mapbox ─────────────────────────────────────────────────
// Use factory function returning plain objects — avoids React copy issues caused
// by importing React inside vi.mock factory scope.
vi.mock("react-map-gl/mapbox", async () => {
  const React = await import("react");
  return {
    default: vi.fn(
      ({
        children,
      }: {
        children: React.ReactNode;
        onLoad?: (e: { target: object }) => void;
      }) => React.createElement("div", { "data-testid": "mapgl-root" }, children),
    ),
    Marker: vi.fn(({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "mapbox-marker" }, children),
    ),
    Popup: vi.fn(() => null),
    AttributionControl: vi.fn(() => null),
  };
});

// ─── Test fixtures ────────────────────────────────────────────────────────────

function makeVenue(id: string, name: string, category: Venue["category"] = "pantry"): Venue {
  return {
    id,
    name,
    category,
    lat: 38.2544,
    lng: -104.6091,
    address: `${id} Test St, Pueblo, CO`,
    source: "test",
    last_verified: "2026-01-01",
  };
}

const VENUES_EMPTY: Venue[] = [];
const VENUES_ONE = [makeVenue("v1", "La Familia Pantry", "pantry")];
const VENUES_THREE = [
  makeVenue("v1", "La Familia Pantry", "pantry"),
  makeVenue("v2", "City Market", "grocery"),
  makeVenue("v3", "Bessemer Community Garden", "garden"),
];

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    venues: VENUES_EMPTY,
    selectedVenueId: null,
    userLocation: null,
    userDistances: new Map<string, number>(),
    onSelectVenue: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Stub window.matchMedia for reduced-motion guard inside Map component
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

// ─── Basic render ─────────────────────────────────────────────────────────────

describe("Map — basic render", () => {
  test("renders without error when venues array is empty", () => {
    const { container } = render(<MapComponent {...makeProps()} />);
    expect(container.querySelector("[data-testid='mapgl-root']")).not.toBeNull();
  });

  test("renders without error when venues are provided", () => {
    const { container } = render(<MapComponent {...makeProps({ venues: VENUES_THREE })} />);
    expect(container.querySelector("[data-testid='mapgl-root']")).not.toBeNull();
  });
});

// ─── Venue markers ────────────────────────────────────────────────────────────

describe("Map — venue markers", () => {
  test("renders one marker button per venue", () => {
    render(<MapComponent {...makeProps({ venues: VENUES_THREE })} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(VENUES_THREE.length);
  });

  test("renders zero marker buttons when venues is empty", () => {
    render(<MapComponent {...makeProps({ venues: VENUES_EMPTY })} />);
    const buttons = screen.queryAllByRole("button");
    expect(buttons.length).toBe(0);
  });

  test("marker button aria-label contains venue name", () => {
    render(<MapComponent {...makeProps({ venues: VENUES_ONE })} />);
    const btn = screen.getByRole("button", {
      name: /La Familia Pantry/,
    });
    expect(btn).toBeDefined();
  });

  test("clicking a marker button fires onSelectVenue with correct id", () => {
    const onSelectVenue = vi.fn();
    render(
      <MapComponent
        {...makeProps({
          venues: VENUES_ONE,
          onSelectVenue,
        })}
      />,
    );
    const btn = screen.getByRole("button", {
      name: /La Familia Pantry/,
    });
    fireEvent.click(btn);
    expect(onSelectVenue).toHaveBeenCalledWith("v1");
  });
});

// ─── User-location dot ────────────────────────────────────────────────────────

describe("Map — user-location dot", () => {
  test("user-location dot absent when userLocation is null", () => {
    const { container } = render(
      <MapComponent {...makeProps({ userLocation: null })} />,
    );
    const dot = container.querySelector(".pfm-user-dot");
    expect(dot).toBeNull();
  });

  test("user-location dot present when userLocation is provided", () => {
    const { container } = render(
      <MapComponent
        {...makeProps({
          userLocation: { lat: 38.2544, lng: -104.6091 },
        })}
      />,
    );
    const dot = container.querySelector(".pfm-user-dot");
    expect(dot).not.toBeNull();
  });

  test("user-location dot has aria-hidden='true'", () => {
    const { container } = render(
      <MapComponent
        {...makeProps({
          userLocation: { lat: 38.2544, lng: -104.6091 },
        })}
      />,
    );
    const dot = container.querySelector(".pfm-user-dot");
    expect(dot?.getAttribute("aria-hidden")).toBe("true");
  });
});

// ─── Distance labels in aria ──────────────────────────────────────────────────

describe("Map — distance in marker aria-label", () => {
  test("marker aria-label includes distance when provided via userDistances", () => {
    const userDistances = new Map<string, number>([["v1", 0.8]]);
    render(
      <MapComponent
        {...makeProps({
          venues: VENUES_ONE,
          userDistances,
        })}
      />,
    );
    const btn = screen.getByRole("button", {
      name: /La Familia Pantry.*0\.8 mi/,
    });
    expect(btn).toBeDefined();
  });
});
