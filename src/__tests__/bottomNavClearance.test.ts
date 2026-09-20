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
 * silent-drift risk for `--viewport-small` (globals.css: must have both a
 * `vh` base for pre-svh browsers and an `@supports (height: 100svh)`
 * override, or a bottom-pinned element silently loses either the fallback
 * or the real fix) and `themeColor` (layout.tsx: must literally equal
 * `--color-bone-50`, globals.css — a `<meta name="theme-color">` value
 * can't reference a CSS custom property, so it's a second hard-coded hex
 * with no compiler link to the first). Also guards that BottomNav.tsx /
 * BottomSheet.tsx carry no bare `vh`/`dvh` unit on bottom-anchored chrome,
 * and (#530 review round 2) that neither component positions itself via an
 * inline `style={{ top/bottom/left/right: ... }}` — an inline style always
 * outranks a stylesheet rule, which is what made the first #530 attempt's
 * 2xl reset dead CSS.
 *
 * #541 — REPLACES the #530/#536 toolbar-height-reserve model entirely, and
 * this file's #536-era tests along with it. Real iPhone measurement (iOS
 * 26, 2026-09-20, `/viewport-check`, both Safari and Chrome, toolbar
 * expanded and collapsed) found a plain `position: fixed; bottom: 0`
 * element already renders fully visible directly above the browser's own
 * toolbar — the premise `--viewport-toolbar-gap` (#530's static
 * `100vh - var(--viewport-small)` fallback, #536's live `100vh - 100dvh`
 * override) was built on was FALSE on the real device. Stacking that
 * reserve on top of `bottom: 0`/`env(safe-area-inset-bottom)` double-
 * counted the toolbar and lifted every bottom-pinned bar 40-74px too high.
 * `--viewport-toolbar-gap` is deleted outright (both declarations), and the
 * four rules that consumed it now read `env(safe-area-inset-bottom)` alone
 * (0 on the test device, kept for standalone/home-screen installs and
 * devices that DO report a home-indicator inset) plus their own fixed
 * pixel offset. This file's job below is to guard the NEW formula on all
 * four rules and on RouteStrip.tsx's Steps sheet, and to make sure the
 * toolbar-gap term never quietly comes back anywhere in `src/`.
 */

import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { BOTTOM_NAV_HEIGHT_PX } from "@/components/BottomNav";

const readSrc = (relPath: string) => readFileSync(join(process.cwd(), relPath), "utf-8");

// Recursively lists every file under a directory (relative to repo root) —
// used by the #541 regression guard below, which must scan all of `src/`,
// not just the handful of files the older, formula-specific tests name.
function listFiles(relDir: string): string[] {
  const absDir = join(process.cwd(), relDir);
  const out: string[] = [];
  for (const entry of readdirSync(absDir)) {
    const relPath = join(relDir, entry);
    const absPath = join(process.cwd(), relPath);
    if (statSync(absPath).isDirectory()) {
      out.push(...listFiles(relPath));
    } else {
      out.push(relPath);
    }
  }
  return out;
}

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
  ])("%s pins bottom-anchored chrome with no bare vh unit", (relPath) => {
    const src = readSrc(relPath);
    expect(src, `${relPath} must not size/position against a bare vh unit`).not.toMatch(/\b\d+vh\b/);
  });

  test("BottomNav.tsx uses no dvh unit at all", () => {
    const src = readSrc("src/components/BottomNav.tsx");
    expect(
      src,
      "BottomNav.tsx must not size/position against a bare dvh unit — it has no snap-point " +
        "constraint forcing it off --viewport-small, so dvh here would only reintroduce #530's " +
        "mid-scroll jump"
    ).not.toMatch(/\b\d+dvh\b/);
  });

  // #549 — narrowed from a blanket dvh ban to "only 100dvh, and only in
  // BottomSheet.tsx". The blanket ban was written for #530, before vaul's
  // snap-point math was understood: vaul measures a px snap point against
  // `window.innerHeight`, so the route-active drawer's height MUST use the
  // one CSS unit that equals `window.innerHeight` in both toolbar states —
  // measured on the real iPhone, iOS 26, 2026-09-20 (Safari 714/714, Chrome
  // 683/683). `--viewport-small` is deliberately shorter than that, which is
  // exactly what pushed the route strip off the bottom edge. Still has teeth:
  // any OTHER dvh fraction (90dvh, 50dvh — the kind of unmeasured "size it to
  // the viewport" guess this guard exists to catch) still fails here, and the
  // exact height expression is pinned separately in routeStripSnapMath.test.ts.
  test("BottomSheet.tsx's only dvh unit is the measured 100dvh", () => {
    const src = readSrc("src/components/BottomSheet.tsx");
    const used = Array.from(new Set(src.match(/\b\d+dvh\b/g) ?? []));
    expect(
      used,
      "BottomSheet.tsx may use 100dvh (it must match vaul's window.innerHeight reference — " +
        "see its own `style` prop comment) and no other dvh value"
    ).toEqual(["100dvh"]);
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

  test("[data-bottom-nav]'s bottom rule is scoped below 2xl, so it can't fight 2xl:bottom-6", () => {
    const css = readSrc("src/app/globals.css");
    // Pins the exact bug this issue's review caught: a [data-bottom-nav]
    // rule with no media scoping would apply at every width, including 2xl,
    // and (same specificity as a Tailwind class, later in source) silently
    // win over BottomNav.tsx's 2xl:bottom-6 — correct only by coincidence.
    expect(css).toMatch(
      /@media\s*\(width\s*<\s*96rem\)\s*\{\s*\[data-bottom-nav\]\s*\{\s*bottom:\s*calc\(env\(safe-area-inset-bottom\)\s*\+\s*12px\);/
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

  test("[data-bottom-sheet] has its own bottom rule built on env(safe-area-inset-bottom)", () => {
    const css = readSrc("src/app/globals.css");
    expect(css).toMatch(/\[data-bottom-sheet\]\s*\{\s*bottom:\s*env\(safe-area-inset-bottom\);/);
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

describe("#541 — bottom-pinned chrome uses env(safe-area-inset-bottom) alone, no toolbar reserve", () => {
  test("[data-bottom-nav]'s bottom rule is env(safe-area-inset-bottom) + 12px", () => {
    const css = readSrc("src/app/globals.css");
    expect(css).toMatch(
      /\[data-bottom-nav\]\s*\{\s*bottom:\s*calc\(env\(safe-area-inset-bottom\)\s*\+\s*12px\);/
    );
  });

  test(".mapboxgl-ctrl-bottom-right's bottom rule is env(safe-area-inset-bottom) + --bottom-nav-clearance + 8px", () => {
    const css = readSrc("src/app/globals.css");
    expect(css).toMatch(
      /\.mapboxgl-map \.mapboxgl-ctrl-bottom-right\s*\{\s*bottom:\s*calc\(env\(safe-area-inset-bottom\)\s*\+\s*var\(--bottom-nav-clearance\)\s*\+\s*8px\);/
    );
  });

  test("[data-bottom-sheet]'s bottom rule is env(safe-area-inset-bottom) alone", () => {
    const css = readSrc("src/app/globals.css");
    expect(css).toMatch(/\[data-bottom-sheet\]\s*\{\s*bottom:\s*env\(safe-area-inset-bottom\);/);
  });

  // #547 (Kyle, 2026-09-20) reverses #531: the nav now hides for the whole
  // time the route strip is on screen (MapWrapper.tsx's `venueSheetOpen`),
  // so the strip has no nav left to clear and this rule is gone — inverted
  // from asserting its presence to asserting it never comes back, same as
  // RouteNavVisibility.test.tsx's own inversion for the same issue.
  test("#547: [data-bottom-sheet][data-strip-open] clearance rule is GONE — the strip falls through to the plain [data-bottom-sheet] rule", () => {
    const css = readSrc("src/app/globals.css");
    // Matches only an actual rule declaration (selector immediately followed
    // by `{`), not the historical note left in the surrounding comment —
    // that comment names the old selector in prose on purpose (WHY the rule
    // is gone), which would otherwise false-fail this assertion.
    expect(css).not.toMatch(/\[data-bottom-sheet\]\[data-strip-open\]\s*\{/);
  });

  test("RouteStrip.tsx's Steps sheet uses the bottom-[env(safe-area-inset-bottom)] arbitrary value", () => {
    const src = readSrc("src/components/RouteStrip.tsx");
    expect(src).toMatch(/bottom-\[env\(safe-area-inset-bottom\)\]/);
  });

  test("--viewport-toolbar-gap appears nowhere in src/ — regression guard against the double-count coming back", () => {
    // toolbarGapNeedle is built at runtime, not written literally, so this
    // very file — which has to name the retired property to describe what
    // it's guarding against — doesn't trip its own assertion.
    const toolbarGapNeedle = ["--viewport", "-toolbar-gap"].join("");
    const selfPath = join("src", "__tests__", "bottomNavClearance.test.ts");
    const files = listFiles("src")
      .filter((f) => /\.(ts|tsx|css|js|jsx)$/.test(f))
      .filter((f) => f !== selfPath);
    const offenders = files.filter((f) => readSrc(f).includes(toolbarGapNeedle));
    expect(
      offenders,
      `${toolbarGapNeedle} must not appear anywhere in src/ (found in: ${offenders.join(", ")})`
    ).toEqual([]);
  });
});

/**
 * #553 — iOS Safari rubber-band bounce on swipe-down.
 *
 * A downward drag starting inside a scroller that is already at scrollTop 0
 * CHAINS to the document unless the scroller opts out, and iOS Safari answers
 * that by bouncing the entire page. Measured off Kyle's 2026-09-20 screen
 * recording: header, map and card translated down together by ~104 CSS px and
 * sprang back, once per swipe-down attempt. `modal={false}` on the drawer
 * means vaul never applies its body scroll-lock, so nothing else intercepts
 * it.
 *
 * Neither half is reachable from a jsdom test — jsdom implements no scrolling,
 * no touch physics, and BottomSheet's own tests mock vaul outright — so these
 * are source-level guards, in the same spirit as the `vh`/`dvh` guards above.
 */
describe("#553 — overscroll chaining is contained", () => {
  test("globals.css sets overscroll-behavior-y: none on html", () => {
    const css = readSrc("src/app/globals.css");
    expect(css).toMatch(/html\s*\{[^}]*overscroll-behavior-y:\s*none;/);
  });

  test("the html rule stays on the y axis — the shorthand would kill edge-swipe back/forward", () => {
    // `overscroll-behavior: none` at the document root also zeroes the X
    // axis, which is the documented way to disable Chrome/Android's
    // edge-swipe navigation gesture. Nothing here wants that, and no Android
    // device is available to catch the regression, so the shorthand must not
    // come back. Matches a rule declaration only, never the prose above it.
    const css = readSrc("src/app/globals.css");
    expect(css).not.toMatch(/^\s*overscroll-behavior:\s*none;/m);
  });

  // Deliberately NOT "every scroller in src/" — only the ones that render
  // inside the mobile bottom sheet, where a pull-down at scrollTop 0 is the
  // reported gesture. Other scrollers (DesktopVenueWindow, SearchResultsPopover,
  // FilterPanel, SplashScreen) rely on the `html` backstop above instead;
  // widening this list would mean touching files this bug never reached.
  test.each([
    ["src/components/BottomSheet.tsx"],
    ["src/components/RouteStrip.tsx"],
    ["src/components/DirectionButtons.tsx"],
    ["src/components/ListView.tsx"],
  ])("%s: every overflow-y-auto scroller also opts out of scroll chaining", (relPath) => {
    // Drop comments first. Several of these files discuss `overflow-y-auto`
    // in prose (BottomSheet.tsx's repositionInputs note, DirectionButtons'
    // "FIX 4" note, and this fix's own comments) — counting those as
    // scrollers would fail the assertion on documentation rather than code.
    // Block comments are stripped too: JSX attribute comments in these files
    // are `{/* ... */}`, and a future docs edit mentioning the utility inside
    // one would otherwise trip this.
    const src = readSrc(relPath)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//"))
      .join("\n");
    // What's left: the utility appears only inside class strings. Pull each
    // quoted/templated run containing the scroll utility and require the
    // containment utility beside it, so a NEW scroller added to one of these
    // components can't silently reopen the bug.
    const scrollers = src.match(/[^"'`]*overflow-y-auto[^"'`]*/g) ?? [];
    expect(scrollers.length, `expected at least one scroller in ${relPath}`).toBeGreaterThan(0);
    const unguarded = scrollers.filter((s) => !s.includes("overscroll-contain"));
    expect(
      unguarded,
      `overflow-y-auto without overscroll-contain in ${relPath}: ${unguarded.join(" | ")}`
    ).toEqual([]);
  });
});
