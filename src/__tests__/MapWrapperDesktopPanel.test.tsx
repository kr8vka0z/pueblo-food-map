/**
 * MapWrapperDesktopPanel — #682, the desktop right-hand side panel.
 *
 * Proves the three pieces MapWrapper itself owns (the panel content lives in
 * DesktopSidePanel.test.tsx / DesktopVenueWindow.test.tsx instead):
 *   1. Selecting a venue on desktop renders the venue card INSIDE
 *      DesktopSidePanel (not the old marker-anchored positioning).
 *   2. SearchBar/BottomNav receive a nonzero rightInset while the panel is
 *      open, and 0 once it closes.
 *   3. The pan-on-select effect calls `mapboxMap.panBy` only when the
 *      selected pin's projected position would actually be hidden behind
 *      the panel — never when it's already clear.
 *
 * Harness copied from RouteFit.test.tsx (same reasoning: the effects under
 * test live in MapWrapper itself, so the REAL MapWrapper has to mount) and
 * trimmed to what this file needs — no geolocation/walking-route wiring.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { LocaleProvider } from "@/lib/LocaleContext";
import MapWrapper from "@/components/MapWrapper";
import { DESKTOP_PANEL_RIGHT_CLEARANCE_PX } from "@/components/DesktopSidePanel";
import { venues as allRealVenues } from "@/data/venues";
import { addFavorite, __resetFavoritesForTests } from "@/lib/favorites";

vi.mock("mapbox-gl/dist/mapbox-gl.css", () => ({}));

vi.mock("next/dynamic", () => ({
  default: (
    factory: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>,
  ) => {
    function DynamicWrapper(props: Record<string, unknown>) {
      const [Comp, setComp] = React.useState<
        React.ComponentType<Record<string, unknown>> | null
      >(null);
      React.useEffect(() => {
        let cancelled = false;
        factory().then((mod) => {
          if (!cancelled) setComp(() => mod.default);
        });
        return () => {
          cancelled = true;
        };
      }, []);
      return Comp ? React.createElement(Comp, props) : null;
    }
    DynamicWrapper.displayName = "DynamicWrapper";
    return DynamicWrapper;
  },
}));

const mockOnLoadHolder: { current?: (e: { target: unknown }) => void } = {};

vi.mock("react-map-gl/mapbox", async () => {
  const ReactActual = await import("react");
  const MapGLMock = ReactActual.forwardRef(function MapGLMock(
    {
      children,
      onLoad,
    }: {
      children: React.ReactNode;
      onLoad?: (e: { target: unknown }) => void;
      initialViewState?: unknown;
    },
    ref: React.Ref<{ flyTo: () => void; jumpTo: () => void; fitBounds: () => void }>,
  ) {
    mockOnLoadHolder.current = onLoad;
    ReactActual.useImperativeHandle(ref, () => ({
      flyTo: () => {},
      jumpTo: () => {},
      fitBounds: () => {},
    }));
    return ReactActual.createElement("div", { "data-testid": "mapgl-root" }, children);
  });
  return {
    default: MapGLMock,
    Marker: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement("div", { "data-testid": "mapbox-marker" }, children),
    Popup: () => null,
    AttributionControl: () => null,
    Source: (
      { children, "data-testid": testId }: { children?: React.ReactNode; "data-testid"?: string },
    ) => ReactActual.createElement("div", { "data-testid": testId ?? "mapbox-source" }, children),
    Layer: () => null,
  };
});

const TEST_VENUE = allRealVenues[0];
const SAVED_VENUE = allRealVenues[1];

beforeEach(() => {
  mockOnLoadHolder.current = undefined;
  __resetFavoritesForTests();

  HTMLCanvasElement.prototype.getContext = (() => ({
    getExtension: () => null,
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  // Desktop layout throughout — no query ever matches MOBILE_QUERY/BELOW_2XL_QUERY.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });

  Object.defineProperty(navigator, "permissions", {
    value: { query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }) },
    configurable: true,
    writable: true,
  });

  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.includes("/api/public/blessing-boxes")) {
        return Promise.resolve({ ok: true, json: async () => ({ boxes: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ features: [] }) });
    }),
  );
});

async function renderMapWrapper() {
  render(
    <LocaleProvider>
      <MapWrapper initialVenueId={TEST_VENUE.id} />
    </LocaleProvider>,
  );
  await waitFor(() => {
    if (!mockOnLoadHolder.current) {
      throw new Error("Map's onLoad was not captured — dynamic import has not resolved yet");
    }
  });
}

/** Container is 1200 wide — DESKTOP_PANEL_RIGHT_CLEARANCE_PX clears the panel's own footprint. */
function fireMapReady(projectX: number) {
  const fakeMap = {
    fitBounds: vi.fn(),
    jumpTo: vi.fn(),
    flyTo: vi.fn(),
    panBy: vi.fn(),
    project: vi.fn(() => ({ x: projectX, y: 300 })),
    getContainer: vi.fn(() => ({ offsetWidth: 1200, offsetHeight: 800 })),
    on: vi.fn(),
    off: vi.fn(),
  };
  act(() => {
    mockOnLoadHolder.current!({ target: fakeMap });
  });
  return fakeMap;
}

describe("MapWrapper desktop side panel (#682)", () => {
  test("selecting a venue renders its card inside DesktopSidePanel", async () => {
    await renderMapWrapper();
    fireMapReady(400);

    // DesktopVenueWindow is code-split (#588) — wait for its dialog, not just
    // the (synchronously-rendered) DesktopSidePanel shell around it.
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByText(new RegExp(TEST_VENUE.name, "i")).length).toBeGreaterThan(0);
  });

  test("SearchBar and BottomNav get a nonzero rightInset while the panel is open", async () => {
    await renderMapWrapper();
    fireMapReady(400);
    await screen.findByRole("dialog");

    const nav = screen.getByRole("navigation");
    expect(nav.style.getPropertyValue("--panel-right-inset")).toBe(
      `${DESKTOP_PANEL_RIGHT_CLEARANCE_PX}px`,
    );

    const searchInput = screen.getByRole("combobox");
    // The padding lives on the input's absolute-positioned ancestor wrapper.
    const paddedAncestor = searchInput.closest('[style*="padding-right"]');
    expect(paddedAncestor).not.toBeNull();
    expect(paddedAncestor?.getAttribute("style")).toContain(
      `padding-right: ${DESKTOP_PANEL_RIGHT_CLEARANCE_PX}px`,
    );
  });

  test("closing the panel resets rightInset back to 0", async () => {
    await renderMapWrapper();
    fireMapReady(400);
    const dialog = await screen.findByRole("dialog");

    const closeButton = within(dialog).getByRole("button", { name: /close/i });
    await act(async () => {
      closeButton.click();
    });

    await waitFor(() => expect(screen.queryByTestId("desktop-side-panel")).toBeNull());
    const nav = screen.getByRole("navigation");
    expect(nav.style.getPropertyValue("--panel-right-inset")).toBe("0px");
  });

  test("pans the map when the selected pin would land under the panel", async () => {
    await renderMapWrapper();
    // Container is 1200 wide; visible-left-of-panel edge sits at
    // 1200 - DESKTOP_PANEL_RIGHT_CLEARANCE_PX. Project the pin
    // 50px past that edge.
    const overflowX = 1200 - DESKTOP_PANEL_RIGHT_CLEARANCE_PX + 50;
    const fakeMap = fireMapReady(overflowX);
    await screen.findByRole("dialog");

    await waitFor(() => expect(fakeMap.panBy).toHaveBeenCalledTimes(1));
    expect(fakeMap.panBy).toHaveBeenCalledWith([50, 0], expect.objectContaining({ duration: expect.any(Number) }));
  });

  test("does NOT pan when the selected pin is already clear of the panel", async () => {
    await renderMapWrapper();
    // Well left of the panel's footprint.
    const fakeMap = fireMapReady(100);
    await screen.findByRole("dialog");

    // Give the effect a tick to (not) fire.
    await act(async () => {
      await Promise.resolve();
    });
    expect(fakeMap.panBy).not.toHaveBeenCalled();
  });
});

// ─── 8b — Saved/Menu as panel views ───────────────────────────────────────────
// Coordinator's approved plan: "MapWrapper owns one desktop sidePanelView
// union ... venue selection and Menu/Saved become mutually exclusive on
// desktop only". Each test below is one of that plan's own acceptance items.

describe("MapWrapper desktop side panel — Saved/Menu views (#682 8b)", () => {
  test("venue open -> tap Saved: venue card is replaced by the Saved list, and Saved lights up in the bar", async () => {
    addFavorite(SAVED_VENUE.id);
    const user = userEvent.setup();
    await renderMapWrapper();
    fireMapReady(400);
    await screen.findByRole("dialog", { name: new RegExp(TEST_VENUE.name, "i") });

    await user.click(screen.getByTestId("nav-saved"));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Saved places")).toBeDefined();
    expect(screen.getByText(SAVED_VENUE.name)).toBeDefined();
    expect(screen.getByTestId("nav-saved").getAttribute("aria-current")).toBe("true");
  });

  test("saved row -> venue card with a '← Saved' back-link; clicking it returns to the list", async () => {
    addFavorite(SAVED_VENUE.id);
    const user = userEvent.setup();
    await renderMapWrapper();
    fireMapReady(400);
    await screen.findByRole("dialog", { name: new RegExp(TEST_VENUE.name, "i") });

    await user.click(screen.getByTestId("nav-saved"));
    await screen.findByText("Saved places");
    await user.click(screen.getByText(SAVED_VENUE.name));

    const dialog = await screen.findByRole("dialog", { name: new RegExp(SAVED_VENUE.name, "i") });
    // FavoriteButton's aria-label ("Remove ... from saved") also matches
    // /saved/i, so match the exact back-link text instead.
    const backLink = within(dialog).getByRole("button", { name: "← Saved" });
    // Opening from Saved does NOT light the Saved bar item — only the list does.
    expect(screen.getByTestId("nav-saved").getAttribute("aria-current")).toBeNull();

    await user.click(backLink);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Saved places")).toBeDefined();
    expect(screen.getByText(SAVED_VENUE.name)).toBeDefined();
  });

  test("Menu while Saved is open: switches to the Menu view", async () => {
    addFavorite(SAVED_VENUE.id);
    const user = userEvent.setup();
    await renderMapWrapper();
    fireMapReady(400);
    await screen.findByRole("dialog");

    await user.click(screen.getByTestId("nav-saved"));
    await screen.findByText("Saved places");

    await user.click(screen.getByTestId("nav-top"));

    expect(screen.queryByText("Saved places")).toBeNull();
    expect(screen.getByRole("menu")).toBeDefined();
    expect(screen.getByTestId("nav-top").getAttribute("aria-current")).toBe("true");
  });

  test("re-clicking the lit Menu item closes the panel entirely", async () => {
    const user = userEvent.setup();
    await renderMapWrapper();
    fireMapReady(400);
    await screen.findByRole("dialog");

    await user.click(screen.getByTestId("nav-top"));
    await screen.findByRole("menu");

    await user.click(screen.getByTestId("nav-top"));

    await waitFor(() => expect(screen.queryByTestId("desktop-side-panel")).toBeNull());
    expect(screen.getByTestId("nav-top").getAttribute("aria-current")).toBeNull();
  });

  test("Menu opens over the list view too (unlike a venue card, which needs the map)", async () => {
    const user = userEvent.setup();
    await renderMapWrapper();
    fireMapReady(400);
    const dialog = await screen.findByRole("dialog");
    // Close the deep-linked venue card first so we start from a clean panel.
    await user.click(within(dialog).getByRole("button", { name: /close/i }));
    await waitFor(() => expect(screen.queryByTestId("desktop-side-panel")).toBeNull());

    // Switch to list view via the Menu's own "List view" line, then close it.
    // HamburgerMenuItem renders role="menuitem" on the <li>, the actual
    // clickable control is the <button> inside it — query that directly, or
    // userEvent.click(li) never reaches the button's own onClick (click
    // events bubble UP from the real target, never down into a descendant).
    await user.click(screen.getByTestId("nav-top"));
    await screen.findByRole("menu");
    await user.click(screen.getByRole("button", { name: /list view/i }));
    await waitFor(() => expect(screen.queryByTestId("desktop-side-panel")).toBeNull());

    // Now on the list — Menu must still open (the old 280px dropdown worked here too).
    await user.click(screen.getByTestId("nav-top"));
    expect(screen.getByRole("menu")).toBeDefined();
  });

  test("Filters opened over an open Saved panel: Escape closes Filters only (#527/#604)", async () => {
    addFavorite(SAVED_VENUE.id);
    const user = userEvent.setup();
    await renderMapWrapper();
    fireMapReady(400);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /close/i }));
    await waitFor(() => expect(screen.queryByTestId("desktop-side-panel")).toBeNull());

    await user.click(screen.getByTestId("nav-saved"));
    await screen.findByText("Saved places");

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await screen.findByRole("dialog", { name: /filters/i });

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /filters/i })).toBeNull());
    // Filters closed; the Saved panel is still showing underneath.
    expect(screen.getByText("Saved places")).toBeDefined();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("desktop-side-panel")).toBeNull());
  });

  // PR #688 review, Important item 1: closeDesktopPanel used to clear
  // selectedVenueId/windowExpanded unconditionally, including the "← Saved"
  // branch — deselecting the pin (and dropping any walking route) just from
  // navigating back to the list. Proxy for "is this venue still selected":
  // VenueMarker renders a sage (#4A8466) ring <circle> around the pin ONLY
  // when selected (VenueMarker.tsx) — the plain MapPin glyph ALSO has its
  // own decorative circle (the icon's "eye") in both states, so match on
  // the ring's specific stroke color, not just circle presence.
  function getMarkerButton(venueName: string): HTMLElement {
    // VenueMarker's aria-label is "<name>, <category>[, <distance>]" — match
    // on that exact prefix, not a bare substring: the venue card open at the
    // same time has its OWN buttons whose aria-label also CONTAINS the name
    // (Share/Favorite, e.g. "Remove La Familia Community Garden from saved").
    const escaped = venueName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return screen.getByRole("button", { name: new RegExp(`^${escaped},`) });
  }

  function markerIsSelected(venueName: string): boolean {
    return getMarkerButton(venueName).querySelector('circle[stroke="#4A8466"]') !== null;
  }

  test("'← Saved' keeps the venue selected (marker stays highlighted); a real close deselects it", async () => {
    addFavorite(SAVED_VENUE.id);
    const user = userEvent.setup();
    await renderMapWrapper();
    fireMapReady(400);
    const initialDialog = await screen.findByRole("dialog", { name: new RegExp(TEST_VENUE.name, "i") });
    await user.click(within(initialDialog).getByRole("button", { name: /close/i }));
    await waitFor(() => expect(screen.queryByTestId("desktop-side-panel")).toBeNull());

    expect(markerIsSelected(SAVED_VENUE.name)).toBe(false);

    await user.click(screen.getByTestId("nav-saved"));
    await screen.findByText("Saved places");
    await user.click(screen.getByText(SAVED_VENUE.name));
    const dialog = await screen.findByRole("dialog", { name: new RegExp(SAVED_VENUE.name, "i") });
    expect(markerIsSelected(SAVED_VENUE.name)).toBe(true);

    // "← Saved" — NOT a real close. The venue must stay selected.
    await user.click(within(dialog).getByRole("button", { name: "← Saved" }));
    await screen.findByText("Saved places");
    expect(markerIsSelected(SAVED_VENUE.name)).toBe(true);

    // A venue opened from Saved always routes ✕/Escape back to Saved, never
    // a full close (item 4: "← Saved returns to the list") — so to prove a
    // REAL close still deselects, open the SAME venue via its own pin
    // instead (from=undefined), then close it with ✕.
    await user.click(getMarkerButton(SAVED_VENUE.name));
    const pinOpenedDialog = await screen.findByRole("dialog", { name: new RegExp(SAVED_VENUE.name, "i") });
    await user.click(within(pinOpenedDialog).getByRole("button", { name: /close/i }));
    await waitFor(() => expect(screen.queryByTestId("desktop-side-panel")).toBeNull());
    expect(markerIsSelected(SAVED_VENUE.name)).toBe(false);
  });

  // PR #688 review, Important item 3: focus management through the full
  // Saved -> venue -> back -> close round trip.
  test("focus returns to the Saved bar button after Saved -> row -> '← Saved' -> ✕ close", async () => {
    addFavorite(SAVED_VENUE.id);
    const user = userEvent.setup();
    await renderMapWrapper();
    fireMapReady(400);
    const initialDialog = await screen.findByRole("dialog", { name: new RegExp(TEST_VENUE.name, "i") });
    await user.click(within(initialDialog).getByRole("button", { name: /close/i }));
    await waitFor(() => expect(screen.queryByTestId("desktop-side-panel")).toBeNull());

    const savedNavButton = screen.getByTestId("nav-saved");
    await user.click(savedNavButton);
    await screen.findByText("Saved places");

    await user.click(screen.getByText(SAVED_VENUE.name));
    const dialog = await screen.findByRole("dialog", { name: new RegExp(SAVED_VENUE.name, "i") });

    await user.click(within(dialog).getByRole("button", { name: "← Saved" }));
    const savedHeading = await screen.findByText("Saved places");

    // Back at the Saved list — its OWN header carries a ✕ too (every
    // HamburgerMenuContent view does), independent of any venue card. A
    // venue-from-saved's ✕ always goes back to Saved (item 4), never a full
    // close, so THIS is the ✕ that actually closes the panel here.
    const savedPanel = savedHeading.closest('[data-testid="desktop-side-panel"]') as HTMLElement;
    await user.click(within(savedPanel).getByRole("button", { name: /close/i }));

    await waitFor(() => expect(screen.queryByTestId("desktop-side-panel")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(savedNavButton));
  });

  test("focus returns to the pin that opened a venue card while Menu was showing (Menu -> venue -> close)", async () => {
    const user = userEvent.setup();
    await renderMapWrapper();
    fireMapReady(400);
    const initialDialog = await screen.findByRole("dialog", { name: new RegExp(TEST_VENUE.name, "i") });
    await user.click(within(initialDialog).getByRole("button", { name: /close/i }));
    await waitFor(() => expect(screen.queryByTestId("desktop-side-panel")).toBeNull());

    await user.click(screen.getByTestId("nav-top"));
    await screen.findByRole("menu");

    // Selecting a venue via its own pin is an OUTSIDE click — it recaptures
    // the return-focus trigger away from the Menu bar item, same as opening
    // fresh (see DesktopSidePanel's own header on the capture-effect guard).
    const otherVenue = allRealVenues[2];
    const pinButton = getMarkerButton(otherVenue.name);
    await user.click(pinButton);

    const venueDialog = await screen.findByRole("dialog", { name: new RegExp(otherVenue.name, "i") });
    await user.click(within(venueDialog).getByRole("button", { name: /close/i }));

    await waitFor(() => expect(screen.queryByTestId("desktop-side-panel")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(pinButton));
  });
});
