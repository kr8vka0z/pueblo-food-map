"use client";

/**
 * BottomNav — the app's five navigation targets: Near me · Saved · Boxes · Help · Menu.
 *
 * Spec: docs/bottom-nav-spec.md (§3 bar, §5 breakpoints, §6 Near me, §12 a11y).
 *
 * Boxes (#516, Kyle 2026-09-19) is a plain toggle, not a MenuSection: tapping
 * it flips `blessing_box` in the same category Set the Filters panel (#513)
 * writes to — two ways into one piece of state, so ticking the box in either
 * place lights up both the bar item and the Filters badge count. The caller
 * (MapWrapper/PageNav) owns that state; this component only reflects it via
 * `boxesActive`/`onBoxesToggle`, the same controlled-prop shape `onNearMe`
 * already uses for "Near me".
 *
 * One component, two layouts, one set of buttons:
 *   below 2xl  — floating rounded pill near the bottom, icon above its word
 *               (Kyle, 2026-09-16: it was a full-width bar; the pill matches
 *               the search bar and the laptop layout).
 *   2xl and up — pill floating in the bottom centre of the screen, icon and
 *               word on one line (Kyle, 2026-09-16; it used to sit beside
 *               the search box).
 * WHY one DOM tree with responsive classes rather than two renders: there is
 * never a moment both layouts should exist, so there is never a second
 * landmark, a second focus stop, or a second copy of the Near-me state.
 *
 * Replaces the navy menu button, the orange "Find food near me" banner
 * (LocateButton, deleted — its state machine is `nearMeIcon` below) and
 * the map wordmark. Mounted LAST in MapWrapper so keyboard users reach the
 * map and the search before it (§12).
 */

import type { RefObject } from "react";
import Link from "next/link";
import { Locate, LocateFixed, Loader2, Star, HandHelping, Menu } from "lucide-react";
import type { GeoState } from "@/lib/useGeolocation";
import { t, type Locale } from "@/lib/i18n";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";
import { useAnyOverlayOpen } from "@/lib/overlayRegistry";

/**
 * Space the nav takes off the bottom of the screen below 2xl, excluding the
 * safe-area inset: the 64px pill + the 12px gap under it. JS/TSX that must
 * clear the nav (MapWrapper's alert offset, HamburgerMenu's drawer padding,
 * DesktopVenueWindow's clip math) imports this constant directly. Plain CSS
 * can't import a TS export, so globals.css mirrors the same number as
 * `--bottom-nav-clearance` (kept in sync by a source-level test, not by a
 * shared import) for PageNav/ListView padding and the Mapbox credits offset.
 */
export const BOTTOM_NAV_HEIGHT_PX = 76;

/** Which drawer section a nav item opens (§7). Resources is a page, not a section. */
export type MenuSection = "top" | "saved";

interface BottomNavProps {
  locale: Locale;
  /** The drawer section currently open, or null when the drawer is closed (§3.3). */
  openSection: MenuSection | null;
  /** Tapping an item: open the drawer at that section, or close it if it's already the open one. */
  onSectionTap: (section: MenuSection) => void;
  geoState: GeoState;
  isLocating: boolean;
  isDrifted: boolean;
  onNearMe: () => void;
  /**
   * Boxes (#516) — whether the blessing-box category filter is currently on.
   * Required (like `onNearMe`) so a caller can't silently forget to wire it
   * and ship a dead button.
   */
  boxesActive: boolean;
  /** Tapping Boxes: toggle `blessing_box` in the caller's category filter. */
  onBoxesToggle: () => void;
  /** Used by HamburgerMenu's outside-click check so tapping the nav doesn't count as "outside". */
  navRef?: RefObject<HTMLElement | null>;
  /** On /resources itself (PageNav): Resources shows as the current item. */
  onResourcesPage?: boolean;
}

/**
 * Small box with a roof and a heart on the door (#516 mockup: "Bottom Nav
 * Blessing Box Shortcut - Mockup.html", `#box` symbol) — no lucide icon
 * matches, so this is hand-drawn to lucide's own stroke conventions
 * (24×24 viewBox, stroke-width 2, round caps/joins, no fill) so it sits
 * naturally beside Locate/Star/HandHelping/Menu.
 *
 * The pressed (active) state does NOT fill the paths, unlike the mockup's
 * `.bb.on .ico{fill:...}` — filling the roof+wall path renders as a solid
 * house and the heart collapses into it at 24px. The raspberry tint on the
 * cell background plus the raspberry stroke color (see BOXES_ACTIVE_STYLE
 * below) carries the "on" state instead, the same way every other active
 * bar item is colour-only, never fill-only.
 */
function BoxHeartIcon({ className }: { className?: string }) {
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
      <path d="M12 17.5s-3-1.8-3-3.6a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 1.8-3 3.6-3 3.6z" />
    </svg>
  );
}

// Boxes' own "on" tint: raspberry text + a light raspberry background wash.
// color-mix against the existing --color-cat-blessing token rather than a
// new CSS variable — design:drift only allows tokens already in globals.css.
const BOXES_ACTIVE_STYLE: React.CSSProperties = {
  backgroundColor: "color-mix(in srgb, var(--color-cat-blessing) 12%, transparent)",
};

const ITEM_CLASS =
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
  "hover:bg-[var(--color-bone-100)] " +
  "disabled:cursor-default " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-sage-500)] " +
  PRESS_FEEDBACK;

const ICON_CLASS = "shrink-0 size-6 2xl:size-5";

function colorFor(active: boolean) {
  return active
    ? "text-[var(--color-brand-navy)]"
    : "text-[var(--color-ink-500)]";
}

export default function BottomNav({
  locale,
  openSection,
  onSectionTap,
  geoState,
  isLocating,
  isDrifted,
  onNearMe,
  boxesActive,
  onBoxesToggle,
  navRef,
  onResourcesPage = false,
}: BottomNavProps) {
  // #542: single choke point for "hide the bar while a full-surface overlay
  // is open" — every overlay (Menu on mobile, Filters, PhotoViewer, the
  // route steps sheet, the full venue/box card via MapWrapper's
  // venueSheetOpen) registers into the SAME shared registry
  // (overlayRegistry.ts) instead of each call site (MapWrapper, PageNav)
  // re-deriving its own boolean and wrapping this component in JSX.
  if (useAnyOverlayOpen()) return null;

  // §6: the label never changes, only the icon does — so the bar never reflows.
  const located = geoState.permission === "granted" && geoState.position !== null;
  const nearMeIcon = isLocating ? (
    <Loader2 aria-hidden className={ICON_CLASS + " animate-spin motion-reduce:animate-none"} />
  ) : located && isDrifted ? (
    <LocateFixed aria-hidden className={ICON_CLASS} />
  ) : (
    <Locate aria-hidden className={ICON_CLASS} />
  );

  const sectionItem = (section: MenuSection, label: string, icon: React.ReactNode) => {
    const active = openSection === section;
    return (
      <li className="flex flex-1 2xl:flex-none 2xl:h-11">
        <button
          type="button"
          onClick={() => onSectionTap(section)}
          aria-current={active ? "true" : undefined}
          data-testid={`nav-${section}`}
          className={ITEM_CLASS + " " + colorFor(active)}
        >
          {icon}
          <span>{label}</span>
        </button>
      </li>
    );
  };

  return (
    <nav
      ref={navRef}
      aria-label={t("nav.aria", locale)}
      // #530 review round 2: the `bottom` position lives in globals.css
      // (`[data-bottom-nav]`), NOT here as a class or inline style — an
      // inline style always outranks a stylesheet rule (short of
      // `!important`), so a Tailwind `2xl:` class or a media-scoped CSS
      // reset can never override one, no matter which comes later in the
      // cascade. See globals.css's own comment for the actual formula and
      // the reasoning (a stable gap derived from the large/small viewport
      // difference, no env(safe-area-inset-bottom) term — see that file).
      data-bottom-nav=""
      className={
        // Below 2xl: a 64px pill floating 12px in from the sides — same
        // fill, border and radius as the search bar, with a slightly
        // stronger shadow because it sits over the busiest part of the map.
        // Cells stay ~90px wide at 393px, well past the 44px tap floor.
        "fixed left-3 right-3 z-[1003] " +
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
        "2xl:right-auto 2xl:z-[1000] " +
        "2xl:bottom-6 2xl:left-1/2 2xl:-translate-x-1/2 " +
        "2xl:h-[52px] 2xl:px-1 2xl:shadow-none 2xl:elevation-1"
      }
    >
      <ul className="flex h-full items-stretch 2xl:items-center 2xl:gap-0.5">
        <li className="flex flex-1 2xl:flex-none 2xl:h-11">
          <button
            type="button"
            onClick={onNearMe}
            disabled={isLocating}
            aria-busy={isLocating}
            data-testid="nav-near-me"
            className={ITEM_CLASS + " " + colorFor(false)}
          >
            {nearMeIcon}
            <span>{t("nav.nearMe", locale)}</span>
          </button>
          {/* Announces the in-flight request; the visible label stays fixed. */}
          <span className="sr-only" aria-live="polite">
            {isLocating ? t("locate.locating", locale) : ""}
          </span>
        </li>
        {/* Star, not heart: matches the save button on every venue card (Kyle, 2026-09-16). */}
        {sectionItem("saved", t("nav.saved", locale), <Star aria-hidden className={ICON_CLASS} />)}
        {/* Boxes (#516) — a plain toggle, not a drawer section: tapping it
            flips the shared blessing_box category filter (see file header).
            Middle position keeps Near me first / Menu last, under the thumb. */}
        <li className="flex flex-1 2xl:flex-none 2xl:h-11">
          <button
            type="button"
            onClick={onBoxesToggle}
            aria-pressed={boxesActive}
            data-testid="nav-boxes"
            className={
              ITEM_CLASS + " " + (boxesActive ? "text-[var(--color-cat-blessing)]" : colorFor(false))
            }
            style={boxesActive ? BOXES_ACTIVE_STYLE : undefined}
          >
            <BoxHeartIcon className={ICON_CLASS} />
            <span>{t("nav.boxes", locale)}</span>
          </button>
        </li>
        {/* Resources ("Help", #516) opens its own page (/resources) — Kyle,
            2026-09-16: as a drawer section it looked like it did the same
            thing as Menu. */}
        <li className="flex flex-1 2xl:flex-none 2xl:h-11">
          <Link
            href="/resources"
            data-testid="nav-resources"
            aria-current={onResourcesPage ? "page" : undefined}
            className={ITEM_CLASS + " " + colorFor(onResourcesPage)}
          >
            {/* hand-helping, not hand-heart: the heart collapses into the fingers at 24px (§3.2). */}
            <HandHelping aria-hidden className={ICON_CLASS} />
            <span>{t("nav.resources", locale)}</span>
          </Link>
        </li>
        {sectionItem("top", t("nav.menu", locale), <Menu aria-hidden className={ICON_CLASS} />)}
      </ul>
    </nav>
  );
}
