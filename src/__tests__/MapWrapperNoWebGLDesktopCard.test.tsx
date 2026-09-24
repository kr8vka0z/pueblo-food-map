/**
 * MapWrapperNoWebGLDesktopCard — #524, desktop layout, regular venue.
 *
 * MapWrapperNoWebGLBoxCard.test.tsx covers mobile + a blessing box. This
 * covers the other half: desktop layout, an ordinary venue, with the REAL
 * DesktopVenueWindow (loaded through a next/dynamic mock that actually runs
 * the import). Selecting a venue while the map can't draw must open its
 * card over the list instead of navigating to /venue/<id>.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import MapWrapper from "@/components/MapWrapper";
import { LocaleProvider } from "@/lib/LocaleContext";
import { venues } from "@/data/venues";

const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

vi.mock("@/lib/webgl", () => ({ isWebGLAvailable: () => false }));

vi.mock("next/dynamic", () => ({
  default: (
    factory: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>,
  ) => {
    function DynamicWrapper(props: Record<string, unknown>) {
      const [Comp, setComp] = React.useState<React.ComponentType<Record<string, unknown>> | null>(null);
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

// The map canvas never mounts without WebGL, but MapWrapper still imports it.
vi.mock("react-map-gl/mapbox", () => ({
  default: () => null,
  Marker: () => null,
  Source: () => null,
  Layer: () => null,
  NavigationControl: () => null,
  GeolocateControl: () => null,
  AttributionControl: () => null,
  useMap: () => ({ current: null }),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  Object.defineProperty(navigator, "permissions", {
    value: { query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }) },
    configurable: true,
    writable: true,
  });
  // Desktop layout: the mobile media query never matches.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ boxes: [] }) }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MapWrapper — no-WebGL, desktop, regular venue (#524)", () => {
  test("selecting a venue opens the real DesktopVenueWindow over the list; no navigation", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(
        <LocaleProvider>
          <MapWrapper />
        </LocaleProvider>,
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByText(/map unavailable/i)).toBeTruthy();

    const target = venues[0];
    await user.click(screen.getByRole("button", { name: new RegExp(target.name, "i") }));

    const dialog = await screen.findByRole("dialog", {}, { timeout: 5000 });
    expect(within(dialog).getAllByText(new RegExp(target.name, "i")).length).toBeGreaterThan(0);
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
