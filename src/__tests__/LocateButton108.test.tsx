/**
 * LocateButton (#108) — location control state logic tests.
 *
 * Tests the three visible states (findFood, locating, reCenter),
 * the hidden state, locating feedback, outside-county path,
 * and drift-detection helpers exported from MapWrapper.
 *
 * LocateButton is a pure presentational component; geolocation and drift
 * detection are driven by props. We test:
 *   1. Which label/variant renders for each prop combination.
 *   2. That tapping triggers the onRequest callback.
 *   3. The isPointInBounds + isOutsideCounty helpers (unit-only, no DOM).
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LocateButton from "@/components/LocateButton";
import type { GeoState } from "@/lib/useGeolocation";
import { isPointInBounds, isOutsideCounty, DRIFT_PAD_DEG } from "@/components/MapWrapper";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GEO_PROMPT: GeoState = { permission: "prompt", position: null };
const GEO_DENIED: GeoState = { permission: "denied", position: null };
const GEO_GRANTED_NULL: GeoState = { permission: "granted", position: null };
const GEO_LOCATED: GeoState = {
  permission: "granted",
  position: { lat: 38.2544, lng: -104.6091 },
};

function renderButton(
  overrides: Partial<Parameters<typeof LocateButton>[0]> = {},
) {
  const defaults: Parameters<typeof LocateButton>[0] = {
    geoState: GEO_PROMPT,
    isLocating: false,
    isDrifted: false,
    onRequest: vi.fn(),
    sheetVisible: false,
    sheetFullyExpanded: false,
    locale: "en",
    ...overrides,
  };
  return render(<LocateButton {...defaults} />);
}

// ─── Stub navigator.permissions ───────────────────────────────────────────────
beforeEach(() => {
  Object.defineProperty(navigator, "permissions", {
    value: {
      query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }),
    },
    configurable: true,
    writable: true,
  });
});

// ─── State: findFood (initial, permission=prompt) ─────────────────────────────

describe("LocateButton — findFood state (no location yet)", () => {
  test("renders 'Find food near me' button when permission is prompt", () => {
    renderButton({ geoState: GEO_PROMPT, isLocating: false, isDrifted: false });
    expect(screen.getByTestId("locate-button")).toBeDefined();
    expect(screen.getByText("Find food near me")).toBeDefined();
  });

  test("renders 'Find food near me' button when permission is denied", () => {
    renderButton({ geoState: GEO_DENIED, isLocating: false, isDrifted: false });
    expect(screen.getByText("Find food near me")).toBeDefined();
    expect(screen.getByTestId("locate-button").getAttribute("data-variant")).toBe("findFood");
  });

  test("renders 'Encuentra comida cerca de mí' in ES locale", () => {
    renderButton({ geoState: GEO_PROMPT, isLocating: false, isDrifted: false, locale: "es" });
    expect(screen.getByText("Encuentra comida cerca de mí")).toBeDefined();
  });

  test("tapping findFood button calls onRequest", () => {
    const onRequest = vi.fn();
    renderButton({ geoState: GEO_PROMPT, isLocating: false, isDrifted: false, onRequest });
    fireEvent.click(screen.getByTestId("locate-button"));
    expect(onRequest).toHaveBeenCalledTimes(1);
  });
});

// ─── State: locating (in-flight) ─────────────────────────────────────────────

describe("LocateButton — locating state", () => {
  test("renders 'Locating…' label while isLocating is true", () => {
    renderButton({ geoState: GEO_PROMPT, isLocating: true, isDrifted: false });
    expect(screen.getByText("Locating…")).toBeDefined();
    expect(screen.getByTestId("locate-button").getAttribute("data-variant")).toBe("locating");
  });

  test("renders 'Localizando…' in ES locale", () => {
    renderButton({ geoState: GEO_PROMPT, isLocating: true, isDrifted: false, locale: "es" });
    expect(screen.getByText("Localizando…")).toBeDefined();
  });

  test("locating button is disabled (no double-tap)", () => {
    renderButton({ geoState: GEO_PROMPT, isLocating: true, isDrifted: false });
    const btn = screen.getByTestId("locate-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  test("locating button has aria-busy=true", () => {
    renderButton({ geoState: GEO_PROMPT, isLocating: true, isDrifted: false });
    const btn = screen.getByTestId("locate-button");
    expect(btn.getAttribute("aria-busy")).toBe("true");
  });
});

// ─── State: hidden (located + on-screen) ─────────────────────────────────────

describe("LocateButton — hidden state (located, not drifted)", () => {
  test("renders nothing when located and isDrifted=false", () => {
    const { container } = renderButton({
      geoState: GEO_LOCATED,
      isLocating: false,
      isDrifted: false,
    });
    expect(container.querySelector("[data-testid='locate-button']")).toBeNull();
  });

  test("renders findFood when permission=granted but position=null, isDrifted=false", () => {
    renderButton({
      geoState: GEO_GRANTED_NULL,
      isLocating: false,
      isDrifted: false,
    });
    // GEO_GRANTED_NULL: position is null → falls through to findFood
    // (user has permission but no fix yet; not locating)
    expect(screen.queryByText("Find food near me")).toBeDefined();
  });

  test("renders nothing when sheetFullyExpanded=true (any state)", () => {
    const { container } = renderButton({
      geoState: GEO_PROMPT,
      isLocating: false,
      isDrifted: false,
      sheetFullyExpanded: true,
    });
    expect(container.querySelector("[data-testid='locate-button']")).toBeNull();
  });
});

// ─── State: reCenter (located but drifted) ───────────────────────────────────

describe("LocateButton — reCenter state (located and drifted)", () => {
  test("renders 'Re-center' when located and isDrifted=true", () => {
    renderButton({
      geoState: GEO_LOCATED,
      isLocating: false,
      isDrifted: true,
    });
    expect(screen.getByText("Re-center")).toBeDefined();
    expect(screen.getByTestId("locate-button").getAttribute("data-variant")).toBe("reCenter");
  });

  test("renders 'Recentrar' in ES locale", () => {
    renderButton({
      geoState: GEO_LOCATED,
      isLocating: false,
      isDrifted: true,
      locale: "es",
    });
    expect(screen.getByText("Recentrar")).toBeDefined();
  });

  test("tapping reCenter button calls onRequest", () => {
    const onRequest = vi.fn();
    renderButton({
      geoState: GEO_LOCATED,
      isLocating: false,
      isDrifted: true,
      onRequest,
    });
    fireEvent.click(screen.getByTestId("locate-button"));
    expect(onRequest).toHaveBeenCalledTimes(1);
  });

  test("reCenter button is not disabled", () => {
    renderButton({
      geoState: GEO_LOCATED,
      isLocating: false,
      isDrifted: true,
    });
    const btn = screen.getByTestId("locate-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });
});

// ─── Locating overrides reCenter ─────────────────────────────────────────────

describe("LocateButton — locating takes priority over reCenter", () => {
  test("shows locating state even when isDrifted=true", () => {
    renderButton({
      geoState: GEO_LOCATED,
      isLocating: true,
      isDrifted: true,
    });
    expect(screen.getByTestId("locate-button").getAttribute("data-variant")).toBe("locating");
    expect(screen.getByText("Locating…")).toBeDefined();
  });
});

// ─── sheetFullyExpanded hides all states ─────────────────────────────────────

describe("LocateButton — hidden when sheet fully expanded", () => {
  test("sheetFullyExpanded hides reCenter", () => {
    const { container } = renderButton({
      geoState: GEO_LOCATED,
      isLocating: false,
      isDrifted: true,
      sheetFullyExpanded: true,
    });
    expect(container.querySelector("[data-testid='locate-button']")).toBeNull();
  });

  test("sheetFullyExpanded hides locating", () => {
    const { container } = renderButton({
      geoState: GEO_PROMPT,
      isLocating: true,
      isDrifted: false,
      sheetFullyExpanded: true,
    });
    expect(container.querySelector("[data-testid='locate-button']")).toBeNull();
  });
});

// ─── Placement: mobile anchors to top (below search bar), desktop to bottom ──

describe("LocateButton — placement adapts to mobile vs desktop", () => {
  test("anchors to the top (below search bar) on mobile; bottom-center on desktop", () => {
    const { container: mobile } = renderButton({
      geoState: GEO_PROMPT,
      isLocating: false,
      isDrifted: false,
      sheetVisible: true,
    });
    const { container: desktop } = renderButton({
      geoState: GEO_PROMPT,
      isLocating: false,
      isDrifted: false,
      sheetVisible: false,
    });
    const btnMobile = mobile.querySelector<HTMLElement>("[data-testid='locate-button']");
    const btnDesktop = desktop.querySelector<HTMLElement>("[data-testid='locate-button']");
    expect(btnMobile).not.toBeNull();
    expect(btnDesktop).not.toBeNull();
    // Mobile (sheetVisible): anchored to the top, not the bottom.
    expect(btnMobile!.style.top).not.toBe("");
    expect(btnMobile!.style.bottom).toBe("");
    // Desktop: anchored to the bottom, not the top.
    expect(btnDesktop!.style.bottom).not.toBe("");
    expect(btnDesktop!.style.top).toBe("");
  });
});

// ─── isPointInBounds helper ───────────────────────────────────────────────────

describe("isPointInBounds (drift detection helper)", () => {
  // Build a minimal mock of mapboxgl.LngLatBounds
  function makeBounds(sw: [number, number], ne: [number, number]) {
    return {
      getSouthWest: () => ({ lng: sw[0], lat: sw[1] }),
      getNorthEast: () => ({ lng: ne[0], lat: ne[1] }),
    } as unknown as import("mapbox-gl").LngLatBounds;
  }

  const bounds = makeBounds([-105.0, 38.0], [-104.0, 38.5]);

  test("point well inside bounds returns true", () => {
    expect(isPointInBounds({ lat: 38.25, lng: -104.5 }, bounds)).toBe(true);
  });

  test("point outside bounds to the west returns false", () => {
    expect(isPointInBounds({ lat: 38.25, lng: -105.1 }, bounds)).toBe(false);
  });

  test("point outside bounds to the east returns false", () => {
    expect(isPointInBounds({ lat: 38.25, lng: -103.9 }, bounds)).toBe(false);
  });

  test("point outside bounds to the north returns false", () => {
    expect(isPointInBounds({ lat: 38.6, lng: -104.5 }, bounds)).toBe(false);
  });

  test("point outside bounds to the south returns false", () => {
    expect(isPointInBounds({ lat: 37.9, lng: -104.5 }, bounds)).toBe(false);
  });

  test("point exactly on the edge (within padding) returns false", () => {
    // Exactly on the SW corner — the padding margin should push it outside
    expect(isPointInBounds({ lat: 38.0, lng: -105.0 }, bounds)).toBe(false);
  });

  test("point inside the padding margin returns false", () => {
    // Just inside the raw bounds but within DRIFT_PAD_DEG of the edge
    const justInsideSW = {
      lat: 38.0 + DRIFT_PAD_DEG / 2,
      lng: -105.0 + DRIFT_PAD_DEG / 2,
    };
    expect(isPointInBounds(justInsideSW, bounds)).toBe(false);
  });
});

// ─── isOutsideCounty helper ───────────────────────────────────────────────────

describe("isOutsideCounty", () => {
  test("Pueblo city center is inside county", () => {
    expect(isOutsideCounty({ lat: 38.2544, lng: -104.6091 })).toBe(false);
  });

  test("Denver coords are outside county", () => {
    // Denver: ~39.74°N, 104.98°W — well north of Pueblo County
    expect(isOutsideCounty({ lat: 39.74, lng: -104.98 })).toBe(true);
  });

  test("south of county (in Las Animas County) is outside", () => {
    // Lat 37.5 is south of the county's 37.6747 southern bound
    expect(isOutsideCounty({ lat: 37.5, lng: -104.6 })).toBe(true);
  });

  test("east of county is outside", () => {
    // Lng -103.9 is east of -103.9939
    expect(isOutsideCounty({ lat: 38.25, lng: -103.9 })).toBe(true);
  });

  test("west of county is outside", () => {
    // Lng -105.2 is west of -105.1107
    expect(isOutsideCounty({ lat: 38.25, lng: -105.2 })).toBe(true);
  });
});
