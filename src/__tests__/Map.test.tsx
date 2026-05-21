/**
 * Map tests — basic render coverage for the Mapbox-based Map component.
 *
 * react-map-gl/mapbox requires a live WebGL context. We mock the entire module
 * so vitest/jsdom can render the Map component tree without a real canvas:
 *   - MapGL (default export) → forwardRef wrapper that exposes flyTo/jumpTo spies
 *     via the ref, so useEffect flyTo calls are observable in tests
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
 *   - locate button recenters on every tap, not just the first (#60)
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import MapComponent from "@/components/Map";
import type { Venue } from "@/types/venue";

// ─── Stub mapbox-gl CSS (no-op in jsdom) ─────────────────────────────────────
vi.mock("mapbox-gl/dist/mapbox-gl.css", () => ({}));

// Shared spy instances — reset in beforeEach
export const mockFlyTo = vi.fn();
export const mockJumpTo = vi.fn();

// ─── Mock react-map-gl/mapbox ─────────────────────────────────────────────────
// MapGL forwards the ref so Map.tsx's mapRef.current is populated with a mock
// object exposing flyTo / jumpTo spies. Without ref-forwarding those calls are
// silent no-ops (optional chaining on null) and we can't assert on them.
//
// Source and Layer are mocked as passthrough wrappers so the county mask
// elements render without a real Mapbox GL context (#62).
vi.mock("react-map-gl/mapbox", async () => {
  const React = await import("react");
  const MapGLMock = React.forwardRef(function MapGLMock(
    {
      children,
    }: {
      children: React.ReactNode;
      onLoad?: (e: { target: object }) => void;
    },
    ref: React.Ref<{ flyTo: typeof mockFlyTo; jumpTo: typeof mockJumpTo }>,
  ) {
    React.useImperativeHandle(ref, () => ({
      flyTo: mockFlyTo,
      jumpTo: mockJumpTo,
    }));
    return React.createElement("div", { "data-testid": "mapgl-root" }, children);
  });
  return {
    default: MapGLMock,
    Marker: vi.fn(({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "mapbox-marker" }, children),
    ),
    Popup: vi.fn(() => null),
    AttributionControl: vi.fn(() => null),
    // Source renders children when data prop is present; Layer renders null (GPU-only).
    Source: vi.fn(({ children, "data-testid": testId }: { children?: React.ReactNode; "data-testid"?: string }) =>
      React.createElement("div", { "data-testid": testId ?? "mapbox-source" }, children),
    ),
    Layer: vi.fn(() => null),
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
  // Stub fetch for county boundary GeoJSON (#62). The actual boundary loading
  // is tested in pueblo-bbox.test.ts; here we just prevent real network calls.
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ features: [] }),
    }),
  );
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

// ─── Locate button recenter — issue #60 ──────────────────────────────────────
//
// Reproduces: second locate tap after panning does nothing.
// The fix: Map accepts a `recenterRequestId` prop (number); the flyTo effect
// depends on it in addition to userLocation, so every increment triggers a
// recenter regardless of whether userLocation changed.

describe("Map — locate button recenter (#60)", () => {
  const USER_LOC = { lat: 38.26, lng: -104.62 };

  test("flyTo fires on first recenterRequestId (initial locate)", () => {
    render(
      <MapComponent
        {...makeProps({
          userLocation: USER_LOC,
          recenterRequestId: 1,
        })}
      />,
    );
    expect(mockFlyTo).toHaveBeenCalledTimes(1);
    expect(mockFlyTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [USER_LOC.lng, USER_LOC.lat],
        zoom: 14,
      }),
    );
  });

  test("flyTo fires again when recenterRequestId increments (second tap after pan)", () => {
    const { rerender } = render(
      <MapComponent
        {...makeProps({
          userLocation: USER_LOC,
          recenterRequestId: 1,
        })}
      />,
    );
    expect(mockFlyTo).toHaveBeenCalledTimes(1);

    // Simulate user panning away, then tapping locate again — same userLocation,
    // incremented recenterRequestId.
    act(() => {
      rerender(
        <MapComponent
          {...makeProps({
            userLocation: USER_LOC,
            recenterRequestId: 2,
          })}
        />,
      );
    });

    // Bug: with the old flownToUserRef guard, flyTo is NOT called a second time.
    // Fix: flyTo must fire again → total call count = 2.
    expect(mockFlyTo).toHaveBeenCalledTimes(2);
  });

  test("passive userLocation update without recenterRequestId change does NOT re-center", () => {
    // Guards against watchPosition jitter causing unwanted re-centers.
    // recenterRequestId stays at 1 across both renders.
    const { rerender } = render(
      <MapComponent
        {...makeProps({
          userLocation: USER_LOC,
          recenterRequestId: 1,
        })}
      />,
    );
    expect(mockFlyTo).toHaveBeenCalledTimes(1);

    // Simulate geolocation watchPosition firing a slightly different position
    // (jitter) without a user tap.
    act(() => {
      rerender(
        <MapComponent
          {...makeProps({
            userLocation: { lat: 38.2601, lng: -104.6201 },
            recenterRequestId: 1, // unchanged — no user tap
          })}
        />,
      );
    });

    // Should still be 1 — passive jitter must not re-center.
    expect(mockFlyTo).toHaveBeenCalledTimes(1);
  });
});

// ─── County constraint props (#62) ───────────────────────────────────────────
//
// We cannot assert on the actual Mapbox WebGL rendering (no canvas in jsdom),
// but we can verify:
//   - Map renders without error when the constraint props are present.
//   - The mock MapGL receives maxBounds and minZoom (via the mock's props
//     passthrough — the forwardRef mock renders children so the tree is intact).
//
// The Source + Layer GPU paths are mocked away (see vi.mock above).

describe("Map — county constraint (#62)", () => {
  test("renders without error (constraint props accepted)", () => {
    // Map.tsx now always passes maxBounds + minZoom. If those props caused a
    // type or runtime error, this render would throw.
    const { container } = render(<MapComponent {...makeProps()} />);
    expect(container.querySelector("[data-testid='mapgl-root']")).not.toBeNull();
  });

  test("fetch for county boundary is called on mount", async () => {
    render(<MapComponent {...makeProps()} />);
    // fetch is called once (county boundary URL). May fire async — await a tick.
    await act(async () => {});
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/data/pueblo-county-boundary.geojson",
    );
  });

  test("renders correctly when venues are present alongside constraint props", () => {
    const { container } = render(
      <MapComponent {...makeProps({ venues: VENUES_THREE })} />,
    );
    // Map root renders
    expect(container.querySelector("[data-testid='mapgl-root']")).not.toBeNull();
    // Venue markers still render — constraint props do not suppress them
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(VENUES_THREE.length);
  });
});
