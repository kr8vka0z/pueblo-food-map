/**
 * HomePageClient -> MapWrapper -> Map for a shared /?event=<id> link (#758).
 * A regression in the read would break shared event links silently, so this
 * goes through the real HomePageClient and MapWrapper; only Map (WebGL) is a
 * sentinel. The map loads on the first interaction: ?event= is deliberately
 * not eager yet, so it must not defeat the splash hold (#588).
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";
import HomePageClient from "@/app/(site)/HomePageClient";
import { LocaleProvider } from "@/lib/LocaleContext";

vi.mock("@/lib/webgl", () => ({ isWebGLAvailable: () => true }));

vi.mock("next/dynamic", () => ({
  default: (factory: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>) => {
    let Resolved: React.ComponentType<Record<string, unknown>> | null = null;
    factory().then((mod) => { Resolved = mod.default; }, () => {});
    function Dynamic(props: Record<string, unknown>) {
      return Resolved ? React.createElement(Resolved, props) : null;
    }
    return Dynamic;
  },
}));

vi.mock("@/components/Map", async () => {
  const React = await import("react");
  function MapMock({ selectedEventId, onMapReady }: { selectedEventId?: string | null; onMapReady?: (m: unknown) => void }) {
    React.useEffect(() => {
      onMapReady?.({ fitBounds: vi.fn(), flyTo: vi.fn(), jumpTo: vi.fn() });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return React.createElement("div", { "data-testid": "map-canvas", "data-selected-event-id": selectedEventId ?? "" });
  }
  return { default: MapMock };
});

vi.mock("@/components/DesktopVenueWindow", () => ({ default: () => null }));

beforeEach(() => {
  localStorage.setItem("pfm.splash.seen.v2", "1");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ boxes: [], events: [] }) }));
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
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

async function settle() {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, 0));
  });
}

describe("shared /?event=<id> link through HomePageClient", () => {
  test("selects that pin once the map loads, and keeps ?event= in the address bar", async () => {
    window.history.replaceState(null, "", "/?event=evt-1");
    const makeTree = () => (
      <LocaleProvider>
        <HomePageClient />
      </LocaleProvider>
    );
    const { rerender, container } = render(makeTree());
    // The mocked next/dynamic resolves after first paint (importing the real
    // MapWrapper takes a moment) and does not re-render itself; re-rendering
    // until it shows stands in for the real loader's own update.
    for (let i = 0; i < 100 && !container.querySelector("main > *"); i++) {
      await act(async () => {
        await new Promise<void>((r) => setTimeout(r, 100));
      });
      rerender(makeTree());
    }
    await settle();
    expect(screen.queryByTestId("map-canvas")).toBeNull(); // not eager: no map before interaction

    await act(async () => {
      window.dispatchEvent(new Event("pointerdown"));
    });
    await settle();
    expect(screen.getByTestId("map-canvas")).toHaveAttribute("data-selected-event-id", "evt-1");
    expect(window.location.search).toBe("?event=evt-1");
  });
});
