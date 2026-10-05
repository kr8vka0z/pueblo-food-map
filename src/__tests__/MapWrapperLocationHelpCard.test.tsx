/**
 * MapWrapper × LocationHelpCard (#739) — when the card shows and hides:
 *   shows: after the splash CTA failed (denied or failed, handed in as the
 *     splashLocationFailure prop), and after a "Near me" tap that fails
 *     (denied OR failed — the old banner covered only a re-tapped denial).
 *   never: on a plain page load, even if the Permissions API says "denied".
 *   hides: "See all places as a list", a successful Try again, a venue opening.
 *
 * Mocking recipe (WebGL / next-dynamic / Map) copied from
 * MapWrapperViewSwitch.test.tsx; MapMock here also exposes a button that
 * selects the first venue so "a venue opens" can be driven without WebGL.
 * navigator.geolocation is stubbed (not useGeolocation) so the real hook,
 * including #738's one low-accuracy retry, runs.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import React from "react";
import MapWrapper from "@/components/MapWrapper";
import { LocaleProvider } from "@/lib/LocaleContext";
import type { LocationFailure } from "@/lib/useGeolocation";

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
    venues,
    onSelectVenue,
    onMapReady,
  }: {
    venues?: Array<{ id: string }>;
    onSelectVenue?: (id: string) => void;
    onMapReady?: (map: unknown) => void;
  }) {
    React.useEffect(() => {
      onMapReady?.({ fitBounds: vi.fn(), flyTo: vi.fn(), jumpTo: vi.fn() });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return React.createElement(
      "div",
      { "data-testid": "map-canvas" },
      React.createElement(
        "button",
        { "data-testid": "pick-venue", onClick: () => onSelectVenue?.(venues![0].id) },
        "pick",
      ),
    );
  }
  return { default: MapMock };
});

vi.mock("@/components/DesktopVenueWindow", () => ({ default: () => null }));

const DENIED: LocationFailure = { permission: "denied", position: null };
const FAILED: LocationFailure = { permission: "failed", position: null, reason: "timeout" };

type GeoCall = (ok: PositionCallback, err: PositionErrorCallback) => void;
let getCurrentPosition: ReturnType<typeof vi.fn>;

function stubGeolocation(impl: GeoCall) {
  getCurrentPosition = vi.fn(impl);
  Object.defineProperty(navigator, "geolocation", {
    value: { getCurrentPosition },
    configurable: true,
  });
}
const fail = (code: number): GeoCall => (_ok, err) =>
  err({ code, message: "", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
const succeed: GeoCall = (ok) =>
  ok({ coords: { latitude: 38.2544, longitude: -104.6091 } } as GeolocationPosition);

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
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderMap(props: { splashLocationFailure?: LocationFailure | null } = {}) {
  await act(async () => {
    render(
      <LocaleProvider>
        <MapWrapper {...props} />
      </LocaleProvider>,
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  // Trigger the deferred map load (#226) so viewMode="map" shows map-canvas.
  await act(async () => {
    window.dispatchEvent(new Event("pointerdown"));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

const nearMe = () => screen.getByTestId("nav-near-me");

describe("splash failure handed in", () => {
  test("denied → 'Location is off' with no Try again", async () => {
    await renderMap({ splashLocationFailure: DENIED });
    expect(await screen.findByRole("heading", { name: "Location is off" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  test("failed → 'We couldn't find you' with Try again", async () => {
    await renderMap({ splashLocationFailure: FAILED });
    expect(await screen.findByRole("heading", { name: "We couldn't find you" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  test("Try again that succeeds closes the card", async () => {
    stubGeolocation(succeed);
    await renderMap({ splashLocationFailure: FAILED });
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  test("a later splash success (prop back to null) clears a stale card (PR #741 review)", async () => {
    let rerenderMap: (ui: React.ReactElement) => void = () => {};
    await act(async () => {
      const r = render(
        <LocaleProvider>
          <MapWrapper splashLocationFailure={FAILED} />
        </LocaleProvider>,
      );
      rerenderMap = r.rerender;
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(await screen.findByRole("heading", { name: "We couldn't find you" })).toBeTruthy();
    await act(async () => {
      rerenderMap(
        <LocaleProvider>
          <MapWrapper splashLocationFailure={null} />
        </LocaleProvider>,
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  test("Try again that fails again keeps the card, with the new reason", async () => {
    stubGeolocation(fail(2)); // POSITION_UNAVAILABLE, both attempts
    await renderMap({ splashLocationFailure: FAILED });
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/couldn't work out where you are/)).toBeTruthy();
  });

  test("'See all places as a list' switches to the list and closes the card", async () => {
    await renderMap({ splashLocationFailure: DENIED });
    fireEvent.click(await screen.findByRole("button", { name: "See all places as a list" }));
    expect(screen.getByText(/sorted by/i)).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("X closes it", async () => {
    await renderMap({ splashLocationFailure: DENIED });
    fireEvent.click(await screen.findByRole("button", { name: "Close" }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("opening a venue closes it for good", async () => {
    await renderMap({ splashLocationFailure: DENIED });
    await screen.findByRole("status");
    fireEvent.click(screen.getByTestId("pick-venue"));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });
});

describe("map Near me tap", () => {
  test("a refusal shows 'Location is off'", async () => {
    stubGeolocation(fail(1));
    await renderMap();
    fireEvent.click(nearMe());
    expect(await screen.findByRole("heading", { name: "Location is off" })).toBeTruthy();
  });

  test("a timeout (after #738's retry) shows 'We couldn't find you'", async () => {
    stubGeolocation(fail(3));
    await renderMap();
    fireEvent.click(nearMe());
    expect(await screen.findByRole("heading", { name: "We couldn't find you" })).toBeTruthy();
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  });

  test("a success shows no card", async () => {
    stubGeolocation(succeed);
    await renderMap();
    fireEvent.click(nearMe());
    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("plain page load", () => {
  test("no card even when the Permissions API already says denied", async () => {
    Object.defineProperty(navigator, "permissions", {
      value: { query: vi.fn().mockResolvedValue({ state: "denied", onchange: null }) },
      configurable: true,
      writable: true,
    });
    await renderMap();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
