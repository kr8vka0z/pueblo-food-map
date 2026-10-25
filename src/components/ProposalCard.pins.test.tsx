/**
 * The review card shows what the venue itself told us beside a change that
 * would overwrite it (meta.pins, Venue Data Rebuild step 1), and a
 * hand-checked removal says why instead of "no longer lists".
 */
import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ParsedProposal } from "@/lib/adminProposals";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import ProposalCard from "@/components/ProposalCard";

function proposal(changeType: "update" | "remove", source: string, diff: ParsedProposal["diff"]): ParsedProposal {
  return {
    row: {
      id: 1, source, target_venue_id: "venue-1", change_type: changeType, proposed_diff: "", diff_hash: "h", run_id: "r",
      anomaly: 0, status: "pending", created_at: "2026-10-26T00:00:00.000Z", reviewed_by: null, reviewed_at: null, applied_at: null,
    },
    parseError: false,
    diff,
  } as ParsedProposal;
}

describe("ProposalCard venue pins and source notes", () => {
  test("a change to a pinned field shows the venue's word, its date and the note", () => {
    render(
      <ProposalCard
        proposal={proposal("update", "plentiful", {
          before: { phone: "719-555-0100" },
          after: { phone: "719-555-0199" },
          fields_changed: ["phone", "last_verified"],
          meta: { pins: [{ field: "phone", pinned_at: "2026-10-12T00:00:00.000Z", pinned_by: "a", note: "Heather, by email", age_days: 14, stale: false }] },
        })}
      />,
    );
    expect(screen.getByText(/The venue told us the phone/)).toBeInTheDocument();
    expect(screen.getByText(/Oct 12, 2026 \(Heather, by email\)/)).toBeInTheDocument();
  });

  test("a stale pin says it is over a year old", () => {
    render(
      <ProposalCard
        proposal={proposal("update", "plentiful", {
          before: { phone: "1" },
          after: { phone: "2" },
          fields_changed: ["phone"],
          meta: { pins: [{ field: "phone", pinned_at: "2025-01-01T00:00:00.000Z", pinned_by: null, note: null, age_days: 400, stale: true }] },
        })}
      />,
    );
    expect(screen.getByText(/over a year ago/)).toBeInTheDocument();
  });

  test("a website removal shows its reason and source link", () => {
    render(
      <ProposalCard
        proposal={proposal("remove", "website", {
          before: { id: "venue-1", name: "Main Location" },
          after: null,
          fields_changed: [],
          meta: { source_url: "https://careandshare.org/contact/", summary: "Not open to the public." },
        })}
      />,
    );
    expect(screen.getByText(/Not open to the public\./)).toBeInTheDocument();
    expect(screen.queryByText(/no longer lists/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /careandshare\.org/ })).toHaveAttribute("href", "https://careandshare.org/contact/");
  });
});
