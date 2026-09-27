"use client";

/**
 * BoxAdoptersReviewView — the adopt-a-box moderation queue's card list
 * (Blessing Boxes slice 6). Rendered by src/app/admin/box-adopters/page.tsx,
 * which owns the auth gate and the loadPendingAdopters() read.
 *
 * #677 ("fold Photo review and Sponsor requests into the Blessing Boxes
 * tab"): this queue and its route are going away (redirected to
 * /admin/boxes?show=review) once the box edit page's own "Things to
 * review" box (BoxReviewBox.tsx) covers the same ground — kept alive only
 * until that cleanup step deletes it. The actual card is now
 * SponsorRequestCard.tsx (extracted here so the box edit page can render
 * the exact same card, not a re-derived copy).
 */

import SponsorRequestCard from "@/components/SponsorRequestCard";
import type { AdminBoxAdopterRow } from "@/lib/boxAdopters";

export interface BoxAdoptersReviewViewProps {
  adopters: AdminBoxAdopterRow[];
}

export default function BoxAdoptersReviewView({ adopters }: BoxAdoptersReviewViewProps) {
  if (adopters.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white px-4 py-16 text-center">
        <p className="text-sm font-semibold text-[var(--color-ink-700)]">No sponsor requests to review</p>
        <p className="mt-1 text-sm text-[var(--color-ink-500)]">New applications will show up here.</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {adopters.map((adopter) => (
        <li key={adopter.id}>
          <SponsorRequestCard adopter={adopter} />
        </li>
      ))}
    </ul>
  );
}
