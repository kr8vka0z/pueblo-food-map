/**
 * HomePage page-level overlay architecture tests — frosted splash over map.
 *
 * Verifies the overlay-architecture introduced in feat/splash-map-peek:
 *   - Map (MapWrapper) is always mounted, even when the splash is shown
 *   - SplashScreen renders as a dialog overlay on top of the map
 *   - While the splash is up: map container carries inert + aria-hidden
 *   - After dismiss: map container has neither attribute
 *   - showSplashAgain (re-show path, #99) re-applies inert + aria-hidden
 *
 * MapWrapper is mocked because it depends on next/dynamic + mapbox WebGL.
 * SplashScreen is rendered real (no mock) so we can verify its overlay role
 * and trigger dismiss.
 *
 * navigator.permissions is stubbed so useGeolocation doesn't throw.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import HomePage from "@/app/page";

// ─── Mock MapWrapper — renders a testid sentinel; no WebGL needed ─────────────
vi.mock("@/components/MapWrapper", () => ({
  default: vi.fn(({ onShowWelcome }: { onShowWelcome?: () => void }) => (
    <div data-testid="map-wrapper" tabIndex={-1}>
      <button type="button" onClick={onShowWelcome} data-testid="show-welcome-btn">
        Show welcome
      </button>
    </div>
  )),
}));

// ─── Mock navigator.permissions ──────────────────────────────────────────────
beforeEach(() => {
  Object.defineProperty(navigator, "permissions", {
    value: {
      query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }),
    },
    configurable: true,
    writable: true,
  });
});

// ─── localStorage isolation ───────────────────────────────────────────────────
const GATE_KEY = "pfm.splash.seen.v2";

beforeEach(() => {
  localStorage.removeItem(GATE_KEY);
});

afterEach(() => {
  localStorage.removeItem(GATE_KEY);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Render the page and flush the queueMicrotask-deferred state update. */
async function renderPage() {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(<HomePage />);
  });
  return result;
}

/** Dismiss the splash by clicking the "Find food near me" button. */
async function dismissSplash() {
  const btn = screen.getByRole("button", { name: /find food near me/i });
  await act(async () => {
    fireEvent.click(btn);
  });
}

// ─── Map always mounted ───────────────────────────────────────────────────────

describe("map always mounted", () => {
  test("MapWrapper renders even when splash is shown (first visit)", async () => {
    await renderPage();
    // Map sentinel should be in the DOM whether or not the splash is shown.
    expect(screen.getByTestId("map-wrapper")).toBeTruthy();
  });

  test("MapWrapper still renders after splash is dismissed", async () => {
    await renderPage();
    await dismissSplash();
    expect(screen.getByTestId("map-wrapper")).toBeTruthy();
  });

  test("MapWrapper renders when localStorage gate is already set (returning visitor)", async () => {
    localStorage.setItem(GATE_KEY, "1");
    await renderPage();
    expect(screen.getByTestId("map-wrapper")).toBeTruthy();
  });
});

// ─── Splash as overlay ────────────────────────────────────────────────────────

describe("splash overlay", () => {
  test("SplashScreen renders as a dialog overlay on first visit", async () => {
    await renderPage();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    // Must be in the DOM simultaneously with the map
    expect(screen.getByTestId("map-wrapper")).toBeTruthy();
  });

  test("SplashScreen is absent on returning visit (gate already set)", async () => {
    localStorage.setItem(GATE_KEY, "1");
    await renderPage();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("SplashScreen disappears after dismiss", async () => {
    await renderPage();
    await dismissSplash();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

// ─── Map locked while splash is up ───────────────────────────────────────────

describe("map locked while splash is shown", () => {
  test("map container has inert attribute while splash is shown", async () => {
    const { container } = await renderPage();
    const mapContainer = container.querySelector("main");
    expect(mapContainer).not.toBeNull();
    // inert attribute present while splash is up (blocks keyboard/pointer access)
    expect(mapContainer!.hasAttribute("inert")).toBe(true);
  });

  test("map container has aria-hidden=true while splash is shown", async () => {
    const { container } = await renderPage();
    const mapContainer = container.querySelector("main");
    expect(mapContainer!.getAttribute("aria-hidden")).toBe("true");
  });

  test("map container loses inert after splash dismiss", async () => {
    const { container } = await renderPage();
    await dismissSplash();
    const mapContainer = container.querySelector("main");
    expect(mapContainer!.hasAttribute("inert")).toBe(false);
  });

  test("map container loses aria-hidden after splash dismiss", async () => {
    const { container } = await renderPage();
    await dismissSplash();
    const mapContainer = container.querySelector("main");
    expect(mapContainer!.getAttribute("aria-hidden")).toBeNull();
  });

  test("map starts without inert on returning visit (no splash)", async () => {
    localStorage.setItem(GATE_KEY, "1");
    const { container } = await renderPage();
    const mapContainer = container.querySelector("main");
    expect(mapContainer!.hasAttribute("inert")).toBe(false);
  });
});

// ─── showSplashAgain (#99 re-show path) ───────────────────────────────────────

describe("#99 showSplashAgain", () => {
  test("re-showing the splash re-applies inert to the map container", async () => {
    // Start as a returning visitor (no initial splash)
    localStorage.setItem(GATE_KEY, "1");
    const { container } = await renderPage();

    const mapContainer = container.querySelector("main");
    // Initially no inert (returning visitor)
    expect(mapContainer!.hasAttribute("inert")).toBe(false);

    // Trigger showSplashAgain via the mock MapWrapper button
    const showBtn = screen.getByTestId("show-welcome-btn");
    await act(async () => {
      fireEvent.click(showBtn);
    });

    // Now splash is re-shown — inert should be back
    expect(mapContainer!.hasAttribute("inert")).toBe(true);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  test("re-dismissing after re-show removes inert again", async () => {
    localStorage.setItem(GATE_KEY, "1");
    const { container } = await renderPage();

    // Re-show the splash
    const showBtn = screen.getByTestId("show-welcome-btn");
    await act(async () => {
      fireEvent.click(showBtn);
    });

    // Dismiss again
    await dismissSplash();
    const mapContainer = container.querySelector("main");
    expect(mapContainer!.hasAttribute("inert")).toBe(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("showSplashAgain does NOT clear the localStorage gate", async () => {
    localStorage.setItem(GATE_KEY, "1");
    await renderPage();

    const showBtn = screen.getByTestId("show-welcome-btn");
    await act(async () => {
      fireEvent.click(showBtn);
    });

    // Gate should still be set (future page loads skip the splash)
    expect(localStorage.getItem(GATE_KEY)).toBe("1");
  });
});
