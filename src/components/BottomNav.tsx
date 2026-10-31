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
import { BoxHeartIcon, ICON_CLASS, ITEM_CLASS, NAV_CLASS, colorFor } from "@/components/bottomNavShared";
import { useAnyOverlayOpen } from "@/lib/overlayRegistry";
import { useLocale } from "@/lib/LocaleContext";
import { localizedHref } from "@/lib/localizedHref";

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
  /**
   * Extra clearance (px) from the desktop side panel (#682) — shifts the bar
   * left so it re-centers in the map area left of the panel while it's open.
   * Applied as a CSS custom property (`--panel-right-inset`) rather than a
   * Tailwind class, since its value is a runtime number: below `2xl` it
   * widens the bar's own right offset (the bar is a near-full-width pill);
   * at `2xl`+ it shifts the centered pill's `left` percentage instead (its
   * `translate-x` stays a fixed -50%). Always 0 on mobile — MapWrapper only
   * passes a nonzero value on desktop, when the panel is actually open.
   */
  rightInset?: number;
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
  rightInset = 0,
}: BottomNavProps) {
  // #689 PR 2: tree (not the `locale` prop) decides whether Resources links
  // into /es — see localizedHref's own header. Read via useLocale() here
  // (not a new prop) since this component already renders inside
  // RootShell's LocaleProvider on every page that mounts it.
  const { tree } = useLocale();

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
      // #682: `--panel-right-inset` drives both breakpoints' shift below via
      // arbitrary-value `calc()` — a plain number prop, so it can't be a
      // static Tailwind class. `right`/`left` (not `transform`), so this
      // combines cleanly with the FIXED `2xl:-translate-x-1/2` below instead
      // of fighting over the one `transform` property inline styles would.
      style={{ ["--panel-right-inset" as string]: `${rightInset}px` }}
      className={NAV_CLASS}
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
          >
            <BoxHeartIcon className={ICON_CLASS} active={boxesActive} />
            <span>{t("nav.boxes", locale)}</span>
          </button>
        </li>
        {/* Resources ("Help", #516) opens its own page (/resources) — Kyle,
            2026-09-16: as a drawer section it looked like it did the same
            thing as Menu. */}
        <li className="flex flex-1 2xl:flex-none 2xl:h-11">
          <Link
            href={localizedHref("/resources", tree)}
            // #721: this link is on screen on every map and content page, so
            // the default viewport prefetch fetched /resources' data and code
            // in the background for every visitor, most of whom never tap it.
            prefetch={false}
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
