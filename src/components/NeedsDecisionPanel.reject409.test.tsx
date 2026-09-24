/**
 * Regression test for #568 item 4 — new file because
 * src/components/NeedsDecisionPanel.test.tsx is an existing test file
 * (write-guarded on fix/* branches); this covers ONLY the RejectButton
 * 409-branch removal, not the rest of the component (see that file for
 * everything else).
 *
 * Before the fix, RejectButton treated a 409 exactly like a 404 (silent
 * refresh) — dead code, since every reject route it calls only ever
 * returns 404 for a stale row (see NeedsDecisionPanel.tsx's own header).
 * This proves the button no longer special-cases 409: a real 409 now shows
 * "Try again" and does NOT refresh, same as any other unexpected failure.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReviewSubmission } from "@/components/SubmissionsReviewView";
import type { ParsedProposal } from "@/lib/adminProposals";
import type { VenueLookup } from "@/lib/adminVenueLookup";
import type { AdminBoxPhotoRow } from "@/lib/boxPhotos";
import type { AdminBoxAdopterRow } from "@/lib/boxAdopters";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

import NeedsDecisionPanel from "@/components/NeedsDecisionPanel";

const mockFetch = vi.fn();
let confirmSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mockFetch.mockReset();
  mockPush.mockReset();
  mockRefresh.mockReset();
  vi.stubGlobal("fetch", mockFetch);
  confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  confirmSpy.mockRestore();
});

function emptyProps() {
  return {
    submissions: [] as ReviewSubmission[],
    submissionsTotal: 0,
    proposals: [] as ParsedProposal[],
    proposalsTotal: 0,
    venueLookup: {} as Record<string, VenueLookup>,
    photos: [] as AdminBoxPhotoRow[],
    photosTotal: 0,
    adopters: [] as AdminBoxAdopterRow[],
    adoptersTotal: 0,
  };
}

function makeSubmission(overrides: Partial<ReviewSubmission> = {}): ReviewSubmission {
  return {
    id: 5,
    kind: "new_venue",
    createdAt: "2026-09-01T12:00:00.000Z",
    submitterEmail: "suggester@example.com",
    targetVenueId: null,
    parseError: false,
    payload: {
      venueName: "New Pantry",
      address: "1 Test St",
      category: "pantry",
      acceptsSnap: true,
      acceptsWic: false,
      submitterEmail: "suggester@example.com",
    },
    ...overrides,
  } as ReviewSubmission;
}

describe("NeedsDecisionPanel — RejectButton, a real 409", () => {
  test("shows 'Try again' and does not refresh (409 is no longer treated as a stale-row signal)", async () => {
    mockFetch.mockResolvedValueOnce({ status: 409, json: async () => ({ ok: false, error: "conflict" }) } as Response);
    render(<NeedsDecisionPanel {...emptyProps()} submissions={[makeSubmission()]} submissionsTotal={1} />);

    await userEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(await screen.findByText("Try again")).toBeDefined();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  test("a 404 (genuinely stale row) still refreshes quietly, unaffected by this change", async () => {
    mockFetch.mockResolvedValueOnce({ status: 404, json: async () => ({ ok: false, error: "Not found" }) } as Response);
    render(<NeedsDecisionPanel {...emptyProps()} submissions={[makeSubmission()]} submissionsTotal={1} />);

    await userEvent.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Try again")).toBeNull();
  });
});
