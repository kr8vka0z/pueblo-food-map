/**
 * The search popover ("See all places as a list") must close when anything
 * outside the search area is pressed or a place/event becomes selected, and
 * the events strip must step aside while it is open. A map pin press does not
 * move focus off the search input, so blur alone left it stuck open beside the
 * opened card. Same sentinel-Map recipe as MapWrapperEventStrip.test.tsx; the
 * Map mock exposes pin buttons that select/clear an event. Elements found by
 * role/test id.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import React from "react";
import MapWrapper from "@/components/MapWrapper";
import { LocaleProvider } from "@/lib/LocaleContext";

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
    onSelectEvent,
    onMapReady,
  }: {
    onSelectEvent?: (id: string | null) => void;
    onMapReady?: (map: unknown) => void;
  }) {
    React.useEffect(() => {
      onMapReady?.({ fitBounds: vi.fn(), flyTo: vi.fn(), jumpTo: vi.fn() });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return React.createElement(
      "div",
      { "data-testid": "map-canvas" },
      React.createElement("button", { "data-testid": "pin-event", onClick: () => onSelectEvent?.("live") }),
      React.createElement("button", { "data-testid": "pin-event-clear", onClick: () => onSelectEvent?.(null) }),
    );
  }
  return { default: MapMock };
});

vi.mock("@/components/DesktopVenueWindow", () => ({ default: () => null }));

const HOUR = 3_600_000;
const NOW = Date.parse("2026-10-10T18:00:00.000Z");
const LIVE = {
  id: "live", name: "Event live", name_es: null, host: null, host_es: null, description: null,
  description_es: null, what_to_bring: null, what_to_bring_es: null,
  starts_at: new Date(NOW - HOUR).toISOString(), ends_at: new Date(NOW + HOUR).toISOString(),
  lat: 38.26, lng: -104.61, address: "1 Main St", venue_id: null, link_url: null,
};

async function mount() {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      url === "/api/public/events"
        ? Promise.resolve({ ok: true, json: async () => ({ events: [LIVE] }) })
        : Promise.resolve({ ok: true, json: async () => ({ boxes: [] }) }),
    ),
  );
  await act(async () => {
    render(<LocaleProvider><MapWrapper /></LocaleProvider>);
    await new Promise<void>((r) => setTimeout(r, 0));
  });
  await act(async () => {
    window.dispatchEvent(new Event("pointerdown"));
    await new Promise<void>((r) => setTimeout(r, 0));
  });
}

const row = () => screen.queryByRole("button", { name: /See all places as a list/i });
const strip = () => screen.queryByTestId("event-strip");
const openSearch = () => fireEvent.focus(screen.getByRole("combobox"));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  window.history.replaceState(null, "", "/");
  window.localStorage.clear();
  Object.defineProperty(navigator, "permissions", {
    value: { query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }) },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("search popover closes on outside interaction", () => {
  test("a press on the map closes it", async () => {
    await mount();
    openSearch();
    expect(row()).not.toBeNull();
    fireEvent.pointerDown(screen.getByTestId("map-canvas"));
    expect(row()).toBeNull();
  });

  test("selecting an event while it is open closes it, with no press and focus never leaving the input", async () => {
    await mount();
    openSearch();
    expect(row()).not.toBeNull();
    fireEvent.click(screen.getByTestId("pin-event"));
    expect(row()).toBeNull();
  });

  test("a press inside the popover does not close it before the row's click lands", async () => {
    await mount();
    openSearch();
    fireEvent.pointerDown(row()!);
    expect(row()).not.toBeNull();
    fireEvent.click(row()!);
    expect(row()).toBeNull();
    expect(screen.getByText(/sorted by/i)).toBeTruthy();
  });

  test("typing keeps it open", async () => {
    await mount();
    openSearch();
    const box = screen.getByRole("combobox");
    fireEvent.pointerDown(box);
    fireEvent.change(box, { target: { value: "pantry" } });
    fireEvent.pointerDown(box);
    // The empty-query row gives way to results; the popover is still open
    // (a press on the input is inside the search area), so a press on the map
    // is what closes it.
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
    fireEvent.pointerDown(screen.getByTestId("map-canvas"));
    expect(screen.queryAllByRole("option").length).toBe(0);
  });
});

describe("events strip while the search popover is open", () => {
  test("hidden while it is open, back once it closes", async () => {
    await mount();
    expect(strip()).not.toBeNull();
    openSearch();
    expect(strip()).toBeNull();
    fireEvent.pointerDown(screen.getByTestId("map-canvas"));
    expect(strip()).not.toBeNull();
  });

  test("open search, pick a pin: popover closes and the strip stays hidden until the card closes", async () => {
    await mount();
    openSearch();
    fireEvent.click(screen.getByTestId("pin-event"));
    expect(row()).toBeNull();
    expect(strip()).toBeNull();
    fireEvent.click(screen.getByTestId("pin-event-clear"));
    expect(strip()).not.toBeNull();
  });
});
