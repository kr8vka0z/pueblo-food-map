/**
 * CategoryAutoZoomHomeView — MapWrapper's category-autozoom effect (#111) vs.
 * the #231 fixed home view. Issue #247.
 *
 * Reproduces: on a fresh load, `mapboxMap` transitions null -> ready while
 * `activeCategoryFilter` is still its initial `null` (never touched). The
 * pre-fix effect read that "map ready" run as "the user cleared a category"
 * and fitBounds-ed to the whole venue set, overriding the #231 fixed Pueblo
 * home view a few hundred ms after paint. Fix (MapWrapper.tsx): a ref records
 * the previous `activeCategoryFilter` only on runs where `mapboxMap` is ready,
 * so the effect can tell "map just became ready" apart from a genuine user
 * clear (a real non-null -> null transition).
 *
 * Mounts the REAL MapWrapper (the fitBounds call under test lives in
 * MapWrapper's own effect, not in any sub-component) instead of the
 * page.test.tsx-style full mock. Two things have to be faked for that to work
 * in jsdom:
 *
 *   - next/dynamic: MapWrapper code-splits its map canvas via
 *     dynamic(() => import("./Map"), { ssr: false }). Real next/dynamic
 *     depends on webpack/Turbopack chunk loading that doesn't exist under
 *     Vitest (same root cause documented in src/__tests__/page.test.tsx).
 *     This mock resolves the import inside its own useState/useEffect so
 *     "the map becomes ready" is a real, observable React state update
 *     rather than a bare closure mutation nothing re-renders for.
 *   - react-map-gl/mapbox: same mock shape as Map.test.tsx (WebGL needs a
 *     real canvas jsdom doesn't have), extended to capture the `onLoad` prop
 *     so the test can fire "the map is ready" at an exact, controlled point
 *     — independent of real Mapbox load timing.
 *
 * WebGL availability, matchMedia, geolocation permissions, and the county
 * boundary fetch are also stubbed — MapWrapper's own WebGL probe
 * (src/lib/webgl.ts) would otherwise suppress the map entirely in jsdom.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import React from "react";
import { LocaleProvider } from "@/lib/LocaleContext";
import MapWrapper, {
  CATEGORY_FIT_MAX_ZOOM,
  CATEGORY_FIT_PADDING_DESKTOP,
  computeCategoryBounds,
} from "@/components/MapWrapper";
import { venues as allRealVenues } from "@/data/venues";

// ─── Stub mapbox-gl CSS (no-op in jsdom) ─────────────────────────────────────
vi.mock("mapbox-gl/dist/mapbox-gl.css", () => ({}));

// ─── Mock next/dynamic — resolves via the wrapper's OWN state ────────────────
// A bare closure variable (the pattern in page.test.tsx) only surfaces once
// SOME other state update happens to re-render that subtree. Giving the
// wrapper its own useState/useEffect makes the resolved import a real,
// self-contained state update instead of relying on an unrelated sibling
// effect to fire first.
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

// ─── Mock react-map-gl/mapbox — Map.test.tsx's pattern, extended to capture
// `onLoad` so the test controls exactly when "the map is ready" fires. ───────
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
    ref: React.Ref<{ flyTo: () => void; jumpTo: () => void; fitBounds: () => void }>,
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

// ─── Shared test setup ────────────────────────────────────────────────────────

beforeEach(() => {
  mockOnLoadHolder.current = undefined;

  // WebGL probe (src/lib/webgl.ts) — jsdom's canvas has no real GL context by
  // default, which would flip MapWrapper into its no-WebGL list fallback and
  // suppress the map entirely. Fake a minimal available context so the probe
  // reports "available".
  HTMLCanvasElement.prototype.getContext = (() => ({
    getExtension: () => null,
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  // matchMedia — used for isMobile detection AND prefers-reduced-motion.
  // Always "no match" (desktop, no reduced motion) keeps the render tree
  // small (BottomSheet/vaul is mobile-only) and fitBounds durations deterministic.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });

  // Geolocation permissions probe (useGeolocation) — resolve "prompt" so it
  // never fires a state update this suite doesn't care about.
  Object.defineProperty(navigator, "permissions", {
    value: { query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }) },
    configurable: true,
    writable: true,
  });

  // County boundary fetch (Map.tsx, #62) — not under test here.
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ json: vi.fn().mockResolvedValue({ features: [] }) }),
  );
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Render the real MapWrapper and wait past next/dynamic's async resolution
 * so the real Map component mounts and captures `onLoad` — but do NOT fire
 * "map ready" yet (mapboxMap stays null until fireMapReady() is called).
 *
 * WHY waitFor (poll) instead of a fixed tick count: Vite/esbuild compiles the
 * dynamically-imported "./Map" chunk on first touch — the very first test in
 * this file pays that cold-start cost and can take longer than a couple of
 * setTimeout(0) ticks to settle, while later tests in the same run resolve
 * near-instantly from cache. Polling avoids tuning a tick count to the
 * slowest case.
 */
async function renderMapWrapper() {
  render(
    <LocaleProvider>
      <MapWrapper />
    </LocaleProvider>,
  );
  await waitFor(() => {
    if (!mockOnLoadHolder.current) {
      throw new Error("Map's onLoad was not captured — dynamic import has not resolved yet");
    }
  });
}

/**
 * Simulate Map.tsx's onLoad firing — the "map is ready" transition MapWrapper
 * reacts to by calling setMapboxMap(target). Returns the fake map instance so
 * assertions can check fitBounds calls on it.
 */
function fireMapReady() {
  const fakeMap = { fitBounds: vi.fn(), jumpTo: vi.fn(), flyTo: vi.fn() };
  act(() => {
    mockOnLoadHolder.current!({ target: fakeMap });
  });
  return fakeMap;
}

/** Find a CategoryDropdown option row by its visible label text. */
function findCategoryOption(labelSubstring: string): HTMLElement {
  const options = screen.getAllByRole("option");
  const match = options.find((el) => el.textContent?.includes(labelSubstring));
  if (!match) throw new Error(`No category option found containing "${labelSubstring}"`);
  return match;
}

/** Open the category dropdown (search input focus, empty query) and click one row. */
async function selectCategory(labelSubstring: string) {
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  const option = findCategoryOption(labelSubstring);
  await act(async () => {
    fireEvent.click(option);
  });
}

/** Click the active-category chip's clear (×) button in the search bar. */
async function clearCategoryFilter() {
  const clearBtn = screen.getByRole("button", { name: /Clear category filter/i });
  await act(async () => {
    fireEvent.click(clearBtn);
  });
}

// Expected bounds, computed the same way the effect under test computes them —
// reused across assertions so a select/clear can be checked against the exact
// fitBounds argument, not just "was called."
const PANTRY_BOUNDS = computeCategoryBounds(
  allRealVenues.filter((v) => v.category === "pantry"),
);
const ALL_BOUNDS = computeCategoryBounds(allRealVenues);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("#247 — category autozoom vs. #231 fixed home view", () => {
  test("map-ready with no filter ever selected does NOT fitBounds (home view stands)", async () => {
    await renderMapWrapper();
    const fakeMap = fireMapReady();
    expect(fakeMap.fitBounds).not.toHaveBeenCalled();
  });

  test("selecting a category still fits to that category's venues", async () => {
    await renderMapWrapper();
    const fakeMap = fireMapReady();
    fakeMap.fitBounds.mockClear();

    await selectCategory("Food Pantry");

    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
    expect(fakeMap.fitBounds).toHaveBeenCalledWith(
      PANTRY_BOUNDS,
      expect.objectContaining({
        maxZoom: CATEGORY_FIT_MAX_ZOOM,
        padding: CATEGORY_FIT_PADDING_DESKTOP,
      }),
    );
  });

  test("clearing an active category (non-null -> null) still fits to all venues", async () => {
    await renderMapWrapper();
    const fakeMap = fireMapReady();
    await selectCategory("Food Pantry");
    fakeMap.fitBounds.mockClear();

    await clearCategoryFilter();

    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
    expect(fakeMap.fitBounds).toHaveBeenCalledWith(
      ALL_BOUNDS,
      expect.objectContaining({
        maxZoom: CATEGORY_FIT_MAX_ZOOM,
        padding: CATEGORY_FIT_PADDING_DESKTOP,
      }),
    );
  });

  // Edge case called out in #247: the category dropdown is interactive before
  // the map finishes loading (a deferred/slow map load — see #226). Filter
  // churn that happens entirely before "map ready" must still resolve to the
  // right view once the map does become ready.
  describe("select/clear while the map is still loading", () => {
    test("selecting a category BEFORE the map is ready still fits to that category once ready", async () => {
      await renderMapWrapper();
      await selectCategory("Food Pantry"); // activeCategoryFilter set while mapboxMap is still null

      const fakeMap = fireMapReady();

      expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
      expect(fakeMap.fitBounds).toHaveBeenCalledWith(
        PANTRY_BOUNDS,
        expect.objectContaining({ maxZoom: CATEGORY_FIT_MAX_ZOOM }),
      );
    });

    test("select then clear BEFORE the map is ready nets out to no fitBounds on ready (matches a fresh load)", async () => {
      await renderMapWrapper();
      await selectCategory("Food Pantry");
      await clearCategoryFilter();

      const fakeMap = fireMapReady();

      expect(fakeMap.fitBounds).not.toHaveBeenCalled();
    });
  });
});
