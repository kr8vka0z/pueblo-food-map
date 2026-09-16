/**
 * MapWrapper inline view switch tests (#191) — the Map/List switch built
 * into SearchBar, reachable from the main screen without opening the menu.
 *
 * Covers, at the real-MapWrapper level (the acceptance criteria this issue
 * named): the switch renders inside the search bar in both view states,
 * clicking it actually switches the view, aria-pressed tracks the active
 * view, and a query/category filter survives a view switch. The bottom
 * nav (docs/bottom-nav-spec.md) is covered at this level too: one switch
 * only, aria-current on the open panel's item, the fade band, Near me.
 *
 * Mocking recipe (WebGL/next-dynamic/Map/DesktopVenueWindow) copied
 * verbatim from MapWrapperDeferredLoad.test.tsx — see that file's header
 * for the full WHY on each mock; not re-derived here.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Render MapWrapper and trigger the deferred map load (#226) so viewMode="map" actually shows map-canvas. */
async function renderAndLoadMap() {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <LocaleProvider>
        <MapWrapper />
      </LocaleProvider>,
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {
    window.dispatchEvent(new Event("pointerdown"));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  return result;
}

/** The inline switch inside SearchBar — the sole match while the hamburger menu is closed. */
function getInlineSwitch() {
  return screen.getByRole("group", { name: /choose map or list view/i });
}

describe("MapWrapper — inline view switch renders in the search bar (#191)", () => {
  test("renders in map view (default)", async () => {
    await renderAndLoadMap();
    expect(getInlineSwitch()).toBeDefined();
    expect(screen.getByTestId("map-canvas")).toBeTruthy();
  });

  test("renders in list view too", async () => {
    await renderAndLoadMap();
    fireEvent.click(screen.getByRole("button", { name: /^List$/i }));
    expect(getInlineSwitch()).toBeDefined();
    // ListView (#129) renders as a full-screen overlay ABOVE the map rather
    // than unmounting it — "sorted by" is its own summary-line sentinel
    // (same convention as MapWrapperDeferredLoad.test.tsx), the real signal
    // that list view is now showing.
    expect(screen.getByText(/sorted by/i)).toBeTruthy();
  });
});

describe("MapWrapper — clicking the inline switch changes the view (#191)", () => {
  test("clicking List shows the list overlay and marks List pressed", async () => {
    await renderAndLoadMap();
    fireEvent.click(screen.getByRole("button", { name: /^List$/i }));

    expect(screen.getByText(/sorted by/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^List$/i }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: /^Map$/i }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  test("clicking Map after List hides the list overlay and marks Map pressed", async () => {
    await renderAndLoadMap();
    fireEvent.click(screen.getByRole("button", { name: /^List$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Map$/i }));

    expect(screen.getByTestId("map-canvas")).toBeTruthy();
    expect(screen.queryByText(/sorted by/i)).toBeNull();
    expect(screen.getByRole("button", { name: /^Map$/i }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: /^List$/i }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });
});

describe("MapWrapper — search query survives a view switch (#191)", () => {
  test("typed query is unchanged after switching to list and back to map", async () => {
    const user = userEvent.setup();
    await renderAndLoadMap();

    const input = screen.getByRole("combobox");
    await user.type(input, "pantry");
    expect((input as HTMLInputElement).value).toBe("pantry");

    fireEvent.click(screen.getByRole("button", { name: /^List$/i }));
    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("pantry");

    fireEvent.click(screen.getByRole("button", { name: /^Map$/i }));
    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("pantry");
  });
});

describe("MapWrapper — category filter survives a view switch (#191)", () => {
  test("an active category filter chip is still shown after switching views", async () => {
    await renderAndLoadMap();

    // Focus the empty search box to open the category browse dropdown (#95).
    fireEvent.focus(screen.getByRole("combobox"));
    const pantryOption = screen.getByText("Food Pantry").closest('[role="option"]');
    expect(pantryOption).not.toBeNull();
    fireEvent.click(pantryOption!);

    // filterChip now renders inside the search bar.
    expect(screen.getByText("Food Pantry")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /^List$/i }));
    expect(screen.getByText("Food Pantry")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /^Map$/i }));
    expect(screen.getByText("Food Pantry")).toBeDefined();
  });
});

describe("MapWrapper — bottom nav (docs/bottom-nav-spec.md)", () => {
  test("the Map/List switch exists exactly once — the drawer no longer carries its own (§4.4)", async () => {
    await renderAndLoadMap();
    fireEvent.click(screen.getByRole("button", { name: /^Menu$/i }));
    expect(screen.getByRole("menu")).toBeDefined();
    expect(screen.getAllByRole("group", { name: /choose map or list view/i })).toHaveLength(1);
  });

  test("no nav item is current until its panel opens; then only that one is (§3.3)", async () => {
    await renderAndLoadMap();
    const nav = screen.getByRole("navigation");
    expect(nav.querySelectorAll("[aria-current]")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /^Saved$/i }));
    const current = nav.querySelectorAll("[aria-current]");
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toBe("Saved");

    // Tapping the open item again closes the drawer and clears the state.
    fireEvent.click(screen.getByRole("button", { name: /^Saved$/i }));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(nav.querySelectorAll("[aria-current]")).toHaveLength(0);
  });

  test("the fade band is decorative and non-interactive, map mode only (§8, §13 test 5)", async () => {
    await renderAndLoadMap();
    const band = screen.getByTestId("nav-fade-band");
    expect(band.getAttribute("aria-hidden")).toBe("true");
    // pointer-events: none lives on .nav-fade-band in globals.css (jsdom loads
    // no stylesheet), so assert the element carries that class.
    expect(band.className).toContain("nav-fade-band");

    fireEvent.click(screen.getByRole("button", { name: /^List$/i }));
    expect(screen.queryByTestId("nav-fade-band")).toBeNull();
    // The bar itself persists in list mode.
    expect(screen.getByRole("navigation")).toBeDefined();
  });

  test("Near me from list view returns to the map (§6)", async () => {
    await renderAndLoadMap();
    fireEvent.click(screen.getByRole("button", { name: /^List$/i }));
    expect(screen.getByRole("button", { name: /^List$/i }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /^Near me$/i }));
    expect(screen.getByRole("button", { name: /^Map$/i }).getAttribute("aria-pressed")).toBe("true");
  });
});
