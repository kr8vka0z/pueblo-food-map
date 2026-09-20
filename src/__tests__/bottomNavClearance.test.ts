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
 *
 * Extended again for #530 review round 2 (the first attempt's `top` position
 * lived in a React inline style, which always outranks a stylesheet rule —
 * a `[data-bottom-nav] { top: auto }` reset meant to win back at 2xl was
 * dead CSS, and desktop was only correct because 52+24 happened to equal
 * 64+12). Guards:
 *   - Neither BottomNav.tsx nor BottomSheet.tsx sets a `style={{` position
 *     prop at all — the position lives in globals.css as a plain rule, so
 *     it can never out-rank a later stylesheet override the way an inline
 *     style did.
 *   - `--viewport-toolbar-gap` (globals.css) is declared from `100vh` and
 *     `--viewport-small` — the stable gap the position rules below build on.
 *   - `[data-bottom-nav]`'s `bottom` rule is scoped inside
 *     `@media (width < 96rem)` — this is what "pins desktop's position" per
 *     the review: if a future edit ever drops that scoping, this same rule
 *     would apply unconditionally and silently fight BottomNav.tsx's own
 *     `2xl:bottom-6` Tailwind class (same specificity, last-in-source wins)
 *     — the exact class of bug just fixed, just with the roles reversed.
 *   - `[data-bottom-sheet]` gets a `bottom` rule too (BottomSheet's own half
 *     of #530, not attempted in the first pass).
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

describe("#530 review round 2 — position lives in CSS, not a React inline style", () => {
  test.each([
    ["src/components/BottomNav.tsx"],
    ["src/components/BottomSheet.tsx"],
  ])("%s sets no inline top/bottom/left/right position style", (relPath) => {
    const src = readSrc(relPath);
    // Scoped to the position properties specifically (not `style={{` in
    // general — both files legitimately use inline style for unrelated
    // things, e.g. fontFamily/backgroundColor/height). An inline top/bottom
    // offset is what made the first attempt's 2xl reset dead CSS: it always
    // outranks a stylesheet rule, short of !important.
    expect(
      src,
      `${relPath} must not position itself via an inline style — position lives in globals.css`
    ).not.toMatch(/style=\{\{?\s*(top|bottom|left|right)\s*:/);
  });

  test("--viewport-toolbar-gap is declared from 100vh and --viewport-small", () => {
    const css = readSrc("src/app/globals.css");
    expect(
      css,
      "expected --viewport-toolbar-gap: calc(100vh - var(--viewport-small));"
    ).toMatch(/--viewport-toolbar-gap:\s*calc\(100vh\s*-\s*var\(--viewport-small\)\);/);
  });

  test("[data-bottom-nav]'s bottom rule is scoped below 2xl, so it can't fight 2xl:bottom-6", () => {
    const css = readSrc("src/app/globals.css");
    // Pins the exact bug this issue's review caught: a [data-bottom-nav]
    // rule with no media scoping would apply at every width, including 2xl,
    // and (same specificity as a Tailwind class, later in source) silently
    // win over BottomNav.tsx's 2xl:bottom-6 — correct only by coincidence.
    expect(css).toMatch(
      /@media\s*\(width\s*<\s*96rem\)\s*\{\s*\[data-bottom-nav\]\s*\{\s*bottom:\s*calc\(var\(--viewport-toolbar-gap\)/
    );
    // [data-bottom-nav] names an actual CSS selector exactly once in the
    // whole file — inside that media block. Strip /* */ comments first (the
    // WHY-prose above legitimately mentions the selector by name); a second
    // REAL selector occurrence, unscoped, would apply at every width,
    // including 2xl, and (same specificity as a Tailwind class, later in
    // source) silently win over BottomNav.tsx's 2xl:bottom-6.
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const occurrences = withoutComments.match(/\[data-bottom-nav\]/g) ?? [];
    expect(occurrences.length, "expected [data-bottom-nav] to appear exactly once as a real selector in globals.css").toBe(1);
  });

  test("[data-bottom-sheet] has its own bottom rule built on --viewport-toolbar-gap", () => {
    const css = readSrc("src/app/globals.css");
    expect(css).toMatch(/\[data-bottom-sheet\]\s*\{\s*bottom:\s*var\(--viewport-toolbar-gap\);/);
  });
});

describe("#530 review round 3 — vaul's own keyboard-avoidance reintroduces the slice", () => {
  test("Drawer.Root disables vaul's repositionInputs", () => {
    const src = readSrc("src/components/BottomSheet.tsx");
    // vaul defaults repositionInputs to true: on visualViewport resize (the
    // keyboard opening/closing) it writes an inline `drawerRef.current
    // .style.bottom` and never clears it — which always outranks
    // globals.css's [data-bottom-sheet] rule for the life of the instance,
    // and leaves the sheet at a literal `bottom: 0px` (the #530 slice bug)
    // once the keyboard closes. This is invisible to every OTHER test in
    // this file/suite, which all mock vaul — this regex-on-source is the
    // only guard available.
    expect(src, "expected repositionInputs={false} on Drawer.Root").toMatch(
      /repositionInputs=\{false\}/
    );
  });
});
