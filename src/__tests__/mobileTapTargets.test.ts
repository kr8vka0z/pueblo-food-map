/**
 * mobileTapTargets.test.ts — guards the Priority-3 tap-target fixes from the
 * 2026-09-15 mobile review (items 7-10: controls that measured under the 24px
 * WCAG floor). These four controls are awkward to render in isolation
 * (SearchBar's clear chip only shows with an active filter passed in;
 * BottomSheet/DirectionButtons need a full venue + route fixture and live
 * inside a vaul Drawer portal) — the fixes themselves are pure Tailwind class
 * additions, so a source-level assertion that the enlarging classes are
 * present is a direct, low-friction check that regresses loudly if someone
 * reverts one of these edits.
 *
 * Each assertion targets the SPECIFIC class fragment added in this PR, not
 * just "some className exists", so an unrelated refactor that keeps the
 * enlarged box would still pass, but reverting the size change would fail.
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf-8");
}

// mobile review #7's SearchBar filter-chip clear button was removed outright
// by #513 ("Category chip leaves the search bar entirely") — the chip and its
// 14px->26px clear button no longer exist; filters live in FilterPanel instead.

// #666 replaced the ~20px "Show/Hide details" text-link toggle this guard
// covered with a real 48×48 grab-bar button (see BottomSheet.tsx's own
// header) — there's no longer a padding hack to regress, since the tap
// target IS the button's own size now. Re-pointed at the bar's own floor.
describe("mobile review #8 (superseded by #666) — BottomSheet grab bar meets the 48px floor", () => {
  test("grab bar button is a real 48px square, not a padded text link", () => {
    const src = readSource("src/components/BottomSheet.tsx");
    expect(src).toMatch(/flex h-12 w-12 items-center justify-center rounded-md/);
  });
});

describe("mobile review #9 — DirectionButtons walk-steps toggle (~20px -> >=24px)", () => {
  test("steps toggle gains vertical padding", () => {
    const src = readSource("src/components/DirectionButtons.tsx");
    expect(src).toMatch(/py-1\.5 text-sm font-medium text-\[var\(--color-sage-600\)\]/);
  });
});

describe("mobile review #10 — DirectionButtons \"Open in Google Maps\" link (~16px -> >=24px)", () => {
  test("link is inline-block with vertical padding", () => {
    const src = readSource("src/components/DirectionButtons.tsx");
    expect(src).toMatch(/inline-block py-1\.5 text-xs text-\[var\(--color-ink-500\)\]/);
  });
});

describe("mobile review #13 — VenueMarker invisible hit-area floor", () => {
  test("default pin's hit box is floored at 44px while the pin itself keeps its own size", () => {
    const src = readSource("src/components/VenueMarker.tsx");
    expect(src).toMatch(/const MIN_HIT_SIZE = 44;/);
    expect(src).toMatch(/const hitSize = Math\.max\(totalSize, MIN_HIT_SIZE\);/);
  });
});

describe("mobile review #14 — shared press-feedback style is defined once", () => {
  test("PRESS_FEEDBACK is exported from the shared module, not pasted per-component", () => {
    const src = readSource("src/lib/interactionStyles.ts");
    expect(src).toMatch(/export const PRESS_FEEDBACK = "hover:brightness-105 active:brightness-95";/);
  });

  test.each([
    "src/components/SearchBar.tsx",
    "src/components/BottomSheet.tsx",
    "src/components/DirectionButtons.tsx",
    // #682 8b (coordinator: "Split HamburgerMenu.tsx into content-only
    // pieces... plus a thin wrapper") moved every PRESS_FEEDBACK usage
    // (close button, sponsor card, menu items) into HamburgerMenuContent —
    // HamburgerMenu.tsx itself is now pure shell (position/focus/Escape),
    // with nothing left that needs the press-feedback style.
    "src/components/HamburgerMenuContent.tsx",
    "src/components/VenuePopupHeader.tsx",
    "src/components/LocationHelpCard.tsx",
    "src/components/FavoriteButton.tsx",
    "src/components/ShareButton.tsx",
    // ViewToggle.tsx removed by #514 (the inline search-bar switch it
    // rendered is gone) — dropped from this list, not just left to 404.
    // CategoryChips.tsx removed by #596 (dead code — built, never wired
    // into MapWrapper; only tests imported it) — same treatment.
    "src/components/LanguageToggle.tsx",
  ])("%s imports the shared PRESS_FEEDBACK constant", (path) => {
    const src = readSource(path);
    expect(src).toContain('import { PRESS_FEEDBACK } from "@/lib/interactionStyles";');
  });
});
