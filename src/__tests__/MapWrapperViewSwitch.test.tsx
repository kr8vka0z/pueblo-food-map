/**
 * MapWrapper inline view switch tests (#191) — the Map/List switch built
 * into SearchBar, reachable from the main screen without opening the menu.
 *
 * Covers, at the real-MapWrapper level (the acceptance criteria this issue
 * named): the switch renders inside the search bar in both view states,
 * clicking it actually switches the view, aria-pressed tracks the active
 * view, and a query/category filter survives a view switch. The bottom
 * nav (docs/bottom-nav-spec.md) is covered at this level too: one switch
 * only, aria-current on the open panel's item, Near me.
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

describe("MapWrapper — category filter survives a view switch (#191, rewired to FilterPanel by #513)", () => {
  test("an active category filter is still on (Filters button badge) after switching views", async () => {
    await renderAndLoadMap();

    // Open the Filters panel (#513) and check the Food Pantry checkbox —
    // replaces the old search-focus category browse dropdown (#95), which
    // #513 removed along with the search bar's filterChip text.
    fireEvent.click(screen.getByRole("button", { name: /^Filters$/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Food Pantry/i }));
    // "Show N places" closes the panel without discarding the selection —
    // the filter pipeline (useMapFilters) already applied it live.
    fireEvent.click(screen.getByRole("button", { name: /^Show \d+ places?$/i }));

    // Filters button's spoken label carries the active count.
    expect(screen.getByRole("button", { name: /^Filters, 1 on$/i })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /^List$/i }));
    expect(screen.getByRole("button", { name: /^Filters, 1 on$/i })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /^Map$/i }));
    expect(screen.getByRole("button", { name: /^Filters, 1 on$/i })).toBeDefined();
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

  test("Near me from list view returns to the map (§6)", async () => {
    await renderAndLoadMap();
    fireEvent.click(screen.getByRole("button", { name: /^List$/i }));
    expect(screen.getByRole("button", { name: /^List$/i }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /^Near me$/i }));
    expect(screen.getByRole("button", { name: /^Map$/i }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("MapWrapper — phone venue sheet hides the bottom chrome (§10)", () => {
  test("the nav steps aside while a venue sheet is open (§10)", async () => {
    // Every media query matches → phone layout (isMobile, below 2xl).
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    });
    const { venues } = await import("@/data/venues");
    await act(async () => {
      render(
        <LocaleProvider>
          <MapWrapper initialVenueId={venues[0].id} />
        </LocaleProvider>,
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByTestId("map-canvas").getAttribute("data-selected-venue-id")).toBe(venues[0].id);
    // DOM queries, not role queries: vaul's modal sheet aria-hides its siblings.
    expect(document.querySelector("[data-bottom-nav]")).toBeNull();
  });
});

describe("MapWrapper — sponsor credit lives in the Menu, not on the map (Kyle, 2026-09-16)", () => {
  test("the map shows no sponsor link; Menu opens with one to pueblofoodproject.org", async () => {
    await renderAndLoadMap();
    expect(document.querySelector('a[href="https://pueblofoodproject.org/"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Menu$/i }));
    const card = screen.getByTestId("menu-sponsor");
    expect(card.getAttribute("href")).toBe("https://pueblofoodproject.org/");
    expect(card.getAttribute("target")).toBe("_blank");
  });
});
