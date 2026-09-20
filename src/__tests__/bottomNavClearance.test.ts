/**
 * bottomNavClearance.test.ts — guards the `--bottom-nav-clearance` CSS
 * custom property (globals.css `:root`) against drifting from
 * BOTTOM_NAV_HEIGHT_PX (BottomNav.tsx). Review cleanup item: PageNav.tsx,
 * ListView.tsx, and globals.css's Mapbox-credits offset all used to
 * hard-code 76px directly instead of referencing one source. Plain CSS can't
 * import a TS export, so the two numbers are two separate literals with no
 * shared source — this test is what keeps them from silently diverging if
 * BOTTOM_NAV_HEIGHT_PX (the nav's real, measured height) ever changes.
 *
 * Extended for #530 (Safari bottom-bar slice fix): guards the same kind of
 * silent-drift risk for the two pieces that fix added —
 *   - `--viewport-small` (globals.css): must have both a `vh` base (pre-svh
 *     browsers) and an `@supports (height: 100svh)` override, or a bottom-
 *     pinned element silently loses either the fallback or the real fix.
 *   - `themeColor` (layout.tsx): must literally equal `--color-bone-50`
 *     (globals.css) — a `<meta name="theme-color">` value can't reference a
 *     CSS custom property, so it's a second hard-coded hex with no compiler
 *     link to the first; only a test catches the two drifting apart.
 *   - BottomNav.tsx / BottomSheet.tsx must contain no bare `vh`/`dvh` unit on
 *     bottom-anchored chrome — the whole point of `--viewport-small` is that
 *     nothing pinned to the bottom re-introduces the browser-default unit
 *     that caused #530 (`vh`) or the toolbar-tracking one that jumps (`dvh`).
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BOTTOM_NAV_HEIGHT_PX } from "@/components/BottomNav";

const readSrc = (relPath: string) => readFileSync(join(process.cwd(), relPath), "utf-8");

describe("--bottom-nav-clearance mirrors BOTTOM_NAV_HEIGHT_PX", () => {
  test("globals.css's :root value equals the BottomNav.tsx constant", () => {
    const css = readSrc("src/app/globals.css");
    const match = css.match(/--bottom-nav-clearance:\s*(\d+)px;/);
    expect(match, "expected --bottom-nav-clearance to be declared in globals.css").not.toBeNull();
    expect(Number(match![1])).toBe(BOTTOM_NAV_HEIGHT_PX);
  });
});

describe("#530 — small-viewport anchoring for bottom-pinned chrome", () => {
  test("--viewport-small has a vh base plus an @supports(100svh) override", () => {
    const css = readSrc("src/app/globals.css");
    expect(css, "expected a vh fallback: --viewport-small: 100vh;").toMatch(
      /--viewport-small:\s*100vh;/
    );
    expect(
      css,
      "expected an @supports(height: 100svh) block overriding --viewport-small to 100svh"
    ).toMatch(/@supports\s*\(height:\s*100svh\)\s*\{\s*:root\s*\{\s*--viewport-small:\s*100svh;/);
  });

  test("layout.tsx's themeColor matches globals.css's --color-bone-50", () => {
    const css = readSrc("src/app/globals.css");
    const layout = readSrc("src/app/layout.tsx");
    const cssMatch = css.match(/--color-bone-50:\s*(#[0-9a-fA-F]{6});/);
    expect(cssMatch, "expected --color-bone-50 to be declared in globals.css").not.toBeNull();
    const themeColorMatch = layout.match(/themeColor:\s*["'](#[0-9a-fA-F]{6})["']/);
    expect(themeColorMatch, "expected a themeColor: \"#hex\" entry in layout.tsx's viewport export").not.toBeNull();
    expect(themeColorMatch![1].toLowerCase()).toBe(cssMatch![1].toLowerCase());
  });

  test.each([
    ["src/components/BottomNav.tsx"],
    ["src/components/BottomSheet.tsx"],
  ])("%s pins bottom-anchored chrome with no bare vh/dvh unit", (relPath) => {
    const src = readSrc(relPath);
    expect(src, `${relPath} must not size/position against a bare vh unit`).not.toMatch(/\b\d+vh\b/);
    expect(src, `${relPath} must not size/position against a bare dvh unit`).not.toMatch(/\b\d+dvh\b/);
  });
});
