"use client";

/**
 * CategoryDropdown — empty-query category browse list (#95).
 *
 * Renders when the search bar is focused and the query is empty.
 * Shows all 7 venue categories with:
 *   - Color swatch
 *   - Localized category label
 *   - Total venue count (over all venues, not filtered)
 *
 * A11y:
 *   - role="listbox" on the container
 *   - role="option" on each row
 *   - aria-selected on the active filter row
 *   - aria-label on the container
 *
 * The active filter persists after the dropdown closes (until chip × or re-click).
 */

import { useRef } from "react";
import { categoryColors } from "@/data/venues";
import { t, type Locale } from "@/lib/i18n";
import type { VenueCategory } from "@/types/venue";

// Ordered list — matches existing legend order
export const BROWSE_CATEGORIES: VenueCategory[] = [
  "pantry",
  "grocery",
  "convenience",
  "farm",
  "garden",
  "edible_landscape",
  "meal_site",
];

interface CategoryDropdownProps {
  /** Counts per category (over all venues). */
  counts: Partial<Record<VenueCategory, number>>;
  /** Currently active category filter (null = none). */
  activeCategory: VenueCategory | null;
  /** Called when a category row is clicked. Passes null if toggling off. */
  onSelect: (cat: VenueCategory | null) => void;
  /**
   * Called when mousedown fires inside the dropdown (allows parent to cancel
   * the grace-period close on the search input's blur handler).
   */
  onMouseDown?: (e: React.MouseEvent) => void;
  locale?: Locale;
}

const LISTBOX_ID = "category-browse-listbox";

export default function CategoryDropdown({
  counts,
  activeCategory,
  onSelect,
  onMouseDown,
  locale = "en",
}: CategoryDropdownProps) {
  const listboxRef = useRef<HTMLDivElement>(null);

  return (
    <div
      id={LISTBOX_ID}
      ref={listboxRef}
      role="listbox"
      aria-label={t("search.aria", locale)}
      onMouseDown={onMouseDown}
      className={
        // Same anchor as SearchResultsPopover — positioned relative to MapWrapper root
        "absolute left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[520px] " +
        // Position below search bar (matches SearchResultsPopover)
        "top-[72px] md:top-[84px] " +
        "z-[999] " +
        "bg-[var(--color-bone-50)] " +
        "border border-[var(--color-bone-200)] " +
        "rounded-[var(--radius-lg)] " +
        "elevation-2 " +
        "overflow-hidden " +
        "py-1"
      }
    >
        {BROWSE_CATEGORIES.map((cat) => {
          const active = activeCategory === cat;
          const count = counts[cat] ?? 0;
          const label = t(`category.full.${cat}`, locale);
          return (
            <div
              key={cat}
              role="option"
              aria-selected={active}
              onClick={() => onSelect(active ? null : cat)}
              className={
                "flex items-center gap-3 px-4 py-2.5 cursor-pointer " +
                "text-sm " +
                "transition-colors duration-100 " +
                (active
                  ? "bg-[var(--color-bone-200)] text-[var(--color-ink-900)]"
                  : "text-[var(--color-ink-800)] hover:bg-[var(--color-bone-100)]")
              }
            >
              {/* Color swatch */}
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  backgroundColor: categoryColors[cat],
                  flexShrink: 0,
                }}
              />
              {/* Label */}
              <span className="flex-1 font-medium">{label}</span>
              {/* Count */}
              <span className="text-[var(--color-ink-400)] text-xs tabular-nums">
                {count}
              </span>
            </div>
          );
        })}
    </div>
  );
}
