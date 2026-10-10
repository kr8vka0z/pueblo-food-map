/**
 * eventTime.ts — Pueblo time (America/Denver) <-> absolute UTC for events (#757).
 *
 * WHY this exists: an event happens at a fixed moment in Pueblo no matter
 * where the phone or laptop is. Place hours (src/lib/hours.ts) deliberately
 * use the device clock; events must not. So admins type a wall-clock time,
 * and the SERVER converts it here with Intl — never `new Date(y, m, d, h)`,
 * which uses the host's own zone. The browser only ever sends the raw
 * `datetime-local` string, so the browser's timezone cannot leak in.
 *
 * DST: Denver's UTC offset is -7h (MST) or -6h (MDT). We try each plausible
 * offset and keep those that round-trip. Zero matches = the wall-clock time
 * is skipped by spring-forward (null). Two = the hour repeats on fall-back;
 * we take the first (earlier) occurrence so the answer is deterministic.
 */

const TIME_ZONE = "America/Denver";
const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const MS_PER_MIN = 60_000;
const MS_PER_DAY = 86_400_000;

// hourCycle h23 so midnight is "00", not "24" (some engines emit 24 with hour12:false).
const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function puebloParts(instantMs: number): { y: number; mo: number; d: number; h: number; mi: number } {
  const get = (type: string) => Number(partsFormatter.formatToParts(new Date(instantMs)).find((p) => p.type === type)?.value);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour"), mi: get("minute") };
}

/** Denver's UTC offset in minutes (negative) at an instant. */
function offsetMinutesAt(instantMs: number): number {
  const p = puebloParts(instantMs);
  const wallAsUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
  return Math.round((wallAsUtc - Math.floor(instantMs / MS_PER_MIN) * MS_PER_MIN) / MS_PER_MIN);
}

/**
 * "2026-11-21T10:00" (Pueblo wall clock, from a datetime-local input) ->
 * "2026-11-21T17:00:00.000Z". Returns null for a malformed string, an
 * impossible date, or a time that does not exist (the spring-forward hour).
 */
export function puebloLocalToUtcIso(local: string): string | null {
  const m = LOCAL_RE.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Date.UTC silently rolls over (Feb 30 -> Mar 2, hour 25 -> next day); reject any rollover.
  const check = new Date(wallAsUtc);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || check.getUTCHours() !== h || check.getUTCMinutes() !== mi) {
    return null;
  }

  // Offsets in force a day either side bracket any transition near this wall time.
  const offsets = new Set([offsetMinutesAt(wallAsUtc - MS_PER_DAY), offsetMinutesAt(wallAsUtc + MS_PER_DAY)]);
  const candidates: number[] = [];
  for (const off of offsets) {
    const instant = wallAsUtc - off * MS_PER_MIN;
    if (offsetMinutesAt(instant) === off) candidates.push(instant);
  }
  if (candidates.length === 0) return null;
  return new Date(Math.min(...candidates)).toISOString();
}

/** "2026-11-21T17:00:00.000Z" -> "2026-11-21T10:00" (Pueblo wall clock, for pre-filling the edit form). */
export function utcIsoToPuebloLocal(iso: string): string {
  const p = puebloParts(Date.parse(iso));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}
