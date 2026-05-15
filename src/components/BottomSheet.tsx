"use client";

/**
 * BottomSheet — mobile-only draggable sheet with 3 snap points:
 *   peek (~140px) → half (~50vh) → full (~100vh − 100px)
 *
 * Uses vaul (Drawer.Root) which ships built-in snap-point support,
 * spring physics, and reduced-motion awareness.
 */

import { Drawer } from "vaul";
import type { Venue } from "@/types/venue";
import VenueCard from "./VenueCard";
import VenueDetail from "./VenueDetail";
import CategoryChips from "./CategoryChips";
import EmptyState from "./EmptyState";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type { VenueCategory } from "@/types/venue";

// Snap points expressed as fractions of total viewport or as pixel values.
// vaul accepts numbers between 0 and 1 (fraction of viewport height)
// and also plain pixel strings via CSS custom properties.
// We use fractions here; "full" leaves ~100px of map showing (top bar).
const SNAP_POINTS = [0.18, 0.5, 0.87] as const;

interface BottomSheetProps {
  venues: Array<Venue & { distanceMiles?: number }>;
  selectedVenueId: string | null;
  selectedCategories: Set<VenueCategory> | null;
  categoryCounts: Partial<Record<VenueCategory, number>>;
  totalCount: number;
  onSelectVenue: (id: string | null) => void;
  onToggleCategory: (cat: VenueCategory | null) => void;
  locale?: Locale;
  snap: (typeof SNAP_POINTS)[number];
  onSnapChange: (snap: (typeof SNAP_POINTS)[number]) => void;
  anyFilterActive?: boolean;
  onClearFilters?: () => void;
}

export default function BottomSheet({
  venues,
  selectedVenueId,
  selectedCategories,
  categoryCounts,
  totalCount,
  onSelectVenue,
  onToggleCategory,
  locale = "en",
  snap,
  onSnapChange,
  anyFilterActive = false,
  onClearFilters,
}: BottomSheetProps) {
  const selectedVenue = selectedVenueId
    ? venues.find((v) => v.id === selectedVenueId) ?? null
    : null;

  function handleSnapChange(s: string | number | null) {
    if (typeof s === "number" && SNAP_POINTS.includes(s as (typeof SNAP_POINTS)[number])) {
      onSnapChange(s as (typeof SNAP_POINTS)[number]);
    }
  }

  return (
    <Drawer.Root
      snapPoints={SNAP_POINTS as unknown as number[]}
      activeSnapPoint={snap}
      setActiveSnapPoint={handleSnapChange}
      open
      modal={false}
      // Vaul's snap-point CSS transition is suppressed by the global
      // @media (prefers-reduced-motion: reduce) block in globals.css,
      // which sets transition-duration: 0.01ms on all elements.
    >
      <Drawer.Portal>
        <Drawer.Content
          className={
            "fixed bottom-0 left-0 right-0 z-[800] flex flex-col " +
            "bg-[var(--color-bone-50)] " +
            "rounded-t-[var(--radius-xl)] " +
            "elevation-2 " +
            "focus:outline-none"
          }
          // vaul manages the height via data attributes; we add a max-height
          style={{ maxHeight: "calc(100dvh - 100px)" }}
          aria-label="Venue list panel"
        >
          {/* Drag handle */}
          <div
            className="flex-shrink-0 flex justify-center pt-3 pb-2"
            role="button"
            tabIndex={0}
            aria-label="Drag to expand or collapse panel"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                // Toggle between peek and half
                onSnapChange(snap === SNAP_POINTS[0] ? SNAP_POINTS[1] : SNAP_POINTS[0]);
              }
            }}
          >
            <div
              className="w-9 h-1 rounded-full bg-[var(--color-ink-400)] opacity-30"
              aria-hidden
            />
          </div>

          {/* Content: either venue detail or list */}
          {selectedVenue ? (
            <VenueDetail
              venue={selectedVenue}
              onClose={() => onSelectVenue(null)}
              onBack={() => onSelectVenue(null)}
              locale={locale}
            />
          ) : (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Count line */}
              <div className="flex items-center justify-between px-4 py-1.5">
                <h2 className="text-sm font-semibold text-[var(--color-ink-700)]">
                  {t("sheet.places", locale, { count: String(venues.length) })}
                </h2>
                {snap === SNAP_POINTS[0] && (
                  <button
                    type="button"
                    onClick={() => onSnapChange(SNAP_POINTS[1])}
                    className="text-sm font-medium text-[var(--color-sage-500)] hover:text-[var(--color-sage-600)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] rounded"
                  >
                    {t("sheet.viewList", locale)} →
                  </button>
                )}
              </div>

              {/* Category chips */}
              <div className="pb-2">
                <CategoryChips
                  selected={selectedCategories}
                  counts={categoryCounts}
                  totalCount={totalCount}
                  onToggle={onToggleCategory}
                  locale={locale}
                />
              </div>

              {/* Venue list — only visible when expanded */}
              {snap !== SNAP_POINTS[0] && (
                venues.length === 0 && anyFilterActive ? (
                  <div className="flex flex-1 items-center justify-center p-6">
                    <EmptyState locale={locale} onClearFilters={onClearFilters} />
                  </div>
                ) : (
                  <ul
                    className="flex-1 overflow-y-auto divide-y divide-[var(--color-bone-200)]"
                    aria-label="Filtered venues"
                  >
                    {venues.map((v) => (
                      <VenueCard
                        key={v.id}
                        venue={v}
                        isSelected={v.id === selectedVenueId}
                        onClick={() => {
                          onSelectVenue(v.id);
                          onSnapChange(SNAP_POINTS[2]);
                        }}
                        locale={locale}
                      />
                    ))}
                  </ul>
                )
              )}
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
