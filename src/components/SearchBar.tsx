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
 * Filters control (#539, mockup C — supersedes #513/#528/#529's round
 * bordered button with an orange badge overlapping its corner) — lives
 * INSIDE the bar at the right end when the `filtersButton` prop is passed
 * (MapWrapper always passes it), not as a separate button floating on top of
 * it: no background, no border, just the icon plus a 1px hairline divider on
 * its left so it still reads as part of the bar. Kyle, 2026-09-20: "put the
 * icon for the filters just into the search bar instead of it appearing like
 * a different button" — the old badge overlapping the icon's corner "looks
 * like shit." Filters on: the icon turns sage-600 and an orange/navy count
 * pill appears BESIDE the icon (normal flow, not absolutely overlapping it)
 * — nothing overlaps anything. The magnifier is always shown at the left
 * (previously hidden when a control occupied its spot) so the bar still
 * reads as a search box regardless of the right-end control's state.
 *
 * Icon is a hand-drawn inline SVG (three bars of decreasing width) matching
 * the approved mockup (atlas-kb "Search Filters Redesign - Button Placement",
 * symbol #f, and Filters-In-Bar-Mockup.html's `.c-filter`/`.c-count`) — not
 * lucide's SlidersHorizontal, which Kyle rejected (#528).
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
   * When set, renders an icon-only Filters control at the right end of the
   * bar (#539 mockup C — see this file's own header). ink-500 icon at rest;
   * sage-600 icon + a beside-icon orange count pill when filters are active
   * (#513). `ariaLabel` is built by the caller via i18n
   * (t("filters.button.label"/"filters.button.labelActive")) — same pattern
   * as the input's own `ariaLabel` prop — so this component stays
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
  placeholder = "Search places or categories",
  ariaLabel = "Search places or categories",
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

        {/* Filters control (#539, mockup C) — icon-only, no background, no
            border, so it reads as part of the bar rather than a separate
            button. `.c-filter` in Filters-In-Bar-Mockup.html is the
            geometry reference: 10px left / 14px right padding around a
            20px icon, gap-1.5 (6px) before the count pill, height 44px
            fixed at every width (unlike ViewToggle, the mockups show no
            icon/word distinction for this control). With no count, the
            control's own box is already exactly 44px wide (10+20+14) — no
            separate invisible hit-area box is needed the way #532's
            32px-circle-in-a-44px-button pattern required, since there is no
            visible circle left to keep small. */}
        {filtersButton && (
          <button
            type="button"
            onClick={filtersButton.onClick}
            aria-label={filtersButton.ariaLabel}
            className={
              "absolute right-0 top-1/2 -translate-y-1/2 " +
              "flex items-center gap-1.5 h-11 pl-2.5 pr-3.5 " +
              // #233: invisible 2px-all-round overlay takes the 44×44 box to
              // the 48×48 floor without moving the icon or the divider.
              "before:absolute before:-inset-0.5 " +
              PRESS_FEEDBACK + " " +
              "focus-visible:outline-none focus-visible:ring-2 " +
              "focus-visible:ring-[var(--color-sage-500)] " +
              (filtersButton.count > 0
                ? "text-[var(--color-sage-600)]"
                : "text-[var(--color-ink-500)]")
            }
          >
            {/* Hairline divider — 1px, bone-200, inset 12px top/bottom
                (`.c-filter::before` in the mockup). Absolutely positioned
                against this <button> (already the containing block via the
                `absolute` above), so it always tracks the control, not the
                bar's own edge. */}
            <span
              aria-hidden
              className="absolute left-0 top-[12px] bottom-[12px] w-px bg-[var(--color-bone-200)]"
            />
            <FilterIcon size={20} />
            {filtersButton.count > 0 && (
              <span
                aria-hidden
                className={
                  // Beside the icon in normal flow (the gap-1.5 above), never
                  // absolutely overlapping it — #539 fixes #529's badge that
                  // hung over the icon's corner ("looks like shit," Kyle).
                  "flex items-center justify-center min-w-[19px] h-[19px] px-[5px] rounded-full " +
                  "bg-[var(--color-brand-orange)] text-[var(--color-brand-navy)] " +
                  "text-[11px] font-bold leading-none"
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
            // 48px on phones — DESIGN.md's low-end-device touch floor (#233);
            // an <input> can't carry a ::before overlay, so the bar itself grew.
            "w-full h-12 md:h-[52px] " +
            // Left reservation is now fixed regardless of filtersButton
            // (#528) — the magnifier is always shown, unlike before when the
            // Filters button replaced it in this spot.
            "pl-9 md:pl-10 " +
            // Filters control reserves a FIXED width on the right sized for
            // its WIDEST state (count pill present) — #539's plan requires
            // this stay constant regardless of the current count, so typed
            // text never reflows when a filter is toggled on/off. Math:
            // 10px pad + 20px icon + 6px gap + 14px pad = 50px fixed, plus
            // the count pill itself. Max real count is 11 (8 FilterPanel
            // categories + 3 switches, MapWrapper.tsx ~900-904), so the
            // pill must fit 2 digits — the button isn't width-clamped, so
            // an undersized reservation lets a 2-digit pill lap the last
            // typed character (review finding on #539's first pass: 76px
            // left only 0-2px of slack). Budget the pill generously at
            // ~28px (not just its 19px min-width) for real margin: 50 + 28
            // = 78px, rounded up to 84px. No reservation when absent: the
            // inline Map/List view switch (#191) that used to live here
            // was removed by #514, so the bar ends in plain typing room.
            (filtersButton ? "pr-[84px] " : "pr-4 ") +
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
