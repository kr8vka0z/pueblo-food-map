/**
 * Open-status logic for venue hours.
 *
 * computeOpenStatus() takes a Venue's hours_weekly map and a Date, and returns
 * a discriminated-union status: "open", "opens_at", "closed_today", or
 * "no_hours". Components use this to render the open/closed badge.
 *
 * formatSlot() converts a slot string to a human-readable "9am – 5pm" form for
 * the hours panel in BottomSheet / DesktopVenueWindow. Accepts both the 24h
 * form ("HH:MM-HH:MM") and the 12h Plentiful form ("H:MM AM - H:MM PM") —
 * both produce identical output style.
 *
 * slotToIsoTimes() converts a slot string to ISO 8601 "HH:MM" open/close
 * strings for schema.org OpeningHoursSpecification (src/lib/venueSchema.ts) —
 * a machine-readable sibling to formatSlot()'s human-readable output.
 *
 * #400 adds a second, independent schedule kind — non-weekly recurrences
 * (IrregularSchedule[], src/types/venue.ts) — computed entirely in Denver
 * local time (see "Irregular (monthly-ordinal, etc.)" section below for
 * why) and combined with the weekly logic above by computeVenueOpenStatus().
 */
import type { IrregularSchedule, Venue, WeeklyHours } from "@/types/venue";

export type OpenStatus =
  | { state: "open"; time: string }
  | { state: "opens_at"; time: string }
  | { state: "closed_today" }
  | { state: "no_hours" };

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/**
 * Display ordering for weekly-hours rows (Monday-first), distinct from the
 * Sunday-first DAY_KEYS above which is indexed by Date.getDay() (0 = Sunday).
 * Shared by BottomSheet / DesktopVenueWindow (via HoursList), which render hours Monday→Sunday.
 */
export const DISPLAY_DAY_KEYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;

export type DayKey = (typeof DISPLAY_DAY_KEYS)[number];

/** The DayKey for today (local time), e.g. to highlight the current row. */
export function todayKey(): DayKey {
  const idx = new Date().getDay(); // 0=Sun
  const map: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[idx] ?? "mon";
}

/**
 * Parse a time string to minutes-since-midnight.
 *
 * Accepts two formats:
 *   24h: "HH:MM"           (e.g. "09:00", "17:30")
 *   12h: "H:MM AM/PM"      (e.g. "10:30 AM", "12:00 PM")
 *
 * 12h conversion rules (standard clock):
 *   12:xx AM = 0h  + xx  (midnight hour)
 *   12:xx PM = 720 + xx  (noon hour)
 *   1–11 AM  = h*60 + xx
 *   1–11 PM  = (h+12)*60 + xx
 */
function toMinutes(raw: string): number {
  const s = raw.trim();
  // 12-hour: ends with AM or PM (case-insensitive)
  const twelveHour = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (twelveHour) {
    const h = parseInt(twelveHour[1] ?? "0", 10);
    const m = parseInt(twelveHour[2] ?? "0", 10);
    const period = (twelveHour[3] ?? "").toUpperCase();
    let hours24: number;
    if (period === "AM") {
      hours24 = h === 12 ? 0 : h;   // 12:xx AM → 0h (midnight)
    } else {
      hours24 = h === 12 ? 12 : h + 12; // 12:xx PM → 12h (noon); 1–11 PM → +12
    }
    return hours24 * 60 + m;
  }
  // 24-hour: "HH:MM"
  const [h, m] = s.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Parse a slot string into {open, close} in minutes-since-midnight.
 *
 * Handles both formats:
 *   24h: "09:00-17:00"          (dash, no spaces)
 *   12h: "10:30 AM - 12:00 PM"  (Plentiful: spaces around dash + AM/PM suffix)
 *
 * The 12h format contains dashes in the AM/PM part, so we can't blindly split
 * on "-". Instead we split on the separator " - " (space-dash-space) first;
 * if that yields exactly two parts we use them. Otherwise we fall back to
 * splitting on the last "-" to handle the 24h "HH:MM-HH:MM" form.
 */
function parseSlot(slot: string): { open: number; close: number } | null {
  let start: string | undefined;
  let end: string | undefined;

  // Try the Plentiful " - " separator first (12h format)
  const spaced = slot.split(" - ");
  if (spaced.length === 2) {
    start = spaced[0];
    end = spaced[1];
  } else {
    // Fall back to 24h "HH:MM-HH:MM" — split on "-", take first and last parts
    const parts = slot.split("-");
    if (parts.length < 2) return null;
    start = parts[0];
    end = parts.slice(1).join("-");
  }

  if (!start || !end) return null;
  const open = toMinutes(start);
  const close = toMinutes(end);
  // NaN check: if parsing produced NaN (malformed input), skip the slot
  if (isNaN(open) || isNaN(close)) return null;
  return { open, close };
}

export function computeOpenStatus(
  hours: WeeklyHours | undefined,
  now: Date = new Date(),
): OpenStatus {
  if (!hours) return { state: "no_hours" };

  const dayKey = DAY_KEYS[now.getDay()] as DayKey;
  const slots = hours[dayKey];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (!slots || slots.length === 0) {
    // Check if any other day this week has hours to decide between
    // "closed today" vs "no hours at all"
    const hasAnyHours = DAY_KEYS.some((d) => {
      const s = hours[d];
      return s && s.length > 0;
    });
    return hasAnyHours ? { state: "closed_today" } : { state: "no_hours" };
  }

  // Sort parsed slots by open time so multi-slot venues (some Plentiful entries
  // store slots in reverse order) always check the earliest slot first.
  // This ensures opens_at returns the nearest upcoming slot, not the first
  // listed one. Null slots (parse failures) are dropped here.
  const parsedSlots = slots
    .map((s) => parseSlot(s))
    .filter((p): p is { open: number; close: number } => p !== null)
    .sort((a, b) => a.open - b.open);

  // Check if currently open
  for (const parsed of parsedSlots) {
    if (nowMinutes >= parsed.open && nowMinutes < parsed.close) {
      // Format closing time as "h:mma"
      const closeHour = Math.floor(parsed.close / 60);
      const closeMin = parsed.close % 60;
      const label = formatTime(closeHour, closeMin);
      return { state: "open", time: label };
    }
  }

  // Check if a slot starts later today (sorted, so first match = soonest)
  for (const parsed of parsedSlots) {
    if (nowMinutes < parsed.open) {
      const openHour = Math.floor(parsed.open / 60);
      const openMin = parsed.open % 60;
      const label = formatTime(openHour, openMin);
      return { state: "opens_at", time: label };
    }
  }

  return { state: "closed_today" };
}

function formatTime(hour: number, min: number): string {
  // hour can be 24 — a slot closing at "24:00" (midnight), e.g. OSM's
  // "00:00-24:00" 24-hour venues. Normalize into 0–23 so 24:00 renders as
  // "12am" (midnight), not "12pm": without the %24, a full-day close read as
  // "closes at noon" — wrong hours on every 24-hour store.
  const h24 = hour % 24;
  const period = h24 >= 12 ? "pm" : "am";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const m = min > 0 ? `:${String(min).padStart(2, "0")}` : "";
  return `${h}${m}${period}`;
}

/**
 * Format a slot string as "9am – 5pm" for display.
 *
 * Accepts both the 24h form ("09:00-17:00") and the 12h Plentiful form
 * ("10:30 AM - 12:00 PM"). Delegates parsing to parseSlot() so both formats
 * share the same minute-conversion logic and guarantee the panel text matches
 * the open/closed badge exactly.
 *
 * Returns the raw slot string unchanged on malformed input (fail-safe).
 */
export function formatSlot(slot: string): string {
  const parsed = parseSlot(slot);
  if (!parsed) return slot;
  // A slot spanning a full 24 hours (e.g. OSM's "00:00-24:00") reads far
  // clearer as "Open 24 hours" than "12am – 12am". English string to match
  // this function's existing locale-agnostic output (slot times always render
  // as English am/pm regardless of page locale).
  if (parsed.close - parsed.open >= 24 * 60) return "Open 24 hours";
  const openHour = Math.floor(parsed.open / 60);
  const openMin = parsed.open % 60;
  const closeHour = Math.floor(parsed.close / 60);
  const closeMin = parsed.close % 60;
  return `${formatTime(openHour, openMin)} – ${formatTime(closeHour, closeMin)}`;
}

/**
 * Convert a slot string to ISO 8601 time-of-day strings ("HH:MM", 24h) for
 * schema.org OpeningHoursSpecification's opens/closes fields. Delegates to
 * parseSlot() for both slot formats — see parseSlot's doc comment above.
 *
 * Returns null on the same malformed input parseSlot itself rejects.
 */
export function slotToIsoTimes(
  slot: string,
): { opens: string; closes: string } | null {
  const parsed = parseSlot(slot);
  if (!parsed) return null;
  const pad = (mins: number) =>
    `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  return { opens: pad(parsed.open), closes: pad(parsed.close) };
}

// ─── Irregular (monthly-ordinal, etc.) schedules — Denver time (#400) ─────
//
// Kyle's decision: a monthly-ordinal venue (e.g. "4th Tuesday, 11am-12pm")
// counts as "open" ONLY during its actual slot on the actual matching
// calendar date — never any other day of the month — but is NEVER
// "hours unknown" either, unlike a venue with no schedule data at all. The
// card also gets a "Next: Tue Oct 28, 11am" line (nextIrregularOccurrence +
// formatIrregularOccurrence below) — the single most useful fact for an
// audience with little gas money to spend driving to a pantry on the wrong
// week.
//
// WHY Denver time, computed via Intl rather than a date library: this app
// serves one physical city (Pueblo, CO — America/Denver), and the platform
// (Intl.DateTimeFormat) already does correct DST-aware timezone conversion
// natively — no new dependency needed (see AGENTS.md/RULES.md "no new
// dependencies unless unavoidable"). Only ONE step touches a timezone —
// getDenverDateTime() below, converting the caller's `now: Date` (a real
// UTC instant) into Denver calendar/clock fields. Every downstream
// computation (nth-weekday-of-month, day-of-month, "next occurrence" month
// scanning) is then pure calendar arithmetic on those already-resolved
// Denver fields, done with Date.UTC(...) as a plain "y/m/d carrier" (never
// re-interpreted through a timezone) — so DST transitions can never
// corrupt the arithmetic, only the single initial conversion.

const DENVER_TZ = "America/Denver";

interface DenverDateTime {
  year: number;
  month: number; // 1-12
  day: number;
  minutes: number; // minutes since midnight, Denver local clock
}

/** Converts a real UTC instant to Denver calendar date + clock time. The only timezone-aware step in this whole section — see the module section header above. */
function getDenverDateTime(instant: Date): DenverDateTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DENVER_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  // ICU's h23 cycle has a known quirk: some engines render midnight as "24"
  // rather than "00". % 24 normalizes either form to the same 0-23 value —
  // same defensive pattern this file's own formatTime() already uses for a
  // 24:00 slot-close time, above.
  const hour = get("hour") % 24;
  return { year: get("year"), month: get("month"), day: get("day"), minutes: hour * 60 + get("minute") };
}

/** Days in a given (year, 1-12 month), via a UTC date-math trick — no timezone read involved. */
function daysInMonthUTC(year: number, month: number): number {
  // Date.UTC's own `month` argument is 0-indexed, so passing the 1-12
  // `month` value unadjusted lands on the 1st of the FOLLOWING calendar
  // month; day 0 of that rolls back to the last real day of `month` itself.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const DOW_INDEX: Record<DayKey, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

/**
 * Resolves "the Nth `weekday` of (year, month)" to a day-of-month, or the
 * month's LAST occurrence of `weekday` when ordinal === "last". Returns
 * null when the month simply doesn't have an Nth occurrence (e.g. a "5th
 * Tuesday" in a month with only 4) — never a wrong guess.
 */
function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: DayKey,
  ordinal: 1 | 2 | 3 | 4 | 5 | "last",
): number | null {
  const targetDow = DOW_INDEX[weekday];
  const dowOfFirst = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const firstOccurrence = 1 + ((targetDow - dowOfFirst + 7) % 7);
  const days = daysInMonthUTC(year, month);
  if (ordinal === "last") {
    return firstOccurrence + 7 * Math.floor((days - firstOccurrence) / 7);
  }
  const nth = firstOccurrence + 7 * (ordinal - 1);
  return nth <= days ? nth : null;
}

/**
 * Resolves one IrregularSchedule entry to a day-of-month for a given
 * (year, month), or null when that entry doesn't land in this month at all
 * — either because the month lacks the Nth weekday ("5th Tuesday" in a
 * 4-Tuesday month), a monthly_date's day exceeds the month's real length
 * (day 31 in a 30-day month), or the entry is recurrence "other" (prose
 * only, no computable date — see IrregularSchedule's own doc comment).
 */
function resolveEntryDayInMonth(entry: IrregularSchedule, year: number, month: number): number | null {
  if (entry.recurrence === "monthly_ordinal") {
    if (!entry.weekday || !entry.ordinal) return null;
    return nthWeekdayOfMonth(year, month, entry.weekday, entry.ordinal);
  }
  if (entry.recurrence === "monthly_date") {
    if (!entry.day_of_month) return null;
    return entry.day_of_month <= daysInMonthUTC(year, month) ? entry.day_of_month : null;
  }
  return null; // "other" — no computable date
}

/**
 * Is the venue open RIGHT NOW via an irregular schedule (Denver time)?
 * Mirrors computeOpenStatus()'s per-slot open/opens_at logic above, but
 * scoped to entries whose resolved date is TODAY (Denver calendar date) —
 * every other day of the month, an irregular-only venue is "closed_today"
 * here (never "no_hours"; see this section's own header for why that
 * distinction is load-bearing). Returns null only when there are no
 * schedules to check at all — callers combine this with computeOpenStatus()
 * via computeVenueOpenStatus() below rather than calling this directly.
 */
export function computeIrregularOpenStatus(
  schedules: IrregularSchedule[] | undefined,
  now: Date = new Date(),
): OpenStatus | null {
  if (!schedules || schedules.length === 0) return null;
  const denverNow = getDenverDateTime(now);

  let opensAtCandidate: number | null = null;
  for (const schedule of schedules) {
    const day = resolveEntryDayInMonth(schedule, denverNow.year, denverNow.month);
    if (day !== denverNow.day) continue; // not today — doesn't affect "open now"
    for (const slotStr of schedule.slots) {
      const parsed = parseSlot(slotStr);
      if (!parsed) continue;
      if (denverNow.minutes >= parsed.open && denverNow.minutes < parsed.close) {
        return { state: "open", time: formatTime(Math.floor(parsed.close / 60), parsed.close % 60) };
      }
      if (parsed.open > denverNow.minutes && (opensAtCandidate === null || parsed.open < opensAtCandidate)) {
        opensAtCandidate = parsed.open;
      }
    }
  }
  if (opensAtCandidate !== null) {
    return { state: "opens_at", time: formatTime(Math.floor(opensAtCandidate / 60), opensAtCandidate % 60) };
  }
  return { state: "closed_today" };
}

/**
 * Combines weekly + irregular schedules into one badge-ready status.
 * VenueCard / BottomSheet / DesktopVenueWindow / useMapFilters all read
 * through this (never computeOpenStatus directly) once a venue can carry
 * BOTH schedule kinds (Lynn Gardens Baptist Church, #400) — a single
 * consistent open/closed answer everywhere, not each caller reconciling
 * the two schedules on its own.
 *
 * Decision (#400, Kyle): an irregular-only venue is NEVER "no_hours" — see
 * computeIrregularOpenStatus's own header. Only a venue with NEITHER
 * hours_weekly NOR hours_irregular data is "no_hours" here.
 *
 * WHY weekly stays on the caller's local clock while irregular is
 * Denver-forced: hours_weekly has always read `now`'s LOCAL time (whatever
 * timezone the browser/server runs in) — Denver-forcing irregular schedules
 * only is a deliberate, scoped decision for this new code path, not an
 * inconsistency to "fix" by unifying both. This app serves a single
 * physical city (Pueblo, CO, America/Denver), so both produce the identical
 * real-world answer for every actual visitor regardless of which clock each
 * half reads.
 */
export function computeVenueOpenStatus(
  venue: Pick<Venue, "hours_weekly" | "hours_irregular">,
  now: Date = new Date(),
): OpenStatus {
  const weekly = computeOpenStatus(venue.hours_weekly, now);
  const irregular = computeIrregularOpenStatus(venue.hours_irregular, now);

  if (weekly.state === "open") return weekly;
  if (irregular?.state === "open") return irregular;
  if (weekly.state === "opens_at") return weekly;
  if (irregular?.state === "opens_at") return irregular;
  if (weekly.state === "closed_today" || irregular?.state === "closed_today") {
    return { state: "closed_today" };
  }
  return { state: "no_hours" };
}

export interface IrregularOccurrence {
  /** Denver calendar date — plain fields, not a Date, so nothing downstream re-derives it through a different timezone. */
  year: number;
  month: number; // 1-12
  day: number;
  schedule: IrregularSchedule;
  /** The earliest slot string starting this occurrence, e.g. "11:00-12:00". */
  slot: string;
}

const MAX_MONTHS_SCANNED = 14; // safety bound against a malformed schedule whose ordinal/weekday never resolves — see nextIrregularOccurrence's own doc comment.

function compareOccurrenceDate(a: IrregularOccurrence, b: IrregularOccurrence): number {
  const aKey = a.year * 10000 + a.month * 100 + a.day;
  const bKey = b.year * 10000 + b.month * 100 + b.day;
  if (aKey !== bKey) return aKey - bKey;
  return (parseSlot(a.slot)?.open ?? 0) - (parseSlot(b.slot)?.open ?? 0);
}

/**
 * Earliest upcoming (monthly_ordinal/monthly_date) occurrence at or after
 * `now`, across every schedule entry — Denver time throughout (see this
 * section's own header). "other"-recurrence entries have no computable date
 * (resolveEntryDayInMonth always returns null for them) and are never
 * returned here — their `note` surfaces separately in the UI as prose, not
 * a "Next:" line. Scans forward up to MAX_MONTHS_SCANNED months per entry
 * (needed for e.g. a schedule whose "5th Tuesday" isn't every month);
 * returns null when every entry is "other," there are no entries, or (a
 * malformed schedule) nothing resolves within the scan bound.
 */
export function nextIrregularOccurrence(
  schedules: IrregularSchedule[] | undefined,
  now: Date = new Date(),
): IrregularOccurrence | null {
  if (!schedules || schedules.length === 0) return null;
  const denverNow = getDenverDateTime(now);
  const todayKey = denverNow.year * 10000 + denverNow.month * 100 + denverNow.day;

  let best: IrregularOccurrence | null = null;

  for (const schedule of schedules) {
    if (!schedule.slots || schedule.slots.length === 0) continue;
    const sortedSlots = [...schedule.slots].sort(
      (a, b) => (parseSlot(a)?.open ?? 0) - (parseSlot(b)?.open ?? 0),
    );
    const firstSlot = sortedSlots[0];
    const firstSlotOpen = firstSlot !== undefined ? parseSlot(firstSlot)?.open : undefined;
    if (firstSlotOpen === undefined) continue; // every slot unparseable — nothing computable

    let year = denverNow.year;
    let month = denverNow.month;
    for (let i = 0; i < MAX_MONTHS_SCANNED; i++) {
      const day = resolveEntryDayInMonth(schedule, year, month);
      if (day !== null) {
        const dateKey = year * 10000 + month * 100 + day;
        // Today counts only via a slot that hasn't started yet — a slot
        // already open or already passed today is "now," not "next";
        // computeVenueOpenStatus/computeIrregularOpenStatus own the "is it
        // open right now" answer, this function is strictly upcoming starts.
        // Every slot is checked, not just the earliest: between two same-day
        // slots the later one is still upcoming today, and skipping to next
        // month would contradict the "Opens at" badge shown beside it.
        const slot =
          dateKey > todayKey
            ? firstSlot
            : dateKey === todayKey
              ? sortedSlots.find((s) => (parseSlot(s)?.open ?? -1) >= denverNow.minutes)
              : undefined;
        if (slot !== undefined) {
          const candidate: IrregularOccurrence = { year, month, day, schedule, slot };
          if (best === null || compareOccurrenceDate(candidate, best) < 0) best = candidate;
          break; // this schedule's own next occurrence is found — move to the next schedule
        }
      }
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }

  return best;
}

/**
 * Formats a resolved IrregularOccurrence as "Tue Oct 28, 11am" (en) for the
 * venue card's "Next: ..." line (#400, Kyle). Weekday/month come from
 * Intl.DateTimeFormat against a UTC-carrier Date built directly from the
 * occurrence's own (year, month, day) fields — NOT a fresh `new Date()`
 * reparsed through a timezone, so this never re-derives the Denver date a
 * second time (that already happened once, in getDenverDateTime) and can't
 * be pulled back a day by the runtime's own local timezone. `locale` is a
 * plain "en"/"es" literal (not src/lib/i18n.ts's own Locale type) to avoid
 * this pure lib importing i18n's dictionary module — callers already pass a
 * Locale value, which satisfies this parameter structurally.
 */
export function formatIrregularOccurrence(
  occurrence: IrregularOccurrence,
  locale: "en" | "es" = "en",
): string {
  const carrier = new Date(Date.UTC(occurrence.year, occurrence.month - 1, occurrence.day));
  const dateLabel = new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(carrier);
  const parsed = parseSlot(occurrence.slot);
  const timeLabel = parsed ? formatTime(Math.floor(parsed.open / 60), parsed.open % 60) : occurrence.slot;
  return `${dateLabel}, ${timeLabel}`;
}

/**
 * Describes one IrregularSchedule entry as prose — "4th Tue of each month,
 * 11am – 12pm" — for the venue detail views that list the RULE itself
 * (BottomSheet/DesktopVenueWindow's HoursList, the static /venue/[id] page),
 * as opposed to formatIrregularOccurrence()'s resolved next-DATE line above.
 *
 * `t` is injected (src/lib/i18n.ts's own `t()`, passed by the caller) rather
 * than imported directly — keeps this file free of a hard i18n.ts dependency
 * (matching formatSlot's own "English am/pm regardless of page locale"
 * convention for the time portion, documented at that function) while still
 * sharing ONE implementation across every caller instead of each duplicating
 * this string assembly and risking the two drifting apart.
 */
export function describeIrregularSchedule(
  entry: IrregularSchedule,
  locale: "en" | "es",
  t: (key: string, locale: "en" | "es", vars?: Record<string, string>) => string,
): string {
  const slotsLabel = entry.slots.length > 0 ? entry.slots.map(formatSlot).join(", ") : "";

  let base: string;
  if (entry.recurrence === "monthly_ordinal" && entry.weekday && entry.ordinal) {
    const ordinalLabel = t(`hours.irregular.ordinal.${entry.ordinal}`, locale);
    const weekdayLabel = t(`day.${entry.weekday}`, locale);
    base = t("hours.irregular.monthlyOrdinal", locale, {
      ordinal: ordinalLabel,
      weekday: weekdayLabel,
      slots: slotsLabel,
    });
  } else if (entry.recurrence === "monthly_date" && entry.day_of_month) {
    base = t("hours.irregular.monthlyDate", locale, { day: String(entry.day_of_month), slots: slotsLabel });
  } else {
    // "other" (or a malformed computable-recurrence entry missing its own
    // required field) — the note is the only thing left to show.
    return entry.note ?? "";
  }

  return entry.note ? `${base} — ${entry.note}` : base;
}
