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
let confirmSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mockFetch.mockReset();
  mockRefresh.mockReset();
  vi.stubGlobal("fetch", mockFetch);
  confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  confirmSpy.mockRestore();
});

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
    const { container } = render(<ToReviewSummaryBox reviewRowCount={0} proposals={[]} />);
    expect(container.firstChild).toBeNull();
  });

  test("shows the row count and the raw proposal count", () => {
    render(<ToReviewSummaryBox reviewRowCount={2} proposals={[makeUpdateProposal(), makeDateOnlyProposal()]} />);
    expect(screen.getByText("2 to review · 2 from the data refresh")).toBeDefined();
  });
});

describe("ToReviewSummaryBox — bulk approve date-only updates", () => {
  test("no button when nothing pending is date-only", () => {
    render(<ToReviewSummaryBox reviewRowCount={1} proposals={[makeUpdateProposal()]} />);
    expect(screen.queryByRole("button", { name: /Approve all/i })).toBeNull();
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
      />,
    );
    expect(screen.getByRole("button", { name: "Approve all 2 date-only updates" })).toBeDefined();
  });

  test("declining the confirm dialog never calls fetch", async () => {
    confirmSpy.mockReturnValue(false);
    const user = userEvent.setup();
    render(<ToReviewSummaryBox reviewRowCount={1} proposals={[makeDateOnlyProposal()]} />);

    await user.click(screen.getByRole("button", { name: /Approve all/i }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0]).toMatch(/Real changes are not included/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("confirming POSTs the exact date-only ids and refreshes on success", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ approved: 1, skipped: [] }) });
    const user = userEvent.setup();
    render(
      <ToReviewSummaryBox
        reviewRowCount={1}
        proposals={[makeDateOnlyProposal({ row: { ...makeDateOnlyProposal().row, id: 42 } })]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Approve all/i }));

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
    render(<ToReviewSummaryBox reviewRowCount={1} proposals={[makeDateOnlyProposal()]} />);

    await user.click(screen.getByRole("button", { name: /Approve all/i }));

    await waitFor(() => expect(screen.getByText(/Something went wrong/i)).toBeDefined());
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  test("a too_many_ids response shows the specific message, not the generic one", async () => {
    mockFetch.mockResolvedValueOnce({ status: 400, json: async () => ({ ok: false, error: "too_many_ids" }) });
    const user = userEvent.setup();
    render(<ToReviewSummaryBox reviewRowCount={1} proposals={[makeDateOnlyProposal()]} />);

    await user.click(screen.getByRole("button", { name: /Approve all/i }));

    await waitFor(() =>
      expect(screen.getByText(/More than 200 date-only proposals selected — narrow the filter and retry/i)).toBeDefined(),
    );
  });

  test("the result line is aria-live=\"polite\"", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ approved: 1, skipped: [] }) });
    const user = userEvent.setup();
    render(<ToReviewSummaryBox reviewRowCount={1} proposals={[makeDateOnlyProposal()]} />);

    await user.click(screen.getByRole("button", { name: /Approve all/i }));
    await waitFor(() => {
      const resultLine = screen.getByText("Approved 1. Skipped 0.");
      expect(resultLine.getAttribute("aria-live")).toBe("polite");
    });
  });
});
