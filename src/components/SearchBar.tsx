"use client";

/**
 * SearchBar — v2 floating search bar, positioned absolute above the map.
 *
 * Spec: docs/pueblo-food-map-v2-handoff.md §Mobile·375×812·map(located)
 * and §Desktop·1440×900·map(located)
 *
 * - Floats above Leaflet tiles (z-index 1000 — Leaflet uses 200–800).
 * - Near-full-width on mobile (16px margins each side).
 * - ~520px centered on desktop (≥768px).
 * - Controlled: value/onChange/onSubmit wired by PR 6 (MapWrapper).
 *
 * ARIA combobox pattern (issue #67):
 * - role="combobox" on the input; aria-expanded/aria-controls/aria-activedescendant
 *   are controlled by parent (MapWrapper) and passed as comboboxProps.
 * - onFocus / onBlur / onKeyDown for popover lifecycle are also passed by parent.
 */

import { useCallback } from "react";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  /** Controlled value — owned by MapWrapper. */
  value: string;
  onChange: (next: string) => void;
  /** Called when the user presses Enter to commit the current query. */
  onSubmit?: () => void;
  placeholder?: string;
  /** aria-label text for the search input. */
  ariaLabel?: string;

  // ── Combobox / typeahead wiring (issue #67) ──────────────────────────────
  /** When true, renders role="combobox" with ARIA expansion attrs on the input. */
  comboboxEnabled?: boolean;
  /** aria-expanded — true when the results popover is open. */
  comboboxExpanded?: boolean;
  /** aria-controls — id of the results listbox element. */
  comboboxControls?: string;
  /** aria-activedescendant — id of the currently highlighted option. */
  comboboxActiveDescendant?: string;
  /** Focus handler — parent uses this to open the popover. */
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  /** Blur handler — parent uses this to schedule closing the popover. */
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  /**
   * Additional keydown handler — parent handles ArrowUp / ArrowDown / Escape.
   * This is called BEFORE the internal Enter handler so parent can intercept.
   */
  onKeyDownExtra?: (e: React.KeyboardEvent<HTMLInputElement>) => void;

  // ── Category filter chip (#95) ──────��─────────────────────────────────────
  /**
   * When set, renders a removable chip inside the search bar to the left of
   * the placeholder, indicating an active category filter.
   */
  filterChip?: {
    label: string;
    /** aria-label for the × button. */
    clearAriaLabel?: string;
    onClear: () => void;
  };
}

export default function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = "Search venues or categories",
  ariaLabel = "Search venues or categories",
  comboboxEnabled = false,
  comboboxExpanded = false,
  comboboxControls,
  comboboxActiveDescendant,
  onFocus,
  onBlur,
  onKeyDownExtra,
  filterChip,
}: SearchBarProps) {
  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Let parent handle arrow keys, Escape, and Enter-on-highlighted-option first.
      onKeyDownExtra?.(e);
      // If parent already prevented default (e.g. selected via Enter), skip submit.
      if (e.defaultPrevented) return;
      if (e.key === "Enter") {
        e.currentTarget.blur();
        onSubmit?.();
      }
    },
    [onSubmit, onKeyDownExtra],
  );

  // Build combobox ARIA attrs only when the feature is enabled.
  const comboboxAttrs = comboboxEnabled
    ? {
        role: "combobox" as const,
        "aria-expanded": comboboxExpanded,
        "aria-controls": comboboxControls,
        "aria-haspopup": "listbox" as const,
        "aria-autocomplete": "list" as const,
        "aria-activedescendant": comboboxActiveDescendant ?? undefined,
        autoComplete: "off",
      }
    : {};

  return (
    <div
      className="absolute top-4 left-0 right-0 flex justify-center"
      style={{ zIndex: 1000, pointerEvents: "none" }}
      aria-hidden={false}
    >
      <div
        className="relative w-full mx-4 md:mx-0 md:w-[520px]"
        style={{ pointerEvents: "auto" }}
      >
        {/* Search icon — 16×16 mobile, 18×18 desktop. Hidden when chip is active. */}
        {!filterChip && (
          <>
            <Search
              size={16}
              className={
                "absolute left-3 top-1/2 -translate-y-1/2 " +
                "text-[var(--color-ink-400)] pointer-events-none " +
                "md:hidden"
              }
              aria-hidden
            />
            <Search
              size={18}
              className={
                "hidden absolute left-3.5 top-1/2 -translate-y-1/2 " +
                "text-[var(--color-ink-400)] pointer-events-none " +
                "md:block"
              }
              aria-hidden
            />
          </>
        )}

        {/* Active category filter chip — rendered inside the search bar (#95) */}
        {filterChip && (
          <div
            className={
              "absolute left-3 top-1/2 -translate-y-1/2 " +
              "flex items-center gap-1 " +
              "bg-[var(--color-sage-100,#e8f1ed)] " +
              "text-[var(--color-sage-700,#2d6e52)] " +
              "text-xs font-semibold " +
              "rounded-full px-2 py-0.5 " +
              "max-w-[40%]"
            }
          >
            <span className="truncate">{filterChip.label}</span>
            <button
              type="button"
              aria-label={filterChip.clearAriaLabel ?? `Clear filter: ${filterChip.label}`}
              onClick={(e) => {
                e.stopPropagation();
                filterChip.onClear();
              }}
              className={
                "flex-shrink-0 flex items-center justify-center " +
                "rounded-full w-3.5 h-3.5 " +
                "hover:bg-[var(--color-sage-200,#d0e4da)] " +
                "transition-colors duration-100 " +
                "focus-visible:outline-none focus-visible:ring-1 " +
                "focus-visible:ring-[var(--color-sage-500)]"
              }
            >
              <X size={10} aria-hidden />
            </button>
          </div>
        )}

        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          aria-label={ariaLabel}
          {...comboboxAttrs}
          className={
            "w-full h-11 md:h-[52px] " +
            (filterChip ? "pl-[calc(40%+8px)] " : "pl-9 md:pl-10 ") +
            "pr-4 " +
            "text-base md:text-sm text-[var(--color-ink-700)] " +
            "bg-[var(--color-bone-50)] " +
            "border border-[var(--color-bone-300)] " +
            "rounded-[var(--radius-full)] " +
            "placeholder:text-[var(--color-ink-400)] " +
            "transition-[border-color,box-shadow] duration-150 " +
            "focus:outline-none " +
            "focus:border-[var(--color-sage-500)] " +
            "focus:ring-2 focus:ring-[rgba(74,132,102,0.15)] " +
            "elevation-1"
          }
        />
      </div>
    </div>
  );
}
