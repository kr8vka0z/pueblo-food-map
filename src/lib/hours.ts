import type { WeeklyHours } from "@/types/venue";

export type OpenStatus =
  | { state: "open"; time: string }
  | { state: "opens_at"; time: string }
  | { state: "closed_today" }
  | { state: "no_hours" };

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
type DayKey = (typeof DAY_KEYS)[number];

/** Parse "HH:MM" into minutes-since-midnight. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Parse a slot string like "09:00-17:00" into {open, close} in minutes. */
function parseSlot(slot: string): { open: number; close: number } | null {
  const [start, end] = slot.split("-");
  if (!start || !end) return null;
  return { open: toMinutes(start), close: toMinutes(end) };
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

  // Check if currently open
  for (const slot of slots) {
    const parsed = parseSlot(slot);
    if (!parsed) continue;
    if (nowMinutes >= parsed.open && nowMinutes < parsed.close) {
      // Format closing time as "h:mma"
      const closeHour = Math.floor(parsed.close / 60);
      const closeMin = parsed.close % 60;
      const label = formatTime(closeHour, closeMin);
      return { state: "open", time: label };
    }
  }

  // Check if a slot starts later today
  for (const slot of slots) {
    const parsed = parseSlot(slot);
    if (!parsed) continue;
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

/** Format a slot string like "09:00-17:00" as "9am – 5pm" for display. */
export function formatSlot(slot: string): string {
  const [start, end] = slot.split("-");
  if (!start || !end) return slot;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return `${formatTime(sh ?? 0, sm ?? 0)} – ${formatTime(eh ?? 0, em ?? 0)}`;
}
