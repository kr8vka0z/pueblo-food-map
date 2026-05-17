"use client";

/**
 * EmptySearchPopover — shown when a search query has no venue matches.
 *
 * Spec: docs/pueblo-food-map-v2-handoff.md
 *   §Mobile·375×812·empty search
 *   §Desktop·1440×900·empty search
 *
 * Positioning:
 *   - Absolute, directly below the search bar (top: 72px mobile / 84px desktop).
 *   - Matches search bar width: full-width with 16px margins on mobile,
 *     520px centered on desktop (≥768px).
 *   - elevation-2 shadow.
 *
 * Accessibility:
 *   - role="status" so screen readers announce the empty-result message.
 *   - Each chip is a <button aria-label="Show <category> venues">.
 */

import { CATEGORY_OPTIONS } from "@/lib/searchVenues";
import { categoryColors } from "@/data/venues";

interface EmptySearchPopoverProps {
  query: string;
  /** Called when a chip is clicked. Receives the readable category label. */
  onSelectCategory: (label: string) => void;
}

export default function EmptySearchPopover({
  query,
  onSelectCategory,
}: EmptySearchPopoverProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={
        // Base layout — matches SearchBar positioning logic
        "absolute left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[520px] " +
        // Position below search bar: 44px bar height + 16px gap on mobile;
        // 52px bar height + 16px gap on desktop.
        "top-[72px] md:top-[84px] " +
        "z-[999] " +
        // Visual
        "bg-[var(--color-bone-50)] " +
        "rounded-[var(--radius-lg)] " +
        "elevation-2 " +
        "px-4 py-4 " +
        "border border-[var(--color-bone-200)]"
      }
    >
      {/* Title */}
      <p className="text-sm font-semibold text-[var(--color-ink-700)] mb-1">
        No matches for &ldquo;{query}&rdquo;
      </p>

      {/* Subtitle */}
      <p className="text-xs text-[var(--color-ink-400)] mb-3">
        Try a category instead:
      </p>

      {/* Category chip grid */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_OPTIONS.map(({ key, label }) => {
          const color = categoryColors[key];
          return (
            <button
              key={key}
              type="button"
              aria-label={`Show ${label} venues`}
              onClick={() => onSelectCategory(label)}
              className={
                "flex items-center gap-1.5 px-3 h-8 " +
                "rounded-[var(--radius-full)] " +
                "text-xs font-medium " +
                "bg-[var(--color-bone-100)] text-[var(--color-ink-700)] " +
                "hover:bg-[var(--color-bone-200)] " +
                "transition-colors duration-150 " +
                "focus-visible:outline-none focus-visible:ring-2 " +
                "focus-visible:ring-[var(--color-sage-500)]"
              }
            >
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
