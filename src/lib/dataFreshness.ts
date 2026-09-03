/**
 * Formats the map-wide publish timestamp for the "Map data updated" line
 * (board review finding #2 — users had no way to judge how current the
 * WHOLE map is; only a per-venue `last_verified` date existed).
 *
 * WHY its own file, not inlined per-caller: ListView and /about both need
 * the exact same locale-aware date string — one place keeps the
 * Intl.DateTimeFormat locale mapping (en-US / es-MX) from drifting between
 * them, and gives future callers (e.g. the map view, if it ever wants this)
 * one function to reach for instead of a copy-pasted `new Intl.DateTimeFormat`.
 */
import type { Locale } from "@/lib/i18n";

// es-MX (not bare "es"): i18n.ts's own dictionary comment states the whole
// Spanish dictionary targets Mexican / Latin American Spanish conventions —
// matching that here keeps date formatting consistent with the rest of the
// ES copy (e.g. "22 de julio de 2026" vs. Spain's "22 jul 2026" abbreviation).
const DATE_FORMAT_LOCALE: Record<Locale, string> = {
  en: "en-US",
  es: "es-MX",
};

/**
 * "2026-07-22T04:35:18.344Z" -> "July 22, 2026" (en) / "22 de julio de 2026" (es).
 * `dateStyle: "long"` deliberately drops the time-of-day component — a
 * publish timestamp's exact minute isn't meaningful to a user judging
 * "is this map current," and a bare date reads calmer.
 *
 * `timeZone: "UTC"` is load-bearing, not decoration: without it,
 * Intl.DateTimeFormat renders in the RUNNING PROCESS's local timezone —
 * verified this flips the calendar date near midnight UTC (a 2026-07-22
 * 04:35 UTC timestamp read back as "July 21" on a UTC-6 machine). A CI
 * runner and a developer's laptop can disagree on what date this line shows
 * for the exact same publish otherwise.
 */
export function formatPublishedDate(iso: string, locale: Locale): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(DATE_FORMAT_LOCALE[locale], {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}
