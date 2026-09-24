/**
 * MapWrapper `holdMapLoad` tests (#588) — the render-tree wiring of
 * useDeferredMapLoad's `hold` param (see useDeferredMapLoadHold.test.ts for
 * the hook's own timer/event-listener coverage). Same mocking recipe as
 * MapWrapperDeferredLoad.test.tsx (#226) — see that file's header for the
 * full WHY on each mock; not repeated here.
 *
 * Verifies, at the MapWrapper level:
 *   - holdMapLoad=true: mapbox does NOT load while held, even past the
 *     idle-timeout + fallback budget — proves the splash-showing state
 *     really does keep mapbox-gl off the critical window.
 *   - holdMapLoad=true: a pointerdown (simulating a real tap landing on the
 *     splash's own CTA, which reaches these window-capture listeners
 *     regardless of the splash's DOM position) still loads the map
 *     immediately — "intent" signal, held or not.
 *   - holdMapLoad flipping true→false with NO interaction event (simulating
 *     HomePageClient's `holdMapLoad={splashShown}` prop after a dismiss that
 *     didn't dispatch a pointer/key DOM event) loads the map immediately —
 *     "dismiss" signal.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";
import MapWrapper from "@/components/MapWrapper";
import { LocaleProvider } from "@/lib/LocaleContext";
import { IDLE_TIMEOUT_MS, FALLBACK_DELAY_MS } from "@/lib/useDeferredMapLoad";

vi.mock("@/lib/webgl", () => ({ isWebGLAvailable: () => true }));

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

vi.mock("@/components/Map", async () => {
  const React = await import("react");
  function MapMock({
    onMapReady,
  }: {
    onMapReady?: (map: unknown) => void;
  }) {
    React.useEffect(() => {
      onMapReady?.({ fitBounds: vi.fn(), flyTo: vi.fn(), jumpTo: vi.fn() });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return React.createElement("div", { "data-testid": "map-canvas" });
  }
  return { default: MapMock };
});

vi.mock("@/components/DesktopVenueWindow", () => ({
  default: () => null,
}));

beforeEach(() => {
  Object.defineProperty(navigator, "permissions", {
    value: { query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }) },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function tick() {
  await vi.advanceTimersByTimeAsync(0);
}

async function renderMapWrapper(props: Partial<React.ComponentProps<typeof MapWrapper>> = {}) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <LocaleProvider>
        <MapWrapper {...props} />
      </LocaleProvider>,
    );
    await tick();
  });
  return result;
}

describe("MapWrapper — holdMapLoad=true (splash showing, #588)", () => {
  test("does NOT mount the interactive map, even after the idle timeout + fallback budget elapses", async () => {
    await renderMapWrapper({ holdMapLoad: true });
    expect(screen.queryByTestId("map-canvas")).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS + FALLBACK_DELAY_MS + 1000);
    });
    expect(screen.queryByTestId("map-canvas")).toBeNull();
  });

  test("still mounts the interactive map on a pointerdown (splash-CTA tap) while held", async () => {
    await renderMapWrapper({ holdMapLoad: true });
    expect(screen.queryByTestId("map-canvas")).toBeNull();

    await act(async () => {
      window.dispatchEvent(new Event("pointerdown"));
      await tick();
    });
    expect(screen.getByTestId("map-canvas")).toBeTruthy();
  });
});

describe("MapWrapper — holdMapLoad flips true→false (splash dismissed, #588)", () => {
  test("mounts the interactive map immediately on dismiss, with no interaction and no elapsed timer", async () => {
    const { rerender } = await renderMapWrapper({ holdMapLoad: true });
    expect(screen.queryByTestId("map-canvas")).toBeNull();

    await act(async () => {
      rerender(
        <LocaleProvider>
          <MapWrapper holdMapLoad={false} />
        </LocaleProvider>,
      );
      await tick();
    });
    expect(screen.getByTestId("map-canvas")).toBeTruthy();
  });
});
