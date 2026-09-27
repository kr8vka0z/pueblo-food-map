/**
 * BarList — a labeled horizontal bar list (referrer groups, "most needed"
 * items), plain CSS width bars, no chart library (#680's own instruction).
 * Bar width is relative to the LARGEST value in the list, not an absolute
 * scale, so a single-item list still reads as a full bar rather than a
 * sliver.
 *
 * No "use client": static markup only.
 */

export interface BarListItem {
  label: string;
  value: number;
  /** Pre-formatted for display (e.g. "12 visits") — falls back to the raw value when omitted. */
  displayValue?: string;
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
          <span className="w-28 flex-none truncate text-sm text-[var(--color-ink-700)]" title={item.label}>
            {item.label}
          </span>
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
