/**
 * SuggestionsBox — the venue edit page's "Suggestions to review" box.
 * Originally #674 ("fold the Data refresh tab into Places"): one
 * ProposalCard per pending `change_proposals` row targeting THIS venue.
 * #675 ("fold the Review queue into Places") generalizes this to a
 * discriminated `ReviewItem[]` (src/lib/publicSubmissions.ts) so a pending
 * public report (`public_submissions`, "closure" kind) targeting this same
 * venue renders in the SAME box, dispatching to SubmissionCard instead of
 * ProposalCard — an admin reviewing one venue now sees every open question
 * about it in one place, regardless of which table it came from. A
 * `new_venue` submission never appears here (it has no existing venue row
 * to attach to — see VenueListView.tsx's own "Suggested new place" row and
 * SubmissionCard.tsx's own header for where that kind renders instead).
 *
 * Renders nothing at all when there is nothing pending, same as before —
 * an unedited place's edit page looks exactly as it did before this box
 * existed.
 *
 * Deliberately NOT a client component: it owns no state of its own (every
 * card manages its own approve/reject/mark-done state) and the edit page
 * (src/app/admin/venues/[id]/edit/page.tsx) already does the D1 reads this
 * box needs server-side, same "Server Component fetches, presentational
 * children render" split every other admin page/box pair in this app
 * follows (WaitingToPublishBox.tsx is the closest sibling).
 */

import ProposalCard from "@/components/ProposalCard";
import SubmissionCard from "@/components/SubmissionCard";
import { reviewItemKey, type ReviewItem } from "@/lib/publicSubmissions";
import type { VenueLookup } from "@/lib/adminVenueLookup";

export interface SuggestionsBoxProps {
  items: ReviewItem[];
  venue: VenueLookup;
}

export default function SuggestionsBox({ items, venue }: SuggestionsBoxProps) {
  if (items.length === 0) return null;

  return (
    <div className="max-w-2xl">
      <h2 className="mb-2 text-sm font-semibold text-[var(--color-ink-700)]">
        Suggestions to review ({items.length})
      </h2>
      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <li key={reviewItemKey(item)}>
            {item.kind === "proposal" ? (
              <ProposalCard proposal={item.proposal} venue={venue} />
            ) : (
              <SubmissionCard submission={item.submission} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
