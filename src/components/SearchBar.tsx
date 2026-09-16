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
 * Inline Map/List view switch (#191) — optional `viewSwitch` prop renders a
 * ViewToggle at the pill's right end, mirroring `filterChip`'s left anchor.
 * See that prop's own comment for why it lives here instead of a new
 * floating control.
 */

import { useCallback } from "react";
import { Search, X } from "lucide-react";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";
import ViewToggle, { type ViewMode } from "./ViewToggle";
import type { Locale } from "@/lib/i18n";

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

  // ── Inline Map/List view switch (#191) ───────────────────────────────────
  /**
   * When set, renders the Map/List ViewToggle inside the search pill's right
   * end, mirroring how filterChip anchors to the left. WHY here and not a
   * new floating control: the issue owner's explicit instruction was "build
   * it into the search bar" so the switch doesn't add a new element to an
   * already-busy mobile screen — SearchBar is the one control already
   * visible in BOTH map and list view (unlike LocateButton or the map-only
   * banners), so it's reachable from wherever the user actually is.
   */
  viewSwitch?: {
    mode: ViewMode;
    onChange: (mode: ViewMode) => void;
    locale?: Locale;
    /** Renders the "map" side disabled when the map cannot mount (#165). */
    mapDisabled?: boolean;
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
  viewSwitch,
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

        {/* Active category filter chip — rendered inside the search bar (#95).
            max-w shrinks from 40% to 26% when the view switch (#191) also
            occupies the right end — on a 375px phone that's the difference
            between a category chip that can crowd out the view switch and
            one that still leaves the input a usable typing field. */}
        {filterChip && (
          <div
            className={
              "absolute left-3 top-1/2 -translate-y-1/2 " +
              "flex items-center gap-1 " +
              "bg-[var(--color-sage-100,#e8f1ed)] " +
              "text-[var(--color-sage-700,#2d6e52)] " +
              "text-xs font-semibold " +
              "rounded-full px-2 py-0.5 " +
              (viewSwitch ? "max-w-[26%]" : "max-w-[40%]")
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
                // Visible icon (X size=10) is unchanged — the button's own box grows
                // from 14px to 26px and a matching negative margin cancels the growth
                // for layout purposes, so the icon renders at the exact same spot
                // (mobile review #7: 14x14 was under the 24px WCAG floor).
                "rounded-full w-[26px] h-[26px] -m-[6px] " +
                "hover:bg-[var(--color-sage-200,#d0e4da)] " +
                "transition-colors duration-100 " +
                PRESS_FEEDBACK + " " +
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
          enterKeyHint="search"
          {...comboboxAttrs}
          className={
            "w-full h-11 md:h-[52px] " +
            (filterChip
              ? viewSwitch
                ? "pl-[calc(26%+8px)] "
                : "pl-[calc(40%+8px)] "
              : "pl-9 md:pl-10 ") +
            // pr reserves room for the inline view switch (#191). ONE value at
            // every width (docs/bottom-nav-spec.md §4.2) — the switch is the
            // same control at the same 6px inset everywhere now.
            // MEASURED, not computed (the last two bugs here were arithmetic
            // that rendered wrong): on dev at 1280 the toggle's bounding box
            // is 131.8px EN "Map/List", 145.1px ES "Mapa/Lista". 145 + 6px
            // inset + 8px slack = 160px.
            // With a chip showing under 400px the toggle goes icon-only
            // (§4.3); measured the same way at 375 (EN and ES alike, no
            // words): 78px + 6 + 8 = 92px, leaving 154px to type in.
            (viewSwitch
              ? filterChip
                ? "pr-[160px] max-[400px]:pr-[92px] "
                : "pr-[160px] "
              : "pr-4 ") +
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

        {/* Inline Map/List view switch (#191) — right end of the pill,
            mirroring filterChip's left anchor. size="md" renders a real 36px
            button height (see ViewToggle.tsx's own WHY on the 38px outer
            constant) rather than ViewToggle's default 28px: a prior mobile
            review set a 36×36 CSS px tap-target floor for controls on this
            bar (see the filterChip × button above), and 28px undershoots
            that here too. The 38px outer control sits with a ~3px inset
            inside the 44px mobile / 52px desktop pill. Width reserved on the
            <input> above is measured off the rendered control, not computed.

            Flush since 2026-09-16 (Kyle: "no gap… it just needs to look like a
            part of the search bar"): the switch fills the pill's right end,
            1px in so the pill's border wraps it, with no border or inset of
            its own (size="flush"). This supersedes the 38px/~3px-inset note
            above; the buttons are now 42px / 50px tall. */}
        {viewSwitch && (
          <div className="absolute top-px bottom-px right-px">
            <ViewToggle
              mode={viewSwitch.mode}
              onChange={viewSwitch.onChange}
              locale={viewSwitch.locale}
              mapDisabled={viewSwitch.mapDisabled}
              size="flush"
              collapseLabelsNarrow={Boolean(filterChip)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
