/**
 * MapWrapper special-event wiring (#758): the feed reaches the map, the
 * selected-event id round-trips through ?event=<id>, and a failed feed changes
 * nothing. Same recipe as MapWrapperDeferredLoad.test.tsx: Map is a sentinel
 * (jsdom has no WebGL; EventLayer's own clock and tap behavior are covered in
 * EventLayer.test.tsx), here exposing what MapWrapper handed it.
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
    events,
    selectedEventId,
    onSelectEvent,
    onMapReady,
  }: {
    events?: Array<{ id: string }>;
    selectedEventId?: string | null;
    onSelectEvent?: (id: string | null) => void;
    onMapReady?: (map: unknown) => void;
  }) {
    React.useEffect(() => {
      onMapReady?.({ fitBounds: vi.fn(), flyTo: vi.fn(), jumpTo: vi.fn() });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return React.createElement(
      "div",
      { "data-testid": "map-canvas", "data-event-count": events?.length ?? 0, "data-selected-event-id": selectedEventId ?? "" },
      React.createElement("button", { onClick: () => onSelectEvent?.("e2") }, "tap e2"),
      React.createElement("button", { onClick: () => onSelectEvent?.(null) }, "deselect"),
    );
  }
  return { default: MapMock };
});

vi.mock("@/components/DesktopVenueWindow", () => ({ default: () => null }));

const EVENT = {
  id: "e1", name: "Turkey drive", name_es: null, host: null, host_es: null, description: null,
  description_es: null, what_to_bring: null, what_to_bring_es: null,
  starts_at: "2026-10-10T18:00:00.000Z", ends_at: "2026-10-10T20:00:00.000Z",
  lat: 38.26, lng: -104.61, address: "1 Main St", venue_id: null, link_url: null,
};

function stubFeed(feed: () => Promise<unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      url === "/api/public/events"
        ? feed()
        : Promise.resolve({ ok: true, json: async () => ({ boxes: [] }) }),
    ),
  );
}

async function mount(props: React.ComponentProps<typeof MapWrapper>) {
  await act(async () => {
    render(
      <LocaleProvider>
        <MapWrapper {...props} />
      </LocaleProvider>,
    );
    await new Promise<void>((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  window.history.replaceState(null, "", "/");
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
  vi.unstubAllGlobals();
});

describe("MapWrapper special events (#758)", () => {
  test("the feed is fetched on load and handed to the map", async () => {
    stubFeed(async () => ({ ok: true, json: async () => ({ events: [EVENT] }) }));
    await mount({ initialEventId: "e1" });
    expect(screen.getByTestId("map-canvas")).toHaveAttribute("data-event-count", "1");
  });

  test("a failed feed hands the map no events and raises no error", async () => {
    stubFeed(() => Promise.reject(new Error("offline")));
    await mount({ initialEventId: "e1" });
    expect(screen.getByTestId("map-canvas")).toHaveAttribute("data-event-count", "0");
  });

  test("a shared ?event= link starts selected and stays in the address bar", async () => {
    window.history.replaceState(null, "", "/?event=e1");
    stubFeed(async () => ({ ok: true, json: async () => ({ events: [EVENT] }) }));
    await mount({ initialEventId: "e1" });
    expect(screen.getByTestId("map-canvas")).toHaveAttribute("data-selected-event-id", "e1");
    expect(window.location.search).toBe("?event=e1");
  });

  test("tapping a pin sets ?event=, deselecting clears it", async () => {
    stubFeed(async () => ({ ok: true, json: async () => ({ events: [EVENT] }) }));
    await mount({ initialEventId: "e1" });

    fireEvent.click(screen.getByText("tap e2"));
    expect(screen.getByTestId("map-canvas")).toHaveAttribute("data-selected-event-id", "e2");
    expect(window.location.search).toBe("?event=e2");

    fireEvent.click(screen.getByText("deselect"));
    expect(screen.getByTestId("map-canvas")).toHaveAttribute("data-selected-event-id", "");
    expect(window.location.search).toBe("");
  });
});
