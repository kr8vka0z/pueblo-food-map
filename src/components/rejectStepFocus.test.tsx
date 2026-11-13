/**
 * rejectStepFocus.test.tsx — the four change cards' reason step (Reject,
 * Remove photo, Decline) keeps keyboard focus (#926): opening it moves focus
 * to the reason box, and Cancel hands it back to the button that opened it,
 * which stays mounted while the step is open; Escape does what Cancel does
 * and clears the typed reason; Cancel comes before the red Confirm (#926
 * decision 8). Cards are built from the same row parsers the admin pages use.
 */

import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import PhotoReviewCard from "@/components/PhotoReviewCard";
import SponsorRequestCard from "@/components/SponsorRequestCard";
import ProposalCard from "@/components/ProposalCard";
import SubmissionCard from "@/components/SubmissionCard";
import { parseProposalRow } from "@/lib/adminProposals";
import { parseSubmissionRow } from "@/lib/publicSubmissions";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const proposal = parseProposalRow({
  id: 1,
  source: "osm",
  target_venue_id: "osm-node-1",
  change_type: "update",
  proposed_diff: JSON.stringify({
    before: { phone: "719-555-0100" },
    after: { phone: "719-555-0199" },
    fields_changed: ["phone"],
  }),
  diff_hash: "h1",
  run_id: "run-1",
  anomaly: 0,
  status: "pending",
  created_at: "2026-09-01T12:00:00.000Z",
  reviewed_by: null,
  reviewed_at: null,
  applied_at: null,
});

const submission = parseSubmissionRow({
  id: 9,
  kind: "closure",
  payload: JSON.stringify({
    venueId: "manual-existing-1",
    venueName: "Main Street Grocery",
    venueAddress: "456 Main Ave, Pueblo, CO",
    issueType: "closed",
    description: "This store shut down last month.",
    contactEmail: "reporter@example.com",
  }),
  target_venue_id: "manual-existing-1",
  submitter_email: "reporter@example.com",
  status: "pending",
  created_at: "2026-07-02T09:00:00.000Z",
  reviewed_by: null,
  reviewed_at: null,
  review_reason: null,
});

const CARDS: [string, string, string, () => ReactElement][] = [
  [
    "PhotoReviewCard",
    "Reject",
    "Confirm reject",
    () => (
      <PhotoReviewCard
        photo={{
          id: 7,
          venue_id: "box-1",
          venue_name: "216 W Routt Blessing Box",
          checkin_id: null,
          checkin_kind: null,
          status: "pending",
          flag_count: 0,
          created_at: "2026-09-18T15:00:00.000Z",
        }}
      />
    ),
  ],
  [
    "SponsorRequestCard",
    "Decline",
    "Confirm decline",
    () => (
      <SponsorRequestCard
        adopter={{
          id: 7,
          venue_id: "box-1",
          venue_name: "Test Blessing Box",
          display_name: "The Martinez Family",
          email: "martinez@example.com",
          note: null,
          status: "pending",
          email_confirmed_at: "2026-09-18T15:00:00.000Z",
          created_at: "2026-09-18T14:00:00.000Z",
        }}
      />
    ),
  ],
  ["ProposalCard", "Reject", "Confirm reject", () => <ProposalCard proposal={proposal} />],
  ["SubmissionCard", "Reject", "Confirm reject", () => <SubmissionCard submission={submission} />],
];

// Cancel and Escape leave the same state behind: the step closes, focus is
// back on the opener (the same element, never remounted), the typed reason
// is gone when it reopens, and nothing is sent.
test.each(CARDS)("%s: the step opens on the reason box, Cancel and Escape close it back to %s", async (_card, trigger, confirm, card) => {
  const user = userEvent.setup();
  render(card());
  const opener = screen.getByRole("button", { name: trigger });
  const reasonBox = () => screen.queryByRole("textbox", { name: /^Reason/ });

  await user.click(opener);
  expect(reasonBox()).toHaveFocus();
  const cancel = screen.getByRole("button", { name: "Cancel" });
  expect(cancel.compareDocumentPosition(screen.getByRole("button", { name: confirm })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  await user.click(cancel);
  expect(reasonBox()).toBeNull();
  expect(screen.getByRole("button", { name: trigger })).toBe(opener);
  expect(opener).toHaveFocus();

  await user.click(opener);
  await user.type(reasonBox()!, "Duplicate");
  await user.keyboard("{Escape}");
  expect(reasonBox()).toBeNull();
  expect(opener).toHaveFocus();

  await user.click(opener);
  expect(reasonBox()).toHaveValue("");
  expect(fetchMock).not.toHaveBeenCalled();
});
