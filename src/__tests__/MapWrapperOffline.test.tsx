/**
 * MapWrapperOffline.test.tsx — offline fallback (#130). When the page opens
 * with no connection (served from the service worker's cache), Mapbox can't
 * load its style or tiles, so MapWrapper reuses the #165 map-unavailable
 * path — list view, no map mount — with offline-specific copy.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";
import MapWrapper from "@/components/MapWrapper";
import { LocaleProvider } from "@/lib/LocaleContext";
import { venues } from "@/data/venues";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// WebGL present by default, so the only reason for the fallback is the
// missing connection.
const webgl = vi.hoisted(() => ({ available: true }));
vi.mock("@/lib/webgl", () => ({ isWebGLAvailable: () => webgl.available }));

vi.mock("next/dynamic", () => ({
  default: () => {
    function DummyDynamic() {
      return null;
    }
    DummyDynamic.displayName = "DummyDynamic";
    return DummyDynamic;
  },
}));

vi.mock("@/components/DesktopVenueWindow", () => ({
  default: () => null,
}));

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { value, configurable: true });
}

beforeEach(() => {
  webgl.available = true;
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
  setOnline(true);
  vi.restoreAllMocks();
});

async function renderWrapper() {
  await act(async () => {
    render(
      <LocaleProvider>
        <MapWrapper />
      </LocaleProvider>,
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

describe("MapWrapper offline fallback (#130)", () => {
  test("opened offline: shows the list with a 'map needs a connection' notice", async () => {
    setOnline(false);
    await renderWrapper();

    expect(screen.getByText("Map needs a connection")).toBeTruthy();
    expect(screen.getByText("The list still works.")).toBeTruthy();
    expect(screen.queryByText(/map unavailable/i)).toBeNull();
    expect(
      screen.getByRole("button", { name: new RegExp(venues[0].name, "i") }),
    ).toBeTruthy();
  });

  test("online: no offline notice", async () => {
    setOnline(true);
    await renderWrapper();
    expect(screen.queryByText("Map needs a connection")).toBeNull();
  });

  test("no WebGL AND offline: the permanent WebGL message wins", async () => {
    webgl.available = false;
    setOnline(false);
    await renderWrapper();
    expect(screen.getByText(/map unavailable/i)).toBeTruthy();
    expect(screen.queryByText("Map needs a connection")).toBeNull();
  });
});
