/**
 * RouteNavVisibility — #531 end-to-end proof, mounting the REAL MapWrapper.
 * Mocking recipe (WebGL/next-dynamic/Map/DesktopVenueWindow) copied verbatim
 * from MapWrapperViewSwitch.test.tsx — see that file's own header. Unlike
 * RouteFit.test.tsx's harness (which needs the real react-map-gl mock for
 * fitBounds assertions), this file only needs SOME map to mount so BottomSheet
 * renders — mocking `@/components/Map` directly resolves synchronously
 * (`onMapReady` fires from a `useEffect` on mount), which matters here: the
 * walking-route fetch flow this file exercises lives entirely in
 * MapWrapper.tsx itself, so a real Map component isn't needed.
 *
 * Covers the issue's two acceptance criteria together, since both need the
 * same "route active + strip showing" setup:
 *   1. The bottom nav stays visible under the route strip, and hides again
 *      once "Show card" restores the full card (#509's prior behavior).
 *   2. "Steps" on the strip opens the written directions without disturbing
 *      the nav or fighting Escape's overlay handling.
 */

import { describe, test, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import MapWrapper from "@/components/MapWrapper";
import { LocaleProvider } from "@/lib/LocaleContext";
import { venues as allRealVenues } from "@/data/venues";

// jsdom shims REAL (unmocked) vaul needs — same as RouteFit.test.tsx /
// BottomSheet.escapeGuard.test.tsx: vaul's Drawer.Content calls
// event.target.setPointerCapture() in onPointerDown, which jsdom doesn't
// implement.
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
  const ReactActual = await import("react");
  function MapMock({
    selectedVenueId,
    onMapReady,
  }: {
    selectedVenueId?: string | null;
    onMapReady?: (map: unknown) => void;
  }) {
    ReactActual.useEffect(() => {
      onMapReady?.({ fitBounds: vi.fn(), flyTo: vi.fn(), jumpTo: vi.fn() });
    }, [onMapReady]);
    return ReactActual.createElement("div", {
      "data-testid": "map-canvas",
      "data-selected-venue-id": selectedVenueId ?? "",
    });
  }
  return { default: MapMock };
});

vi.mock("@/components/DesktopVenueWindow", () => ({
  default: () => null,
}));

const TEST_POSITION = { lat: 38.25, lng: -104.6 };
const TEST_VENUE = allRealVenues[0];
const ROUTE_COORDINATES: [number, number][] = [
  [-104.6, 38.25],
  [TEST_VENUE.lng, TEST_VENUE.lat],
];
// Non-empty steps (unlike RouteFit.test.tsx's fixture) — this file also
// proves the Steps control, which only renders when steps exist.
const ROUTE_RESPONSE = {
  routes: [
    {
      geometry: { type: "LineString", coordinates: ROUTE_COORDINATES },
      distance: 640,
      duration: 480,
      legs: [
        {
          steps: [
            { maneuver: { instruction: "Head north on Main St" }, distance: 50 },
            { maneuver: { instruction: `Arrive at ${TEST_VENUE.name}` }, distance: 0 },
          ],
        },
      ],
    },
  ],
};

beforeEach(() => {
  // Every media query matches -> phone layout (isMobile, below 2xl) — same
  // one-liner MapWrapperViewSwitch.test.tsx's own §10 test uses.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
  vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", "test-token");

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

async function renderMobile() {
  render(
    <LocaleProvider>
      <MapWrapper initialVenueId={TEST_VENUE.id} />
    </LocaleProvider>,
  );
  await waitFor(() =>
    expect(screen.getByTestId("map-canvas").getAttribute("data-selected-venue-id")).toBe(TEST_VENUE.id),
  );
}

describe("#531 — bottom nav stays visible under the route strip", () => {
  test("full card (no route yet): nav is hidden, as before (#509)", async () => {
    await renderMobile();
    expect(document.querySelector("[data-bottom-nav]")).toBeNull();
  });

  test("route active -> strip showing: nav is visible", async () => {
    const user = userEvent.setup();
    await renderMobile();

    const walkButton = await screen.findByRole(
      "button",
      { name: new RegExp(`Walking directions to ${TEST_VENUE.name}`, "i") },
    );
    await user.click(walkButton);

    await screen.findByTestId("route-strip");
    expect(document.querySelector("[data-bottom-nav]")).not.toBeNull();
  });

  test("tapping 'Show card' restores the full card and hides the nav again", async () => {
    const user = userEvent.setup();
    await renderMobile();

    const walkButton = await screen.findByRole(
      "button",
      { name: new RegExp(`Walking directions to ${TEST_VENUE.name}`, "i") },
    );
    await user.click(walkButton);
    await screen.findByTestId("route-strip");
    expect(document.querySelector("[data-bottom-nav]")).not.toBeNull();

    await user.click(screen.getByTestId("route-strip-show-card"));

    await waitFor(() => expect(screen.queryByTestId("route-strip")).toBeNull());
    expect(document.querySelector("[data-bottom-nav]")).toBeNull();
  });
});

describe("#531 — Steps control on the route strip", () => {
  test("Steps opens the written directions; Escape closes only the sheet, leaving the strip and nav alone", async () => {
    const user = userEvent.setup();
    await renderMobile();

    const walkButton = await screen.findByRole(
      "button",
      { name: new RegExp(`Walking directions to ${TEST_VENUE.name}`, "i") },
    );
    await user.click(walkButton);
    await screen.findByTestId("route-strip");

    await user.click(screen.getByTestId("route-strip-steps"));
    expect(screen.getByText("Head north on Main St")).toBeDefined();
    expect(screen.getByText(`Arrive at ${TEST_VENUE.name}`)).toBeDefined();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByTestId("walk-steps-list")).toBeNull());
    // The strip and the nav are both still up — Escape didn't cascade past
    // the steps sheet into BottomSheet's own Escape handling (dialogGuard.ts).
    expect(screen.getByTestId("route-strip")).toBeDefined();
    expect(document.querySelector("[data-bottom-nav]")).not.toBeNull();
  });
});
