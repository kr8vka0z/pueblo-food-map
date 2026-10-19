/**
 * formatDurationLabel — a box-stats duration ("5 hours", "2.5 days") in the
 * visitor's language, shared by BoxNumbersPanel and BoxNeedLoveList.
 *
 * WHY not in boxStats.ts: boxStats is pure math that server code (the admin
 * dashboard) also imports, and it has no i18n dependency; the translated
 * label belongs with the public components that render it.
 */

import { t, type Locale } from "@/lib/i18n";
import { formatDurationMs } from "@/lib/boxStats";

/** `null` (no complete pair in the period) reads as box.stats.noData. */
export function formatDurationLabel(ms: number | null, locale: Locale): string {
  if (ms === null) return t("box.stats.noData", locale);
  const { value, unit } = formatDurationMs(ms);
  return t(`box.stats.duration.${unit}`, locale, { value: String(value) });
}
