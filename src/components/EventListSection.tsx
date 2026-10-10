"use client";

/**
 * EventListSection — the special events at the top of the list view (#761,
 * umbrella #156): going-on-now first, then soonest, INCLUDING events more
 * than 7 days out (the map pins stop at a week; this list is where those wait).
 *
 * WHY it is its own component with its own useMinuteClock subscription: the
 * rows must drop an event the minute it ends and flip "Starts in 2 hours" to
 * "Happening now" with no reload, and doing that here keeps the shared tick
 * from re-rendering ListView or MapWrapper. The clock is the same one shared by
 * the pins and the card (one timer for the page).
 *
 * Wording and Pueblo-time formatting are not re-implemented: the countdown is
 * eventBadge and the hours are eventWhen (eventCard.ts), the same lines the
 * card shows. Renders nothing when there is nothing to list, except when the
 * Events filter is on, where "No events coming up" explains the empty screen.
 */

import { Star } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { listOrder } from "@/lib/eventPins";
import { eventBadge, eventWhen, localizeEvent } from "@/lib/eventCard";
import type { PublicEvent } from "@/lib/events";
import { useMinuteClock } from "@/lib/useMinuteClock";

interface EventListSectionProps {
  events: readonly PublicEvent[];
  locale: Locale;
  onSelectEvent: (id: string) => void;
  /** The Events filter is on: show the empty state instead of nothing. */
  showEmpty?: boolean;
}

export default function EventListSection({ events, locale, onSelectEvent, showEmpty = false }: EventListSectionProps) {
  const now = useMinuteClock();
  const items = listOrder(events, now);

  if (items.length === 0) {
    return showEmpty ? (
      <p data-testid="events-empty" className="px-6 pt-16 text-center text-base text-[var(--color-ink-500)]">{t("events.list.empty", locale)}</p>
    ) : null;
  }

  return (
    <section aria-labelledby="event-list-heading" data-testid="event-list" className="pb-2">
      <h2 id="event-list-heading" className="px-4 pt-1 pb-2 text-xs text-[var(--color-ink-400)]">
        {t("events.list.heading", locale)} · {items.length}
      </h2>
      <ul className="divide-y divide-[var(--color-bone-200)]">
        {items.map(({ event, live }) => {
          const { name } = localizeEvent(event, locale);
          const badge = eventBadge(event, now, locale);
          return (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => onSelectEvent(event.id)}
                data-testid={`event-row-${event.id}`}
                className="w-full min-h-16 flex items-start gap-3 px-4 py-3 text-left hover:bg-[var(--color-bone-100)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-sage-500)]"
              >
                {/* The owner-approved event colors (DESIGN.md): the orange disc with a navy star. */}
                <span
                  aria-hidden
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-event-pin)] text-[var(--color-event-outline)]"
                >
                  <Star size={15} fill="currentColor" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-[var(--color-ink-900)]">{name}</span>
                  <span className={`block text-xs ${live ? "font-semibold text-[var(--color-ink-700)]" : "text-[var(--color-ink-500)]"}`}>
                    {badge.text} · {eventWhen(event, locale).time}
                  </span>
                  <span className="block truncate text-xs text-[var(--color-ink-500)]">{event.address}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
