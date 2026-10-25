/**
 * Care and Share review cards (Venue Data Rebuild step 2) must show what
 * Kyle is deciding — which listing, how close, the source's own schedule
 * words — never the plain "no other details changed" confirmation.
 */
import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ParsedProposal } from "@/lib/adminProposals";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import ProposalCard from "@/components/ProposalCard";
import { summarizeProposalForRow } from "@/components/VenueListView";

function proposal(diff: ParsedProposal["diff"]): ParsedProposal {
  return {
    row: {
      id: 1, source: "care_and_share", target_venue_id: "venue-1", change_type: "update", proposed_diff: "", diff_hash: "h", run_id: "r",
      anomaly: 0, status: "pending", created_at: "2026-10-26T00:00:00.000Z", reviewed_by: null, reviewed_at: null, applied_at: null,
    },
    parseError: false,
    diff,
  } as ParsedProposal;
}

const base = { before: { last_verified: "2026-10-01" }, after: { last_verified: "2026-10-26" }, fields_changed: ["last_verified"] };

describe("ProposalCard — Care and Share", () => {
  test("an unconfirmed match names the listing, distance and phone evidence", () => {
    const p = proposal({ ...base, meta: { match: { upstream_id: "cas-20467", name: "RMSER Pueblo", distance_m: 73, name_score: 0.5, same_phone: false } } });
    render(<ProposalCard proposal={p} />);
    expect(screen.getByText(/RMSER Pueblo/)).toBeInTheDocument();
    expect(screen.getByText(/73 m away/)).toBeInTheDocument();
    expect(screen.queryByText(/no other details changed/)).not.toBeInTheDocument();
    expect(summarizeProposalForRow(p)).toBe("Care and Share listing — same place?");
  });

  test("a schedule it couldn't read shows their words and how to stop seeing it", () => {
    const p = proposal({ ...base, meta: { needs_review: ['note: "And 4 to 6"'], schedule_text: "Monday 10:00 AM–12:00 PM (And 4 to 6)" } });
    render(<ProposalCard proposal={p} />);
    expect(screen.getByText(/Monday 10:00 AM–12:00 PM \(And 4 to 6\)/)).toBeInTheDocument();
    expect(screen.getByText(/won't come back until their schedule changes/)).toBeInTheDocument();
    expect(screen.queryByText(/no other details changed/)).not.toBeInTheDocument();
    expect(summarizeProposalForRow(p)).toBe("Hours need a look");
  });

  test("a listed-twice card names every listing", () => {
    const p = proposal({
      ...base,
      meta: {
        match: {
          upstream_ids: ["cas-20403", "cas-24531"],
          listings: [
            { upstream_id: "cas-20403", name: "Lynn Gardens Baptist Church", address: "3804 W. Pueblo Blvd, Pueblo, CO 81005" },
            { upstream_id: "cas-24531", name: "Lynn gardens baptist church", address: "3804 W Pueblo Blvd, Pueblo, CO 81005" },
          ],
        },
      },
    });
    render(<ProposalCard proposal={p} />);
    expect(screen.getByText(/lists 2 places/)).toBeInTheDocument();
    expect(screen.getByText(/Rejecting means neither listing is proposed again/)).toBeInTheDocument();
    expect(screen.getByText(/Lynn gardens baptist church/)).toBeInTheDocument();
  });

  test("a first-run link says so, and that rejecting removes it", () => {
    const p = proposal({
      before: { phone: "", last_verified: "2026-10-01" },
      after: { phone: "719-555-0100", last_verified: "2026-10-26" },
      fields_changed: ["phone", "last_verified"],
      meta: { new_alias: { upstream_id: "cas-20349", name: "Salvation Army of Pueblo", distance_m: 12, name_score: 1, same_phone: false } },
    });
    render(<ProposalCard proposal={p} />);
    expect(screen.getByText(/New link/)).toBeInTheDocument();
    expect(screen.getByText(/Salvation Army of Pueblo/)).toBeInTheDocument();
    expect(screen.getByText(/Rejecting this also removes the link/)).toBeInTheDocument();
  });
});
