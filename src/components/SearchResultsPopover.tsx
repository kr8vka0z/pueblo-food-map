"use client";

/**
 * SearchResultsPopover — live typeahead results dropdown anchored to the search bar.
 *
 * Issue #67: show matching venues while the user types, with full keyboard navigation
 * and ARIA combobox pattern.
 *
 * Design contract:
 *   - Visually identical anchor/border/shadow/typography to EmptySearchPopover.
 *   - Mutually exclusive with EmptySearchPopover — parent (MapWrapper) renders
 *     exactly one based on filteredVenues.length.
 *   - Controlled: open/close, activeIndex, and item selection are all driven by parent.
 *   - Cap: show MAX_VISIBLE rows in the scrollable list; "+N more matches" stub at bottom.
 *
 * ARIA combobox pattern:
 *   - role="combobox" + aria-expanded + aria-controls + aria-activedescendant live on the
 *     <input> in SearchBar (wired by parent via searchBarProps).
 *   - role="listbox" on results container; role="option" + aria-selected on each row.
 *   - Live region (role="status") announces match count on query change.
 *
 * Spec: GitHub issue #67
 */

import { useRef, useEffect } from "react";
import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import type { Venue, VenueCategory } from "@/types/venue";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum rows visible before we show "+N more" */
export const MAX_VISIBLE = 7;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Round distance to one decimal and format as "X.X mi". */
function formatDistance(miles: number): string {
  return `${miles.toFixed(1)} mi`;
}

/** Stable DOM id for a listbox option row. */
export function optionId(listboxId: string, index: number): string {
  return `${listboxId}-option-${index}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VenueWithDistance extends Venue {
  distanceMiles: number;
}

export interface SearchResultsPopoverProps {
  /** The list of matching venues, pre-filtered + sorted by distance. */
  venues: VenueWithDistance[];
  /** Currently keyboard-highlighted row index (0-based). -1 = none. */
  activeIndex: number;
  /** Unique id for the listbox element; the search input's aria-controls targets this. */
  listboxId: string;
  /** Called when the user selects a venue (click or Enter). */
  onSelect: (venueId: string) => void;
  /** Called when the popover should close (e.g. blur outside). */
  onClose: () => void;
  locale?: Locale;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SearchResultsPopover({
  venues,
  activeIndex,
  listboxId,
  onSelect,
  onClose,
  locale: localeProp,
}: SearchResultsPopoverProps) {
  const { locale: ctxLocale } = useLocale();
  const locale = localeProp ?? ctxLocale;
  const listRef = useRef<HTMLUListElement>(null);

  // Scroll active item into view when activeIndex changes via keyboard.
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[id="${optionId(listboxId, activeIndex)}"]`,
    );
    el?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, listboxId]);

  const visibleVenues = venues.slice(0, MAX_VISIBLE);
  const hiddenCount = venues.length - visibleVenues.length;

  // Count for live region — total match count (not visible cap).
  const matchCountText = t("typeahead.matchCount", locale, {
    count: String(venues.length),
  });

  return (
    <div
      className={
        // Identical anchor to EmptySearchPopover
        "absolute left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[520px] " +
        // Position below search bar: 44px bar height + 16px gap mobile; 52px + 16px desktop
        "top-[72px] md:top-[84px] " +
        "z-[999] " +
        // Visual — identical to EmptySearchPopover
        "bg-[var(--color-bone-50)] " +
        "rounded-[var(--radius-lg)] " +
        "elevation-2 " +
        "border border-[var(--color-bone-200)]"
      }
    >
      {/* Live region — announces total match count to screen readers on query change */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {matchCountText}
      </div>

      {/* Results list */}
      <ul
        ref={listRef}
        id={listboxId}
        role="listbox"
        aria-label={matchCountText}
        className="max-h-[calc(7*52px)] overflow-y-auto py-1 rounded-[var(--radius-lg)]"
      >
        {visibleVenues.map((venue, i) => {
          const isActive = i === activeIndex;
          const categoryLabel = t(`category.full.${venue.category as VenueCategory}`, locale);

          return (
            <li
              key={venue.id}
              id={optionId(listboxId, i)}
              role="option"
              aria-selected={isActive}
              // Prevent blur from firing before click processes
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(venue.id);
                onClose();
              }}
              className={
                "flex items-center gap-3 px-4 h-[52px] cursor-pointer " +
                "transition-colors duration-100 " +
                (isActive
                  ? "bg-[var(--color-sage-50,#f0f7f3)]"
                  : "hover:bg-[var(--color-bone-100)]")
              }
            >
              {/* Primary: venue name */}
              <span className="flex-1 min-w-0">
                <span
                  className={
                    "block truncate text-sm font-medium " +
                    "text-[var(--color-ink-700)]"
                  }
                >
                  {venue.name}
                </span>
                <span
                  className={
                    "block truncate text-xs " +
                    "text-[var(--color-ink-400)]"
                  }
                >
                  {categoryLabel}
                </span>
              </span>

              {/* Distance */}
              <span
                className={
                  "shrink-0 text-xs tabular-nums " +
                  "text-[var(--color-ink-400)]"
                }
                aria-label={`${formatDistance(venue.distanceMiles)} away`}
              >
                {formatDistance(venue.distanceMiles)}
              </span>
            </li>
          );
        })}
      </ul>

      {/* "+N more matches" footer — shown when results exceed MAX_VISIBLE */}
      {hiddenCount > 0 && (
        <p
          className={
            "px-4 py-2 text-xs text-center " +
            "text-[var(--color-ink-400)] " +
            "border-t border-[var(--color-bone-200)]"
          }
          aria-live="off"
        >
          {t("typeahead.moreMatches", locale, { count: String(hiddenCount) })}
        </p>
      )}
    </div>
  );
}
