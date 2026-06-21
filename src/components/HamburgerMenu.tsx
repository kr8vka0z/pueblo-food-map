"use client";

/**
 * HamburgerMenu — top-right overlay menu for map-level actions.
 *
 * Desktop (≥768px): ~280px dropdown anchored below the trigger button.
 * Mobile (<768px): full-height slide-in side sheet from the right, ~80% viewport width.
 *
 * Behavior:
 *   - Toggle open/closed via the hamburger button.
 *   - Close on: X-button click, outside-click/tap, Escape key.
 *   - Focus trap inside the panel while open.
 *   - Focus returns to the hamburger button on close.
 *
 * A11y:
 *   - Button: aria-expanded, aria-haspopup="menu", aria-controls panel id.
 *   - Panel: role="menu", aria-label from i18n "menu.open".
 *   - Menu items: role="menuitem" (delegated to HamburgerMenuItem).
 *   - Mobile backdrop: aria-hidden="true" (decorative overlay).
 *
 * v1 items: "Suggest a venue" → /suggest
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Menu, X, ExternalLink, RotateCcw, MessageSquare, MapPinPlus, Phone } from "lucide-react";
import HamburgerMenuItem from "./HamburgerMenuItem";
import LanguageToggle from "./LanguageToggle";
import ViewToggle, { type ViewMode } from "./ViewToggle";
import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
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
  /** Current map/list view mode (#view-toggle-in-menu). */
  viewMode?: ViewMode;
  /** Called when the user picks a view mode from the menu. */
  onViewModeChange?: (mode: ViewMode) => void;
}

// All focusable elements inside the panel for tab-trap.
const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function HamburgerMenu({ locale: localeProp, onShowWelcome, savedVenues = [], onSelectVenue, viewMode, onViewModeChange }: HamburgerMenuProps) {
  const { locale: ctxLocale } = useLocale();
  const locale = localeProp ?? ctxLocale;
  const [open, setOpen] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Open / close helpers ────────────────────────────────────────────────────

  const close = useCallback(() => {
    setOpen(false);
    // Return focus to the hamburger button
    triggerRef.current?.focus();
  }, []);

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

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
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, close]);

  // ── Focus trap inside the panel ─────────────────────────────────────────────

  useEffect(() => {
    if (!open || !panelRef.current) return;

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

  // isMobile: detect <768px breakpoint client-side (SSR-safe initial false)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    const syncId = setTimeout(() => setIsMobile(mql.matches), 0);
    return () => {
      clearTimeout(syncId);
      mql.removeEventListener("change", handler);
    };
  }, []);

  const menuLabel = t("menu.open", locale);
  const closeLabel = t("menu.close", locale);
  /**
   * External menu links open a new tab; screen readers need that called out in the active locale.
   * Compose label and suffix once so each item stays aligned with i18n keys.
   */
  const externalAriaLabel = (labelKey: string) =>
    `${t(labelKey, locale)} ${t("menu.opensInNewTab", locale)}`;

  // Panel positioning style: fixed side-sheet on mobile, absolute dropdown on desktop
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
      }
    : {
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        width: "280px",
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
        top: "16px",
        right: "16px",
        zIndex: 1002,
      }}
    >
      {/* Hamburger trigger button */}
      <button
        ref={triggerRef}
        type="button"
        aria-label={menuLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="hamburger-panel"
        onClick={toggle}
        className={
          "flex items-center justify-center " +
          "w-11 h-11 md:w-[52px] md:h-[52px] " +
          "rounded-full " +
          "bg-[var(--color-brand-navy)] " +
          "transition-[background-color,opacity] duration-150 " +
          "hover:opacity-90 active:scale-95 " +
          "focus-visible:outline-none focus-visible:ring-2 " +
          "focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
          "elevation-2"
        }
      >
        <Menu
          size={18}
          className="md:hidden"
          style={{ color: "#ffffff" }}
          aria-hidden
        />
        <Menu
          size={22}
          className="hidden md:block"
          style={{ color: "#ffffff" }}
          aria-hidden
        />
      </button>

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
          contains only menuitem-role elements, so role="menu" belongs there.
          aria-controls on the trigger still points to the outer panel id so
          focus management and AT can locate the panel. */}
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
                "flex items-center justify-center w-8 h-8 rounded-full " +
                "text-[var(--color-ink-500)] " +
                "hover:bg-[var(--color-bone-100)] hover:text-[var(--color-ink-800)] " +
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
            {/* View mode (Map | List) — moved here from a floating control */}
            {/* WHY role="none": this row contains a composite widget (ViewToggle),
                not a simple menuitem. role="menuitem" must be on the interactive
                element, not a container. Using role="none" avoids aria-required-children. */}
            {viewMode && onViewModeChange && (
              <li
                role="none"
                className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-bone-200)]"
              >
                <span className="text-sm font-medium text-[var(--color-ink-800)]">
                  {t("menu.view", locale)}
                </span>
                <ViewToggle
                  mode={viewMode}
                  locale={locale}
                  onChange={(m) => {
                    onViewModeChange(m);
                    close();
                  }}
                />
              </li>
            )}
            {/* Saved places (#132) — favorited venues; tap to open on the map */}
            {savedVenues.length > 0 && (
              <>
                <li role="presentation" className="pt-1">
                  <p className="px-5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">
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

            {/* Get help — curated external assistance resources (#131) */}
            <li
              role="presentation"
              className="mt-1 border-t border-[var(--color-bone-200)] pt-2"
            >
              <p className="px-5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">
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
