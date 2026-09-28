/**
 * BoxesToReviewBox — the /admin/boxes tab's "To review" summary box (issue
 * #677, "fold Photo review and Sponsor requests into the Blessing Boxes
 * tab"): "N to review: X photos (Y reported by a visitor) and Z sponsor
 * requests," with a "Show them" link that applies the table's own "To
 * review" filter via `?show=review` (src/app/(site)/admin/boxes/page.tsx reads it
 * server-side into AllBoxesTable's `initialShowReview` prop — same
 * `?show=review` convention #674 established for the Places tab's
 * ToReviewSummaryBox.tsx). Replaces BoxesWaitingChips.tsx entirely (task
 * spec: "BoxesWaitingChips goes away too").
 *
 * Plain server component, not a client one — a single Link needs no
 * interactive state of its own (same "presentational" posture
 * WaitingToPublishBox.tsx already takes for a comparable summary box).
 * Renders nothing when there's nothing pending, same "hide when empty"
 * convention every other summary box on this app's admin pages follows.
 */

import Link from "next/link";

export interface BoxesToReviewBoxProps {
  /** Boxes with at least one photo or sponsor request pending — the "N" in the summary line, and what the "To review" chip/column count matches. */
  reviewingBoxCount: number;
  /** Every pending/flagged photo across every box (not just the one this box's own table column can show per row) — the old /admin/box-photos queue's own count, so "counts match the old tabs" holds. */
  photosCount: number;
  /** The subset of photosCount that's flagged (reported by a visitor), not merely a new upload. */
  flaggedPhotosCount: number;
  /** Every pending sponsor request across every box — the old /admin/box-adopters queue's own count. */
  sponsorRequestsCount: number;
}

const cardClass =
  "elevation-1 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white px-4 py-3 mb-4";

const linkClass =
  "inline-flex min-h-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-sage-600)] " +
  "px-4 py-2 text-sm font-semibold text-[var(--color-bone-50)] transition-colors duration-150 " +
  "hover:bg-[var(--color-sage-700)] focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2";

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export default function BoxesToReviewBox({
  reviewingBoxCount,
  photosCount,
  flaggedPhotosCount,
  sponsorRequestsCount,
}: BoxesToReviewBoxProps) {
  if (reviewingBoxCount === 0) return null;

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--color-ink-700)]">
          {reviewingBoxCount} to review: {pluralize(photosCount, "photo")}
          {flaggedPhotosCount > 0 && ` (${flaggedPhotosCount} reported by a visitor)`} and{" "}
          {pluralize(sponsorRequestsCount, "sponsor request")}
        </p>
        <Link href="/admin/boxes?show=review" className={linkClass}>
          Show them
        </Link>
      </div>
    </div>
  );
}
