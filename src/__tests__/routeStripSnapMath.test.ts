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

  test("MAP_PEEK_PX is defined as a named constant (100), shared with the card sheet", () => {
    expect(readSrc("src/components/ScrollSheet.tsx")).toMatch(/export const MAP_PEEK_PX = 100;/);
    expect(src).toMatch(/import ScrollSheet, \{ MAP_PEEK_PX \} from "@\/components\/ScrollSheet";/);
  });

  // Route mode's vaul drawer sets this height (card mode is ScrollSheet's
  // track, #923, with the same calc); it must still be the 100dvh one.
  test("the sheet height uses 100dvh, not var(--viewport-small)", () => {
    const height = src.match(/style=\{\{\s*height:\s*`([^`]+)`/);
    expect(height, "expected the sheet's height calc string").not.toBeNull();
    expect(height![1]).toMatch(/100dvh/);
    expect(height![1]).not.toMatch(/var\(--viewport-small\)/);
  });

  test("the strip snap point equals ROUTE_STRIP_HEIGHT_PX + MAP_PEEK_PX", () => {
    expect(src).toMatch(/const ROUTE_STRIP_SNAP = `\$\{ROUTE_STRIP_HEIGHT_PX \+ MAP_PEEK_PX\}px`;/);
    // Cross-check against RouteStrip.tsx's real exported value, so this
    // fails if ROUTE_STRIP_HEIGHT_PX itself ever changes without the strip's
    // rendered height and this snap math staying in lockstep.
    expect(ROUTE_STRIP_HEIGHT_PX).toBe(112);
  });
});
