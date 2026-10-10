"use client";

/**
 * EventStrip — the "happening today" strip under the search bar (#761,
 * umbrella #156): a navy bar with an orange star that names the event going on
 * now (else the next one to start today), opens its card when tapped, offers
 * "and N more" when several events are on today, and can be closed for the
 * rest of the Pueblo day.
 *
 * Placement (DESIGN.md "Safe zones"): absolutely positioned exactly like
 * SearchBar's wrapper (same gutters, same desktop width, same `rightInset`),
 * directly below it, so it never enters layout flow and cannot move the map or
 * jump when it arrives after the events fetch. z-700 on purpose: above the map,
 * below the venue card (800) so a tall open card wins the overlap, and below
 * the search popovers (999) that drop into this same strip of screen.
 *
 * WHY it owns the minute clock (useMinuteClock): the strip appears, changes and
 * disappears on the shared once-a-minute tick, and keeping the tick here
 * re-renders only this small component, never the 120 KB MapWrapper. There is
 * no aria-live region on purpose: the text changes quietly every minute and a
 * screen reader should not announce it; it reads the strip when it reaches it.
 *
 * The three controls (open event, "and N more", close) are siblings, never
 * nested, each at the 48px touch floor.
 */

import { useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { clock, denverDayKey, stripAt } from "@/lib/eventPins";
import { eventWhen, localizeEvent } from "@/lib/eventCard";
import type { PublicEvent } from "@/lib/events";
import { dismissEvent, readEventDismissals, type EventDismissals } from "@/lib/eventStripDismissals";
import { useMinuteClock } from "@/lib/useMinuteClock";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";

// Same five-point star the map pin carries (EventMarker.tsx), inlined so this
// first-screen component does not pull the lazily loaded map chunk in.
const STAR_POINTS =
  "12,5.6 13.12,8.46 16.19,8.64 13.81,10.59 14.59,13.56 12,11.9 9.41,13.56 10.19,10.59 7.82,8.64 10.88,8.46";

interface EventStripProps {
  events: readonly PublicEvent[];
  locale: Locale;
  /** Opens the event's card, exactly like tapping its pin. */
  onOpen: (id: string) => void;
  /** "and N more": opens the events list. */
  onMore: () => void;
  /** Desktop side panel clearance, same value SearchBar takes. */
  rightInset?: number;
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-event-pin)]";

export default function EventStrip({ events, locale, onOpen, onMore, rightInset = 0 }: EventStripProps) {
  const now = useMinuteClock();
  // Read once on mount: the strip only mounts after the feed has arrived, on
  // the client, so there is no server render for this to disagree with.
  const [dismissals, setDismissals] = useState<EventDismissals>(readEventDismissals);
  const day = denverDayKey(now);
  const pick = stripAt(events, now, (id) => dismissals[id] === day);
  if (!pick) return null;

  const { pin, more } = pick;
  const { name } = localizeEvent(pin.event, locale);
  const status = pin.live
    ? t("events.strip.liveUntil", locale, { time: clock(pin.event.ends_at, locale) })
    : t("events.strip.today", locale, { time: eventWhen(pin.event, locale).time });

  return (
    <div
      // Below the 48px search bar plus an 8px gap; side gutters mirror SearchBar.
      className="absolute top-[calc(max(1rem,env(safe-area-inset-top))+56px)] left-0 right-0 flex justify-center transition-[padding] duration-300"
      style={{ zIndex: 700, pointerEvents: "none", paddingRight: rightInset }}
    >
      <div
        className="w-full ml-[max(1rem,env(safe-area-inset-left))] mr-[max(1rem,env(safe-area-inset-right))] md:ml-0 md:mr-0 md:w-[520px] flex items-stretch h-12 rounded-[var(--radius-md)] bg-[var(--color-event-outline)] text-white elevation-2 overflow-hidden"
        style={{ pointerEvents: "auto" }}
      >
        <button
          type="button"
          onClick={() => onOpen(pin.event.id)}
          className={`flex-1 min-w-0 flex items-center gap-2 pl-2.5 pr-1 text-left ${PRESS_FEEDBACK} ${FOCUS}`}
        >
          <svg width="20" height="20" viewBox="6 3.6 12 12" aria-hidden="true" className="shrink-0">
            <polygon points={STAR_POINTS} fill="var(--color-event-pin)" />
          </svg>
          <span className="flex-1 min-w-0 flex flex-col leading-tight">
            <span className="truncate text-[11px] font-semibold text-[var(--color-event-pin)]">{status}</span>
            <span className="truncate text-sm font-semibold">{name}</span>
          </span>
          {more === 0 && <ChevronRight size={18} aria-hidden className="shrink-0 text-white/80" />}
        </button>
        {more > 0 && (
          <button
            type="button"
            onClick={onMore}
            aria-label={t("events.strip.moreAria", locale, { count: String(more) })}
            className={`shrink-0 px-2 border-l border-white/20 text-[11px] font-semibold underline underline-offset-2 ${PRESS_FEEDBACK} ${FOCUS}`}
          >
            {t("events.strip.more", locale, { count: String(more) })}
          </button>
        )}
        <button
          type="button"
          onClick={() => setDismissals((cur) => dismissEvent(cur, pin.event.id, day))}
          aria-label={t("events.strip.dismissAria", locale, { name })}
          className={`shrink-0 w-12 flex items-center justify-center text-white/80 ${PRESS_FEEDBACK} ${FOCUS}`}
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
