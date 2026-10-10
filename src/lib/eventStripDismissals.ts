/**
 * eventStripDismissals — which events the visitor has closed on the "happening
 * today" strip, for the rest of that Pueblo day (#761, umbrella #156).
 *
 * Stored in localStorage like the other small on-device preferences
 * (favorites.ts, splashGate.ts) as `{ "<eventId>": "<Pueblo day>" }` under
 * "pfm.eventStrip.dismissed.v1". WHY the day is in the value rather than a
 * timer: "the rest of the day" is Pueblo's calendar day, not 24 hours, and the
 * day key (eventPins.denverDayKey) makes tomorrow's lookup simply not match.
 * Entries from other days are dropped on every write so the key cannot grow.
 *
 * Fails soft: storage that throws on read or write (private mode, disabled
 * cookies, quota) just means the dismissal lasts until the page reloads,
 * because the caller keeps the returned record in memory. The strip never
 * errors over a preference.
 */

const STORAGE_KEY = "pfm.eventStrip.dismissed.v1";

/** event id -> Pueblo day ("2026-10-10") it was dismissed on. */
export type EventDismissals = Readonly<Record<string, string>>;

export function readEventDismissals(): EventDismissals {
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const clean: Record<string, string> = {};
    for (const [id, day] of Object.entries(parsed)) if (typeof day === "string") clean[id] = day;
    return clean;
  } catch {
    return {};
  }
}

/**
 * `current` plus `id` dismissed for `day`, with other days' entries dropped.
 * Always returns the new record even when the write fails, so the caller's
 * in-memory copy still hides the strip this session.
 */
export function dismissEvent(current: EventDismissals, id: string, day: string): EventDismissals {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(current)) if (value === day) next[key] = value;
  next[id] = day;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: the in-memory record is all there is.
  }
  return next;
}
