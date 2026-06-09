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
import { Menu, X, ExternalLink, RotateCcw, MessageSquare, MapPinPlus } from "lucide-react";
import HamburgerMenuItem from "./HamburgerMenuItem";
import LanguageToggle from "./LanguageToggle";
import { t, type Locale } from "@/lib/i18n";

interface HamburgerMenuProps {
  locale?: Locale;
  /**
   * Called when the user clicks "Show welcome screen" (#99).
   * Re-shows the splash WITHOUT clearing localStorage.
   */
  onShowWelcome?: () => void;
}

// All focusable elements inside the panel for tab-trap.
const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function HamburgerMenu({ locale = "en", onShowWelcome }: HamburgerMenuProps) {
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
      {open && (
        <div
          id="hamburger-panel"
          ref={panelRef}
          role="menu"
          aria-label={menuLabel}
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
          <ul role="none" className="py-2">
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
            {/* About Pueblo Food Project (#96) — moved to the bottom of the nav
                links per #124; sits above the language control (kept last per #109). */}
            <HamburgerMenuItem
              label={t("menu.about", locale)}
              href="https://pueblofoodproject.org/about/"
              isExternal={true}
              icon={<ExternalLink size={14} />}
              ariaLabel={`${t("menu.about", locale)} (opens in new tab)`}
            />
            {/* Language toggle (#109) — last item; label + inline EN/ES control */}
            <li
              role="menuitem"
              className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-bone-200)]"
            >
              <span className="text-sm font-medium text-[var(--color-ink-800)]">
                {t("menu.language", locale)}
              </span>
              <LanguageToggle />
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
