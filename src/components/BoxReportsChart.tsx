/**
 * BoxReportsChart — the /admin/boxes tab's "Box reports, last 8 weeks" bar
 * chart (approved mockup Direction B). Plain divs + inline styles, no
 * charting library, per the task spec ("plain divs/CSS, no library") — this
 * app has no chart dependency installed and one 8-bar stacked chart doesn't
 * warrant adding one.
 *
 * Each week is one bar, height scaled to the busiest week in the window;
 * within a bar, the "needs attention" (low/empty/problem) segment stacks
 * ABOVE the "OK" (filled/took) segment via CSS flex-grow proportional to
 * each count, so a week's total height AND its OK/trouble split are both
 * visible from the same bar (src/lib/adminDashboard.ts's bucketCheckinsByWeek
 * already computed which of the two buckets each check-in belongs to —
 * this component only lays it out).
 */

import type { WeeklyCheckinBucket } from "@/lib/adminDashboard";

export interface BoxReportsChartProps {
  buckets: WeeklyCheckinBucket[];
}

/** UTC-pinned, same reasoning src/lib/adminVenues.ts's formatLastVerified gives — weekStart is a date-only string with no time component of its own. */
function formatWeekLabel(weekStart: string): string {
  const date = new Date(`${weekStart}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return weekStart;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

const CHART_HEIGHT_PX = 128;

export default function BoxReportsChart({ buckets }: BoxReportsChartProps) {
  const totals = buckets.map((b) => b.ok + b.trouble);
  const max = Math.max(1, ...totals); // never divide by zero when every week is empty
  const hasAnyReports = totals.some((t) => t > 0);

  return (
    <div>
      {!hasAnyReports ? (
        <p className="text-sm text-[var(--color-ink-500)]">No box reports in the last 8 weeks.</p>
      ) : (
        <div className="flex items-end gap-2" style={{ height: CHART_HEIGHT_PX }}>
          {buckets.map((bucket) => {
            const total = bucket.ok + bucket.trouble;
            const barHeightPct = (total / max) * 100;
            return (
              <div key={bucket.weekStart} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <div
                  className="flex w-full flex-col overflow-hidden rounded-t-[var(--radius-sm)]"
                  style={{ height: `${barHeightPct}%` }}
                  role="img"
                  aria-label={`Week of ${formatWeekLabel(bucket.weekStart)}: ${bucket.ok} OK, ${bucket.trouble} needing attention`}
                >
                  {bucket.trouble > 0 && (
                    <div className="w-full bg-[var(--color-clay-500)]" style={{ flexGrow: bucket.trouble }} />
                  )}
                  {bucket.ok > 0 && <div className="w-full bg-[var(--color-sage-500)]" style={{ flexGrow: bucket.ok }} />}
                </div>
                <span className="text-[10px] text-[var(--color-ink-400)]">{formatWeekLabel(bucket.weekStart)}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-3 flex items-center gap-4 text-xs text-[var(--color-ink-500)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--color-sage-500)]" aria-hidden />
          OK
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--color-clay-500)]" aria-hidden />
          Needs attention
        </span>
      </div>
    </div>
  );
}
