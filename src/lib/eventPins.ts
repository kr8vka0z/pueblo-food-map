/**
 * eventPins.ts — which special events get a star pin on the map, and what the
 * pin says (#758, umbrella #156).
 *
 * WHY absolute time and Pueblo labels: an event happens at one fixed moment in
 * Pueblo whatever the phone's own timezone says, so "is it live" compares UTC
 * instants and every label is formatted in America/Denver. This is deliberately
 * unlike place hours (src/lib/hours.ts), which use the phone's clock. The
 * Pueblo-time parts come from eventTime.ts (the admin form's helper) rather
 * than a second copy of the DST logic.
 *
 * Pure functions only (no React, no timers): the once-a-minute clock lives in
 * src/lib/useMinuteClock.ts and the pins in src/components/EventLayer.tsx.
 */

import { t, type Locale } from "@/lib/i18n";
import { TIME_ZONE, puebloParts } from "@/lib/eventTime";
import type { PublicEvent } from "@/lib/events";

/** Events starting further out than this stay off the map (the list view still shows them, #761). */
export const EVENT_PIN_WINDOW_DAYS = 7;
const EVENT_PIN_WINDOW_MS = EVENT_PIN_WINDOW_DAYS * 86_400_000;

/** Query parameter that carries the selected event in the URL (`/?event=<id>`). */
export const EVENT_PARAM = "event";

export interface EventPin {
  event: PublicEvent;
  /** Going on right now: starts_at <= now < ends_at. */
  live: boolean;
  /** Pueblo calendar day of the start equals Pueblo's today (drives the "Today" label). */
  today: boolean;
}

function sameDenverDay(aMs: number, bMs: number): boolean {
  const a = puebloParts(aMs);
  const b = puebloParts(bMs);
  return a.y === b.y && a.mo === b.mo && a.d === b.d;
}

/**
 * The pins to draw at `nowMs`, in the feed's order (soonest first). Live =
 * `now >= starts_at && now < ends_at`; coming up = starting within the window.
 * An unparseable date drops the event instead of throwing: one bad row must
 * not take the map down.
 */
export function pinsAt(events: readonly PublicEvent[], nowMs: number): EventPin[] {
  const pins: EventPin[] = [];
  for (const event of events) {
    const start = Date.parse(event.starts_at);
    const end = Date.parse(event.ends_at);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const live = nowMs >= start && nowMs < end;
    const comingUp = nowMs < start && start - nowMs <= EVENT_PIN_WINDOW_MS;
    if (!live && !comingUp) continue;
    pins.push({ event, live, today: sameDenverDay(start, nowMs) });
  }
  return pins;
}

/** Pueblo calendar day of an instant as "2026-10-10": the key the strip's dismissals are filed under (#761). */
export function denverDayKey(ms: number): string {
  const p = puebloParts(ms);
  return `${p.y}-${String(p.mo).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export interface EventStripPick {
  /** The event the strip names: the one going on now, else the next to start today. */
  pin: EventPin;
  /** Other events today or on now (after dismissals), for the "and N more" part. */
  more: number;
}

/**
 * What the "happening today" strip shows at `nowMs` (#761), or null for no strip.
 * Candidates are events going on now plus events that start on today's Pueblo
 * calendar day and have not started; the feed arrives soonest-first, so the
 * first live one wins, else the first upcoming. "Today" is Pueblo's day, so an
 * event that is tomorrow in Denver never shows on a phone whose own clock is
 * already on the next date. A dismissed event is left out entirely (it is also
 * not counted in "and N more"). Built on pinsAt, so the strip can never name an
 * event the map would not also be pinning.
 */
export function stripAt(
  events: readonly PublicEvent[],
  nowMs: number,
  isDismissed: (id: string) => boolean,
): EventStripPick | null {
  const candidates = pinsAt(events, nowMs).filter((p) => (p.live || p.today) && !isDismissed(p.event.id));
  const pin = candidates.find((p) => p.live) ?? candidates[0];
  return pin ? { pin, more: candidates.length - 1 } : null;
}

export interface EventListItem {
  event: PublicEvent;
  live: boolean;
}

/**
 * The events list (#761): everything not yet over, going-on-now first, then
 * soonest start. Unlike pinsAt there is NO 7-day window: the list is where an
 * event more than a week out lives until it joins the map. An unparseable date
 * drops the row instead of throwing.
 */
export function listOrder(events: readonly PublicEvent[], nowMs: number): EventListItem[] {
  const items: Array<EventListItem & { start: number }> = [];
  for (const event of events) {
    const start = Date.parse(event.starts_at);
    const end = Date.parse(event.ends_at);
    if (!Number.isFinite(start) || !Number.isFinite(end) || nowMs >= end) continue;
    items.push({ event, live: nowMs >= start, start });
  }
  items.sort((a, b) => Number(b.live) - Number(a.live) || a.start - b.start);
  return items.map(({ event, live }) => ({ event, live }));
}

// Intl formatters are costly to build; one per (locale, shape), made on first use.
const formatterCache = new Map<string, Intl.DateTimeFormat>();
function formatter(locale: Locale, shape: "hour" | "hourMinute" | "weekdayShort" | "weekdayLong"): Intl.DateTimeFormat {
  const key = `${locale}|${shape}`;
  let f = formatterCache.get(key);
  if (!f) {
    const options: Intl.DateTimeFormatOptions =
      shape === "weekdayShort" ? { weekday: "short" }
      : shape === "weekdayLong" ? { weekday: "long" }
      : shape === "hour" ? { hour: "numeric" }
      : { hour: "numeric", minute: "2-digit" };
    f = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", { timeZone: TIME_ZONE, ...options });
    formatterCache.set(key, f);
  }
  return f;
}

/** "2 PM" on the hour, "2:30 PM" otherwise, in Pueblo time. */
export function clock(iso: string, locale: Locale): string {
  const ms = Date.parse(iso);
  return formatter(locale, puebloParts(ms).mi === 0 ? "hour" : "hourMinute").format(ms);
}

/** The text on the pin: "NOW, until 2 PM" while live, otherwise "Sat 2 PM" / "Today 2 PM". */
export function pinLabel(pin: EventPin, locale: Locale): string {
  if (pin.live) return t("events.pin.nowUntil", locale, { time: clock(pin.event.ends_at, locale) });
  const day = pin.today ? t("events.pin.today", locale) : formatter(locale, "weekdayShort").format(Date.parse(pin.event.starts_at));
  return `${day} ${clock(pin.event.starts_at, locale)}`;
}

/** What a screen reader hears: the event name and when. */
export function pinAriaLabel(pin: EventPin, locale: Locale): string {
  const name = locale === "es" && pin.event.name_es ? pin.event.name_es : pin.event.name;
  if (pin.live) return t("events.pin.ariaLive", locale, { name, time: clock(pin.event.ends_at, locale) });
  const day = pin.today ? t("events.pin.today", locale) : formatter(locale, "weekdayLong").format(Date.parse(pin.event.starts_at));
  return t("events.pin.ariaUpcoming", locale, { name, day, time: clock(pin.event.starts_at, locale) });
}

/**
 * The one line a place's own card shows when an upcoming or live event is
 * tied to it (#759): "Event here now" / "Event here today" / "Event here
 * Saturday" (Pueblo weekday).
 */
export function eventHereLabel(pin: EventPin, locale: Locale): string {
  if (pin.live) return t("events.here.now", locale);
  if (pin.today) return t("events.here.today", locale);
  return t("events.here.day", locale, { day: formatter(locale, "weekdayLong").format(Date.parse(pin.event.starts_at)) });
}

/**
 * `search` ("?a=b" or "") with the event parameter set to `id`, or removed for
 * null. Returns the input unchanged when nothing needs to change, so callers
 * can compare and skip a history write.
 */
export function eventSearchWith(search: string, id: string | null): string {
  const params = new URLSearchParams(search);
  if ((params.get(EVENT_PARAM) ?? null) === id) return search;
  if (id === null) params.delete(EVENT_PARAM);
  else params.set(EVENT_PARAM, id);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** The event id a shared `/?event=<id>` link points at, or null. */
export function readEventParam(search: string): string | null {
  const id = new URLSearchParams(search).get(EVENT_PARAM);
  return id ? id : null;
}

/** Mirrors the selected event into the address bar (replace, not push: selecting is not navigation). */
export function syncEventParam(id: string | null): void {
  if (typeof window === "undefined") return;
  const { search, pathname, hash } = window.location;
  const next = eventSearchWith(search, id);
  if (next === search) return;
  window.history.replaceState(null, "", pathname + next + hash);
}
