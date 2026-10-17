"use client";

/**
 * EventsEmptyNotice — the map's answer to "Events filter on, nothing to show"
 * (#761): the same "No events coming up" the list view says, as a small
 * non-blocking pill in the bottom safe zone (the spot the outside-county pill
 * uses, above the Mapbox credits and the bottom nav), with a button that turns
 * the filter off. WHY: with the filter on every place pin is hidden, so once
 * the last event ends the visitor would otherwise face an empty map and only
 * a badge on Filters to explain it.
 *
 * It owns a useMinuteClock subscription (the one shared timer) so it appears on
 * the tick the last event ends, without MapWrapper re-rendering each minute.
 */

import { t, type Locale } from "@/lib/i18n";
import { listOrder } from "@/lib/eventPins";
import type { PublicEvent } from "@/lib/events";
import { useMinuteClock } from "@/lib/useMinuteClock";

interface EventsEmptyNoticeProps {
  events: readonly PublicEvent[];
  locale: Locale;
  onShowPlaces: () => void;
  /** CSS `bottom` value, same math as MapWrapper's outside-county pill. */
  bottom: string | number;
}

export default function EventsEmptyNotice({ events, locale, onShowPlaces, bottom }: EventsEmptyNoticeProps) {
  const now = useMinuteClock();
  if (listOrder(events, now).length > 0) return null;
  return (
    <div
      role="status"
      data-testid="events-empty-notice"
      style={{ position: "absolute", bottom, left: "50%", transform: "translateX(-50%)", zIndex: 1001, whiteSpace: "nowrap" }}
      className="flex items-center gap-1 pl-4 pr-1 rounded-full bg-[var(--color-bone-50)] text-[var(--color-ink-700)] text-sm font-medium elevation-2"
    >
      <span>{t("events.list.empty", locale)}</span>
      <button
        type="button"
        onClick={onShowPlaces}
        data-testid="events-empty-show-places"
        className="min-h-12 px-3 text-sm font-semibold text-[var(--color-sage-600)] hover:text-[var(--color-sage-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] rounded-full"
      >
        {t("events.list.emptyAction", locale)}
      </button>
    </div>
  );
}
