"use client";

/**
 * HamburgerMenu — the app drawer. Controlled; it has no trigger of its own.
 *
 * Opened by BottomNav (docs/bottom-nav-spec.md §7) in one of two views:
 *   - "top"   (Menu)  — links (including /resources) and language.
 *   - "saved" (Saved) — ONLY the saved places, or an empty state when there
 *     are none. WHY two views, not one drawer scrolled to a section: with
 *     nothing saved the Saved section didn't render, so Saved opened the
 *     plain menu and looked like the same button as Menu (Kyle, 2026-09-16).
 * The navy trigger button this used to own was deleted with the bottom
 * nav. Its Map/List row was deleted at the same time (§4.4: "that switch
 * lives in the search box") and RE-ADDED by #514 as a single "List
 * view"/"Map view" line at the top of the "top" view — a second way in for
 * anyone who never taps search. Hidden entirely while the map can't mount
 * (#165, `mapDisabled`) rather than shown pointing at a dead action.
 *
 * Desktop (≥768px): ~280px dropdown top-right, below the search row.
 * Mobile (<768px): full-height slide-in side sheet from the right, ~80% viewport width.
 *
 * Behavior:
 *   - Close on: X-button click, outside-click/tap (taps on the nav don't
 *     count — the nav toggles the drawer itself), Escape key.
 *   - Focus trap inside the panel while open.
 *   - Focus returns to whatever opened it (the nav item) on close.
 *
 * A11y:
 *   - Panel: role="menu", aria-label from i18n "menu.open".
 *   - Menu items: role="menuitem" (delegated to HamburgerMenuItem).
 *   - Mobile backdrop: aria-hidden="true" (decorative overlay).
 *
 * v1 items: "Suggest a venue" → /suggest
 */

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { X, ExternalLink, RotateCcw, MessageSquare, MapPinPlus, Info, List, Map as MapIcon, HandHelping, Star, History } from "lucide-react";
import HamburgerMenuItem from "./HamburgerMenuItem";
import LanguageToggle from "./LanguageToggle";
import { BOTTOM_NAV_HEIGHT_PX, type MenuSection } from "./BottomNav";
import { useMediaQuery, MOBILE_QUERY, BELOW_2XL_QUERY } from "@/lib/useMediaQuery";
import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";
import type { Venue } from "@/types/venue";
import { categoryColors } from "@/data/venues";
import { formatMiles } from "@/lib/distance";
import type { ViewMode } from "@/lib/useMapUI";

interface HamburgerMenuProps {
  locale?: Locale;
  /**
   * Called when the user clicks "Show welcome screen" (#99).
   * Re-shows the splash WITHOUT clearing localStorage.
   */
  onShowWelcome?: () => void;
  /** Favorited venues (nearest-first), shown in the "saved" view (#132). */
  savedVenues?: Array<Venue & { distanceMiles?: number }>;
  /** Called when a saved venue row is tapped — selects it on the map. */
  onSelectVenue?: (id: string) => void;
  /** Whether the drawer is open (controlled by MapWrapper). */
  open: boolean;
  /** Called when the drawer asks to close (X, Escape, outside tap, item picked). */
  onClose: () => void;
  /** Which view the drawer shows: the menu ("top") or the saved places ("saved"). */
  view?: MenuSection;
  /** The nav bar — pointerdowns inside it are not "outside" (it toggles the drawer itself). */
  ignoreOutsideRef?: RefObject<HTMLElement | null>;
  /** Current view mode (#514) — decides the top menu line's label/icon/direction. */
  viewMode?: ViewMode;
  /** Called when the "List view"/"Map view" line is tapped. Omit to hide the line entirely. */
  onToggleView?: () => void;
  /** #165 — true while the map can't mount; hides the line rather than showing a dead action. */
  mapDisabled?: boolean;
}

// All focusable elements inside the panel for tab-trap.
const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function HamburgerMenu({
  locale: localeProp,
  onShowWelcome,
  savedVenues = [],
  onSelectVenue,
  open,
  onClose,
  view = "top",
  ignoreOutsideRef,
  viewMode,
  onToggleView,
  mapDisabled = false,
}: HamburgerMenuProps) {
  const { locale: ctxLocale } = useLocale();
  const locale = localeProp ?? ctxLocale;

  const panelRef = useRef<HTMLDivElement>(null);
  // Element focused when the drawer opened (the nav item) — focus returns there on close.
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // ── Close helper ────────────────────────────────────────────────────────────

  const close = useCallback(() => {
    onClose();
    returnFocusRef.current?.focus();
  }, [onClose]);

  // ── Keyboard: Escape closes ──────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, close]);

  // ── Outside click closes ────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !ignoreOutsideRef?.current?.contains(e.target as Node)
      ) {
        close();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, close, ignoreOutsideRef]);

  // ── Focus trap inside the panel ─────────────────────────────────────────────

  useEffect(() => {
    if (!open || !panelRef.current) return;

    if (document.activeElement instanceof HTMLElement) {
      returnFocusRef.current = document.activeElement;
    }

    // Move focus into the panel on open
    const firstFocusable = panelRef.current.querySelector<HTMLElement>(FOCUSABLE);
    firstFocusable?.focus();

    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => !el.hasAttribute("disabled"));

      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      // Re-targeting the open drawer (e.g. Saved -> Menu via the bottom nav,
      // which this effect doesn't re-run for — it only keys on [open]) can
      // leave focus on a bottom-nav button OUTSIDE the panel. The old check
      // only wrapped at first/last, so from outside, Tab escaped into page
      // content instead of re-entering the trap. Pull focus back in first.
      if (!panelRef.current.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [open]);

  // ── Prevent body scroll on mobile while panel is open ───────────────────────

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Switching views while open (Saved → Menu) starts the new view at the top.
  useEffect(() => {
    if (open && panelRef.current) panelRef.current.scrollTop = 0;
  }, [open, view]);

  const isMobile = useMediaQuery(MOBILE_QUERY);
  const isBelow2xl = useMediaQuery(BELOW_2XL_QUERY);
  // The bottom bar (z 1003) draws over the drawer below 2xl; keep the drawer's
  // last item (the language toggle) scrollable clear of it.
  const barClearance = isBelow2xl
    ? `calc(${BOTTOM_NAV_HEIGHT_PX}px + env(safe-area-inset-bottom))`
    : "0px";

  const menuLabel = t("menu.open", locale);
  const closeLabel = t("menu.close", locale);

  // Panel positioning style: fixed side-sheet on mobile, absolute dropdown on desktop.
  // Mobile stays edge-to-edge (top:0/height:100%) for the backdrop; safe-area
  // padding keeps its content clear of the notch, home indicator, and edge.
  const panelStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        top: 0,
        right: 0,
        height: "100%",
        width: "80vw",
        maxWidth: "384px",
        zIndex: 1002,
        backgroundColor: "white",
        boxShadow: "0 4px 32px rgba(0,0,0,0.22)",
        overflowY: "auto",
        paddingTop: "env(safe-area-inset-top)",
        // isMobile (this branch) implies isBelow2xl — MOBILE_QUERY (767px) is
        // narrower than BELOW_2XL_QUERY (1535px) — so barClearance always
        // applies here; the env(...)-only alternative was unreachable.
        paddingBottom: barClearance,
        paddingRight: "env(safe-area-inset-right)",
      }
    : {
        position: "absolute", // inside the fixed wrapper below
        // 52px = the search row height at md+, where the deleted trigger
        // button sat — the dropdown keeps clearing the search box.
        top: "calc(52px + 8px)",
        right: 0,
        width: "280px",
        // Bounded so a long saved list scrolls and the drawer clears the bar below 2xl.
        maxHeight: `calc(100dvh - 92px - ${barClearance})`,
        zIndex: 1002,
        backgroundColor: "white",
        borderRadius: "8px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        overflowY: "auto",
      };

  return (
    <div
      style={{
        // fixed, not absolute: PageNav mounts this drawer on scrolling pages too.
        position: "fixed",
        // Clears the notch/Dynamic Island (top) and the landscape edge (right).
        top: "max(16px, env(safe-area-inset-top))",
        right: "max(16px, env(safe-area-inset-right))",
        zIndex: 1002,
      }}
    >
      {/* ── Mobile backdrop ─────────────────────────────────────────────────── */}
      {open && isMobile && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            zIndex: 1001,
          }}
          onClick={close}
        />
      )}

      {/* ── Panel ───────────────────────────────────────────────────────────── */}
      {/* WHY role="menu" is on <ul> not the outer div: ARIA requires role="menu"
          children to be menuitem elements. The outer panel also contains the
          close button header which is not a menuitem — putting role="menu" on
          the outer div triggers aria-required-children violations. The <ul>
          contains only menuitem-role elements, so role="menu" belongs there. */}
      {open && (
        <div
          id="hamburger-panel"
          ref={panelRef}
          style={panelStyle}
        >
          {/* Close button (X) — visible at top of panel */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-bone-200)]">
            <span
              className="text-base font-semibold text-[var(--color-ink-800)]"
              aria-hidden="true"
            >
              {t(view === "saved" ? "menu.saved.heading" : "menu.title", locale)}
            </span>
            <button
              type="button"
              aria-label={closeLabel}
              onClick={close}
              className={
                // 32px -> 44px hit area, negative margin cancels the growth so
                // the header row's layout and the icon's position don't move
                // (mobile review #11).
                "flex items-center justify-center w-11 h-11 -m-1.5 rounded-full " +
                "text-[var(--color-ink-500)] " +
                "hover:bg-[var(--color-bone-100)] hover:text-[var(--color-ink-800)] " +
                PRESS_FEEDBACK + " " +
                "focus-visible:outline-none focus-visible:ring-2 " +
                "focus-visible:ring-[var(--color-sage-500)] " +
                "transition-colors duration-100"
              }
            >
              <X size={16} aria-hidden />
            </button>
          </div>

          {view === "saved" ? (
            // Plain list, not role="menu": these are buttons in a dialog-like
            // panel, and the empty state is prose, not a menu item.
            savedVenues.length > 0 ? (
              <ul aria-label={t("menu.saved.heading", locale)} className="py-2">
                {savedVenues.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        onSelectVenue?.(v.id);
                      }}
                      className={
                        "flex items-center gap-2.5 w-full text-left px-5 py-2.5 text-sm font-medium " +
                        "text-[var(--color-ink-800)] hover:bg-[var(--color-bone-100)] hover:text-[var(--color-ink-900)] " +
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
                <p className="text-base font-semibold text-[var(--color-ink-800)]">
                  {t("menu.saved.emptyTitle", locale)}
                </p>
                <p className="text-sm text-[var(--color-ink-600)] leading-relaxed">
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
                      close();
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
                      close();
                      onShowWelcome();
                    }}
                    icon={<RotateCcw size={14} />}
                  />
                )}
                {/* Suggest a venue (#71). onClick={close}: a next/link to the
                    page you're already on doesn't navigate, so without this
                    tapping a link item while on that same route left the
                    drawer open with body scroll locked (review item 2). */}
                <HamburgerMenuItem
                  label={t("menu.suggest", locale)}
                  href="/suggest"
                  onClick={close}
                  icon={<MapPinPlus size={14} />}
                />
                {/* Send us feedback (#116) */}
                <HamburgerMenuItem
                  label={t("menu.feedback", locale)}
                  href="/feedback"
                  onClick={close}
                  icon={<MessageSquare size={14} />}
                />
                {/* About this map (#155) — internal link, no external icon */}
                <HamburgerMenuItem
                  label={t("nav.about", locale)}
                  href="/about"
                  onClick={close}
                  icon={<Info size={14} />}
                />
                {/* Browse all venues (#PR4) — internal link to the full directory */}
                <HamburgerMenuItem
                  label={t("nav.venuesList", locale)}
                  href="/venues"
                  onClick={close}
                  icon={<List size={14} />}
                />

                {/* Blessing box activity log (Blessing Boxes slice 3) — internal
                    link to the public feed of box fills/moves/etc. */}
                <HamburgerMenuItem
                  label={t("nav.boxActivity", locale)}
                  href="/boxes/activity"
                  onClick={close}
                  icon={<History size={14} />}
                />

                {/* Food help programs — the five external links that lived here
                    (#131) moved to the /resources page, which explains each one;
                    the bottom nav's Resources item goes there too. */}
                <HamburgerMenuItem
                  label={t("nav.resourcesPage", locale)}
                  href="/resources"
                  onClick={close}
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
                <span className="text-sm font-medium text-[var(--color-ink-800)]">
                  {t("menu.language", locale)}
                </span>
                <LanguageToggle />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
