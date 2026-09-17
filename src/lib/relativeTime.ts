/**
 * relativeTime.ts — "3 hours ago" / "hace 3 horas" formatting for
 * BoxContent's "last filled" line (Blessing Boxes slice 2).
 *
 * Uses the standard library's Intl.RelativeTimeFormat — no new dependency,
 * bilingual for free ("en"/"es" are both valid BCP 47 tags Intl already
 * knows, same two values src/lib/i18n.ts's own Locale type uses).
 *
 * ponytail: only day/hour/minute granularity (no weeks/months) — a fill
 * from months ago is already well past the point where "how long ago"
 * needs day-level precision for a check-in panel. Upgrade path: add a
 * `week`/`month` step to STEPS below if a later slice's stats page needs
 * coarser display.
 */

import type { Locale } from "@/lib/i18n";

const STEPS: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: "day", ms: 24 * 60 * 60 * 1000 },
  { unit: "hour", ms: 60 * 60 * 1000 },
  { unit: "minute", ms: 60 * 1000 },
];

/** `iso` in the past relative to `now` renders as "X ago" ("hace X" in Spanish) via Intl's own `numeric: "auto"` phrasing. */
export function formatRelativeTime(iso: string, locale: Locale, now: Date = new Date()): string {
  const diffMs = new Date(iso).getTime() - now.getTime(); // negative = past
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  for (const { unit, ms } of STEPS) {
    const value = Math.round(diffMs / ms);
    if (Math.abs(value) >= 1) return rtf.format(value, unit);
  }
  return rtf.format(0, "minute"); // less than a minute ago -> "now" / "ahora"
}
