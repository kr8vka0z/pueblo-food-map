"use client";

/**
 * BoxNumbersPanel — Blessing Boxes slice 7 ("Numbers"). The shared bottom
 * half of both the per-box Numbers section (/box/<id>/history,
 * BoxHistoryContent.tsx) and the network-wide Numbers section
 * (/boxes/activity, BoxesActivityContent.tsx): a period picker, the raw
 * counts, the pair-average "typical timing" numbers, and the honesty note —
 * all driven entirely by props, no fetch of its own, so either caller can
 * recompute on every period change with zero network round-trip
 * (src/lib/boxStats.ts's functions are pure and cheap over this feature's
 * real data volume).
 *
 * Accessible labelled rows, not tiles — a <dl> of label/value pairs reads
 * correctly to a screen reader and needs no custom ARIA, same instinct this
 * repo already applies to every other data list (VenueListView's table,
 * BoxActivityList's items). Two `<dl>`s (counts, then averages) rather than
 * one long one, each with its own leading heading, so the semantic grouping
 * matches the visual one.
 */

import { t, type Locale } from "@/lib/i18n";
import {
  formatDurationMs,
  type CheckinCounts,
  type NetworkOverview,
  type PairAverages,
  type PeriodKey,
} from "@/lib/boxStats";

const FIELD_LABEL = "block text-xs font-medium text-[var(--color-ink-700)] mb-1";
// text-base md:text-sm — iOS Safari auto-zooms on focusing a field under 16px
// (same reasoning BoxesActivityContent.tsx's own SELECT_CLASS documents).
const SELECT_CLASS =
  "w-full rounded-[var(--radius-md)] border border-[var(--color-bone-300)] px-3 py-2 text-base md:text-sm " +
  "text-[var(--color-ink-900)] bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]";

function formatDuration(ms: number | null, locale: Locale): string {
  if (ms === null) return t("box.stats.noData", locale);
  const { value, unit } = formatDurationMs(ms);
  return t(`box.stats.duration.${unit}`, locale, { value: String(value) });
}

interface RowProps {
  label: string;
  value: string;
}

/** One label/value pair — a <div> wrapping <dt>/<dd> is valid HTML5 inside a <dl> (used for the row's own flex layout) and keeps the label/value semantics screen readers expect. */
function Row({ label, value }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-[var(--color-bone-200)] last:border-b-0">
      <dt className="text-sm text-[var(--color-ink-700)]">{label}</dt>
      <dd className="text-sm font-medium text-[var(--color-ink-900)]">{value}</dd>
    </div>
  );
}

export interface BoxNumbersPanelProps {
  /** Distinguishes DOM ids when a per-box panel and the network panel could ever both render on the same page — not true today, but a cheap, cost-free guard against a future id collision. */
  idPrefix: string;
  period: PeriodKey;
  onPeriodChange: (period: PeriodKey) => void;
  counts: CheckinCounts;
  approvedPhotoCount: number;
  pairAverages: PairAverages;
  locale: Locale;
  /**
   * Current ("right now") network-wide counts (issue #512) — box count,
   * sponsor count, and their average — independent of the period picker
   * above, so passed as their own prop rather than folded into `counts`.
   * Undefined on the per-box panel (/box/<id>/history's BoxHistoryContent),
   * where "how many boxes" and "how many sponsors" don't apply to one box.
   */
  networkOverview?: NetworkOverview;
}

export default function BoxNumbersPanel({
  idPrefix,
  period,
  onPeriodChange,
  counts,
  approvedPhotoCount,
  pairAverages,
  locale,
  networkOverview,
}: BoxNumbersPanelProps) {
  const periodSelectId = `${idPrefix}-stats-period`;

  return (
    <div className="space-y-4">
      {networkOverview && (
        <dl>
          <Row label={t("box.stats.boxCount", locale)} value={String(networkOverview.boxCount)} />
          <Row label={t("box.stats.sponsorCount", locale)} value={String(networkOverview.sponsorCount)} />
          <Row label={t("box.stats.avgSponsorsPerBox", locale)} value={networkOverview.avgSponsorsPerBox} />
        </dl>
      )}

      <div className="max-w-xs">
        <label htmlFor={periodSelectId} className={FIELD_LABEL}>
          {t("box.stats.period", locale)}
        </label>
        <select
          id={periodSelectId}
          value={period}
          onChange={(e) => onPeriodChange(e.target.value as PeriodKey)}
          className={SELECT_CLASS}
        >
          <option value="7d">{t("box.stats.period.7d", locale)}</option>
          <option value="30d">{t("box.stats.period.30d", locale)}</option>
          <option value="90d">{t("box.stats.period.90d", locale)}</option>
          <option value="all">{t("box.stats.period.all", locale)}</option>
        </select>
      </div>

      <dl>
        <Row label={t("box.stats.fills", locale)} value={String(counts.fills)} />
        <Row label={t("box.stats.uses", locale)} value={String(counts.uses)} />
        <Row label={t("box.stats.emptyReports", locale)} value={String(counts.emptyReports)} />
        <Row label={t("box.stats.lowReports", locale)} value={String(counts.lowReports)} />
        <Row label={t("box.stats.totalCheckins", locale)} value={String(counts.totalCheckins)} />
        <Row label={t("box.stats.approvedPhotos", locale)} value={String(approvedPhotoCount)} />
      </dl>

      <div>
        <h3 className="text-sm font-medium text-[var(--color-ink-900)] mb-1">{t("box.stats.avgHeading", locale)}</h3>
        <dl>
          <Row label={t("box.stats.avg.emptyToFill", locale)} value={formatDuration(pairAverages.emptyToFillMs, locale)} />
          <Row label={t("box.stats.avg.fillToFill", locale)} value={formatDuration(pairAverages.fillToFillMs, locale)} />
          <Row label={t("box.stats.avg.fillToEmpty", locale)} value={formatDuration(pairAverages.fillToEmptyMs, locale)} />
        </dl>
      </div>

      <p className="text-xs text-[var(--color-ink-500)]">{t("box.stats.honestyNote", locale)}</p>
    </div>
  );
}
