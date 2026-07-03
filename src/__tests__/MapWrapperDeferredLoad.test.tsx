/**
 * MapWrapper deferred map load tests (#226) — the render-tree wiring of
 * useDeferredMapLoad (see useDeferredMapLoad.test.ts for the hook's own
 * timer/event-listener coverage).
 *
 * Verifies, at the MapWrapper level:
 *   - cold load with no venue deep link renders the ListView placeholder in
 *     the map's place and does NOT mount the interactive map (no
 *     <MapCanvas>, so no mapbox-gl chunk fetch — confirmed by our next/dynamic
 *     mock never being asked to resolve a real Map module in this file).
 *   - the placeholder is replaced by the interactive map once the
 *     idle/interaction trigger fires (pointerdown, and separately: focusin,
 *     proving the path is not pointer-only for keyboard/AT users).
 *   - a venue deep link (initialVenueId set — MapWrapper's existing #132
 *     prop, populated by page.tsx from ?venue=/#venue=) bypasses the gate:
 *     the map mounts immediately, no placeholder frame, and the existing
 *     deep-link effect (unit #132, unchanged by this PR) still selects the
 *     venue once the map reports ready.
 *   - the box that holds either the placeholder or the live map keeps the
 *     same fill-parent wrapper across the swap — the structural guarantee
 *     behind "no CLS" (both ListView and Map.tsx's root render
 *     absolute/100%-of-parent; the parent's own size is flex/viewport-driven,
 *     never content-driven).
 *
 * WHY next/dynamic must be mocked here too (same recipe as page.test.tsx):
 * MapWrapper.tsx itself calls dynamic(() => import("./Map")) for MapCanvas.
 * Real next/dynamic's chunk resolution never settles in Vitest/jsdom, so
 * without this mock <MapCanvas> would render null forever regardless of our
 * gate — the mock makes it resolve synchronously-ish (a microtask) instead.
 *
 * WHY Map, DesktopVenueWindow are mocked: Map needs live WebGL (see
 * Map.test.tsx's own module mock for the *real* Map component — this file
 * tests MapWrapper's gating, not Map's rendering, so a light sentinel is
 * enough). DesktopVenueWindow calls real mapboxgl.Map methods (project,
 * getContainer, on/off) on whatever `mapboxMap` it's given — our fake map
 * object from the mocked Map's onMapReady isn't a real mapboxgl.Map instance,
 * so DesktopVenueWindow would throw if it rendered for real once a venue is
 * selected. Everything else (SearchBar, LocateButton, HamburgerMenu,
 * SponsorCredit, Wordmark, CategoryDropdown) renders for real — none of them
 * touch mapboxMap or WebGL, matching the precedent in
 * MapWrapperChrome.test.tsx of exercising simple chrome components directly.
 *
 * WHY @/lib/webgl is mocked: jsdom's canvas.getContext("webgl") genuinely
 * returns null (no GPU), so the real #165 probe would report WebGL
 * unavailable and force mapUnavailable=true / viewMode="list" on every run —
 * masking the #226 gate this file exists to test behind an unrelated,
 * already-covered fallback path (see Map.test.tsx and useMapUI for #165's
 * own coverage). Forcing it "available" here isolates the gate under test.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";
import MapWrapper from "@/components/MapWrapper";
import { LocaleProvider } from "@/lib/LocaleContext";
import { venues } from "@/data/venues";

vi.mock("@/lib/webgl", () => ({ isWebGLAvailable: () => true }));

// ─── Mock next/dynamic — resolve synchronously in Vitest/jsdom ───────────────
// Identical recipe to src/__tests__/page.test.tsx — see that file's WHY.
vi.mock("next/dynamic", () => ({
  default: (factory: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>) => {
    let ResolvedComponent: React.ComponentType<Record<string, unknown>> | null = null;
    factory().then((mod) => { ResolvedComponent = mod.default; });
    function DynamicWrapper(props: Record<string, unknown>) {
      return ResolvedComponent ? React.createElement(ResolvedComponent, props) : null;
    }
    DynamicWrapper.displayName = "DynamicWrapper";
    return DynamicWrapper;
  },
}));

// ─── Mock Map — sentinel that reports what it was given + fires onMapReady ────
// onMapReady fires in an effect (never during render) with a fake map object,
// so the existing #132 deep-link effect in MapWrapper (which waits on
// mapboxMap before selecting initialVenueId) can proceed exactly as it does
// with a real Mapbox instance. The fake map exposes fitBounds/flyTo/jumpTo as
// no-ops — MapWrapper.tsx calls these directly on `mapboxMap` (category
// autozoom #111 fires fitBounds as soon as mapboxMap is set, even with no
// category selected — pre-existing behavior, unrelated to #226) — a bare
// object without them throws "not a function" once onMapReady fires for real.
vi.mock("@/components/Map", async () => {
  const React = await import("react");
  function MapMock({
    venues: mapVenues,
    selectedVenueId,
    onMapReady,
  }: {
    venues?: Array<{ id: string }>;
    selectedVenueId?: string | null;
    onMapReady?: (map: unknown) => void;
  }) {
    React.useEffect(() => {
      onMapReady?.({ fitBounds: vi.fn(), flyTo: vi.fn(), jumpTo: vi.fn() });
      // Fire once on mount only — mirrors a real map's single onLoad.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return React.createElement("div", {
      "data-testid": "map-canvas",
      "data-venue-count": mapVenues?.length ?? 0,
      "data-selected-venue-id": selectedVenueId ?? "",
    });
  }
  return { default: MapMock };
});

// ─── Mock DesktopVenueWindow — takes a real mapboxgl.Map; see file header ─────
vi.mock("@/components/DesktopVenueWindow", () => ({
  default: () => null,
}));

// ─── Global stubs (same shape as Map.test.tsx / page.test.tsx) ───────────────
beforeEach(() => {
  Object.defineProperty(navigator, "permissions", {
    value: { query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }) },
    configurable: true,
    writable: true,
  });
  // matches:false → desktop (useIsMobile stays false), so BottomSheet's
  // isMobile-gated render never triggers and needs no mock.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Render MapWrapper, flush the dynamic()/effect microtasks, settle. */
async function renderMapWrapper(props: Partial<React.ComponentProps<typeof MapWrapper>> = {}) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <LocaleProvider>
        <MapWrapper {...props} />
      </LocaleProvider>,
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  return result;
}

const REAL_VENUE_ID = venues[0].id;

// ─── Cold load, no deep link ──────────────────────────────────────────────────

describe("MapWrapper — cold load with no deep link (#226)", () => {
  test("renders the ListView placeholder in the map's place", async () => {
    await renderMapWrapper();
    // ListView renders real venue cards — its "N places" summary line is a
    // reliable sentinel that the real (not mocked) ListView is mounted.
    expect(screen.getByText(/sorted by/i)).toBeTruthy();
  });

  test("does NOT mount the interactive map", async () => {
    await renderMapWrapper();
    expect(screen.queryByTestId("map-canvas")).toBeNull();
  });

  test("mounts the interactive map, and the placeholder is replaced, once a pointerdown fires", async () => {
    await renderMapWrapper();
    expect(screen.queryByTestId("map-canvas")).toBeNull();

    await act(async () => {
      window.dispatchEvent(new Event("pointerdown"));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByTestId("map-canvas")).toBeTruthy();
  });

  test("mounts the interactive map on focusin — the trigger is not pointer-only (keyboard/AT reachability)", async () => {
    await renderMapWrapper();
    expect(screen.queryByTestId("map-canvas")).toBeNull();

    await act(async () => {
      window.dispatchEvent(new Event("focusin"));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByTestId("map-canvas")).toBeTruthy();
  });
});

// ─── Cold load with a venue deep link (#132 + #226) ───────────────────────────

describe("MapWrapper — cold load with a venue deep link bypasses the gate (#226)", () => {
  test("mounts the interactive map immediately — no placeholder frame", async () => {
    await renderMapWrapper({ initialVenueId: REAL_VENUE_ID });
    // No interaction dispatched, no timers advanced: eager load must not
    // depend on either.
    expect(screen.getByTestId("map-canvas")).toBeTruthy();
  });

  test("opens the deep-linked venue once the map reports ready (existing #132 effect, unchanged)", async () => {
    await renderMapWrapper({ initialVenueId: REAL_VENUE_ID });
    const canvas = await screen.findByTestId("map-canvas");
    expect(canvas.getAttribute("data-selected-venue-id")).toBe(REAL_VENUE_ID);
  });

  test("an unknown deep-link id still loads the map eagerly (fails open, matches pre-existing #132 guard)", async () => {
    await renderMapWrapper({ initialVenueId: "not-a-real-venue-id" });
    expect(screen.getByTestId("map-canvas")).toBeTruthy();
  });
});

// ─── No layout shift across the placeholder → live-map swap ──────────────────

describe("MapWrapper — placeholder/map swap introduces no layout shift (#226)", () => {
  test("the same fill-parent wrapper hosts both the placeholder and the live map", async () => {
    const { container } = await renderMapWrapper();
    const wrapper = container.querySelector(":scope > div");
    expect(wrapper).not.toBeNull();
    expect(wrapper!.className).toBe("relative h-full w-full");
    expect(screen.queryByTestId("map-canvas")).toBeNull();

    await act(async () => {
      window.dispatchEvent(new Event("pointerdown"));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    // Same wrapper node, same classes — only its children swapped.
    const wrapperAfter = container.querySelector(":scope > div");
    expect(wrapperAfter).toBe(wrapper);
    expect(wrapperAfter!.className).toBe("relative h-full w-full");
    expect(screen.getByTestId("map-canvas")).toBeTruthy();
  });
});
