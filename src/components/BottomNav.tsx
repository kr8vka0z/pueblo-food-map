"use client";

/**
 * BottomNav — the app's four navigation targets: Near me · Saved · Resources · Menu.
 *
 * Spec: docs/bottom-nav-spec.md (§3 bar, §5 breakpoints, §6 Near me, §12 a11y).
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
import { Locate, LocateFixed, Loader2, Star, HandHelping, Menu, Gift } from "lucide-react";
import type { GeoState } from "@/lib/useGeolocation";
import { t, type Locale } from "@/lib/i18n";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";

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
  /** Used by HamburgerMenu's outside-click check so tapping the nav doesn't count as "outside". */
  navRef?: RefObject<HTMLElement | null>;
  /** On /resources itself (PageNav): Resources shows as the current item. */
  onResourcesPage?: boolean;
  /**
   * Blessing Boxes slice 4, story B4 — one of the two entry-point
   * candidates being previewed side by side (see MapWrapper's own
   * `?boxEntry=` switch). Defaults to false so every existing caller
   * (PageNav, and MapWrapper when the other candidate is active) keeps
   * exactly the documented four-item bar — this is additive and opt-in,
   * never a change to the established default shape.
   */
  showBoxesItem?: boolean;
  /** On /boxes itself: Boxes shows as the current item (mirrors onResourcesPage). */
  onBoxesPage?: boolean;
}

const ITEM_CLASS =
  // Below 2xl: equal-width cell, 24px icon above a 12px/700 label, 3px gap.
  "flex flex-1 flex-col items-center justify-center gap-[3px] h-full min-w-0 rounded-full " +
  "text-[12px] leading-[14px] font-bold " +
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
  navRef,
  onResourcesPage = false,
  showBoxesItem = false,
  onBoxesPage = false,
}: BottomNavProps) {
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
      data-bottom-nav=""
      className={
        // Below 2xl: a 64px pill floating 12px in from the sides and 12px above
        // the home indicator — same bone-50 fill, bone-300 border and full
        // radius as the search bar, with a slightly stronger shadow because
        // it sits over the busiest part of the map. Cells stay ~90px wide at
        // 393px, well past the 44px tap floor.
        "fixed left-3 right-3 bottom-[calc(12px+env(safe-area-inset-bottom))] z-[1003] " +
        "h-16 px-1.5 " +
        "bg-[var(--color-bone-50)] border border-[var(--color-bone-300)] rounded-[var(--radius-full)] " +
        "shadow-[0_4px_16px_rgba(26,24,23,0.14),0_0_0_1px_rgba(26,24,23,0.04)] " +
        // 2xl: pill floating bottom-centre — same height, radius, shadow and
        // background as SearchBar's input (h-[52px], rounded-full, bone-50,
        // bone-300 border, elevation-1). 24px up, clear of the Mapbox corner.
        // fixed, not absolute: on the Menu pages (PageNav) the document scrolls.
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
        {/* Resources opens its own page (/resources) — Kyle, 2026-09-16: as a
            drawer section it looked like it did the same thing as Menu. */}
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
        {/* Blessing Boxes entry point candidate "nav" (Blessing Boxes slice
            4, story B4) — only rendered when the ?boxEntry= preview switch
            selects it; see MapWrapper's own header for the two candidate
            URLs and the default. */}
        {showBoxesItem && (
          <li className="flex flex-1 2xl:flex-none 2xl:h-11">
            <Link
              href="/boxes"
              data-testid="nav-boxes"
              aria-current={onBoxesPage ? "page" : undefined}
              className={ITEM_CLASS + " " + colorFor(onBoxesPage)}
            >
              <Gift aria-hidden className={ICON_CLASS} />
              <span>{t("nav.boxes", locale)}</span>
            </Link>
          </li>
        )}
        {sectionItem("top", t("nav.menu", locale), <Menu aria-hidden className={ICON_CLASS} />)}
      </ul>
    </nav>
  );
}
