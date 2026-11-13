/**
 * Bulk "approve date-only updates" with more than the server's 200-id cap
 * waiting (#894 item 9). The button used to send every id and always got
 * too_many_ids back; it now sends the first 200 date-only ids and nothing
 * else. New file because ToReviewSummaryBox.test.tsx is write-guarded on
 * fix/ branches.
 */

import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ParsedProposal } from "@/lib/adminProposals";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import ToReviewSummaryBox from "@/components/ToReviewSummaryBox";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function proposal(id: number, diff: ParsedProposal["diff"]): ParsedProposal {
  return {
    row: {
      id,
      source: "plentiful",
      target_venue_id: `venue-${id}`,
      change_type: "update",
      proposed_diff: "",
      diff_hash: `h${id}`,
      run_id: "run-1",
      anomaly: 0,
      status: "pending",
      created_at: "2026-09-01T12:00:00.000Z",
      reviewed_by: null,
      reviewed_at: null,
      applied_at: null,
    },
    parseError: false,
    diff,
  } as ParsedProposal;
}

const dateOnly = (id: number) =>
  proposal(id, { before: { last_verified: "2026-08-01" }, after: { last_verified: "2026-09-01" }, fields_changed: ["last_verified"] });
const realChange = (id: number) => proposal(id, { before: { phone: "1" }, after: { phone: "2" }, fields_changed: ["phone"] });

test("201 date-only waiting: sends exactly the first 200 date-only ids, never a real change", async () => {
  mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ approved: 200, skipped: [] }) });
  // Real changes interleaved at the front, so a naive slice of all proposals would pick them up.
  const proposals = [realChange(1), realChange(2), ...Array.from({ length: 201 }, (_, i) => dateOnly(100 + i))];
  render(<ToReviewSummaryBox reviewRowCount={203} proposals={proposals} submissionCount={0} />);

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /200 date-only updates/ }));
  await user.click(screen.getByRole("button", { name: "Approve 200 updates" }));

  expect(mockFetch).toHaveBeenCalledTimes(1);
  const { ids } = JSON.parse(mockFetch.mock.calls[0][1].body as string) as { ids: number[] };
  expect(ids).toEqual(Array.from({ length: 200 }, (_, i) => 100 + i));
});
