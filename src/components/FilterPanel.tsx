"use client";

/**
 * FilterPanel — left side panel behind the SearchBar's Filters button (#513).
 *
 * Replaces CategoryDropdown (the search-focus browse list): filters are no
 * longer tied to focusing the search box, and category selection is
 * multi-select (a Set) instead of one-at-a-time. Mockup: Kyle picked option C
 * (side panel, checklist) — "Search Filters Redesign - Mockups.html" — with
 * the panel sliding from the LEFT (Atlas's call: the button that opens it
 * replaced the magnifier on the left of the search bar, so the panel opens
 * from the same side it's summoned from).
 *
 * Controlled component — every filter value and every mutation is a prop.
 * MapWrapper's useMapFilters pipeline is the single source of truth, so
 * checking a box here applies the filter immediately (map updates live,
 * visible beside the dimmed panel) rather than staging a draft to "apply" on
 * close. "Show N places" therefore only closes the panel; it doesn't commit
 * anything that wasn't already committed.
 *
 * Close paths (issue #513): ×, Escape, tapping the dimmed map, swipe left.
 * Focus trap + body-scroll-lock while open reuse the same recipe as
 * HamburgerMenu.tsx (the app's other full-height overlay panel) — see that
 * file's comments for the reasoning behind each piece.
 */

import { useCallback, useEffect, useRef } from "react";
import { X, Clock, CreditCard, Apple } from "lucide-react";
import { categoryColors } from "@/data/venues";
import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";
import { useOverlayEscape, useOverlayRegistration, useScrollLock } from "@/lib/overlayRegistry";
import type { VenueCategory } from "@/types/venue";

// Same order the old CategoryDropdown's BROWSE_CATEGORIES used (legend order,
// blessing_box last — the 8th category, Blessing Boxes slice 1).
const CATEGORIES: VenueCategory[] = [
  "pantry",
  "grocery",
  "convenience",
  "farm",
  "garden",
  "edible_landscape",
  "meal_site",
  "blessing_box",
];

const TITLE_ID = "filter-panel-title";
// Horizontal drag distance (px) that counts as a deliberate swipe-left, not
// an incidental brush of the panel — matches the touch-target/gesture
// tolerances used elsewhere in this app's mobile review passes.
const SWIPE_CLOSE_THRESHOLD_PX = 50;
// All focusable elements inside the panel for the Tab trap — same selector
// shape as HamburgerMenu.tsx's FOCUSABLE, narrowed to what this panel
// actually renders (buttons incl. role="switch", and the category checkboxes).
const FOCUSABLE = 'button:not([disabled]), input[type="checkbox"]';

interface FilterPanelProps {
  open: boolean;
  onClose: () => void;
  locale?: Locale;
  /** Live count of venues matching the CURRENT filter state — "Show N places". */
  resultCount: number;

  filterOpenNow: boolean;
  onToggleOpenNow: () => void;
  openNowCount?: number;
  filterSnap: boolean;
  onToggleSnap: () => void;
  snapCount?: number;
  filterWic: boolean;
  onToggleWic: () => void;
  wicCount?: number;

  /** Multi-select category filter — null/empty means "no category filter." */
  selectedCategories: Set<VenueCategory> | null;
  onToggleCategory: (cat: VenueCategory) => void;

  /** "Clear all" — categories + the three switches only, never the search query. */
  onClearAll: () => void;
}

/** One "Show only" toggle row: label (+ optional count) and a switch control. */
function SwitchRow({
  icon,
  label,
  count,
  checked,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-2.5">
      {icon}
      <span className="flex-1 text-sm font-medium text-[var(--color-ink-800)]">{label}</span>
      {count !== undefined && (
        <span className="text-[var(--color-ink-400)] text-xs tabular-nums">{count}</span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onClick}
        className={
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150 " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
          (checked ? "bg-[var(--color-sage-600)]" : "bg-[var(--color-bone-300)]")
        }
      >
        <span
          aria-hidden
          className={
            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-150 " +
            (checked ? "translate-x-[18px]" : "translate-x-0.5")
          }
        />
      </button>
    </div>
  );
}

export default function FilterPanel({
  open,
  onClose,
  locale: localeProp,
  resultCount,
  filterOpenNow,
  onToggleOpenNow,
  openNowCount,
  filterSnap,
  onToggleSnap,
  snapCount,
  filterWic,
  onToggleWic,
  wicCount,
  selectedCategories,
  onToggleCategory,
  onClearAll,
}: FilterPanelProps) {
  const { locale: ctxLocale } = useLocale();
  const locale = localeProp ?? ctxLocale;

  // #542: full-height 85vw side panel with a full-screen dimmed backdrop at
  // EVERY width (no desktop-narrower variant, unlike HamburgerMenu below) —
  // always hides BottomNav while open.
  useOverlayRegistration(open);

  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  const close = useCallback(() => {
    onClose();
    returnFocusRef.current?.focus();
  }, [onClose]);

  // ── Escape closes (#527: only when this panel is the TOPMOST overlay —
  // see overlayRegistry.ts's own header) ───────────────────────────────────
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault();
      close();
    },
    [close],
  );
  useOverlayEscape(open, handleEscape);

  // ── Focus trap + initial focus + body scroll lock ────────────────────────────
  // Recipe mirrors HamburgerMenu.tsx (see its own comments for the "why" of
  // each step) — this app's other full-height overlay panel.
  useEffect(() => {
    if (!open || !panelRef.current) return;

    // Unlike HamburgerMenu.tsx's own version of this capture (#545), no
    // `!== document.body` guard is needed here: this panel's opener (the
    // Filters button in SearchBar) is never unmounted while the panel is
    // open — nothing hides SearchBar the way #542 hides BottomNav for the
    // mobile Menu — so `document.activeElement` can't have already reset to
    // `<body>` by the time this effect runs.
    if (document.activeElement instanceof HTMLElement) {
      returnFocusRef.current = document.activeElement;
    }
    const firstFocusable = panelRef.current.querySelector<HTMLElement>(FOCUSABLE);
    firstFocusable?.focus();

    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

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
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [open]);

  // #527: shared, ref-counted with every other overlay that wants the lock
  // (see overlayRegistry.ts's own header) — replaces this panel's own
  // set/reset, which used to unlock scroll on close even while HamburgerMenu
  // was still open and wanted it locked too.
  useScrollLock(open);

  // ── Swipe left to close (issue #513) ─────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  }, []);
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const startX = touchStartXRef.current;
      touchStartXRef.current = null;
      const endX = e.changedTouches[0]?.clientX;
      if (startX === null || endX === undefined) return;
      if (startX - endX >= SWIPE_CLOSE_THRESHOLD_PX) close();
    },
    [close],
  );

  if (!open) return null;

  return (
    <>
      <div
        data-testid="filter-panel-backdrop"
        aria-hidden="true"
        onClick={close}
        style={{ position: "fixed", inset: 0, backgroundColor: "rgba(26,24,23,0.4)", zIndex: 1004 }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex flex-col bg-[var(--color-bone-50)]"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: "85vw",
          maxWidth: "360px",
          zIndex: 1005,
          boxShadow: "4px 0 32px rgba(0,0,0,0.22)",
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
        }}
      >
        {/* Header — title, Clear all (top, per #513), × close */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--color-bone-200)]">
          <h2 id={TITLE_ID} className="flex-1 text-base font-semibold text-[var(--color-ink-800)]">
            {t("filters.panel.title", locale)}
          </h2>
          <button
            type="button"
            onClick={onClearAll}
            className={
              "text-sm font-semibold text-[var(--color-sage-600)] hover:text-[var(--color-sage-700)] " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] rounded " +
              PRESS_FEEDBACK
            }
          >
            {t("filters.panel.clearAll", locale)}
          </button>
          <button
            type="button"
            aria-label={t("filters.panel.close", locale)}
            onClick={close}
            className={
              "flex items-center justify-center w-11 h-11 -m-1.5 rounded-full " +
              "text-[var(--color-ink-500)] hover:bg-[var(--color-bone-100)] hover:text-[var(--color-ink-800)] " +
              PRESS_FEEDBACK + " " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
              "transition-colors duration-100"
            }
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        {/* Scrollable middle — Show only switches, Kind of place checkboxes */}
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">
            {t("filters.panel.showOnly", locale)}
          </div>
          <SwitchRow
            icon={<Clock aria-hidden size={14} className="text-[var(--color-ink-500)] shrink-0" />}
            label={t("filter.openNow", locale)}
            count={openNowCount}
            checked={filterOpenNow}
            onClick={onToggleOpenNow}
          />
          <SwitchRow
            icon={<CreditCard aria-hidden size={14} className="text-[var(--color-ink-500)] shrink-0" />}
            label={t("filter.snap", locale)}
            count={snapCount}
            checked={filterSnap}
            onClick={onToggleSnap}
          />
          <SwitchRow
            icon={<Apple aria-hidden size={14} className="text-[var(--color-ink-500)] shrink-0" />}
            label={t("filter.wic", locale)}
            count={wicCount}
            checked={filterWic}
            onClick={onToggleWic}
          />

          <div className="border-t border-[var(--color-bone-200)] mx-5 my-2" aria-hidden="true" />

          <div className="px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">
            {t("filters.panel.kindOfPlace", locale)}
          </div>
          {CATEGORIES.map((cat) => {
            const checked = selectedCategories?.has(cat) ?? false;
            return (
              <label
                key={cat}
                className={
                  "flex items-center gap-3 px-5 py-2.5 cursor-pointer text-sm font-medium " +
                  "text-[var(--color-ink-800)] hover:bg-[var(--color-bone-100)] transition-colors duration-100"
                }
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleCategory(cat)}
                  className={
                    "h-4 w-4 rounded border-[var(--color-bone-300)] text-[var(--color-sage-600)] " +
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
                  }
                />
                <span
                  aria-hidden="true"
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: categoryColors[cat] }}
                />
                <span>{t(`category.full.${cat}`, locale)}</span>
              </label>
            );
          })}
        </div>

        {/* Footer — orange live-count "Show N places" (closes the panel) */}
        <div className="px-5 py-3 border-t border-[var(--color-bone-200)]">
          <button
            type="button"
            onClick={close}
            className={
              "w-full h-11 rounded-[var(--radius-md)] font-semibold text-sm " +
              // #529: --color-orange/--color-navy don't exist — DESIGN.md's
              // orange exception is --color-brand-orange/--color-brand-navy.
              "bg-[var(--color-brand-orange)] text-[var(--color-brand-navy)] " +
              "hover:brightness-105 active:brightness-95 " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-brand-orange)]"
            }
          >
            {t("filters.panel.showResults", locale, { count: String(resultCount) })}
          </button>
        </div>
      </div>
    </>
  );
}
