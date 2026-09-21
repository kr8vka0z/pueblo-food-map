/**
 * MapWrapper box selection (map-first rework, 2026-09-18). Same WebGL-
 * unavailable harness as MapWrapperFallback.test.tsx (the only path this
 * repo can exercise MapWrapper's selection handlers through — Mapbox's own
 * WebGL canvas is unavailable in jsdom, see AGENTS.md's "Map library"
 * section) — a real map-pin tap can't be tested headlessly, but the
 * mapUnavailable ListView fallback exercises the SAME handleSelectFromList
 * code path a pin tap shares, including the box-vs-venue branch.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MapWrapper from "@/components/MapWrapper";
import { LocaleProvider } from "@/lib/LocaleContext";

const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

// Mock WebGL as unavailable — same convention as MapWrapperFallback.test.tsx.
vi.mock("@/lib/webgl", () => ({ isWebGLAvailable: () => false }));

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

const TEST_BOX = {
  id: "test-blessing-box-1",
  name: "Test Blessing Box",
  category: "blessing_box" as const,
  lat: 38.264,
  lng: -104.611,
  address: "123 Test St",
  source: "manual",
  last_verified: "2026-09-01",
  box: {
    hostName: null,
    hostNote: null,
    mostNeeded: null,
    installedOn: null,
    removedOn: null,
    status: "stocked" as const,
    lastFilledAt: "2026-09-17T09:00:00.000Z",
    recentCheckins: [],
  },
};

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
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
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ boxes: [TEST_BOX] }),
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MapWrapper box selection (map-first rework)", () => {
  test("selecting a box card while the map is unavailable routes to /box/<id>/history, not /venue/<id> or /box/<id>", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(
        <LocaleProvider>
          <MapWrapper />
        </LocaleProvider>,
      );
      // Let useBoxesList's fetch resolve.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    const boxButton = await screen.findByRole("button", { name: new RegExp(TEST_BOX.name, "i") });
    await user.click(boxButton);

    expect(mockPush).toHaveBeenCalledWith(`/box/${TEST_BOX.id}/history`);
    expect(mockPush).not.toHaveBeenCalledWith(`/venue/${TEST_BOX.id}`);
    expect(mockPush).not.toHaveBeenCalledWith(`/box/${TEST_BOX.id}`);
  });

  test("pressing Enter on a box search result while the map is unavailable routes to /box/<id>/history (review fix, 2026-09-18: this path used to silently do nothing)", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(
        <LocaleProvider>
          <MapWrapper />
        </LocaleProvider>,
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    const searchInput = await screen.findByRole("combobox", { name: /search/i });
    await user.type(searchInput, "Test Blessing");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(mockPush).toHaveBeenCalledWith(`/box/${TEST_BOX.id}/history`);
    expect(mockPush).not.toHaveBeenCalledWith(`/venue/${TEST_BOX.id}`);
  });

  test("?venue=<boxId> deep link with the map unavailable replaces to /box/<id>/history", async () => {
    await act(async () => {
      render(
        <LocaleProvider>
          <MapWrapper initialVenueId={TEST_BOX.id} />
        </LocaleProvider>,
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(mockReplace).toHaveBeenCalledWith(`/box/${encodeURIComponent(TEST_BOX.id)}/history`);
  });
});
