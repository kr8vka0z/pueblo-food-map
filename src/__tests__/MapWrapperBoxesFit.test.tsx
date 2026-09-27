/**
 * MapWrapperBoxesFit — #670: tapping Boxes on the bottom bar zooms to the
 * visitor's 5 nearest boxes, centered on the visitor, when their location is
 * already known — instead of the plain "fit every box in the county" the
 * category-fit effect (CategoryAutoZoom*.test.ts) otherwise does. Covers:
 *
 *   1. Location known (Near me already granted a position): Boxes-on fits
 *      nearestBoundsAround(position, boxVenues, 5), not the all-boxes bounds.
 *   2. Location unknown: Boxes-on fits all boxes (today's behavior), same as
 *      before #670 — and never calls the geolocation permission prompt.
 *   3. Boxes-off (after on): restores the all-venues fit.
 *   4. The `/?boxes=1` hand-off (`initialBoxesFilter` prop) applies the same
 *      known-location-vs-unknown rule as the bottom-bar button.
 *
 * Same harness as CategoryAutoZoomHomeView.test.tsx / RouteFit.test.tsx (the
 * fitBounds call under test lives in MapWrapper's own effect, not a
 * sub-component) — real MapWrapper, mocked next/dynamic + react-map-gl/mapbox,
 * fake-available WebGL, geolocation stubbed per test.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { LocaleProvider } from "@/lib/LocaleContext";
import MapWrapper, {
  computeCategoryBounds,
  nearestBoundsAround,
} from "@/components/MapWrapper";
import { venues as allRealVenues } from "@/data/venues";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";

// ─── Stub mapbox-gl CSS (no-op in jsdom) ─────────────────────────────────────
vi.mock("mapbox-gl/dist/mapbox-gl.css", () => ({}));

// ─── Mock next/dynamic — CategoryAutoZoomHomeView.test.tsx's pattern ─────────
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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TEST_POSITION = { lat: 38.2544, lng: -104.6091 };

// 6 boxes at increasing distance from TEST_POSITION so "nearest 5" is a real,
// checkable subset — the 6th (farthest) must not affect the fit bounds.
const TEST_BOXES: PublicBlessingBox[] = Array.from({ length: 6 }, (_, i) => ({
  id: `box-${i}`,
  name: `Box ${i}`,
  category: "blessing_box" as const,
  lat: TEST_POSITION.lat + (i + 1) * 0.01,
  lng: TEST_POSITION.lng,
  address: `${i} Test St`,
  source: "manual",
  last_verified: "2026-09-01",
  box: {
    hostName: null,
    hostNote: null,
    mostNeeded: null,
    installedOn: null,
    removedOn: null,
    status: "stocked" as const,
    lastFilledAt: null,
    recentCheckins: [],
    latestPhoto: null,
    adopters: [],
  },
}));

// Boxes-on with only `blessing_box` checked fits bounds over just that
// category's venues (existing category-fit behavior, unchanged by #670) —
// blessing_box venues live ONLY in boxVenues (see MapWrapper.tsx's own
// comment on categoryVenues), so this is boxes-only, not allVenues+boxes.
const ALL_BOXES_BOUNDS = computeCategoryBounds(
  TEST_BOXES.map((b) => ({ lat: b.lat, lng: b.lng })),
);
// Boxes toggled back OFF is a real "clear" (no categories left checked) —
// THAT path fits every venue across both allVenues and boxVenues.
const CLEAR_ALL_BOUNDS = computeCategoryBounds([
  ...allRealVenues,
  ...TEST_BOXES.map((b) => ({ lat: b.lat, lng: b.lng })),
]);
const EXPECTED_NEAREST_5_BOUNDS = nearestBoundsAround(
  TEST_POSITION,
  TEST_BOXES.map((b) => ({ lat: b.lat, lng: b.lng })),
  5,
);

// ─── Shared test setup ────────────────────────────────────────────────────────

/** Geolocation permission stub. "granted" + a synchronous position stub makes
 * a later Near-me tap resolve `userLocation` immediately, matching
 * useGeolocation.ts's real contract (permission != position — see
 * RouteFit.test.tsx's own comment). "prompt" leaves position permanently null
 * (an unanswered prompt) for the "location unknown" cases. */
function stubGeolocation(permission: "granted" | "prompt") {
  Object.defineProperty(navigator, "permissions", {
    value: { query: vi.fn().mockResolvedValue({ state: permission, onchange: null }) },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(navigator, "geolocation", {
    value: {
      getCurrentPosition: vi.fn(
        (success: (pos: { coords: { latitude: number; longitude: number } }) => void) => {
          success({ coords: { latitude: TEST_POSITION.lat, longitude: TEST_POSITION.lng } });
        },
      ),
    },
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  mockOnLoadHolder.current = undefined;

  HTMLCanvasElement.prototype.getContext = (() => ({
    getExtension: () => null,
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });

  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.includes("/api/public/blessing-boxes")) {
        return Promise.resolve({ ok: true, json: async () => ({ boxes: TEST_BOXES }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ features: [] }) });
    }),
  );
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function renderMapWrapper(props: Record<string, unknown> = {}) {
  render(
    <LocaleProvider>
      <MapWrapper {...props} />
    </LocaleProvider>,
  );
  await waitFor(() => {
    if (!mockOnLoadHolder.current) {
      throw new Error("Map's onLoad was not captured — dynamic import has not resolved yet");
    }
  });
  // Let useBoxesList's fetch resolve so boxVenues is populated before any
  // fitBounds assertion — without this, an early Boxes tap would compute
  // bounds over an empty box list.
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

function fireMapReady() {
  const fakeMap = { fitBounds: vi.fn(), jumpTo: vi.fn(), flyTo: vi.fn() };
  act(() => {
    mockOnLoadHolder.current!({ target: fakeMap });
  });
  return fakeMap;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("#670 — Boxes bottom-nav button zooms to the visitor's nearest boxes", () => {
  test("location known (Near me already granted): Boxes-on fits the nearest-5 bounds, not all-boxes", async () => {
    stubGeolocation("granted");
    const user = userEvent.setup();
    await renderMapWrapper();
    const fakeMap = fireMapReady();

    // Establish a known location the same way a real visitor would — tap
    // Near me first (flies/recenters; doesn't call fitBounds — nothing to
    // wait on beyond the click settling before the Boxes tap below).
    await user.click(screen.getByTestId("nav-near-me"));
    fakeMap.fitBounds.mockClear();

    fireEvent.click(screen.getByTestId("nav-boxes"));

    await waitFor(() => expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1));
    expect(fakeMap.fitBounds).toHaveBeenCalledWith(
      EXPECTED_NEAREST_5_BOUNDS,
      expect.objectContaining({ duration: 600 }),
    );
  });

  test("location unknown (permission never answered): Boxes-on fits ALL boxes, same as before #670", async () => {
    stubGeolocation("prompt");
    await renderMapWrapper();
    const fakeMap = fireMapReady();
    fakeMap.fitBounds.mockClear();

    fireEvent.click(screen.getByTestId("nav-boxes"));

    await waitFor(() => expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1));
    expect(fakeMap.fitBounds).toHaveBeenCalledWith(
      ALL_BOXES_BOUNDS,
      expect.objectContaining({ duration: 600 }),
    );
  });

  test("location unknown: tapping Boxes never triggers the geolocation permission prompt", async () => {
    stubGeolocation("prompt");
    await renderMapWrapper();
    fireMapReady();

    const getCurrentPositionSpy = navigator.geolocation.getCurrentPosition as ReturnType<
      typeof vi.fn
    >;
    getCurrentPositionSpy.mockClear();

    fireEvent.click(screen.getByTestId("nav-boxes"));

    expect(getCurrentPositionSpy).not.toHaveBeenCalled();
  });

  test("Boxes off (after on) restores the all-venues fit", async () => {
    stubGeolocation("prompt");
    await renderMapWrapper();
    const fakeMap = fireMapReady();

    fireEvent.click(screen.getByTestId("nav-boxes")); // on
    await waitFor(() => expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1));
    fakeMap.fitBounds.mockClear();

    fireEvent.click(screen.getByTestId("nav-boxes")); // off

    await waitFor(() => expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1));
    expect(fakeMap.fitBounds).toHaveBeenCalledWith(
      CLEAR_ALL_BOUNDS,
      expect.objectContaining({ duration: 600 }),
    );
  });

  test("the /?boxes=1 hand-off (initialBoxesFilter) doesn't wait on geolocation — fits all boxes when position isn't resolved yet", async () => {
    // useGeolocation's own mount probe (navigator.permissions.query) resolves
    // asynchronously (a microtask), so even with permission already
    // "granted", `geo.state.position` is still null on the SAME synchronous
    // effect pass the one-shot initialBoxesFilter effect runs in (real
    // contract: permission != position, see useGeolocation.ts's header).
    // This is exactly the race #670's Plan calls out ("arrives before
    // geolocation resolves ... don't wait on it") — proving the hand-off
    // falls through to fit-all rather than blocking for a position that
    // hasn't arrived, the same way it would with permission never granted.
    stubGeolocation("granted");
    await renderMapWrapper({ initialBoxesFilter: true });
    const fakeMap = fireMapReady();

    await waitFor(() => expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1));
    expect(fakeMap.fitBounds).toHaveBeenCalledWith(
      ALL_BOXES_BOUNDS,
      expect.objectContaining({ duration: 600 }),
    );
  });
});
