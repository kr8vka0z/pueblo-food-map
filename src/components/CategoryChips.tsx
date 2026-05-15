"use client";

import type { VenueCategory } from "@/types/venue";
import { categoryColors } from "@/data/venues";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

const ALL_CATEGORIES: VenueCategory[] = [
  "pantry",
  "grocery",
  "convenience",
  "farm",
  "garden",
  "edible_landscape",
  "meal_site",
];

interface CategoryChipsProps {
  selected: Set<VenueCategory> | null; // null = "All"
  counts: Partial<Record<VenueCategory, number>>;
  totalCount: number;
  onToggle: (cat: VenueCategory | null) => void;
  locale?: Locale;
}

export default function CategoryChips({
  selected,
  counts,
  totalCount,
  onToggle,
  locale = "en",
}: CategoryChipsProps) {
  const isAll = selected === null || selected.size === 0;

  return (
    <div className="relative">
      {/* Scrollable chip row */}
      <div
        className="flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar"
        role="group"
        aria-label="Filter by category"
      >
        {/* "All" chip */}
        <button
          type="button"
          onClick={() => onToggle(null)}
          aria-pressed={isAll}
          className={
            "shrink-0 flex items-center gap-1.5 px-3 h-9 rounded-full " +
            "text-sm font-medium transition-colors duration-150 " +
            (isAll
              ? "bg-[var(--color-ink-700)] text-[var(--color-bone-50)]"
              : "bg-[var(--color-bone-100)] text-[var(--color-ink-700)] hover:bg-[var(--color-bone-200)]") +
            " focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
          }
        >
          {t("category.all", locale)} · {totalCount}
        </button>

        {ALL_CATEGORIES.map((cat) => {
          const isSelected = selected !== null && selected.has(cat);
          const color = categoryColors[cat];
          const count = counts[cat] ?? 0;
          if (count === 0) return null;

          return (
            <button
              key={cat}
              type="button"
              onClick={() => onToggle(cat)}
              aria-pressed={isSelected}
              className={
                "shrink-0 flex items-center gap-1.5 px-3 h-9 rounded-full " +
                "text-sm font-medium transition-colors duration-150 " +
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
              }
              style={
                isSelected
                  ? {
                      backgroundColor: color,
                      color: "#FBFAF6",
                    }
                  : {
                      backgroundColor: "var(--color-bone-100)",
                      color: "var(--color-ink-700)",
                    }
              }
            >
              {/* Color dot when not selected */}
              {!isSelected && (
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
              )}
              {t(`category.${cat}`, locale)} · {count}
            </button>
          );
        })}
      </div>

      {/* Fade mask on right edge */}
      <div
        className="pointer-events-none absolute right-0 top-0 h-full w-8"
        style={{
          background:
            "linear-gradient(to right, transparent, var(--color-bone-50))",
        }}
        aria-hidden
      />
    </div>
  );
}
