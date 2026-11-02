/**
 * Takeover from the map-screen stand-in (#730): text a returning visitor typed
 * into the stand-in's search field before MapWrapper loaded must end up in the
 * real search field, searched on, with focus moved there if the stand-in had
 * it. The stand-in goes in as server HTML (no React behind it), as on a real
 * first load; same sentinel-Map recipe as MapWrapperSearchPopoverCloses.test.tsx.
 */

import { test, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import React from "react";
import MapWrapper from "@/components/MapWrapper";
import MapScreenStandIn from "@/components/MapScreenStandIn";
import { LocaleProvider } from "@/lib/LocaleContext";

vi.mock("@/lib/webgl", () => ({ isWebGLAvailable: () => true }));

vi.mock("next/dynamic", () => ({
  default: (factory: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>) => {
    let ResolvedComponent: React.ComponentType<Record<string, unknown>> | null = null;
    factory().then((mod) => { ResolvedComponent = mod.default; });
    function DynamicWrapper(props: Record<string, unknown>) {
      return ResolvedComponent ? React.createElement(ResolvedComponent, props) : null;
    }
    return DynamicWrapper;
  },
}));

vi.mock("@/components/Map", () => ({ default: () => <div data-testid="map-canvas" /> }));
vi.mock("@/components/DesktopVenueWindow", () => ({ default: () => null }));

const labels = { search: "Search", filters: "Filters", nearMe: "Near me", saved: "Saved", boxes: "Boxes", help: "Help", menu: "Menu" };

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

test("text typed into the stand-in carries into the real search field, focused and searched", async () => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ boxes: [], events: [] }) })));

  const host = document.createElement("div");
  host.innerHTML = renderToString(<MapScreenStandIn labels={labels} />);
  document.body.appendChild(host);
  const standInInput = host.querySelector<HTMLInputElement>("input")!;
  expect(standInInput.getAttribute("aria-label")).toBe("Search");
  standInInput.focus();
  standInInput.value = "pan";

  await act(async () => {
    render(<LocaleProvider><MapWrapper /></LocaleProvider>);
    await new Promise<void>((r) => setTimeout(r, 0));
  });

  const real = screen.getByRole("combobox") as HTMLInputElement;
  expect(real.value).toBe("pan");
  expect(document.activeElement).toBe(real);
  expect(real.selectionStart).toBe(3);
  // Focus opened the results popover on the carried text: the search ran.
  expect(real.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
});
