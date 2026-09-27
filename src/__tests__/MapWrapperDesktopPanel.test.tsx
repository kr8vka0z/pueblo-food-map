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
import React from "react";
import { LocaleProvider } from "@/lib/LocaleContext";
import MapWrapper from "@/components/MapWrapper";
import { DESKTOP_PANEL_RIGHT_CLEARANCE_PX } from "@/components/DesktopSidePanel";
import { venues as allRealVenues } from "@/data/venues";

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

beforeEach(() => {
  mockOnLoadHolder.current = undefined;

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
