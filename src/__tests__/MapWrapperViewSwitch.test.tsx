/**
 * MapWrapper view-switch tests (#514) — Map/List switching now goes through
 * three entry points instead of a standing control in the search bar:
 *   1. ViewSuggestion — the one-line drop-down under an EMPTY, focused
 *      search bar ("See all places as a list" / "Back to the map").
 *   2. SearchResultsPopover's "See all N matches as a list" row, once the
 *      user has typed something (map only).
 *   3. HamburgerMenu's "List view"/"Map view" line, for anyone who never
 *      taps search.
 *
 * #191's inline ViewToggle (a standing group of two buttons at the pill's
 * right end) was removed entirely — that mechanism's own tests
 * (SearchBarViewSwitch.test.tsx, ViewToggle.test.tsx) were retired/rewritten
 * with it. ViewSuggestion.tsx and SearchResultsPopover.test.tsx cover the
 * component-level behavior (including mapDisabled hiding "Back to the map")
 * in isolation; this file covers the same acceptance criteria wired through
 * the real MapWrapper.
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

/** Menu-based switch — a deterministic route for tests that just need to GET
 * into the other view, independent of the search-bar mechanism under test
 * elsewhere in this file. */
function switchViewViaMenu(label: "List view" | "Map view") {
  fireEvent.click(screen.getByRole("button", { name: /^Menu$/i }));
  fireEvent.click(screen.getByRole("button", { name: label }));
}

describe("MapWrapper — default view is map; the Menu line reaches the list", () => {
  test("map-canvas renders by default; List view switches to the list overlay", async () => {
    await renderAndLoadMap();
    expect(screen.getByTestId("map-canvas")).toBeTruthy();

    switchViewViaMenu("List view");
    // ListView (#129) renders as a full-screen overlay ABOVE the map rather
    // than unmounting it — "sorted by" is its own summary-line sentinel
    // (same convention as MapWrapperDeferredLoad.test.tsx).
    expect(screen.getByText(/sorted by/i)).toBeTruthy();
  });
});

describe("MapWrapper — ViewSuggestion on an empty, focused search bar (#514)", () => {
  test('on the map, focusing the empty bar offers "See all places as a list" with a count', async () => {
    await renderAndLoadMap();
    fireEvent.focus(screen.getByRole("combobox"));
    const row = screen.getByRole("button", { name: /See all places as a list/i });
    expect(row.textContent).toMatch(/\d+ places/);
  });

  test("clicking it switches to list view and closes the popover", async () => {
    await renderAndLoadMap();
    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("button", { name: /See all places as a list/i }));
    expect(screen.getByText(/sorted by/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Back to the map/i })).toBeNull();
  });

  test('on the list, focusing the empty bar offers "Back to the map"; clicking returns to the map', async () => {
    await renderAndLoadMap();
    switchViewViaMenu("List view");

    fireEvent.focus(screen.getByRole("combobox"));
    const row = screen.getByRole("button", { name: /Back to the map/i });
    expect(row).toBeDefined();

    fireEvent.click(row);
    expect(screen.getByTestId("map-canvas")).toBeTruthy();
  });

  test("the count honours an active category filter (#514 spec: 'honours active filters')", async () => {
    await renderAndLoadMap();
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    const baseline = Number(
      screen.getByRole("button", { name: /See all places as a list/i }).textContent!.match(/(\d+) places/)![1],
    );

    fireEvent.click(screen.getByRole("button", { name: /^Filters$/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Food Pantry/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Show \d+ places?$/i }));

    const filtered = Number(
      screen.getByRole("button", { name: /See all places as a list/i }).textContent!.match(/(\d+) places/)![1],
    );
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(baseline);
  });
});

describe("MapWrapper — typed query's 'See all N matches as a list' row (#514, map only)", () => {
  test("appears while on the map, with the match count; clicking switches to list and keeps the query", async () => {
    const user = userEvent.setup();
    await renderAndLoadMap();
    const input = screen.getByRole("combobox");
    await user.type(input, "pantry");

    const row = screen.getByRole("button", { name: /See all \d+ matches as a list/i });
    fireEvent.click(row);

    expect(screen.getByText(/sorted by/i)).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("pantry");
  });

  test("does not appear once already on the list — typing there already filters ListView live", async () => {
    const user = userEvent.setup();
    await renderAndLoadMap();
    switchViewViaMenu("List view");

    const input = screen.getByRole("combobox");
    await user.type(input, "pantry");

    expect(screen.queryByRole("button", { name: /matches as a list/i })).toBeNull();
    // Ordinary result options are still offered (jump to a specific venue still works).
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  });
});

describe("MapWrapper — search query survives a view switch (#514)", () => {
  test("typed query is unchanged after switching to list and back to map", async () => {
    const user = userEvent.setup();
    await renderAndLoadMap();

    const input = screen.getByRole("combobox");
    await user.type(input, "pantry");
    expect((input as HTMLInputElement).value).toBe("pantry");

    switchViewViaMenu("List view");
    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("pantry");

    switchViewViaMenu("Map view");
    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("pantry");
  });
});

describe("MapWrapper — category filter survives a view switch (#514, rewired to FilterPanel by #513)", () => {
  test("an active category filter is still on (Filters button badge) after switching views", async () => {
    await renderAndLoadMap();

    fireEvent.click(screen.getByRole("button", { name: /^Filters$/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Food Pantry/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Show \d+ places?$/i }));
    expect(screen.getByRole("button", { name: /^Filters, 1 on$/i })).toBeDefined();

    switchViewViaMenu("List view");
    expect(screen.getByRole("button", { name: /^Filters, 1 on$/i })).toBeDefined();

    switchViewViaMenu("Map view");
    expect(screen.getByRole("button", { name: /^Filters, 1 on$/i })).toBeDefined();
  });
});

describe("MapWrapper — bottom nav (docs/bottom-nav-spec.md)", () => {
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
    switchViewViaMenu("List view");
    expect(screen.getByText(/sorted by/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Near me$/i }));
    expect(screen.getByTestId("map-canvas")).toBeTruthy();
  });
});

describe("MapWrapper — Boxes bottom-nav shortcut (#516)", () => {
  test("tapping Boxes sets aria-pressed and lights up the Filters badge; tapping again clears both", async () => {
    await renderAndLoadMap();
    const boxesBtn = screen.getByTestId("nav-boxes");
    expect(boxesBtn.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: /^Filters$/i })).toBeDefined();

    fireEvent.click(boxesBtn);
    expect(boxesBtn.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /^Filters, 1 on$/i })).toBeDefined();

    fireEvent.click(boxesBtn);
    expect(boxesBtn.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: /^Filters$/i })).toBeDefined();
  });

  test("two ways into one state: ticking Blessing Box in the Filters panel also lights up the bar item", async () => {
    await renderAndLoadMap();
    fireEvent.click(screen.getByRole("button", { name: /^Filters$/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Blessing Box/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Show \d+ places?$/i }));

    expect(screen.getByTestId("nav-boxes").getAttribute("aria-pressed")).toBe("true");
  });

  test("Boxes doesn't disturb other active filters (e.g. Open now)", async () => {
    await renderAndLoadMap();
    fireEvent.click(screen.getByRole("button", { name: /^Filters$/i }));
    fireEvent.click(screen.getByRole("switch", { name: /^Open now$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Show \d+ places?$/i }));

    fireEvent.click(screen.getByTestId("nav-boxes"));
    expect(screen.getByRole("button", { name: /^Filters, 2 on$/i })).toBeDefined();
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
