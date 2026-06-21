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
 */
import type { WeeklyHours } from "@/types/venue";

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
  const period = hour >= 12 ? "pm" : "am";
  const h = hour % 12 === 0 ? 12 : hour % 12;
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
  const openHour = Math.floor(parsed.open / 60);
  const openMin = parsed.open % 60;
  const closeHour = Math.floor(parsed.close / 60);
  const closeMin = parsed.close % 60;
  return `${formatTime(openHour, openMin)} – ${formatTime(closeHour, closeMin)}`;
}
