/**
 * DailyBars — "Visitors per day" bar chart, plain SVG (#680's own "no chart
 * library" instruction). Must stay legible with up to 90 bars (the 90-day
 * period) on a ~360px phone screen (AGENTS.md "low/mid-end mobile first")
 * — a fixed `viewBox` scales every bar to fit rather than growing the
 * chart's real pixel width, and there's no per-bar text/animation to
 * clutter that many columns.
 *
 * No "use client": a static <svg>, no interactivity.
 */

export interface DailyBarsPoint {
  date: string;
  value: number;
}

export interface DailyBarsProps {
  points: readonly DailyBarsPoint[];
  emptyMessage: string;
}

const VIEW_WIDTH = 300;
const VIEW_HEIGHT = 60;
const GAP_RATIO = 0.2;

export default function DailyBars({ points, emptyMessage }: DailyBarsProps) {
  if (points.length === 0) {
    return <p className="text-sm text-[var(--color-ink-500)]">{emptyMessage}</p>;
  }

  const max = Math.max(...points.map((p) => p.value), 1);
  const slot = VIEW_WIDTH / points.length;
  const barWidth = slot * (1 - GAP_RATIO);

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      className="h-16 w-full text-[var(--color-sage-500)]"
      role="img"
      aria-label={`Visitors per day, ${points[0].date} to ${points[points.length - 1].date}`}
    >
      {points.map((p, i) => {
        const barHeight = (p.value / max) * VIEW_HEIGHT;
        return (
          <rect
            key={p.date}
            x={i * slot}
            y={VIEW_HEIGHT - barHeight}
            width={barWidth}
            height={Math.max(barHeight, p.value > 0 ? 1 : 0)}
            fill="currentColor"
          >
            <title>
              {p.date}: {p.value}
            </title>
          </rect>
        );
      })}
    </svg>
  );
}
