"use client";

/**
 * HamburgerMenu — the app drawer: saved places, assistance resources, links,
 * language. Controlled; it has no trigger of its own.
 *
 * Opened by BottomNav's Saved / Resources / Menu items (docs/bottom-nav-spec.md
 * §7), each passing `initialSection` so the drawer scrolls that section into
 * view. The navy trigger button this used to own was deleted with the bottom
 * nav, as was its Map/List row — that switch lives in the search box (§4.4).
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
import { X, ExternalLink, RotateCcw, MessageSquare, MapPinPlus, Phone, Info, List } from "lucide-react";
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

interface HamburgerMenuProps {
  locale?: Locale;
  /**
   * Called when the user clicks "Show welcome screen" (#99).
   * Re-shows the splash WITHOUT clearing localStorage.
   */
  onShowWelcome?: () => void;
  /** Favorited venues (nearest-first), shown in the "Saved places" section (#132). */
  savedVenues?: Array<Venue & { distanceMiles?: number }>;
  /** Called when a saved venue row is tapped — selects it on the map. */
  onSelectVenue?: (id: string) => void;
  /** Whether the drawer is open (controlled by MapWrapper). */
  open: boolean;
  /** Called when the drawer asks to close (X, Escape, outside tap, item picked). */
  onClose: () => void;
  /** Section scrolled into view on open, and again whenever it changes while open (§7). */
  initialSection?: MenuSection;
  /** The nav bar — pointerdowns inside it are not "outside" (it toggles the drawer itself). */
  ignoreOutsideRef?: RefObject<HTMLElement | null>;
}

/** DOM ids of the sections BottomNav can open the drawer at. */
const SECTION_IDS: Record<Exclude<MenuSection, "top">, string> = {
  saved: "menu-section-saved",
  help: "menu-section-help",
};

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
  initialSection = "top",
  ignoreOutsideRef,
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

  // ── Scroll the requested section into view (§7) ─────────────────────────────
  // Declared after the focus-trap effect so it runs after focus lands on the
  // close button at the top. Re-runs when the section changes while open
  // (Saved → Resources).
  //
  // ponytail: scroll-into-view is the whole mechanism. Ceiling: if either
  // section ever grows past a screenful of its own, it wants a real page.
  // Upgrade path is a route per section, with the drawer delegating.
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const target =
      initialSection === "top" ? null : document.getElementById(SECTION_IDS[initialSection]);
    // No saved places yet → the Saved section isn't rendered; stay at the top.
    if (target) target.scrollIntoView?.({ block: "start" });
    else panelRef.current.scrollTop = 0;
  }, [open, initialSection]);

  const isMobile = useMediaQuery(MOBILE_QUERY);
  const isBelow2xl = useMediaQuery(BELOW_2XL_QUERY);
  // The bottom bar (z 1003) draws over the drawer below 2xl; keep the drawer's
  // last item (the language toggle) scrollable clear of it.
  const barClearance = isBelow2xl
    ? `calc(${BOTTOM_NAV_HEIGHT_PX}px + env(safe-area-inset-bottom))`
    : "0px";

  const menuLabel = t("menu.open", locale);
  const closeLabel = t("menu.close", locale);
  /**
   * External menu links open a new tab; screen readers need that called out in the active locale.
   * Compose label and suffix once so each item stays aligned with i18n keys.
   */
  const externalAriaLabel = (labelKey: string) =>
    `${t(labelKey, locale)} ${t("menu.opensInNewTab", locale)}`;

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
        paddingBottom: isBelow2xl ? barClearance : "env(safe-area-inset-bottom)",
        paddingRight: "env(safe-area-inset-right)",
      }
    : {
        position: "absolute",
        // 52px = the search row height at md+, where the deleted trigger
        // button sat — the dropdown keeps clearing the search box.
        top: "calc(52px + 8px)",
        right: 0,
        width: "280px",
        // Bounded so it scrolls (initialSection needs that) and clears the bar below 2xl.
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
        position: "absolute",
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
              {t("menu.title", locale)}
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

          {/* Menu item list — About is the last item (#124) */}
          <ul role="menu" aria-label={menuLabel} className="py-2">
            {/* Saved places (#132) — favorited venues; tap to open on the map */}
            {savedVenues.length > 0 && (
              <>
                <li role="presentation" className="pt-1">
                  <p id={SECTION_IDS.saved} className="scroll-mt-2 px-5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">
                    {t("menu.saved.heading", locale)}
                  </p>
                </li>
                {savedVenues.map((v) => (
                  <li role="menuitem" key={v.id}>
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
                <li
                  role="presentation"
                  aria-hidden="true"
                  className="mt-1 mb-1 border-t border-[var(--color-bone-200)]"
                />
              </>
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
            {/* Suggest a venue (#71) */}
            <HamburgerMenuItem
              label={t("menu.suggest", locale)}
              href="/suggest"
              icon={<MapPinPlus size={14} />}
            />
            {/* Send us feedback (#116) */}
            <HamburgerMenuItem
              label={t("menu.feedback", locale)}
              href="/feedback"
              icon={<MessageSquare size={14} />}
            />
            {/* About this map (#155) — internal link, no external icon */}
            <HamburgerMenuItem
              label={t("nav.about", locale)}
              href="/about"
              icon={<Info size={14} />}
            />
            {/* Browse all venues (#PR4) — internal link to the full directory */}
            <HamburgerMenuItem
              label={t("nav.venuesList", locale)}
              href="/venues"
              icon={<List size={14} />}
            />

            {/* Get help — curated external assistance resources (#131) */}
            <li
              role="presentation"
              className="mt-1 border-t border-[var(--color-bone-200)] pt-2"
            >
              <p id={SECTION_IDS.help} className="scroll-mt-2 px-5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">
                {t("menu.help.heading", locale)}
              </p>
            </li>
            <HamburgerMenuItem
              label={t("menu.help.211", locale)}
              href="https://www.211colorado.org/food-assistance/"
              isExternal={true}
              icon={<ExternalLink size={14} />}
              ariaLabel={externalAriaLabel("menu.help.211")}
            />
            <HamburgerMenuItem
              label={t("menu.help.snap", locale)}
              href="https://cdhs.colorado.gov/snap"
              isExternal={true}
              icon={<ExternalLink size={14} />}
              ariaLabel={externalAriaLabel("menu.help.snap")}
            />
            <HamburgerMenuItem
              label={t("menu.help.wic", locale)}
              href="https://www.coloradowic.gov/eligibility/apply"
              isExternal={true}
              icon={<ExternalLink size={14} />}
              ariaLabel={externalAriaLabel("menu.help.wic")}
            />
            <HamburgerMenuItem
              label={t("menu.help.doubleup", locale)}
              href="https://doubleupcolorado.org/"
              isExternal={true}
              icon={<ExternalLink size={14} />}
              ariaLabel={externalAriaLabel("menu.help.doubleup")}
            />
            <HamburgerMenuItem
              label={t("menu.help.hotline", locale)}
              href="tel:+18558554626"
              isExternal={true}
              icon={<Phone size={14} />}
              ariaLabel={t("menu.help.hotline", locale)}
            />

            {/* About Pueblo Food Project (#96) — moved to the bottom of the nav
                links per #124; sits above the language control (kept last per #109). */}
            <HamburgerMenuItem
              label={t("menu.about", locale)}
              href="https://pueblofoodproject.org/about/"
              isExternal={true}
              icon={<ExternalLink size={14} />}
              ariaLabel={externalAriaLabel("menu.about")}
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
        </div>
      )}
    </div>
  );
}
