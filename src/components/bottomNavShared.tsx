/**
 * bottomNavShared — the bottom nav's classes and Boxes icon, shared by
 * BottomNav and MapScreenStandIn (#730).
 *
 * WHY its own module: the stand-in is the server-rendered copy of the map
 * screen a returning visitor sees before MapWrapper's chunk arrives, and it
 * must match the real bar box for box or the bar jumps when MapWrapper
 * mounts. Importing these from BottomNav.tsx would drag its i18n dictionary
 * into the homepage's blocking bundle (see HomePageClient's header), so both
 * files import them from here instead. Keep this module free of i18n.
 */

import { PRESS_FEEDBACK } from "@/lib/interactionStyles";

/**
 * Small box with a roof and a heart on the door (#516 mockup: "Bottom Nav
 * Blessing Box Shortcut - Mockup.html", `#box` symbol) — no lucide icon
 * matches, so this is hand-drawn to lucide's own stroke conventions
 * (24×24 viewBox, stroke-width 2, round caps/joins) so it sits naturally
 * beside Locate/Star/HandHelping/Menu.
 *
 * Option D (#670, 2026-09-26 mockup — supersedes the raspberry background
 * wash this component used to carry): the "on" state fills ONLY the heart
 * path raspberry, via `currentColor` (the button's own text color already
 * turns raspberry when `active`, so stroke and fill always match with no
 * separate color prop). The roof+wall path stays unfilled — filling it
 * renders as a solid house and the heart disappears into it at 24px (#516's
 * original reason for skipping fill entirely, still true for that path; the
 * heart alone is small enough not to collapse). The filled heart doubles as
 * the color-blind-safe cue: the shape itself changes, not just its hue.
 */
export function BoxHeartIcon({ className, active }: { className?: string; active: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 10 12 4l9 6" />
      <path d="M5 9v11h14V9" />
      <path
        d="M12 17.5s-3-1.8-3-3.6a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 1.8-3 3.6-3 3.6z"
        fill={active ? "currentColor" : "none"}
      />
    </svg>
  );
}

export const ITEM_CLASS =
  // Below 2xl: equal-width cell, 24px icon above a 12px/700 label, 3px gap.
  // #516: a 5th item narrows each cell (~67px @375, ~57px @320) — the label
  // drops to 11px under 360px (mockup's own fix for "Resources" not fitting
  // at 320 on the 4-item bar) and returns to 12px at 360px and up. One
  // conditional, not a layout system (ponytail: the 360px floor is the
  // mockup's measured number, not a breakpoint — re-measure before touching it).
  "flex flex-1 flex-col items-center justify-center gap-[3px] h-full min-w-0 rounded-full " +
  "text-[11px] min-[360px]:text-[12px] leading-[14px] font-bold " +
  // 2xl: icon and word on one line inside the pill (§5).
  "2xl:flex-none 2xl:flex-row 2xl:gap-1.5 2xl:px-3 " +
  "transition-colors duration-150 " +
  // `hover:bg-...` compiles under Tailwind's own `@media (hover: hover)`
  // wrapper (v3.4+, still true in v4 — verified against this repo's
  // node_modules/tailwindcss build output), so it never matches on a
  // touch-only device; a real phone can't get stuck showing it. #670
  // investigated a faint grey circle Kyle saw stick on the Boxes cell after
  // tapping it off in Chrome's phone emulation — that symptom traces to the
  // BROWSER's own native tap highlight instead (`-webkit-tap-highlight-color`
  // defaults to a translucent grey rect on `<button>`/`<a>` taps and nothing
  // in this file cleared it), which devtools' touch emulation reproduces
  // faithfully. Suppressed below rather than here, since it's unrelated to
  // this Tailwind hover rule.
  "hover:bg-[var(--color-bone-100)] " +
  "disabled:cursor-default " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-sage-500)] " +
  // #670 — the actual fix for the grey-circle symptom above: disables the
  // native tap-highlight overlay on every bar item (all five share this
  // class), not just Boxes, since the same default applies to any of them.
  "[-webkit-tap-highlight-color:transparent] " +
  PRESS_FEEDBACK;

export const ICON_CLASS = "shrink-0 size-6 2xl:size-5";

export function colorFor(active: boolean) {
  return active
    ? "text-[var(--color-brand-navy)]"
    : "text-[var(--color-ink-500)]";
}

/** The nav element's own classes — see BottomNav.tsx's `<nav>` for its style/positioning comments. */
export const NAV_CLASS =
  // Below 2xl: a 64px pill floating 12px in from the sides — same
  // fill, border and radius as the search bar, with a slightly
  // stronger shadow because it sits over the busiest part of the map.
  // Cells stay ~90px wide at 393px, well past the 44px tap floor.
  // right (not right-3): widens by --panel-right-inset while the
  // desktop panel is open, so the bar's own right edge stays clear of
  // it (see BottomNav's rightInset doc comment).
  "fixed left-3 right-[calc(0.75rem+var(--panel-right-inset,0px))] z-[1003] " +
  "transition-[right] duration-300 " +
  "h-16 px-1.5 " +
  "bg-[var(--color-bone-50)] border border-[var(--color-bone-300)] rounded-[var(--radius-full)] " +
  "shadow-[0_4px_16px_rgba(26,24,23,0.14),0_0_0_1px_rgba(26,24,23,0.04)] " +
  // 2xl: pill floating bottom-centre — same height, radius, shadow and
  // background as SearchBar's input (h-[52px], rounded-full, bone-50,
  // bone-300 border, elevation-1). 24px up, clear of the Mapbox corner.
  // fixed, not absolute: on the Menu pages (PageNav) the document scrolls.
  // Overrides globals.css's below-2xl `[data-bottom-nav]` bottom rule
  // outright (that rule is scoped to `@media (width < 96rem)`, so it
  // simply doesn't match here — no specificity fight, no reset needed).
  // left shifts by half the panel inset (not the transform) so the
  // pill re-centers in the map area left of the panel — see the
  // `<nav>`'s style comment in BottomNav.tsx.
  "2xl:right-auto 2xl:z-[1000] " +
  "2xl:bottom-6 2xl:left-[calc(50%-var(--panel-right-inset,0px)/2)] 2xl:-translate-x-1/2 " +
  "2xl:transition-[left] 2xl:duration-300 " +
  "2xl:h-[52px] 2xl:px-1 2xl:shadow-none 2xl:elevation-1";
