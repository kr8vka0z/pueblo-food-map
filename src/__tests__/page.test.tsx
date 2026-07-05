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
 * Also verifies the SEO PR1 server/client split (page.tsx + HomePageClient):
 *   - The ItemList JSON-LD <script> and the sr-only <h1> render on the
 *     PLAIN synchronous render, before any effect/microtask flush — proof
 *     they now come from page.tsx's server output, not from client state
 *     that resolves later (the bug this PR fixes).
 *
 * MapWrapper is mocked because it depends on next/dynamic + mapbox WebGL.
 * SplashScreen is rendered real (no mock) so we can verify its overlay role
 * and trigger dismiss.
 *
 * navigator.permissions is stubbed so useGeolocation doesn't throw.
 *
 * WHY next/dynamic is mocked: HomePageClient.tsx uses next/dynamic
 * (ssr:false) to code-split MapWrapper and SplashScreen for TBT reduction
 * (#202). In Vitest (jsdom, no Next.js runtime), next/dynamic's lazy
 * resolution never settles — components render null and tests see an empty
 * DOM. The mock makes dynamic() behave like a synchronous require() so tests
 * exercise the real render path. Only the ssr:false dynamic() calls in this
 * test's subject (HomePageClient.tsx, rendered by page.tsx) need this;
 * nested dynamic() calls inside MapWrapper/SplashScreen are already covered
 * by their own module mocks.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import React from "react";
import HomePage from "@/app/page";

// ─── Mock next/dynamic — resolve synchronously in Vitest/jsdom ───────────────
// WHY: next/dynamic's real implementation relies on webpack/Turbopack chunk
// loading that doesn't exist in Vitest. Without this mock, dynamic()'d
// components render null indefinitely and all overlay-architecture assertions
// fail (#202 made MapWrapper + SplashScreen dynamic for TBT reduction).
//
// The mock calls the import factory immediately, resolves in a microtask, and
// returns a wrapper that re-evaluates on each render. The setTimeout(0) in
// renderPage() gives the microtask time to settle before assertions run.
vi.mock("next/dynamic", () => ({
  default: (factory: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>) => {
    // Per-call-site closure — each dynamic() invocation gets its own slot.
    let ResolvedComponent: React.ComponentType<Record<string, unknown>> | null = null;
    factory().then((mod) => { ResolvedComponent = mod.default; });
    function DynamicWrapper(props: Record<string, unknown>) {
      return ResolvedComponent ? React.createElement(ResolvedComponent, props) : null;
    }
    DynamicWrapper.displayName = "DynamicWrapper";
    return DynamicWrapper;
  },
}));

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

// ─── Mock SplashScreen — renders dialog role + dismiss CTA sentinel ───────────
// WHY: SplashScreen is now dynamically imported (ssr:false) for TBT reduction
// (#202). The real component depends on useGeolocation, useLocale, and i18n
// which are complex to wire in jsdom. The mock preserves the interface that
// matters for these tests: role="dialog" overlay + "Find food near me" CTA.
vi.mock("@/components/SplashScreen", () => ({
  default: vi.fn(({ onPrimary }: { onPrimary?: (mode: "located" | "pueblo-center") => void }) => (
    <div role="dialog" aria-modal="true" data-testid="splash-screen">
      <button
        type="button"
        onClick={() => onPrimary?.("located")}
        data-testid="find-food-btn"
      >
        Find food near me
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

/** Render the page, flush queueMicrotask state update, and settle Suspense. */
async function renderPage() {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(<HomePage />);
    // Flush multiple microtask ticks to settle:
    // 1. queueMicrotask in page.tsx that sets splashShown
    // 2. React.lazy Promise resolution for dynamic components
    // 3. React re-render after Suspense resolution
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
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

// ─── Server-rendered SEO content (SEO PR1) ───────────────────────────────────
// Asserted on a PLAIN synchronous render — no `act(async...)` microtask flush —
// because the whole point is that this markup must exist before HomePageClient's
// client-side state ever resolves, i.e. it comes from page.tsx's server render.

describe("server-rendered SEO content", () => {
  test("renders the ItemList JSON-LD script synchronously", () => {
    const { container } = render(<HomePage />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const json = JSON.parse(script!.innerHTML) as { "@type": string; itemListElement: unknown[] };
    expect(json["@type"]).toBe("ItemList");
    expect(Array.isArray(json.itemListElement)).toBe(true);
  });

  test("renders a sr-only <h1> synchronously", () => {
    render(<HomePage />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toBeTruthy();
    expect(heading.className).toContain("sr-only");
  });
});

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
