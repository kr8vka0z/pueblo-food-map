/**
 * Splash server-rendering tests — the splash must be in the first render (so
 * it is in the server HTML and painted before hydration), without flashing for
 * returning visitors or deep links.
 *
 * Covers:
 *   (a) server output (renderToString) already contains the real splash,
 *       marked `data-splash-pending`, with no <main>
 *   (b) client render (the client-side-navigation case): the gate resolves in
 *       a layout effect, inside render()'s act, so a returning visitor never
 *       has the splash in the DOM once render() returns; a first visitor has
 *       it, no longer pending
 *   (c) the inline SPLASH_GATE_SCRIPT and shouldSkipSplash() agree on every
 *       URL/storage combination — the two are hand-mirrored (ES5 vs TS), so
 *       this is what keeps them from drifting
 *   (d) blocked storage neither throws nor traps the visitor on the splash
 *
 * SplashScreen is rendered REAL (need its root attribute and #splash-purpose);
 * MapWrapper and next/dynamic are mocked the same way as page.test.tsx.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import React from "react";
import HomePageClient from "@/app/(site)/HomePageClient";
import { t } from "@/lib/i18n";
import {
  SPLASH_GATE_SCRIPT,
  SPLASH_SEEN_ATTR,
  markSplashSeen,
  readSplashGate,
  shouldSkipSplash,
} from "@/lib/splashGate";

// WHY: next/dynamic's real chunk loading doesn't exist under Vitest (see
// page.test.tsx's identical mock for the full rationale).
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

vi.mock("@/components/MapWrapper", () => ({
  default: () => <div data-testid="map-wrapper" />,
}));

beforeEach(() => {
  Object.defineProperty(navigator, "permissions", {
    value: { query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }) },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute(SPLASH_SEEN_ATTR);
  window.history.replaceState(null, "", "/");
});

describe("server output (renderToString)", () => {
  test("has the real splash, marked pending, and no <main>", () => {
    // Even with the gate set: the server can't know, so it always emits the
    // pending splash (the inline script + CSS hide it for returning visitors).
    markSplashSeen();
    const host = document.createElement("div");
    host.innerHTML = renderToString(<HomePageClient />);

    expect(host.querySelector("#splash-purpose")?.textContent).toBe(
      t("splash.purpose", "en"),
    );
    expect(host.querySelector('[role="dialog"]')?.hasAttribute("data-splash-pending")).toBe(true);
    expect(host.querySelector("main")).toBeNull();
  });
});

describe("client render (gate resolves before paint)", () => {
  // No await anywhere below: the layout effect's setState is flushed inside
  // render()'s own act, i.e. before a browser would paint. This is the
  // client-side-navigation case, where the inline script never runs.
  test("returning visitor: no splash in the DOM once render() returns, map mounted", () => {
    markSplashSeen();
    const { container } = render(<HomePageClient />);

    expect(container.querySelector("#splash-purpose")).toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector("main")).not.toBeNull();
  });

  test("first visitor: splash shown but no longer pending, map mounted", () => {
    const { container } = render(<HomePageClient />);

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.hasAttribute("data-splash-pending")).toBe(false);
    expect(container.querySelector("main")).not.toBeNull();
  });

  test("deep link (?venue=): no splash once render() returns", () => {
    window.history.replaceState(null, "", "/?venue=abc");
    const { container } = render(<HomePageClient />);

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector("main")).not.toBeNull();
  });
});

describe("SPLASH_GATE_SCRIPT parity with shouldSkipSplash", () => {
  // `skip` is spelled out (not derived) so the test also pins the semantics:
  // an empty ?venue= wins over #venue= and is falsy, so it does NOT skip.
  const cases: { name: string; url: string; gate: boolean; skip: boolean }[] = [
    { name: "none", url: "/", gate: false, skip: false },
    { name: "gate set", url: "/", gate: true, skip: true },
    { name: "?venue=abc", url: "/?venue=abc", gate: false, skip: true },
    { name: "?venue= (empty)", url: "/?venue=", gate: false, skip: false },
    { name: "#venue=abc", url: "/#venue=abc", gate: false, skip: true },
    { name: "?venue=&x=1#venue=abc", url: "/?venue=&x=1#venue=abc", gate: false, skip: false },
    { name: "?near=1", url: "/?near=1", gate: false, skip: true },
    { name: "?boxes=1", url: "/?boxes=1", gate: false, skip: true },
    { name: "?near=0", url: "/?near=0", gate: false, skip: false },
  ];

  test.each(cases)("$name", ({ url, gate, skip }) => {
    window.history.replaceState(null, "", url);
    if (gate) markSplashSeen();

    new Function(SPLASH_GATE_SCRIPT)();

    const { search, hash } = window.location;
    const scriptSkips = document.documentElement.hasAttribute(SPLASH_SEEN_ATTR);
    expect(scriptSkips).toBe(shouldSkipSplash({ search, hash, gateSeen: gate }));
    expect(scriptSkips).toBe(skip);
  });

  test("stays ES5-safe and can't break out of its <script> tag", () => {
    // Old low-end Android WebViews: no arrow functions, const/let, ?? or startsWith.
    expect(SPLASH_GATE_SCRIPT).not.toMatch(/=>|\bconst\b|\blet\b|\?\?|startsWith|`/);
    // dangerouslySetInnerHTML on <script> is not escaped.
    expect(SPLASH_GATE_SCRIPT).not.toContain("<");
  });
});

describe("blocked storage", () => {
  afterEach(() => vi.restoreAllMocks());

  test("markSplashSeen swallows a throwing setItem (dismiss must not abort)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(() => markSplashSeen()).not.toThrow();
  });

  test("a throwing getItem reads as unseen, and a first visit still resolves to the splash", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(readSplashGate()).toBe(false);

    const { container } = render(<HomePageClient />);
    expect(container.querySelector('[role="dialog"]')?.hasAttribute("data-splash-pending")).toBe(false);
    expect(container.querySelector("main")).not.toBeNull();
  });
});
