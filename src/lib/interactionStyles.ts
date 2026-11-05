/**
 * interactionStyles.ts — shared Tailwind class fragment for touch/press feedback.
 *
 * WHY one exported constant instead of pasting the literal into every component:
 * Tailwind's preflight removes iOS's default grey tap flash, so taps on most of
 * this app's controls felt "dead" (mobile review item 14, 2026-09-15 — only
 * LocateButton and HamburgerMenu's trigger had their own ad-hoc press state).
 * Picks the brightness-based treatment (LocateButton's precedent) over
 * HamburgerMenu's scale-based one because brightness reads correctly on both
 * filled buttons and bare icon buttons with no background to scale against,
 * and composites over the enlarged-but-invisible hit boxes added alongside it
 * (Priority 3 tap-target fixes, same review) without any transform-origin
 * interaction to reason about.
 */

/** Append to a control's className: dims 5% on press, brightens 5% on hover. */
export const PRESS_FEEDBACK = "hover:brightness-105 active:brightness-95";

/**
 * The phone sheet's close button (#882, Kyle: no visible × on the phone, the
 * sheet closes by swiping down). Visually hidden, but still in the Tab order
 * and announced, so keyboard and screen-reader users keep a way out; on
 * keyboard focus it appears in the sheet's top-right corner. Absolutely
 * positioned either way, so it never takes room from the row it sits in.
 */
export const HIDDEN_UNTIL_FOCUS =
  "sr-only focus-visible:not-sr-only focus-visible:!absolute focus-visible:right-2 focus-visible:top-2 " +
  "focus-visible:z-10 focus-visible:h-12 focus-visible:w-12 focus-visible:bg-[var(--color-bone-50)]";
