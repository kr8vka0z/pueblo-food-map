"use client";

/**
 * BoxPhotosReviewView — the photo moderation queue's card list (Blessing
 * Boxes slice 5). Rendered by src/app/admin/box-photos/page.tsx, which owns
 * the auth gate and the `loadReviewQueue()` read.
 *
 * #677 ("fold Photo review and Sponsor requests into the Blessing Boxes
 * tab"): this queue and its route are going away (redirected to
 * /admin/boxes?show=review) once the box edit page's own "Things to
 * review" box (BoxReviewBox.tsx) covers the same ground — kept alive only
 * until that cleanup step deletes it. The actual card is now
 * PhotoReviewCard.tsx (extracted here so the box edit page can render the
 * exact same card, not a re-derived copy).
 */

import PhotoReviewCard from "@/components/PhotoReviewCard";
import type { AdminBoxPhotoRow } from "@/lib/boxPhotos";

export interface BoxPhotosReviewViewProps {
  photos: AdminBoxPhotoRow[];
}

export default function BoxPhotosReviewView({ photos }: BoxPhotosReviewViewProps) {
  if (photos.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white px-4 py-16 text-center">
        <p className="text-sm font-semibold text-[var(--color-ink-700)]">No photos to review</p>
        <p className="mt-1 text-sm text-[var(--color-ink-500)]">
          New uploads and reported photos will show up here.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {photos.map((photo) => (
        <li key={photo.id}>
          <PhotoReviewCard photo={photo} />
        </li>
      ))}
    </ul>
  );
}
