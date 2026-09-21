/**
 * BoxHealthList — renders a ranked list of src/lib/boxHealth.ts's
 * BoxHealthEntry rows. Shared by THREE call sites that must never disagree
 * about what a box's status means or how it reads: the /admin Dashboard's
 * "Boxes that need help" panel (capped top ~4, "needs-help" variant) and
 * the /admin/boxes tab's fuller "Needs help now" / "Gone quiet" lists
 * (unlimited, "needs-help"/"quiet" variants) — one presentational component,
 * fed already-ranked-and-limited entries by each caller
 * (src/lib/boxHealth.ts's rankNeedsHelp/rankQuiet), rather than three
 * hand-copied row renderers that could drift on color, label, or relative-
 * time wording.
 *
 * No "use client": every row is plain markup + a real navigation Link (to
 * the box's edit screen) — nothing here needs client-side state.
 */

import Link from "next/link";
import type { BoxHealthEntry, BoxHealthStatus } from "@/lib/boxHealth";

export interface BoxHealthListProps {
  entries: BoxHealthEntry[];
  /** "needs-help" shows the latest report's kind + note; "quiet" shows days since the last report + caretaker instead (there is no unresolved report to show). */
  variant: "needs-help" | "quiet";
  emptyMessage: string;
}

// Colors match the task spec's own assignment: filled/took -> sage (ok,
// handled by the Dashboard/tab never ranking an "ok" box into either list),
// low -> warning (amber), empty -> danger (red), problem -> clay, quiet ->
// ink-400 (grey). No "-100" background token exists for warning/danger in
// DESIGN.md, so the dot uses the full-strength color at a small size rather
// than inventing a new token.
const STATUS_META: Record<BoxHealthStatus, { label: string; dotClass: string; textClass: string }> = {
  ok: { label: "OK", dotClass: "bg-[var(--color-sage-500)]", textClass: "text-[var(--color-sage-700)]" },
  low: { label: "Low", dotClass: "bg-[var(--color-warning)]", textClass: "text-[var(--color-warning)]" },
  empty: { label: "Empty", dotClass: "bg-[var(--color-danger)]", textClass: "text-[var(--color-danger)]" },
  problem: { label: "Problem", dotClass: "bg-[var(--color-clay-500)]", textClass: "text-[var(--color-clay-700)]" },
  quiet: { label: "Quiet", dotClass: "bg-[var(--color-ink-400)]", textClass: "text-[var(--color-ink-500)]" },
};

function formatRelativeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function BoxHealthList({ entries, variant, emptyMessage }: BoxHealthListProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-[var(--color-ink-500)]">{emptyMessage}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => {
        const meta = STATUS_META[entry.health.status];
        return (
          <li key={entry.venueId}>
            <Link
              href={`/admin/venues/${entry.venueId}/edit`}
              className="flex min-h-11 items-start gap-2 rounded-[var(--radius-md)] px-2 py-1.5 -mx-2 transition-colors duration-150 hover:bg-[var(--color-bone-100)]"
            >
              <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${meta.dotClass}`} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-[var(--color-ink-700)]">{entry.name}</span>
                {variant === "needs-help" ? (
                  <span className={`block text-xs ${meta.textClass}`}>
                    {meta.label}
                    {entry.health.latest?.note ? ` — ${entry.health.latest.note}` : ""}
                    {entry.health.daysSinceLastReport !== null && (
                      <> · {formatRelativeDays(entry.health.daysSinceLastReport)}</>
                    )}
                  </span>
                ) : (
                  <span className="block text-xs text-[var(--color-ink-500)]">
                    {entry.health.daysSinceLastReport === null
                      ? "No reports yet"
                      : `Quiet ${formatRelativeDays(entry.health.daysSinceLastReport)}`}
                    {" · "}
                    {entry.caretaker ? `Cared for by ${entry.caretaker}` : "No caretaker"}
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
