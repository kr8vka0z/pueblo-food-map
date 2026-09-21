/**
 * BoxesWaitingChips — the /admin/boxes tab's "Waiting on you:" strip
 * (approved mockup Direction B). Deliberately narrower than the Dashboard's
 * "Needs a decision" panel: ONLY box photos + adoption requests, per the
 * task spec ("Omit publish/suggestion chips — Dashboard-only") — those two
 * queues live on this tab because they're blessing-boxes-specific; publish
 * and public-submission review belong to /admin's own to-do list, not a
 * second copy here.
 */

import Link from "next/link";

export interface BoxesWaitingChipsProps {
  photosCount: number;
  adoptersCount: number;
}

const chipClass =
  "inline-flex items-center rounded-full bg-[var(--color-clay-100)] px-3 py-1 text-sm font-medium text-[var(--color-clay-700)] " +
  "transition-colors duration-150 hover:bg-[var(--color-clay-100)]/80";

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export default function BoxesWaitingChips({ photosCount, adoptersCount }: BoxesWaitingChipsProps) {
  if (photosCount === 0 && adoptersCount === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-[var(--color-ink-700)]">Waiting on you:</span>
      {photosCount > 0 && (
        <Link href="/admin/box-photos" className={chipClass}>
          {pluralize(photosCount, "photo")} to review
        </Link>
      )}
      {adoptersCount > 0 && (
        <Link href="/admin/box-adopters" className={chipClass}>
          {pluralize(adoptersCount, "adoption request")}
        </Link>
      )}
    </div>
  );
}
