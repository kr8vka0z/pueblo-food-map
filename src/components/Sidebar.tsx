"use client";

/**
 * Sidebar — used on tablet (360px) and within the desktop list column (380px).
 * Shows category chips, then a scrollable venue list.
 * On tablet it's the left panel; on desktop it's the middle column, with
 * the filter rail in a separate leftmost column.
 */

import type { Venue } from "@/types/venue";
import type { VenueCategory } from "@/types/venue";
import VenueCard from "./VenueCard";
import CategoryChips from "./CategoryChips";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

interface SidebarProps {
  venues: Array<Venue & { distanceMiles?: number }>;
  selectedVenueId: string | null;
  selectedCategories: Set<VenueCategory> | null;
  categoryCounts: Partial<Record<VenueCategory, number>>;
  totalCount: number;
  onSelectVenue: (id: string) => void;
  onToggleCategory: (cat: VenueCategory | null) => void;
  locationStatus: "loading" | "granted" | "denied" | "unavailable" | "fallback";
  locale?: Locale;
  /** On tablet, also shows filter chips (no dedicated rail). On desktop, chips
   *  are not shown here because the CategoryRail handles it. */
  showCategoryChips?: boolean;
}

export default function Sidebar({
  venues,
  selectedVenueId,
  selectedCategories,
  categoryCounts,
  totalCount,
  onSelectVenue,
  onToggleCategory,
  locationStatus,
  locale = "en",
  showCategoryChips = true,
}: SidebarProps) {
  const sortedByLabel = locationStatus === "granted"
    ? t("location.granted", locale)
    : t("location.fallback", locale);

  return (
    <aside
      className="flex flex-col h-full border-r border-[var(--color-bone-200)] bg-[var(--color-bone-50)]"
      aria-label="Venue list"
    >
      {/* Header row */}
      <div className="px-4 py-2.5 border-b border-[var(--color-bone-200)]">
        <h2 className="text-sm font-semibold text-[var(--color-ink-700)]">
          {t("sheet.places", locale, { count: String(venues.length) })}
        </h2>
        <p className="text-xs text-[var(--color-ink-400)] mt-0.5">{sortedByLabel}</p>
      </div>

      {/* Category chips — optional (tablet shows them, desktop relies on rail) */}
      {showCategoryChips && (
        <div className="py-2 border-b border-[var(--color-bone-200)]">
          <CategoryChips
            selected={selectedCategories}
            counts={categoryCounts}
            totalCount={totalCount}
            onToggle={onToggleCategory}
            locale={locale}
          />
        </div>
      )}

      {/* Venue list */}
      <ul
        className="flex-1 overflow-y-auto divide-y divide-[var(--color-bone-200)]"
        aria-label="Filtered venues"
      >
        {venues.map((v) => (
          <VenueCard
            key={v.id}
            venue={v}
            isSelected={v.id === selectedVenueId}
            onClick={() => onSelectVenue(v.id)}
            locale={locale}
          />
        ))}
      </ul>
    </aside>
  );
}
