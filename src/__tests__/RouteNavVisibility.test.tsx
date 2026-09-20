/**
 * RouteNavVisibility — #547 end-to-end proof, mounting the REAL MapWrapper.
 * Originally written for #531 ("bar stays visible under the route strip");
 * #547 (Kyle, 2026-09-20, after walking the app on his phone) reverses that
 * on purpose — the bar now hides for the whole time a route is on screen,
 * the same way it already hides for the full card and every other
 * full-surface overlay. Every assertion below is inverted from #531's
 * version, per that issue's own instruction not to treat the old assertions
 * as the source of truth — they are what this file inverts.
 *
 * Mocking recipe (WebGL/next-dynamic/Map/DesktopVenueWindow) copied verbatim
 * from MapWrapperViewSwitch.test.tsx — see that file's own header. Unlike
 * RouteFit.test.tsx's harness (which needs the real react-map-gl mock for
 * fitBounds assertions), this file only needs SOME map to mount so BottomSheet
 * renders — mocking `@/components/Map` directly resolves synchronously
 * (`onMapReady` fires from a `useEffect` on mount), which matters here: the
 * walking-route fetch flow this file exercises lives entirely in
 * MapWrapper.tsx itself, so a real Map component isn't needed.
 *
 * Covers #547's acceptance criteria together, since both need the same
 * "route active + strip showing" setup:
 *   1. The bottom nav hides the instant the route strip shows, and stays
 *      hidden once "Show card" swaps in the full card (#509's unchanged
 *      behavior for the full card itself — it already hid the nav before
 *      this issue, and still does).
 *   2. "Steps" on the strip opens the written directions without disturbing
 *      the (already-hidden) nav or fighting Escape's overlay handling.
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
    onSelectVenue,
  }: {
    selectedVenueId?: string | null;
    onMapReady?: (map: unknown) => void;
    onSelectVenue?: (id: string) => void;
  }) {
    ReactActual.useEffect(() => {
      onMapReady?.({ fitBounds: vi.fn(), flyTo: vi.fn(), jumpTo: vi.fn() });
    }, [onMapReady]);
    return ReactActual.createElement(
      "div",
      { "data-testid": "map-canvas", "data-selected-venue-id": selectedVenueId ?? "" },
      // Stand-in for tapping a different venue's real pin (MapCanvas calls
      // the same onSelectVenue prop from a marker click) — #531 review's
      // "venue switched while a route runs" case needs a way to select
      // VENUE_B without a real map.
      ReactActual.createElement("button", {
        type: "button",
        "data-testid": "select-venue-b",
        onClick: () => onSelectVenue?.(VENUE_B.id),
      }),
    );
  }
  return { default: MapMock };
});

vi.mock("@/components/DesktopVenueWindow", () => ({
  default: () => null,
}));

const TEST_POSITION = { lat: 38.25, lng: -104.6 };
const TEST_VENUE = allRealVenues[0];
// A second, distinct venue — the #531 review's "venue switched while a
// route runs" case taps this one's pin while a route to TEST_VENUE is active.
const VENUE_B = allRealVenues[1];
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

describe("#547 — bottom nav hides while the route strip is showing", () => {
  test("full card (no route yet): nav is hidden, as before (#509)", async () => {
    await renderMobile();
    expect(document.querySelector("[data-bottom-nav]")).toBeNull();
  });

  test("route active -> strip showing: nav is hidden", async () => {
    const user = userEvent.setup();
    await renderMobile();

    const walkButton = await screen.findByRole(
      "button",
      { name: new RegExp(`Walking directions to ${TEST_VENUE.name}`, "i") },
    );
    await user.click(walkButton);

    await screen.findByTestId("route-strip");
    // #547 (was: not.toBeNull() under #531 — the bar used to stay visible
    // under the strip; Kyle reversed that after walking the app on his
    // phone, since the bar covered the route controls).
    expect(document.querySelector("[data-bottom-nav]")).toBeNull();
  });

  test("tapping 'Show card' restores the full card; nav stays hidden throughout", async () => {
    const user = userEvent.setup();
    await renderMobile();

    const walkButton = await screen.findByRole(
      "button",
      { name: new RegExp(`Walking directions to ${TEST_VENUE.name}`, "i") },
    );
    await user.click(walkButton);
    await screen.findByTestId("route-strip");
    expect(document.querySelector("[data-bottom-nav]")).toBeNull();

    await user.click(screen.getByTestId("route-strip-show-card"));

    await waitFor(() => expect(screen.queryByTestId("route-strip")).toBeNull());
    expect(document.querySelector("[data-bottom-nav]")).toBeNull();
  });
});

describe("#547 — venue switched while a route runs (reviewer risk)", () => {
  test("tapping a different venue's pin drops the strip and keeps the nav hidden under B's own full card", async () => {
    const user = userEvent.setup();
    await renderMobile();

    const walkButton = await screen.findByRole(
      "button",
      { name: new RegExp(`Walking directions to ${TEST_VENUE.name}`, "i") },
    );
    await user.click(walkButton);
    await screen.findByTestId("route-strip");
    expect(document.querySelector("[data-bottom-nav]")).toBeNull();

    // Stand-in for tapping venue B's real map pin — MapCanvas would call the
    // same onSelectVenue prop from a marker click.
    await user.click(screen.getByTestId("select-venue-b"));

    // BottomSheet is keyed by selectedVenueId (BottomSheet.tsx), so it
    // remounts fresh for B: no route targets B (walkingRouteVenueId still
    // names TEST_VENUE), so isWalkRouteActive is false for B and it opens
    // straight to the full card, never the strip.
    await waitFor(() =>
      expect(screen.getByTestId("map-canvas").getAttribute("data-selected-venue-id")).toBe(VENUE_B.id),
    );
    expect(screen.queryByTestId("route-strip")).toBeNull();
    // Full card open (for B) keeps the nav hidden — same as the strip just
    // shown for A, and the same as the no-route baseline: #547 registers
    // the nav's hide/show off `selectedVenue !== null` alone (MapWrapper.tsx's
    // `venueSheetOpen`), so switching between strip and full card can never
    // leave it stuck in the wrong state either way.
    expect(document.querySelector("[data-bottom-nav]")).toBeNull();
  });
});

describe("#547 — Steps control on the route strip", () => {
  test("Steps opens the written directions; Escape closes only the sheet, leaving the strip up and the nav hidden", async () => {
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
    // The strip is still up and the nav is still hidden — Escape didn't
    // cascade past the steps sheet into BottomSheet's own Escape handling
    // (dialogGuard.ts).
    expect(screen.getByTestId("route-strip")).toBeDefined();
    expect(document.querySelector("[data-bottom-nav]")).toBeNull();
  });

  // #542: the steps sheet is a full-surface overlay over the map, exactly
  // like the strip itself now is (#547) — both register with the shared
  // overlay registry, so the nav is hidden by either or both at once.
  test("#547: Steps hides the nav while open; closing it leaves the nav hidden since the strip is still showing", async () => {
    const user = userEvent.setup();
    await renderMobile();

    const walkButton = await screen.findByRole(
      "button",
      { name: new RegExp(`Walking directions to ${TEST_VENUE.name}`, "i") },
    );
    await user.click(walkButton);
    await screen.findByTestId("route-strip");
    // Nav already hidden the instant the strip shows (#547) — before Steps
    // is even opened.
    expect(document.querySelector("[data-bottom-nav]")).toBeNull();

    await user.click(screen.getByTestId("route-strip-steps"));
    expect(screen.getByText("Head north on Main St")).toBeDefined();
    expect(document.querySelector("[data-bottom-nav]")).toBeNull();

    await user.click(screen.getByTestId("route-strip-steps-close"));
    await waitFor(() => expect(screen.queryByTestId("walk-steps-list")).toBeNull());
    // (Was: nav returns here under #531/#542, since the strip alone used to
    // leave the nav visible.) #547: the strip is still showing, so the nav
    // stays hidden — it does not "return" until the venue sheet itself
    // closes (see the RouteClear describe block below for that proof).
    expect(document.querySelector("[data-bottom-nav]")).toBeNull();
  });
});

// #547 acceptance: "Clear the route → bar returns." Tracing the real code
// (MapWrapper.tsx's handleClearWalkingRoute, BottomSheet.tsx's cardRevealed
// effect): clearing the route does not deselect the venue, so BottomSheet
// swaps the strip for the FULL CARD (isWalkRouteActive flips false ->
// cardRevealed=true) rather than closing outright — and the full card hides
// the nav too (#509, unchanged). The nav only actually reappears once the
// venue sheet itself closes. This proves that path is not "stranded" (the
// issue's own worded risk): closing after a clear does bring the bar back.
describe("#547 — clearing the route never strands the nav hidden", () => {
  test("Clear route swaps in the full card (nav still hidden); closing the sheet is what brings the nav back", async () => {
    const user = userEvent.setup();
    await renderMobile();

    const walkButton = await screen.findByRole(
      "button",
      { name: new RegExp(`Walking directions to ${TEST_VENUE.name}`, "i") },
    );
    await user.click(walkButton);
    await screen.findByTestId("route-strip");
    expect(document.querySelector("[data-bottom-nav]")).toBeNull();

    await user.click(screen.getByTestId("route-strip-clear"));

    await waitFor(() => expect(screen.queryByTestId("route-strip")).toBeNull());
    expect(document.querySelector("[data-bottom-nav]")).toBeNull();

    const closeButton = screen.getByRole("button", { name: /close/i });
    await user.click(closeButton);

    await waitFor(() => expect(document.querySelector("[data-bottom-nav]")).not.toBeNull());
  });
});
