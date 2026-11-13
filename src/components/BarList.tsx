/**
 * BarList — a labeled horizontal bar list (referrer groups, "most needed"
 * items), plain CSS width bars, no chart library (#680's own instruction).
 * Bar width is relative to the LARGEST value in the list, not an absolute
 * scale, so a single-item list still reads as a full bar rather than a
 * sliver.
 *
 * No "use client": static markup only.
 */

import { linkClass } from "@/lib/adminCardStyles";

// The name column: 112 px on a phone; from 640 up 40% of the row (never under
// 112), so ordinary names fit where the row has room instead of being cut
// to 112 at every width (#926). A longer name wraps onto a second line
// instead of being cut off: DESIGN.md says 320 must not cut anything off, and
// box names ("Preview Box — Riverside Trailhead") ran past 112 at every width.
const NAME_WIDTH = "w-28 sm:w-[max(7rem,40%)]";

export interface BarListItem {
  label: string;
  value: number;
  /** Pre-formatted for display (e.g. "12 visits") — falls back to the raw value when omitted. */
  displayValue?: string;
  /** Wraps the label in a link when set — added for #681's "most opened places" list, which links each place to its edit page. Every other caller omits this and keeps a plain label. */
  href?: string;
}

export interface BarListProps {
  items: readonly BarListItem[];
  emptyMessage: string;
}

export default function BarList({ items, emptyMessage }: BarListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--color-ink-500)]">{emptyMessage}</p>;
  }

  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          {item.href ? (
            <a
              href={item.href}
              className={`${linkClass} ${NAME_WIDTH} flex-none break-words text-sm`}
              title={item.label}
            >
              {item.label}
            </a>
          ) : (
            <span className={`${NAME_WIDTH} flex-none break-words text-sm text-[var(--color-ink-700)]`} title={item.label}>
              {item.label}
            </span>
          )}
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-bone-100)]">
            <span
              className="block h-full rounded-full bg-[var(--color-sage-600)]"
              style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 4 : 0)}%` }}
            />
          </span>
          <span className="w-10 flex-none text-right text-sm text-[var(--color-ink-500)]">{item.displayValue ?? item.value}</span>
        </li>
      ))}
    </ul>
  );
}
