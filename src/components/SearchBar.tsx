"use client";

/**
 * SearchBar — v2 floating search bar, positioned absolute above the map.
 *
 * Spec: docs/pueblo-food-map-v2-handoff.md §Mobile·375×812·map(located)
 * and §Desktop·1440×900·map(located)
 *
 * - Floats above the Mapbox GL map canvas and controls (z-index 1000).
 * - Near-full-width on mobile (16px margins each side).
 * - ~520px centered on desktop (≥768px).
 * - Controlled: value/onChange/onSubmit wired by PR 6 (MapWrapper).
 *
 * ARIA combobox pattern (issue #67):
 * - role="combobox" on the input; aria-expanded/aria-controls/aria-activedescendant
 *   are controlled by parent (MapWrapper) and passed as comboboxProps.
 * - onFocus / onBlur / onKeyDown for popover lifecycle are also passed by parent.
 *
 * Inline Map/List view switch (#191) — REMOVED by #514: the bar itself now
 * carries nothing on the right. Switching views goes through the search
 * bar's own suggestion row (ViewSuggestion, shown on an empty focused bar,
 * or the last row of SearchResultsPopover once the user types) or a Menu
 * line — see MapWrapper.tsx and HamburgerMenu.tsx.
 *
 * Filters button (#513, moved to the right edge by #528) — a round button at
 * the RIGHT end of the bar when the `filtersButton` prop is passed (MapWrapper
 * always passes it). Originally sat in the magnifier's spot on the left, but
 * that collided with the placeholder text on a phone (#528) — the right end
 * was free once the Map/List view switch that used to live there was removed
 * by #514, and a button there can never overlap typed text. Replaces the old
 * `filterChip` (a variable-width category-name chip) entirely: filters now
 * live behind their own panel, so the bar only ever shows a small round icon
 * button + an orange count badge, never a label. The magnifier is always
 * shown now (previously hidden when filtersButton occupied its spot) so the
 * bar still reads as a search box with the button gone from that side.
 *
 * Icon is a hand-drawn inline SVG (three bars of decreasing width) matching
 * the approved mockup (atlas-kb "Search Filters Redesign - Button Placement",
 * symbol #f) — not lucide's SlidersHorizontal, which Kyle rejected (#528).
 */

import { useCallback } from "react";
import { Search } from "lucide-react";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";

/**
 * Filters icon — three horizontal bars of decreasing width, per the approved
 * mockup's `<symbol id="f">` (path unchanged from that source, not lucide's
 * SlidersHorizontal). Inline rather than a dependency (#528: "do not add a
 * dependency" for one icon).
 */
function FilterIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

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
   * When set, renders a round Filters button at the right end of the bar
   * (#528 — was the magnifier's spot on the left until it collided with the
   * placeholder text). Plain when count is 0; green with an orange count
   * badge when filters are active (#513). `ariaLabel` is built by the caller
   * via i18n (t("filters.button.label"/"filters.button.labelActive")) — same
   * pattern as the input's own `ariaLabel` prop — so this component stays
   * locale-agnostic. Absent for standalone use (e.g. a11y.test.tsx renders
   * SearchBar bare with no filters concept at all) — the magnifier shows
   * either way now.
   */
  filtersButton?: {
    count: number;
    onClick: () => void;
    ariaLabel: string;
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
  filtersButton,
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
      // top clears the notch/Dynamic Island; side gutter lives on the inner div below.
      className="absolute top-[max(1rem,env(safe-area-inset-top))] left-0 right-0 flex justify-center"
      style={{ zIndex: 1000, pointerEvents: "none" }}
      aria-hidden={false}
    >
      <div
        // mx-4 gutter, safe-area-aware for the landscape notch.
        className="relative w-full ml-[max(1rem,env(safe-area-inset-left))] mr-[max(1rem,env(safe-area-inset-right))] md:ml-0 md:mr-0 md:w-[520px]"
        style={{ pointerEvents: "auto" }}
      >
        {/* Search icon — 16×16 mobile, 18×18 desktop. Always shown (#528):
            the Filters button no longer sits here, so nothing hides it. */}
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

        {/* Filters button (#513, right-anchored by #528) — the RIGHT end of
            the bar, where the removed Map/List view switch used to live.
            Plain (bone/ink) when no filters are on; sage-filled with an
            orange count badge when count > 0. One fixed size at every width
            (unlike ViewToggle, the mockups show no icon/word distinction for
            this control). */}
        {filtersButton && (
          <button
            type="button"
            onClick={filtersButton.onClick}
            aria-label={filtersButton.ariaLabel}
            className={
              "absolute right-1.5 top-1/2 -translate-y-1/2 " +
              "flex items-center justify-center w-8 h-8 rounded-full border " +
              "transition-colors duration-100 " +
              PRESS_FEEDBACK + " " +
              "focus-visible:outline-none focus-visible:ring-2 " +
              "focus-visible:ring-[var(--color-sage-500)] " +
              (filtersButton.count > 0
                ? "bg-[var(--color-sage-600)] border-[var(--color-sage-600)] text-white"
                : "bg-[var(--color-bone-50)] border-[var(--color-bone-300)] text-[var(--color-ink-500)]")
            }
          >
            <FilterIcon size={16} />
            {filtersButton.count > 0 && (
              <span
                aria-hidden
                className={
                  // Badge hangs toward the CENTER of the bar (-left-1), not
                  // the outer edge (-right-1 would push it past the button's
                  // right edge into the pill's rounded corner and clip —
                  // #528's risk note). Mirrors the original left-anchored
                  // button, whose badge also hung inward (-right-1 there,
                  // toward the input, away from that side's outer curve).
                  "absolute -top-1 -left-1 min-w-[16px] h-4 px-0.5 rounded-full " +
                  "bg-[var(--color-brand-orange)] text-[var(--color-brand-navy)] " +
                  "text-[10px] font-bold leading-4 text-center " +
                  "border-2 border-[var(--color-bone-50)]"
                }
              >
                {filtersButton.count}
              </span>
            )}
          </button>
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
          enterKeyHint="search"
          {...comboboxAttrs}
          className={
            "w-full h-11 md:h-[52px] " +
            // Left reservation is now fixed regardless of filtersButton
            // (#528) — the magnifier is always shown, unlike before when the
            // Filters button replaced it in this spot.
            "pl-9 md:pl-10 " +
            // Filters button reserves a fixed 44px (32px button + right-1.5
            // inset + a little slack) on the RIGHT at every width (#528,
            // moved from the left where it collided with the placeholder
            // text) — unlike the removed filterChip, its size never varies
            // with content or breakpoint. No reservation when absent: the
            // inline Map/List view switch (#191) that used to live here was
            // removed by #514, so the bar ends in plain typing room.
            (filtersButton ? "pr-11 " : "pr-4 ") +
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
