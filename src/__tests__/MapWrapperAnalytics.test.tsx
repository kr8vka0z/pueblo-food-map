/**
 * MapWrapper analytics tests (#485 PR 2) — near_me_clicked and venue_opened.
 *
 * Mocking recipe (WebGL unavailable → ListView fallback) copied from
 * MapWrapperBoxSelection.test.tsx: a real map-pin tap can't be exercised in
 * jsdom (no WebGL canvas), but the mapUnavailable ListView fallback drives
 * the SAME setSelectedVenueId call handleSelectVenueFromMap would — see that
 * file's own header for the full WHY.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MapWrapper from "@/components/MapWrapper";
import { LocaleProvider } from "@/lib/LocaleContext";
import { track, EVENTS } from "@/lib/analytics";

// #485 PR 2: mock the whole module so EVENTS keeps its real allowlist values.
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  track: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Mock WebGL as unavailable — same convention as MapWrapperBoxSelection.test.tsx.
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

// A real venue from src/data/published-venues.ts — needed for a name the
// ListView fallback actually renders.
const REAL_VENUE_NAME = "Bethany Lutheran Church Garden";
const REAL_VENUE_ID = "garden-bethany-lutheran";
const REAL_VENUE_CATEGORY = "garden";

beforeEach(() => {
  vi.mocked(track).mockClear();
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
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ boxes: [] }) }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderWrapper(props: Record<string, unknown> = {}) {
  await act(async () => {
    render(
      <LocaleProvider>
        <MapWrapper {...props} />
      </LocaleProvider>,
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

describe("MapWrapper — near_me_clicked", () => {
  test("tapping the Near me nav item fires near_me_clicked", async () => {
    const user = userEvent.setup();
    await renderWrapper();
    await user.click(screen.getByRole("button", { name: /^Near me$/i }));
    expect(track).toHaveBeenCalledWith(EVENTS.NEAR_ME_CLICKED, { source: "map" });
  });
});

describe("MapWrapper — venue_opened", () => {
  test("selecting a venue from the list fallback fires venue_opened once", async () => {
    const user = userEvent.setup();
    await renderWrapper();

    const venueButton = await screen.findByRole("button", {
      name: new RegExp(REAL_VENUE_NAME, "i"),
    });
    await user.click(venueButton);

    expect(track).toHaveBeenCalledWith(EVENTS.VENUE_OPENED, {
      category: REAL_VENUE_CATEGORY,
      venueId: REAL_VENUE_ID,
    });
    expect(
      vi.mocked(track).mock.calls.filter((c) => c[0] === EVENTS.VENUE_OPENED),
    ).toHaveLength(1);
  });
});
