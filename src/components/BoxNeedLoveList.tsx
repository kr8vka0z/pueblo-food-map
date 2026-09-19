"use client";

/**
 * BoxNeedLoveList — Blessing Boxes slice 7 ("Numbers"), network-wide section
 * only. Renders the three "boxes that need love" rankings
 * (src/lib/boxStats.ts's rankLongestSinceLastFill/rankMostEmptyReports/
 * rankSlowestRefill) as three separate ordered lists rather than one blended
 * score — the task named three distinct criteria and combining them into a
 * single ranking would invent a weighting nobody asked for (ponytail: the
 * simplest defensible reading of "longest since last fill, most empty
 * reports, slowest refill" is three lists, not one composite index).
 *
 * `<ol>` per list — these ARE ordered (rank 1, 2, 3...), unlike
 * BoxActivityList's plain `<ul>` feed, so the semantics correctly differ.
 * Each box name links to /box/<id>/history, same destination every other
 * "see more about this box" link in this app already points at.
 */

import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";
import { formatRelativeTime } from "@/lib/relativeTime";
import { formatDurationMs, type LastFillEntry, type EmptyReportEntry, type SlowRefillEntry } from "@/lib/boxStats";

function formatDuration(ms: number, locale: Locale): string {
  const { value, unit } = formatDurationMs(ms);
  return t(`box.stats.duration.${unit}`, locale, { value: String(value) });
}

const LIST_CLASS = "space-y-1";
const ITEM_CLASS = "flex items-center justify-between gap-3 py-1 text-sm";
const LINK_CLASS = "text-[var(--color-sage-600)] hover:text-[var(--color-sage-700)] underline underline-offset-2";
const VALUE_CLASS = "shrink-0 text-[var(--color-ink-700)]";

interface SubListHeadingProps {
  id: string;
  children: string;
}

function SubListHeading({ id, children }: SubListHeadingProps) {
  return (
    <h3 id={id} className="text-sm font-medium text-[var(--color-ink-900)] mb-1">
      {children}
    </h3>
  );
}

export interface BoxNeedLoveListProps {
  longestSinceFill: readonly LastFillEntry[];
  mostEmptyReports: readonly EmptyReportEntry[];
  slowestRefill: readonly SlowRefillEntry[];
  locale: Locale;
  now?: Date;
}

export default function BoxNeedLoveList({
  longestSinceFill,
  mostEmptyReports,
  slowestRefill,
  locale,
  now = new Date(),
}: BoxNeedLoveListProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-normal text-[var(--color-ink-900)]" style={{ fontFamily: "var(--font-display)" }}>
        {t("box.stats.needLoveHeading", locale)}
      </h2>

      <div>
        <SubListHeading id="need-love-longest-since-fill">{t("box.stats.needLove.longestSinceFill", locale)}</SubListHeading>
        {longestSinceFill.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-500)]">{t("box.stats.needLove.empty", locale)}</p>
        ) : (
          <ol aria-labelledby="need-love-longest-since-fill" className={LIST_CLASS}>
            {longestSinceFill.map((entry) => (
              <li key={entry.id} className={ITEM_CLASS}>
                <Link href={`/box/${entry.id}/history`} className={LINK_CLASS}>
                  {entry.name}
                </Link>
                <span className={VALUE_CLASS}>
                  {entry.lastFilledAt === null ? t("box.stats.neverFilled", locale) : formatRelativeTime(entry.lastFilledAt, locale, now)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div>
        <SubListHeading id="need-love-most-empty-reports">{t("box.stats.needLove.mostEmptyReports", locale)}</SubListHeading>
        {mostEmptyReports.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-500)]">{t("box.stats.needLove.empty", locale)}</p>
        ) : (
          <ol aria-labelledby="need-love-most-empty-reports" className={LIST_CLASS}>
            {mostEmptyReports.map((entry) => (
              <li key={entry.id} className={ITEM_CLASS}>
                <Link href={`/box/${entry.id}/history`} className={LINK_CLASS}>
                  {entry.name}
                </Link>
                <span className={VALUE_CLASS}>
                  {t("box.stats.needLove.emptyReportCount", locale, { count: String(entry.emptyReportCount) })}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div>
        <SubListHeading id="need-love-slowest-refill">{t("box.stats.needLove.slowestRefill", locale)}</SubListHeading>
        {slowestRefill.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-500)]">{t("box.stats.needLove.empty", locale)}</p>
        ) : (
          <ol aria-labelledby="need-love-slowest-refill" className={LIST_CLASS}>
            {slowestRefill.map((entry) => (
              <li key={entry.id} className={ITEM_CLASS}>
                <Link href={`/box/${entry.id}/history`} className={LINK_CLASS}>
                  {entry.name}
                </Link>
                <span className={VALUE_CLASS}>{formatDuration(entry.avgRefillMs, locale)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
