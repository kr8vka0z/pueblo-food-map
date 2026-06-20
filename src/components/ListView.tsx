"use client";

import type { ReactNode } from "react";
import type { Venue } from "@/types/venue";
import { t, type Locale } from "@/lib/i18n";
import VenueCard from "@/components/VenueCard";

interface ListViewProps {
  venues: Array<Venue & { distanceMiles?: number }>;
  selectedVenueId: string | null;
  onSelect: (id: string) => void;
  onClearFilters?: () => void;
  showClearFilters?: boolean;
  locale?: Locale;
  /** Optional notice banner rendered below the floating chrome spacer, above the scroll container. */
  notice?: ReactNode;
}

export default function ListView({
  venues,
  selectedVenueId,
  onSelect,
  onClearFilters,
  showClearFilters = false,
  locale = "en",
  notice,
}: ListViewProps) {
  return (
    <div className="absolute inset-0 z-[700] flex flex-col bg-[var(--color-bone-50)] overflow-hidden">
      {/* Spacer clears the floating SearchBar + ViewToggle that sit above the list */}
      <div className="shrink-0 h-[116px]" aria-hidden />
      {notice ? <div className="shrink-0">{notice}</div> : null}
      <div className="flex-1 overflow-y-auto overscroll-contain pb-6">
        {venues.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 pt-16 text-center">
            <p className="text-base text-[var(--color-ink-500)]">{t("empty.title", locale)}</p>
            {showClearFilters && onClearFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="px-4 h-10 rounded-[var(--radius-md)] bg-[var(--color-sage-500)] text-[var(--color-bone-50)] text-sm font-semibold hover:bg-[var(--color-sage-600)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2"
              >
                {t("empty.clear", locale)}
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="px-4 pt-1 pb-2 text-xs text-[var(--color-ink-400)]">
              {t("sheet.places", locale, { count: String(venues.length) })} · {t("sheet.sortedBy", locale)}
            </p>
            <ul className="divide-y divide-[var(--color-bone-200)]">
              {venues.map((v) => (
                <VenueCard
                  key={v.id}
                  venue={v}
                  isSelected={v.id === selectedVenueId}
                  onClick={() => onSelect(v.id)}
                  locale={locale}
                  headingLevel={3}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
