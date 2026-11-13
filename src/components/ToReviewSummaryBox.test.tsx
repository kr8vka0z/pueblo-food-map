/**
 * ToReviewSummaryBox tests — the bulk "Approve all date-only updates" cases
 * moved from ProposalsReviewView.test.tsx (issue #674: that queue/component
 * is gone; this box is its bulk-approve action's new home — see the
 * component's own header for why), plus the summary line itself.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ParsedProposal } from "@/lib/adminProposals";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

import ToReviewSummaryBox from "@/components/ToReviewSummaryBox";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  mockRefresh.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Opens the on-page confirm, then presses its own Approve button (the second press). Every caller has one date-only update, so the words are singular (#926 A19). */
async function approveViaConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Approve 1 date-only update" }));
  await user.click(screen.getByRole("button", { name: "Approve 1 update" }));
}

/** The one shape POST /api/admin/proposals/approve-date-only ever bulk-approves. */
function makeDateOnlyProposal(overrides: Partial<ParsedProposal> = {}): ParsedProposal {
  return {
    row: {
      id: 20,
      source: "plentiful",
      target_venue_id: "plentiful-pantry-1",
      change_type: "update",
      proposed_diff: "",
      diff_hash: "h20",
      run_id: "run-1",
      anomaly: 0,
      status: "pending",
      created_at: "2026-09-01T12:00:00.000Z",
      reviewed_by: null,
      reviewed_at: null,
      applied_at: null,
    },
    parseError: false,
    diff: { before: { last_verified: "2026-08-01" }, after: { last_verified: "2026-09-01" }, fields_changed: ["last_verified"] },
    ...overrides,
  } as ParsedProposal;
}

function makeUpdateProposal(): ParsedProposal {
  return {
    row: {
      id: 1,
      source: "osm",
      target_venue_id: "osm-node-1",
      change_type: "update",
      proposed_diff: "",
      diff_hash: "h1",
      run_id: "run-1",
      anomaly: 0,
      status: "pending",
      created_at: "2026-09-01T12:00:00.000Z",
      reviewed_by: null,
      reviewed_at: null,
      applied_at: null,
    },
    parseError: false,
    diff: { before: { phone: "1" }, after: { phone: "2" }, fields_changed: ["phone"] },
  } as ParsedProposal;
}

describe("ToReviewSummaryBox — summary line", () => {
  test("renders nothing when nothing is pending", () => {
    const { container } = render(<ToReviewSummaryBox reviewRowCount={0} proposals={[]} submissionCount={0} />);
    expect(container.firstChild).toBeNull();
  });

  test("shows the row count, the raw proposal count, and the raw submission count", () => {
    render(<ToReviewSummaryBox reviewRowCount={2} proposals={[makeUpdateProposal(), makeDateOnlyProposal()]} submissionCount={3} />);
    expect(screen.getByText("2 to review · 2 from the data refresh, 3 from the public")).toBeDefined();
  });
});

describe("ToReviewSummaryBox — bulk approve date-only updates", () => {
  test("no button when nothing pending is date-only", () => {
    render(<ToReviewSummaryBox reviewRowCount={1} proposals={[makeUpdateProposal()]} submissionCount={0} />);
    expect(screen.queryByRole("button", { name: /date-only/i })).toBeNull();
  });

  test("shows the button with the correct count when date-only proposals are present", () => {
    render(
      <ToReviewSummaryBox
        reviewRowCount={2}
        proposals={[
          makeDateOnlyProposal({ row: { ...makeDateOnlyProposal().row, id: 20 } }),
          makeDateOnlyProposal({ row: { ...makeDateOnlyProposal().row, id: 21 } }),
          makeUpdateProposal(),
        ]}
        submissionCount={0}
      />,
    );
    expect(screen.getByRole("button", { name: "Approve all 2 date-only updates" })).toBeDefined();
  });

  test("the first press only asks; Cancel sends nothing and puts focus back on the button", async () => {
    const user = userEvent.setup();
    render(<ToReviewSummaryBox reviewRowCount={1} proposals={[makeDateOnlyProposal()]} submissionCount={0} />);

    await user.click(screen.getByRole("button", { name: "Approve 1 date-only update" }));
    expect(screen.getByText(/Real changes are not included/)).toBeDefined();
    expect(mockFetch).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Approve 1 date-only update" })).toHaveFocus();
  });

  test("confirming POSTs the exact date-only ids and refreshes on success", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ approved: 1, skipped: [] }) });
    const user = userEvent.setup();
    render(
      <ToReviewSummaryBox
        reviewRowCount={1}
        proposals={[makeDateOnlyProposal({ row: { ...makeDateOnlyProposal().row, id: 42 } })]}
        submissionCount={0}
      />,
    );

    await approveViaConfirm(user);

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/proposals/approve-date-only",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ ids: [42] }) }),
      ),
    );
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Approved 1. Skipped 0.")).toBeDefined();
  });

  test("a failed request shows an inline error and never refreshes", async () => {
    mockFetch.mockResolvedValueOnce({ status: 500, json: async () => ({ ok: false }) });
    const user = userEvent.setup();
    render(<ToReviewSummaryBox reviewRowCount={1} proposals={[makeDateOnlyProposal()]} submissionCount={0} />);

    await approveViaConfirm(user);

    await waitFor(() => expect(screen.getByText(/Some updates may not have been approved/)).toBeDefined());
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  test("a too_many_ids response shows the specific message, not the generic one", async () => {
    mockFetch.mockResolvedValueOnce({ status: 400, json: async () => ({ ok: false, error: "too_many_ids" }) });
    const user = userEvent.setup();
    render(<ToReviewSummaryBox reviewRowCount={1} proposals={[makeDateOnlyProposal()]} submissionCount={0} />);

    await approveViaConfirm(user);

    await waitFor(() => expect(screen.getByText(/more than 200 date-only proposals were selected/i)).toBeDefined());
  });

  test("the result line is aria-live=\"polite\"", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ approved: 1, skipped: [] }) });
    const user = userEvent.setup();
    render(<ToReviewSummaryBox reviewRowCount={1} proposals={[makeDateOnlyProposal()]} submissionCount={0} />);

    await approveViaConfirm(user);
    await waitFor(() => {
      const resultLine = screen.getByText("Approved 1. Skipped 0.");
      expect(resultLine.getAttribute("aria-live")).toBe("polite");
    });
  });
});
