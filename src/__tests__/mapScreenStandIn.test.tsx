/**
 * Map-screen stand-in (#730) — the still search bar + nav a returning visitor
 * sees while MapWrapper's chunk loads. Guards the two ways it can go wrong:
 * showing with (or instead of) the first-time splash, and lingering after the
 * real map screen mounts (a second, dead search bar on top of the real one).
 *
 * next/dynamic is mocked to honour `loading` (unlike page.test.tsx's mock),
 * and MapWrapper's module waits on `mapChunk` so the test decides when the
 * chunk "arrives".
 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { render, act, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import HomePageClient from "@/app/(site)/HomePageClient";
import { markSplashSeen } from "@/lib/splashGate";

const mapChunk = vi.hoisted(() => {
  let release!: () => void;
  const ready = new Promise<void>((r) => (release = r));
  return { ready, release };
});

vi.mock("next/dynamic", () => ({
  default: (
    factory: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>,
    opts?: { loading?: React.ComponentType },
  ) => {
    let Resolved: React.ComponentType<Record<string, unknown>> | null = null;
    const loaded = factory().then((mod) => { Resolved = mod.default; });
    function Dynamic(props: Record<string, unknown>) {
      const [, rerender] = React.useReducer((n: number) => n + 1, 0);
      React.useEffect(() => { loaded.then(rerender); }, []);
      if (Resolved) return React.createElement(Resolved, props);
      return opts?.loading ? React.createElement(opts.loading) : null;
    }
    return Dynamic;
  },
}));

vi.mock("@/components/MapWrapper", async () => {
  await mapChunk.ready;
  return { default: () => <div data-testid="map-wrapper" /> };
});

const labels = {
  search: "Search",
  filters: "Filters",
  nearMe: "Near me",
  saved: "Saved",
  boxes: "Boxes",
  help: "Help",
  menu: "Menu",
};

afterEach(() => {
  localStorage.clear();
});

describe("map-screen stand-in", () => {
  test("server HTML: a pending, hidden-from-AT stand-in that CSS shows only when the gate script fires", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(<HomePageClient standInLabels={labels} />);
    const standIn = host.querySelector("[data-map-standin]");
    expect(standIn?.hasAttribute("data-map-standin-pending")).toBe(true);
    expect(standIn?.getAttribute("aria-hidden")).toBe("true");
    expect(standIn?.hasAttribute("inert")).toBe(true);
    // The splash is in the same HTML; this rule is what keeps a first-time
    // visitor from seeing both (the gate script sets data-splash-seen only
    // for returning visitors and shared links).
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf-8");
    expect(css).toMatch(/html:not\(\[data-splash-seen\]\) \[data-map-standin-pending\]\s*\{\s*display:\s*none;/);
  });

  test("first-time visitor: splash only, no stand-in behind it", () => {
    const { container } = render(<HomePageClient standInLabels={labels} />);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.querySelector("[data-map-standin]")).toBeNull();
  });

  test("returning visitor: stand-in until the map screen mounts, then gone", async () => {
    markSplashSeen();
    const { container } = render(<HomePageClient standInLabels={labels} />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector("main [data-map-standin]")).not.toBeNull();

    await act(async () => {
      mapChunk.release();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByTestId("map-wrapper")).toBeTruthy();
    expect(container.querySelector("[data-map-standin]")).toBeNull();
  });
});
