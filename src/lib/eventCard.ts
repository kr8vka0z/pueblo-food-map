/**
 * eventCard.ts — the pure logic behind the special-event card (#759, umbrella
 * #156): which stage an event is in, what the countdown badge says, the
 * English/Spanish text choice, and the Pueblo-time "when" lines.
 *
 * WHY pure and clock-as-argument: the card re-renders off the map's shared
 * once-a-minute tick (src/lib/useMinuteClock.ts), and the badge wording at
 * the minute/hour/day edges is the easiest thing here to get wrong, so it
 * lives where a test can pass any `nowMs`. Like eventPins.ts, every instant
 * is absolute UTC and every label is formatted in America/Denver, never the
 * phone's own timezone.
 */

import { t, type Locale } from "@/lib/i18n";
import { TIME_ZONE, puebloParts } from "@/lib/eventTime";
import { EVENT_PIN_WINDOW_DAYS, clock } from "@/lib/eventPins";
import type { PublicEvent, PublicEventDetail } from "@/lib/events";

const MS_PER_MIN = 60_000;
const MIN_PER_HOUR = 60;
const MIN_PER_DAY = 1440;

/** Where an event is on its timeline (a cancelled event is decided by its status, not its clock). */
export type EventPhase = "upcoming" | "live" | "ended";

export interface EventBadge {
  phase: EventPhase;
  text: string;
}

/** Spanish text when the page is Spanish and that column is non-blank, otherwise English. */
export function eventText(en: string | null | undefined, es: string | null | undefined, locale: Locale): string {
  const spanish = locale === "es" ? es?.trim() : "";
  return spanish || en?.trim() || "";
}

export interface LocalizedEvent {
  name: string;
  host: string;
  description: string;
  whatToBring: string;
  cancelNote: string;
}

/** Every text field of an event in the page's language (blank string when absent). */
export function localizeEvent(event: PublicEvent | PublicEventDetail, locale: Locale): LocalizedEvent {
  const note = "cancel_note" in event ? event : null;
  return {
    name: eventText(event.name, event.name_es, locale),
    host: eventText(event.host, event.host_es, locale),
    description: eventText(event.description, event.description_es, locale),
    whatToBring: eventText(event.what_to_bring, event.what_to_bring_es, locale),
    cancelNote: eventText(note?.cancel_note, note?.cancel_note_es, locale),
  };
}

/**
 * Whole minutes left, rounded UP so the badge never shows "0 min" while time
 * remains, then bucketed: under an hour -> minutes, under a day -> whole
 * hours, otherwise whole days. Rounding up first means 59m30s reads
 * "1 hour", not "59 min" followed a tick later by "1 hour" anyway.
 */
function countdownParts(remainingMs: number): { n: number; unit: "min" | "hour" | "day" } {
  const minutes = Math.ceil(remainingMs / MS_PER_MIN);
  if (minutes < MIN_PER_HOUR) return { n: minutes, unit: "min" };
  if (minutes < MIN_PER_DAY) return { n: Math.floor(minutes / MIN_PER_HOUR), unit: "hour" };
  return { n: Math.floor(minutes / MIN_PER_DAY), unit: "day" };
}

function countdownText(prefix: "startsIn" | "endsIn", remainingMs: number, locale: Locale): string {
  const { n, unit } = countdownParts(remainingMs);
  const form = n === 1 ? "one" : "other";
  return t(`events.card.${prefix}.${unit}.${form}`, locale, { n: String(n) });
}

const startsOnFormatters = new Map<Locale, Intl.DateTimeFormat>();
function startsOn(startMs: number, locale: Locale): string {
  let f = startsOnFormatters.get(locale);
  if (!f) {
    f = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
      timeZone: TIME_ZONE,
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    startsOnFormatters.set(locale, f);
  }
  return t("events.card.startsOn", locale, { date: f.format(startMs) });
}

/**
 * The stage and the badge text at `nowMs`. Live is `start <= now < end`, the
 * same comparison the pins use, so the pin and the card never disagree. An
 * event more than a week out reads "Starts Sat, Nov 21" (the lifecycle
 * table's wording) instead of a day count. An unparseable date reads as ended:
 * the card then offers no directions to a time nobody can state.
 */
export function eventBadge(
  event: Pick<PublicEvent, "starts_at" | "ends_at">,
  nowMs: number,
  locale: Locale,
): EventBadge {
  const start = Date.parse(event.starts_at);
  const end = Date.parse(event.ends_at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || nowMs >= end) {
    return { phase: "ended", text: t("events.card.ended", locale) };
  }
  if (nowMs >= start) {
    return { phase: "live", text: t("events.card.liveEndsIn", locale, { remaining: countdownText("endsIn", end - nowMs, locale) }) };
  }
  if (start - nowMs > EVENT_PIN_WINDOW_DAYS * MIN_PER_DAY * MS_PER_MIN) {
    return { phase: "upcoming", text: startsOn(start, locale) };
  }
  return { phase: "upcoming", text: countdownText("startsIn", start - nowMs, locale) };
}

const dayFormatters = new Map<Locale, Intl.DateTimeFormat>();
function dayLabel(ms: number, locale: Locale): string {
  let f = dayFormatters.get(locale);
  if (!f) {
    f = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
      timeZone: TIME_ZONE,
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    dayFormatters.set(locale, f);
  }
  return f.format(ms);
}

function sameDenverDay(aMs: number, bMs: number): boolean {
  const a = puebloParts(aMs);
  const b = puebloParts(bMs);
  return a.y === b.y && a.mo === b.mo && a.d === b.d;
}

/**
 * The When lines in Pueblo time: `day` ("Saturday, November 21") and `time`
 * ("10 AM – 2 PM"). When the event runs past midnight the end carries its own
 * day so "10 PM – 2 AM" can't be misread as ending before it starts.
 */
export function eventWhen(
  event: Pick<PublicEvent, "starts_at" | "ends_at">,
  locale: Locale,
): { day: string; time: string } {
  const start = Date.parse(event.starts_at);
  const end = Date.parse(event.ends_at);
  const range = `${clock(event.starts_at, locale)} – ${clock(event.ends_at, locale)}`;
  return {
    day: dayLabel(start, locale),
    time: sameDenverDay(start, end) ? range : `${range} (${dayLabel(end, locale)})`,
  };
}
