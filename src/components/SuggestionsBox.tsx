/**
 * SuggestionsBox — the venue edit page's "Suggestions to review" box (issue
 * #674, "fold the Data refresh tab into Places"): one ProposalCard per
 * pending `change_proposals` row targeting THIS venue, all sharing the same
 * `venue` context (source/found-date/field diff/triage reading, and each
 * card's own per-type action — see ProposalCard.tsx's own header for the
 * update/remove/link_health/rename rules, unchanged here). Renders nothing
 * at all when there is nothing pending, so an unedited place's edit page
 * looks exactly as it did before this box existed.
 *
 * Deliberately NOT a client component: it owns no state of its own (every
 * card manages its own approve/reject state) and the edit page
 * (src/app/admin/venues/[id]/edit/page.tsx) already does the one D1 read
 * this box needs server-side, same "Server Component fetches, presentational
 * children render" split every other admin page/box pair in this app
 * follows (WaitingToPublishBox.tsx is the closest sibling).
 */

import ProposalCard from "@/components/ProposalCard";
import type { ParsedProposal } from "@/lib/adminProposals";
import type { VenueLookup } from "@/lib/adminVenueLookup";

export interface SuggestionsBoxProps {
  proposals: ParsedProposal[];
  venue: VenueLookup;
}

export default function SuggestionsBox({ proposals, venue }: SuggestionsBoxProps) {
  if (proposals.length === 0) return null;

  return (
    <div className="max-w-2xl">
      <h2 className="mb-2 text-sm font-semibold text-[var(--color-ink-700)]">
        Suggestions to review ({proposals.length})
      </h2>
      <ul className="flex flex-col gap-4">
        {proposals.map((proposal) => (
          <li key={proposal.row.id}>
            <ProposalCard proposal={proposal} venue={venue} />
          </li>
        ))}
      </ul>
    </div>
  );
}
