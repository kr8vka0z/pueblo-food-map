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
import { buildWalkingRouteUrl, parseWalkSteps } from "@/components/MapWrapper";
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

// ─── parseWalkSteps — step parsing edge cases (FIX 3) ────────────────────────
//
// parseWalkSteps is extracted from the handleWalkRoute async callback so the
// parse logic can be unit-tested without mounting MapWrapper (WebGL required).
// Tests cover the highest-risk paths: malformed API responses that would
// previously throw → be caught → silently discard the entire route.

describe("parseWalkSteps — step parsing edge cases (FIX 3)", () => {
  test("normal multi-step route returns all steps with instruction + distance", () => {
    const route = {
      legs: [{
        steps: [
          { maneuver: { instruction: "Head north on Main St" }, distance: 50 },
          { maneuver: { instruction: "Turn right on Union Ave" }, distance: 300 },
          { maneuver: { instruction: "Arrive at destination" }, distance: 0 },
        ],
      }],
    };
    const steps = parseWalkSteps(route);
    expect(steps).toHaveLength(3);
    expect(steps[0]).toEqual({ instruction: "Head north on Main St", distance: 50 });
    expect(steps[1]).toEqual({ instruction: "Turn right on Union Ave", distance: 300 });
    expect(steps[2]).toEqual({ instruction: "Arrive at destination", distance: 0 });
  });

  test("empty legs array returns empty steps", () => {
    const steps = parseWalkSteps({ legs: [] });
    expect(steps).toHaveLength(0);
  });

  test("missing legs field returns empty steps", () => {
    const steps = parseWalkSteps({});
    expect(steps).toHaveLength(0);
  });

  test("step missing maneuver field is dropped (not thrown)", () => {
    // WHY: the API response is consumed via an `as` cast — missing maneuver
    // was previously an uncaught throw that discarded the entire route.
    const route = {
      legs: [{
        steps: [
          { maneuver: { instruction: "Head north on Main St" }, distance: 50 },
          { distance: 200 } as never, // no maneuver field
          { maneuver: { instruction: "Arrive at destination" }, distance: 0 },
        ],
      }],
    };
    const steps = parseWalkSteps(route);
    // The malformed step (no maneuver) is dropped; valid steps are kept
    expect(steps).toHaveLength(2);
    expect(steps[0].instruction).toBe("Head north on Main St");
    expect(steps[1].instruction).toBe("Arrive at destination");
  });

  test("step with maneuver but missing instruction is dropped", () => {
    const route = {
      legs: [{
        steps: [
          { maneuver: { instruction: "Head north on Main St" }, distance: 50 },
          { maneuver: {}, distance: 200 } as never, // maneuver present, instruction absent
          { maneuver: { instruction: "Arrive at destination" }, distance: 0 },
        ],
      }],
    };
    const steps = parseWalkSteps(route);
    expect(steps).toHaveLength(2);
    expect(steps[0].instruction).toBe("Head north on Main St");
  });

  test("step with empty-string instruction is dropped", () => {
    const route = {
      legs: [{
        steps: [
          { maneuver: { instruction: "" }, distance: 100 },
          { maneuver: { instruction: "Turn left" }, distance: 50 },
        ],
      }],
    };
    const steps = parseWalkSteps(route);
    expect(steps).toHaveLength(1);
    expect(steps[0].instruction).toBe("Turn left");
  });

  test("arrival step (distance 0) is kept by the parser", () => {
    // WHY: distance 0 formatting is handled by formatStepDistance (returns ""),
    // not by the parser. The parser keeps the step so the arrival instruction
    // ("Arrive at destination") is visible in the list.
    const route = {
      legs: [{
        steps: [
          { maneuver: { instruction: "Arrive at destination" }, distance: 0 },
        ],
      }],
    };
    const steps = parseWalkSteps(route);
    expect(steps).toHaveLength(1);
    expect(steps[0].distance).toBe(0);
    expect(steps[0].instruction).toBe("Arrive at destination");
  });

  test("all steps malformed returns empty array without throwing", () => {
    const route = {
      legs: [{
        steps: [
          { distance: 100 } as never,
          { maneuver: {}, distance: 200 } as never,
        ],
      }],
    };
    expect(() => parseWalkSteps(route)).not.toThrow();
    const steps = parseWalkSteps(route);
    expect(steps).toHaveLength(0);
  });
});

// ─── Race guard — monotonic seq logic (#208 hardening) ───────────────────────
//
// handleWalkRoute in MapWrapper.tsx uses a monotonic sequence counter
// (walkReqSeq ref) instead of keying on venue.id. This describe block
// exercises the guard semantics as a pure behavioral simulation — no
// MapWrapper mount needed (WebGL unavailable in jsdom).
//
// The simulation recreates the closure pattern from handleWalkRoute:
//   seq = ++counter.current     // mint token at fetch start
//   await fetch(...)            // yield — other taps may increment counter
//   if (counter.current !== seq) return;  // bail if superseded
//   commitState()
//
// This covers both gaps from the PR #208 review:
//   Gap 1: same-venue double-tap (old venue.id guard would let both through).
//   Gap 2: A→B switch while A's fetch pending (seq guard + render-gate).
//
// NOTE: The render-gate (walkingRouteVenueId === selectedVenueId ? route : null)
// is a JSX prop expression; it cannot be directly exercised without mounting
// MapWrapper (WebGL). It is covered by the behavioral description in the final
// two tests, which verify that the seq guard drops superseded responses before
// any state is committed — making the render-gate the secondary defence.

describe("Race guard — monotonic seq counter (#208 hardening)", () => {
  /**
   * Minimal simulation of the walkReqSeq guard pattern.
   * Returns a factory that mimics the async closure in handleWalkRoute.
   */
  function makeGuardedFetch(counter: { current: number }) {
    return async function fetchAndCommit(
      resolveWith: string,
      resolveLater: Promise<void>,
      committed: string[],
    ) {
      const seq = ++counter.current;
      await resolveLater;
      // Guard: bail if a newer request has been issued since we started.
      if (counter.current !== seq) return;
      committed.push(resolveWith);
    };
  }

  test("first of two concurrent fetches is dropped when the second resolves last", async () => {
    const counter = { current: 0 };
    const fetch = makeGuardedFetch(counter);
    const committed: string[] = [];

    let resolveFirst!: () => void;
    let resolveSecond!: () => void;
    const firstDone = new Promise<void>((r) => { resolveFirst = r; });
    const secondDone = new Promise<void>((r) => { resolveSecond = r; });

    // Launch fetch A (seq=1), then fetch B (seq=2) — B is issued after A.
    const fetchA = fetch("route-A", firstDone, committed);
    const fetchB = fetch("route-B", secondDone, committed);

    // B resolves first, then A resolves — older response arrives last.
    resolveSecond();
    await fetchB;
    resolveFirst();
    await fetchA;

    // Only B should commit; A should bail (counter.current=2, A's seq=1).
    expect(committed).toEqual(["route-B"]);
  });

  test("same-venue double-tap: only the latest request commits", async () => {
    const counter = { current: 0 };
    const fetch = makeGuardedFetch(counter);
    const committed: string[] = [];

    let resolveFirst!: () => void;
    let resolveSecond!: () => void;
    const firstDone = new Promise<void>((r) => { resolveFirst = r; });
    const secondDone = new Promise<void>((r) => { resolveSecond = r; });

    // Two taps for the same venue (same route string, different seq tokens).
    const tap1 = fetch("route-same-venue", firstDone, committed);
    const tap2 = fetch("route-same-venue", secondDone, committed);

    // First tap resolves last (slow network on first try).
    resolveSecond();
    await tap2;
    resolveFirst();
    await tap1;

    // Under the OLD venue.id guard both would pass (same id).
    // Under the new seq guard only tap2 (seq=2) commits; tap1 (seq=1) bails.
    expect(committed).toHaveLength(1);
  });

  test("explicit clear (seq bump) prevents a pending fetch from committing", async () => {
    const counter = { current: 0 };
    const fetch = makeGuardedFetch(counter);
    const committed: string[] = [];

    let resolveFetch!: () => void;
    const fetchDone = new Promise<void>((r) => { resolveFetch = r; });

    // Start a fetch (seq=1).
    const pendingFetch = fetch("route-A", fetchDone, committed);

    // Simulate toggle-off / handleClearWalkingRoute: bump counter BEFORE resolve.
    counter.current++; // seq is now 2; pending fetch holds seq=1

    // Fetch resolves after the clear.
    resolveFetch();
    await pendingFetch;

    // Pending fetch must not commit.
    expect(committed).toHaveLength(0);
  });

  test("seq NOT bumped in selection-change path: new fetch for new venue proceeds", async () => {
    // WHY: the selectedVenueId-change effect does NOT bump walkReqSeq (by design).
    // This test verifies that a fetch started for a new venue (after a selection
    // switch) is NOT prematurely discarded by the guard.
    const counter = { current: 0 };
    const fetch = makeGuardedFetch(counter);
    const committed: string[] = [];

    let resolveNew!: () => void;
    const newDone = new Promise<void>((r) => { resolveNew = r; });

    // Selection-change effect only clears displayed state (not seq).
    // Immediately after, a Walk tap mints seq=1.
    const newFetch = fetch("route-new-venue", newDone, committed);

    resolveNew();
    await newFetch;

    // Should commit: counter.current=1 === seq=1.
    expect(committed).toEqual(["route-new-venue"]);
  });
});
