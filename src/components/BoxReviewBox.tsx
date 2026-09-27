/**
 * BoxReviewBox — the box edit page's "Things to review" box (issue #677,
 * "fold Photo review and Sponsor requests into the Blessing Boxes tab"):
 * one PhotoReviewCard per pending/flagged photo and one SponsorRequestCard
 * per pending sponsor request targeting THIS box, so a box's own review
 * items resolve on its own page instead of a separate queue tab.
 *
 * A SIBLING to SuggestionsBox.tsx, not a reuse of it: SuggestionsBox is
 * typed to ParsedProposal/ProposalCard only (a single card kind), and #675
 * (folding the public Review queue into Places) is next in line to touch
 * that component again — a second, unrelated card kind riding along would
 * only add merge risk to that slice. Same "Server Component fetches,
 * presentational children render" split as SuggestionsBox and
 * WaitingToPublishBox: the edit page (venues/[id]/edit/page.tsx) does the
 * two D1 reads this box needs (loadReviewQueue/loadPendingAdopters, filtered
 * to this venue) and passes the rows down; this component owns no state of
 * its own (each card manages its own approve/reject state).
 *
 * Renders nothing when there is nothing pending — same convention every
 * other "hide when empty" edit-page box in this app follows.
 */

import PhotoReviewCard from "@/components/PhotoReviewCard";
import SponsorRequestCard from "@/components/SponsorRequestCard";
import type { AdminBoxPhotoRow } from "@/lib/boxPhotos";
import type { AdminBoxAdopterRow } from "@/lib/boxAdopters";

export interface BoxReviewBoxProps {
  photos: AdminBoxPhotoRow[];
  adopters: AdminBoxAdopterRow[];
}

export default function BoxReviewBox({ photos, adopters }: BoxReviewBoxProps) {
  const total = photos.length + adopters.length;
  if (total === 0) return null;

  return (
    <div className="max-w-2xl">
      <h2 className="mb-2 text-sm font-semibold text-[var(--color-ink-700)]">Things to review ({total})</h2>
      <ul className="flex flex-col gap-4">
        {photos.map((photo) => (
          <li key={`photo-${photo.id}`}>
            <PhotoReviewCard photo={photo} />
          </li>
        ))}
        {adopters.map((adopter) => (
          <li key={`adopter-${adopter.id}`}>
            <SponsorRequestCard adopter={adopter} />
          </li>
        ))}
      </ul>
    </div>
  );
}
