"use client";

/**
 * HamburgerMenuContent — the drawer's actual content (#682 split).
 *
 * Extracted from HamburgerMenu.tsx so the SAME Saved-list/Menu-items markup
 * can render inside two different shells: HamburgerMenu's own dropdown/sheet
 * (mobile everywhere, desktop on non-map pages via PageNav — unchanged) and
 * MapWrapper's DesktopSidePanel (map page, desktop — #682). This component
 * owns no position, no backdrop, no focus trap, no Escape handling, no
 * scroll lock — all of that stays with whichever shell renders it.
 *
 * `onClose` replaces the old internal `close` helper: HamburgerMenu (mobile
 * shell) passes its own close-and-restore-focus function; MapWrapper passes
 * a plain "clear the panel" setter. Both call sites want "an action here
 * dismisses whatever's showing this," they just dismiss it differently.
 *
 * `onSelectVenue` is called DIRECTLY, with no `onClose()` first — the two
 * shells compose that differently (HamburgerMenu's `close()` first, same as
 * before; MapWrapper wants the venue view to REPLACE the current view
 * atomically via its own state setter, not close-then-reopen, which would
 * yank focus to the trigger and back — see DesktopSidePanel's own header).
 *
 * `headingId`: when set, the title renders as a real focusable `<h2
 * tabIndex={-1}>` so DesktopSidePanel can move focus to it on view change
 * (#682). Omitted (HamburgerMenu's own callers), it stays the original
 * `aria-hidden` span — a focused `aria-hidden` element fails an axe
 * `aria-hidden-focus` check, so the two must never share one render path.
 */

import { X, ExternalLink, RotateCcw, MessageSquare, MapPinPlus, Info, List, Map as MapIcon, HandHelping, Star, History } from "lucide-react";
import HamburgerMenuItem from "./HamburgerMenuItem";
import LanguageToggle from "./LanguageToggle";
import type { MenuSection } from "./BottomNav";
import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";
import type { Venue } from "@/types/venue";
import { categoryColors } from "@/data/venues";
import { formatMiles } from "@/lib/distance";
import type { ViewMode } from "@/lib/useMapUI";

export interface HamburgerMenuContentProps {
  locale?: Locale;
  onShowWelcome?: () => void;
  savedVenues?: Array<Venue & { distanceMiles?: number }>;
  /** Called directly with the picked venue's id — no implicit close (see file header). */
  onSelectVenue?: (id: string) => void;
  /** Which view to render: the menu ("top") or the saved places ("saved"). */
  view: MenuSection;
  /** Dismisses whatever shell renders this (X, a picked menu item/link). */
  onClose: () => void;
  viewMode?: ViewMode;
  onToggleView?: () => void;
  mapDisabled?: boolean;
  /** When set, the title is a real `<h2 id tabIndex={-1}>` — see file header. */
  headingId?: string;
}

export default function HamburgerMenuContent({
  locale: localeProp,
  onShowWelcome,
  savedVenues = [],
  onSelectVenue,
  view,
  onClose,
  viewMode,
  onToggleView,
  mapDisabled = false,
  headingId,
}: HamburgerMenuContentProps) {
  const { locale: ctxLocale } = useLocale();
  const locale = localeProp ?? ctxLocale;

  const closeLabel = t("menu.close", locale);
  const menuLabel = t("menu.open", locale);
  const titleText = t(view === "saved" ? "menu.saved.heading" : "menu.title", locale);

  return (
    <>
      {/* Close button (X) — visible at top, title alongside. */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-bone-200)] shrink-0">
        {headingId ? (
          <h2
            id={headingId}
            tabIndex={-1}
            className="text-base font-semibold text-[var(--color-ink-700)] outline-none"
          >
            {titleText}
          </h2>
        ) : (
          <span className="text-base font-semibold text-[var(--color-ink-700)]" aria-hidden="true">
            {titleText}
          </span>
        )}
        <button
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
          className={
            // 32px -> 48px hit area (#233's floor; was 44, mobile review
            // #11), negative margin cancels the growth so the header
            // row's layout and the icon's position don't move.
            "flex items-center justify-center w-12 h-12 -m-2 rounded-full " +
            "text-[var(--color-ink-500)] " +
            "hover:bg-[var(--color-bone-100)] hover:text-[var(--color-ink-700)] " +
            PRESS_FEEDBACK + " " +
            "focus-visible:outline-none focus-visible:ring-2 " +
            "focus-visible:ring-[var(--color-sage-500)] " +
            "transition-colors duration-100"
          }
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {view === "saved" ? (
          // Plain list, not role="menu": these are buttons in a dialog-like
          // panel, and the empty state is prose, not a menu item.
          savedVenues.length > 0 ? (
            <ul aria-label={t("menu.saved.heading", locale)} className="py-2">
              {savedVenues.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => onSelectVenue?.(v.id)}
                    className={
                      "flex items-center gap-2.5 w-full min-h-12 text-left px-5 py-2.5 text-sm font-medium " +
                      "text-[var(--color-ink-700)] hover:bg-[var(--color-bone-100)] hover:text-[var(--color-ink-900)] " +
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-sage-500)] " +
                      "transition-colors duration-100"
                    }
                  >
                    <span
                      className="inline-block w-2.5 h-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: categoryColors[v.category] }}
                      aria-hidden="true"
                    />
                    <span className="flex-1 min-w-0 truncate">{v.name}</span>
                    {v.distanceMiles !== undefined && (
                      <span className="shrink-0 font-mono text-xs text-[var(--color-ink-500)] tabular-nums">
                        {formatMiles(v.distanceMiles)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center text-center gap-2 px-6 py-10">
              <Star size={28} aria-hidden className="text-[var(--color-ink-400)]" />
              <p className="text-base font-semibold text-[var(--color-ink-700)]">
                {t("menu.saved.emptyTitle", locale)}
              </p>
              {/* #534: --color-ink-600 undefined in globals.css @theme —
                  mapped to ink-700, DESIGN.md's documented body-text token
                  (same reasoning as FeedbackForm/ReportForm/SuggestForm's
                  identical success/empty-state body copy below a heading). */}
              <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
                {t("menu.saved.emptyBody", locale)}
              </p>
            </div>
          )
        ) : (
          <>
            {/* Sponsor card — first thing in the Menu, deliberately loud (Kyle,
                2026-09-16): the map's corner "Sponsored by" line moved here.
                Outside role="menu" for the same reason as the language row:
                a card link isn't a menuitem. It replaces the old "About Pueblo
                Food Project" item, which went to the same site. */}
            <a
              href="https://pueblofoodproject.org/"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="menu-sponsor"
              aria-label={`${t("menu.sponsoredBy", locale)} Pueblo Food Project ${t("menu.opensInNewTab", locale)}`}
              className={
                "flex items-center gap-3 mx-4 mt-3 mb-1 px-3.5 py-3 rounded-[var(--radius-lg)] " +
                "border border-[var(--color-sage-500)] bg-[var(--color-sage-100)] " +
                "hover:border-[var(--color-sage-700)] transition-colors duration-100 " +
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
                PRESS_FEEDBACK
              }
            >
              <span className="flex flex-col flex-1 min-w-0">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-500)]">
                  {t("menu.sponsoredBy", locale)}
                </span>
                <span className="text-base font-semibold text-[var(--color-sage-700)]">
                  Pueblo Food Project
                </span>
              </span>
              <ExternalLink size={18} aria-hidden className="shrink-0 text-[var(--color-sage-700)]" />
            </a>
            {/* Menu item list */}
            <ul role="menu" aria-label={menuLabel} className="py-2">
              {/* List view / Map view (#514) — top of the menu, second way
                  in for anyone who never taps search. Hidden while the map
                  can't mount (#165) instead of pointing at a dead action —
                  see the prop's own doc comment above. */}
              {!mapDisabled && viewMode && onToggleView && (
                <HamburgerMenuItem
                  label={t(viewMode === "map" ? "menu.listView" : "menu.mapView", locale)}
                  onClick={() => {
                    onClose();
                    onToggleView();
                  }}
                  icon={viewMode === "map" ? <List size={14} /> : <MapIcon size={14} />}
                />
              )}
              {/* Show welcome screen (#99) — re-shows splash without clearing localStorage */}
              {onShowWelcome && (
                <HamburgerMenuItem
                  label={t("menu.showWelcome", locale)}
                  onClick={() => {
                    onClose();
                    onShowWelcome();
                  }}
                  icon={<RotateCcw size={14} />}
                />
              )}
              {/* Suggest a place (#71). onClick={onClose}: a next/link to the
                  page you're already on doesn't navigate, so without this
                  tapping a link item while on that same route left the
                  drawer open with body scroll locked (review item 2). */}
              <HamburgerMenuItem
                label={t("menu.suggest", locale)}
                href="/suggest"
                onClick={onClose}
                icon={<MapPinPlus size={14} />}
              />
              {/* Send us feedback (#116) */}
              <HamburgerMenuItem
                label={t("menu.feedback", locale)}
                href="/feedback"
                onClick={onClose}
                icon={<MessageSquare size={14} />}
              />
              {/* About this map (#155) — internal link, no external icon */}
              <HamburgerMenuItem
                label={t("nav.about", locale)}
                href="/about"
                onClick={onClose}
                icon={<Info size={14} />}
              />
              {/* Browse all places (#PR4) — internal link to the full directory */}
              <HamburgerMenuItem
                label={t("nav.venuesList", locale)}
                href="/venues"
                onClick={onClose}
                icon={<List size={14} />}
              />

              {/* Blessing box activity log (Blessing Boxes slice 3) — internal
                  link to the public feed of box fills/moves/etc. */}
              <HamburgerMenuItem
                label={t("nav.boxActivity", locale)}
                href="/boxes/activity"
                onClick={onClose}
                icon={<History size={14} />}
              />

              {/* Food help programs — the five external links that lived here
                  (#131) moved to the /resources page, which explains each one;
                  the bottom nav's Resources item goes there too. */}
              <HamburgerMenuItem
                label={t("nav.resourcesPage", locale)}
                href="/resources"
                onClick={onClose}
                icon={<HandHelping size={14} />}
              />
            </ul>
            {/* Language toggle (#109) — placed OUTSIDE role="menu" because LanguageToggle
                is a composite widget (role="group" with aria-pressed buttons), not a
                menuitem. WAI-ARIA aria-required-children requires menu children to be
                menuitem, group > menuitem, or separator — a group without menuitem
                children is non-conformant. Moving the toggle below the <ul> keeps the
                visual position while satisfying the ARIA constraint. */}
            <div
              className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-bone-200)]"
            >
              <span className="text-sm font-medium text-[var(--color-ink-700)]">
                {t("menu.language", locale)}
              </span>
              <LanguageToggle />
            </div>
          </>
        )}
      </div>
    </>
  );
}
