/**
 * KpiCard — one number + its change vs the previous period of the same
 * length, admin Dashboard's #680 build. Every period-scoped number on the
 * page (Visitors, Page views, Blessing Box counts) renders through this one
 * component so the delta math (and its 0 -> n / both-zero edge cases,
 * below) lives in exactly one place, unit-tested once rather than
 * re-derived per section.
 *
 * Plain SVG, no chart library (#680's own "no chart library" instruction) —
 * the optional sparkline is a handful of <path> points, not a dependency.
 *
 * No "use client": every prop is already-computed data, nothing here needs
 * browser state.
 */

export interface KpiCardProps {
  label: string;
  /** Formatted for display already (e.g. "1,204", "42%", "2.1s") — this component never formats the value itself, only the delta. */
  displayValue: string;
  /** Raw current-period value, used only for the delta math below. */
  value: number;
  /** Raw previous-period value (same length window) — undefined when no comparison makes sense (e.g. a point-in-time count like "boxes in service", not a period total). */
  previousValue?: number;
  /** Optional per-day values for a tiny inline trend line, oldest first. */
  sparkline?: readonly number[];
  /** "about" prefix for sampled Cloudflare RUM numbers — issue #680's "label RUM numbers 'about'" rule. */
  approximate?: boolean;
}

export interface KpiDelta {
  /** null when there's nothing meaningful to compare (previousValue undefined, or both 0). */
  pct: number | null;
  direction: "up" | "down" | "flat";
  /** true when previous was 0 and current is > 0 — "new" reads better than a meaningless "+Infinity%" or "+100%". */
  isNew: boolean;
}

/**
 * Pure — the one thing #680's Plan calls out for its own test ("KpiCard
 * delta math (including 0 -> n)"). previousValue === 0 with value > 0 is
 * "new" (never a percentage); both 0 is "flat" with no pct at all (nothing
 * changed, nothing to report) — neither branch can ever produce NaN or
 * Infinity, since a real division only happens once previousValue is known
 * to be > 0.
 */
export function computeKpiDelta(value: number, previousValue: number | undefined): KpiDelta {
  if (previousValue === undefined) return { pct: null, direction: "flat", isNew: false };
  if (previousValue === 0) {
    if (value === 0) return { pct: null, direction: "flat", isNew: false };
    return { pct: null, direction: "up", isNew: true };
  }
  const pct = Math.round(((value - previousValue) / previousValue) * 1000) / 10;
  const direction = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  return { pct, direction, isNew: false };
}

function DeltaBadge({ delta }: { delta: KpiDelta }) {
  if (delta.isNew) {
    return <span className="text-xs font-medium text-[var(--color-sage-700)]">new</span>;
  }
  if (delta.pct === null) {
    return <span className="text-xs text-[var(--color-ink-500)]">—</span>;
  }
  const color = delta.direction === "up" ? "text-[var(--color-sage-700)]" : delta.direction === "down" ? "text-[var(--color-danger)]" : "text-[var(--color-ink-500)]";
  const sign = delta.pct > 0 ? "+" : "";
  return (
    <span className={`text-xs font-medium ${color}`}>
      {sign}
      {delta.pct}%
    </span>
  );
}

/** A minimal inline sparkline — one polyline, no axes/labels (this is a trend glance, not a chart). Flat (all-equal or single-point) data renders a flat mid-height line rather than dividing by a zero range. */
function Sparkline({ points }: { points: readonly number[] }) {
  if (points.length < 2) return null;
  const w = 64;
  const h = 20;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => `${i * step},${h - ((p - min) / range) * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="mt-1 text-[var(--color-sage-500)]" aria-hidden>
      <polyline points={coords} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

export default function KpiCard({ label, displayValue, value, previousValue, sparkline, approximate }: KpiCardProps) {
  const delta = computeKpiDelta(value, previousValue);
  return (
    <div className="elevation-1 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-500)]">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-2xl font-semibold text-[var(--color-ink-900)]">
          {approximate && <span className="mr-1 text-sm font-normal text-[var(--color-ink-500)]">about</span>}
          {displayValue}
        </p>
        {previousValue !== undefined && <DeltaBadge delta={delta} />}
      </div>
      {sparkline && <Sparkline points={sparkline} />}
    </div>
  );
}
