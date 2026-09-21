/**
 * routeStripSnapMath.test.ts — guards the #549 fix (real-iPhone route strip
 * pushed almost entirely off the bottom edge, only a ~12px sliver visible).
 *
 * vaul computes a px snap point's transform offset as
 * `offset = window.innerHeight - snapPx` (vaul/dist/index.mjs ~line 540), so
 * a drawer with `bottom: S` and `height: H` shows
 * `visible = S + H - window.innerHeight + snapPx` at that snap — which only
 * equals the strip's own height when `S + H === window.innerHeight`. Source-
 * text regex, not a render/measure test — jsdom has no real
 * window.innerHeight-vs-viewport-unit distinction to assert against, same
 * reasoning as every guard in bottomNavClearance.test.ts.
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROUTE_STRIP_HEIGHT_PX } from "@/components/RouteStrip";

const readSrc = (relPath: string) => readFileSync(join(process.cwd(), relPath), "utf-8");

describe("#549 — route-active BottomSheet height matches vaul's window.innerHeight reference", () => {
  const src = readSrc("src/components/BottomSheet.tsx");

  test("MAP_PEEK_PX is defined as a named constant (100)", () => {
    expect(src).toMatch(/const MAP_PEEK_PX = 100;/);
  });

  test("route-active height uses 100dvh, not var(--viewport-small)", () => {
    const heightBranch = src.match(/isWalkRouteActive\s*\?\s*\{\s*height:\s*`([^`]+)`/);
    expect(heightBranch, "expected a route-active height calc string").not.toBeNull();
    expect(heightBranch![1]).toMatch(/100dvh/);
    expect(heightBranch![1]).not.toMatch(/var\(--viewport-small\)/);
  });

  test("non-route maxHeight still uses var(--viewport-small), not dvh", () => {
    const maxHeightBranch = src.match(/:\s*\{\s*maxHeight:\s*`([^`]+)`/);
    expect(maxHeightBranch, "expected a non-route maxHeight calc string").not.toBeNull();
    expect(maxHeightBranch![1]).toMatch(/var\(--viewport-small\)/);
    expect(maxHeightBranch![1]).not.toMatch(/dvh/);
  });

  test("the strip snap point equals ROUTE_STRIP_HEIGHT_PX + MAP_PEEK_PX", () => {
    expect(src).toMatch(/const ROUTE_STRIP_SNAP = `\$\{ROUTE_STRIP_HEIGHT_PX \+ MAP_PEEK_PX\}px`;/);
    // Cross-check against RouteStrip.tsx's real exported value, so this
    // fails if ROUTE_STRIP_HEIGHT_PX itself ever changes without the strip's
    // rendered height and this snap math staying in lockstep.
    expect(ROUTE_STRIP_HEIGHT_PX).toBe(112);
  });
});
