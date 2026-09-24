/**
 * RouteFit — MapWrapper's walking-route fitBounds effect (#509 review gap).
 *
 * Reviewer on PR #523: the route-fit effect (MapWrapper.tsx, keyed on
 * `walkingRoute`/`mapboxMap`/`isMobile`) had no test — nothing failed if it
 * was reverted. This proves the wiring: fitBounds is called with the route's
 * bounds and `ROUTE_FIT_PADDING_MOBILE` once a walking route is drawn on
 * mobile, and is NOT called for the route on desktop (`isMobile` false) —
 * the strip (and this padding) is a phone-only concept, see RouteStrip.tsx's
 * own header.
 *
 * Mounts the REAL MapWrapper (same reasoning and harness as
 * CategoryAutoZoomHomeView.test.tsx: the fitBounds call under test lives in
 * MapWrapper's own effect, not a sub-component) and drives a real walking
 * route through the same path a user would: select a venue via the
 * `?venue=` deep link, tap its Walk button, grant geolocation, let the
 * Directions API fetch resolve. Three things beyond that file's own harness
 * are needed here:
 *
 *   - `navigator.permissions.query` resolved "granted" (position stays null
 *     until a request — see useGeolocation.ts's own header) and
 *     `navigator.geolocation.getCurrentPosition` stubbed to resolve
 *     synchronously with a fixed position, so tapping Walk reaches a real
 *     fetch instead of the #207 "share your location" hint path.
 *   - `fetch` dispatches on URL: the Mapbox Directions API (route JSON),
 *     `/api/public/blessing-boxes` (empty list — useBoxesList's fetch), and
 *     the county boundary geojson (empty features — Map.tsx's own fetch).
 *   - `NEXT_PUBLIC_MAPBOX_TOKEN` stubbed — fetchWalkingRoute bails silently
 *     without one.
 *
 * The desktop (`isMobile` false) case renders the real DesktopVenueWindow
 * instead of BottomSheet — its own position-tracking effect needs
 * `project`/`getContainer`/`on`/`off` on the fake map object in addition to
 * `fitBounds`/`flyTo`/`jumpTo`, so `fireMapReady()` here stubs the full set
 * CategoryAutoZoomHomeView.test.tsx didn't need.
 */

import { describe, test, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { LocaleProvider } from "@/lib/LocaleContext";
import MapWrapper, {
  ROUTE_FIT_PADDING_MOBILE,
  ROUTE_FIT_MAX_ZOOM,
  computeCategoryBounds,
} from "@/components/MapWrapper";
import { MOBILE_QUERY } from "@/lib/useMediaQuery";
import { venues as allRealVenues } from "@/data/venues";

// ─── jsdom shims real (unmocked) vaul needs — same as BottomSheet.escapeGuard.test.tsx ───
beforeAll(() => {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn();
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  }
});

// ─── Stub mapbox-gl CSS (no-op in jsdom) ─────────────────────────────────────
vi.mock("mapbox-gl/dist/mapbox-gl.css", () => ({}));

// ─── Mock next/dynamic — resolves via the wrapper's OWN state (CategoryAutoZoomHomeView's pattern) ───
vi.mock("next/dynamic", () => ({
  default: (
    factory: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>,
  ) => {
    function DynamicWrapper(props: Record<string, unknown>) {
      const [Comp, setComp] = React.useState<
        React.ComponentType<Record<string, unknown>> | null
      >(null);
      React.useEffect(() => {
        let cancelled = false;
        factory().then((mod) => {
          if (!cancelled) setComp(() => mod.default);
        });
        return () => {
          cancelled = true;
        };
      }, []);
      return Comp ? React.createElement(Comp, props) : null;
    }
    DynamicWrapper.displayName = "DynamicWrapper";
    return DynamicWrapper;
  },
}));

// ─── Mock react-map-gl/mapbox — same shape as CategoryAutoZoomHomeView.test.tsx ───
const mockOnLoadHolder: { current?: (e: { target: unknown }) => void } = {};

vi.mock("react-map-gl/mapbox", async () => {
  const ReactActual = await import("react");
  const MapGLMock = ReactActual.forwardRef(function MapGLMock(
    {
      children,
      onLoad,
    }: {
      children: React.ReactNode;
      onLoad?: (e: { target: unknown }) => void;
      initialViewState?: unknown;
    },
    ref: React.Ref<unknown>,
  ) {
    mockOnLoadHolder.current = onLoad;
    ReactActual.useImperativeHandle(ref, () => ({
      flyTo: () => {},
      jumpTo: () => {},
      fitBounds: () => {},
    }));
    return ReactActual.createElement("div", { "data-testid": "mapgl-root" }, children);
  });
  return {
    default: MapGLMock,
    Marker: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement("div", { "data-testid": "mapbox-marker" }, children),
    Popup: () => null,
    AttributionControl: () => null,
    Source: (
      { children, "data-testid": testId }: { children?: React.ReactNode; "data-testid"?: string },
    ) => ReactActual.createElement("div", { "data-testid": testId ?? "mapbox-source" }, children),
    Layer: () => null,
  };
});

// ─── Fixed test position + route ─────────────────────────────────────────────
const TEST_POSITION = { lat: 38.25, lng: -104.6 };
const TEST_VENUE = allRealVenues[0];
// Two-point LineString — enough for computeCategoryBounds to produce real bounds.
const ROUTE_COORDINATES: [number, number][] = [
  [-104.6, 38.25],
  [TEST_VENUE.lng, TEST_VENUE.lat],
];
const ROUTE_RESPONSE = {
  routes: [
    {
      geometry: { type: "LineString", coordinates: ROUTE_COORDINATES },
      distance: 640, // ~0.4 mi
      duration: 480, // 8 min
      legs: [{ steps: [] }],
    },
  ],
};
const EXPECTED_ROUTE_BOUNDS = computeCategoryBounds(
  ROUTE_COORDINATES.map(([lng, lat]) => ({ lat, lng })),
);

// ─── Shared test setup ────────────────────────────────────────────────────────

/** query -> matches, so tests can force mobile or desktop layout deterministically. */
function stubMatchMedia(matchesForQuery: (query: string) => boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: matchesForQuery(query),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

beforeEach(() => {
  mockOnLoadHolder.current = undefined;
  vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", "test-token");

  // WebGL probe (src/lib/webgl.ts) — same fake-available context as
  // CategoryAutoZoomHomeView.test.tsx.
  HTMLCanvasElement.prototype.getContext = (() => ({
    getExtension: () => null,
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  // Geolocation permission — "granted" but position null (matches
  // useGeolocation.ts's real contract: permission != position). Walk still
  // has to call request() to get a real position, which the geolocation
  // stub below resolves synchronously.
  Object.defineProperty(navigator, "permissions", {
    value: { query: vi.fn().mockResolvedValue({ state: "granted", onchange: null }) },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(navigator, "geolocation", {
    value: {
      getCurrentPosition: vi.fn((success: (pos: { coords: { latitude: number; longitude: number } }) => void) => {
        success({ coords: { latitude: TEST_POSITION.lat, longitude: TEST_POSITION.lng } });
      }),
    },
    configurable: true,
    writable: true,
  });

  // fetch dispatch by URL — Directions API (route), box list (empty), county
  // boundary (empty features, the fallback branch below).
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.includes("api.mapbox.com/directions")) {
        return Promise.resolve({ ok: true, json: async () => ROUTE_RESPONSE });
      }
      if (url.includes("/api/public/blessing-boxes")) {
        return Promise.resolve({ ok: true, json: async () => ({ boxes: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ features: [] }) });
    }),
  );
});

/** Render MapWrapper deep-linked to TEST_VENUE and wait for the map chunk to resolve. */
async function renderMapWrapper() {
  render(
    <LocaleProvider>
      <MapWrapper initialVenueId={TEST_VENUE.id} />
    </LocaleProvider>,
  );
  await waitFor(() => {
    if (!mockOnLoadHolder.current) {
      throw new Error("Map's onLoad was not captured — dynamic import has not resolved yet");
    }
  });
}

/**
 * Fire "the map is ready". The fake map needs the full method set both
 * BottomSheet's fit effect (fitBounds) and DesktopVenueWindow's own
 * position-tracking effect (project/getContainer/on/off) touch — mounting
 * either card exercises whichever set applies.
 */
function fireMapReady() {
  const fakeMap = {
    fitBounds: vi.fn(),
    jumpTo: vi.fn(),
    flyTo: vi.fn(),
    project: vi.fn(() => ({ x: 400, y: 300 })),
    getContainer: vi.fn(() => ({ offsetWidth: 1200, offsetHeight: 800 })),
    on: vi.fn(),
    off: vi.fn(),
  };
  act(() => {
    mockOnLoadHolder.current!({ target: fakeMap });
  });
  return fakeMap;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("#509 review gap — route-fit effect", () => {
  test("mobile: tapping Walk fits the map to the route with ROUTE_FIT_PADDING_MOBILE", async () => {
    stubMatchMedia((query) => query === MOBILE_QUERY);
    const user = userEvent.setup();
    await renderMapWrapper();
    const fakeMap = fireMapReady();

    const walkButton = await screen.findByRole(
      "button",
      { name: new RegExp(`Walking directions to ${TEST_VENUE.name}`, "i") },
    );
    await user.click(walkButton);

    await waitFor(() => expect(fakeMap.fitBounds).toHaveBeenCalled());
    expect(fakeMap.fitBounds).toHaveBeenCalledWith(
      EXPECTED_ROUTE_BOUNDS,
      expect.objectContaining({
        padding: ROUTE_FIT_PADDING_MOBILE,
        maxZoom: ROUTE_FIT_MAX_ZOOM,
      }),
    );
  });

  test("desktop (isMobile false): a walking route does NOT trigger the route fitBounds", async () => {
    stubMatchMedia(() => false); // never matches MOBILE_QUERY -> desktop layout
    const user = userEvent.setup();
    await renderMapWrapper();
    const fakeMap = fireMapReady();

    const walkButton = await screen.findByRole(
      "button",
      { name: new RegExp(`Walking directions to ${TEST_VENUE.name}`, "i") },
      // #588: DesktopVenueWindow is next/dynamic-loaded now; this file's mocked
      // next/dynamic resolves a real import() inside an effect, which can
      // exceed findByRole's 1000ms default on a busy CI runner. Timing only.
      { timeout: 5000 },
    );
    await user.click(walkButton);

    // Confirm the route really did fetch (walkingRoute became non-null) —
    // via the in-card readout DirectionButtons renders once isRouteActive —
    // so a false negative here can't be mistaken for "route never started."
    await screen.findByTestId("walking-route-info");

    expect(fakeMap.fitBounds).not.toHaveBeenCalled();
  });
});
