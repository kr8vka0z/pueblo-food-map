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
import type { LastFillEntry, EmptyReportEntry, SlowRefillEntry } from "@/lib/boxStats";
import { formatDurationLabel } from "@/lib/formatDurationLabel";

const LIST_CLASS = "space-y-1";
const ITEM_CLASS = "flex items-center justify-between gap-3 py-1 text-sm";
const LINK_CLASS = "text-[var(--color-sage-600)] hover:text-[var(--color-sage-700)] underline underline-offset-2";
const VALUE_CLASS = "shrink-0 text-[var(--color-ink-700)]";

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
  // One block per ranking; each row's right-hand value is rendered per list.
  const lists = [
    {
      id: "need-love-longest-since-fill",
      heading: t("box.stats.needLove.longestSinceFill", locale),
      rows: longestSinceFill.map((e) => ({
        id: e.id,
        name: e.name,
        value: e.lastFilledAt === null ? t("box.stats.neverFilled", locale) : formatRelativeTime(e.lastFilledAt, locale, now),
      })),
    },
    {
      id: "need-love-most-empty-reports",
      heading: t("box.stats.needLove.mostEmptyReports", locale),
      rows: mostEmptyReports.map((e) => ({
        id: e.id,
        name: e.name,
        value: t("box.stats.needLove.emptyReportCount", locale, { count: String(e.emptyReportCount) }),
      })),
    },
    {
      id: "need-love-slowest-refill",
      heading: t("box.stats.needLove.slowestRefill", locale),
      rows: slowestRefill.map((e) => ({ id: e.id, name: e.name, value: formatDurationLabel(e.avgRefillMs, locale) })),
    },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-normal text-[var(--color-ink-900)]" style={{ fontFamily: "var(--font-display)" }}>
        {t("box.stats.needLoveHeading", locale)}
      </h2>

      {lists.map((list) => (
        <div key={list.id}>
          <h3 id={list.id} className="text-sm font-medium text-[var(--color-ink-900)] mb-1">
            {list.heading}
          </h3>
          {list.rows.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-500)]">{t("box.stats.needLove.empty", locale)}</p>
          ) : (
            <ol aria-labelledby={list.id} className={LIST_CLASS}>
              {list.rows.map((row) => (
                <li key={row.id} className={ITEM_CLASS}>
                  <Link href={`/box/${row.id}/history`} className={LINK_CLASS}>
                    {row.name}
                  </Link>
                  <span className={VALUE_CLASS}>{row.value}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      ))}
    </div>
  );
}
