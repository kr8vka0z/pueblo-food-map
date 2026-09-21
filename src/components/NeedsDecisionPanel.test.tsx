/**
 * NeedsDecisionPanel tests (admin dashboard build). Covers:
 *   - Empty state (task spec's exact copy) when every group is 0.
 *   - Each group renders only when it has items, with its own "+N more →"
 *     link once totalCount exceeds the number of rows shown.
 *   - Each of the four row kinds' approve/reject action hits the SAME route
 *     its full queue's own component calls (reject POSTs `{reason: null}` —
 *     this panel's own one-click simplification, see the component's file
 *     header) and refreshes on success.
 *   - A proposal's per-changeType action variant: link_health -> Link, not
 *     a button; remove -> confirm() + danger "Archive"; add/update -> plain
 *     "Approve".
 *
 * next/navigation's useRouter is mocked module-wide, same pattern every
 * other *ReviewView.test.tsx file in this app already uses.
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

// ─── Fixtures ───────────────────────────────────────────────────────────────

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

function makeProposal(overrides: Partial<ParsedProposal["row"]> = {}, diffOverrides: Record<string, unknown> = {}): ParsedProposal {
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
      ...overrides,
    },
    parseError: false,
    diff: { before: { phone: "111" }, after: { phone: "222" }, fields_changed: ["phone"], ...diffOverrides },
  } as ParsedProposal;
}

function makePhoto(overrides: Partial<AdminBoxPhotoRow> = {}): AdminBoxPhotoRow {
  return {
    id: 10,
    venue_id: "box-1",
    venue_name: "Blessing Box - Routt",
    checkin_id: null,
    checkin_kind: null,
    status: "pending",
    flag_count: 0,
    created_at: "2026-09-01T12:00:00.000Z",
    ...overrides,
  };
}

function makeAdopter(overrides: Partial<AdminBoxAdopterRow> = {}): AdminBoxAdopterRow {
  return {
    id: 20,
    venue_id: "box-1",
    venue_name: "Blessing Box - Routt",
    display_name: "Jamie R.",
    email: "jamie@example.com",
    note: null,
    status: "pending",
    email_confirmed_at: "2026-09-01T00:00:00.000Z",
    created_at: "2026-09-01T12:00:00.000Z",
    ...overrides,
  };
}

function okJsonResponse(status = 200) {
  return { status, json: async () => ({ ok: true }) } as Response;
}

describe("NeedsDecisionPanel — empty state", () => {
  test("shows the task spec's exact copy when nothing is pending anywhere", () => {
    render(<NeedsDecisionPanel {...emptyProps()} />);
    expect(
      screen.getByText(
        "Nothing waiting on you. New suggestions, data changes, box photos and adoption requests show up here as they come in.",
      ),
    ).toBeDefined();
  });
});

describe("NeedsDecisionPanel — suggestions group", () => {
  test("renders a row and a working Reject action (POST reason: null, then refresh)", async () => {
    mockFetch.mockResolvedValueOnce(okJsonResponse());
    render(<NeedsDecisionPanel {...emptyProps()} submissions={[makeSubmission()]} submissionsTotal={1} />);

    expect(screen.getByText("New Pantry")).toBeDefined();
    expect(screen.getByRole("link", { name: /Review & approve/ }).getAttribute("href")).toBe(
      "/admin/venues/new?submission=5",
    );

    await userEvent.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/admin/submissions/5/reject",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ reason: null }) }),
    );
  });

  test("'+N more' link appears once totalCount exceeds the shown rows and points at the full queue", () => {
    render(<NeedsDecisionPanel {...emptyProps()} submissions={[makeSubmission()]} submissionsTotal={4} />);
    const more = screen.getByText("+3 more →");
    expect(more.getAttribute("href")).toBe("/admin/submissions");
  });
});

describe("NeedsDecisionPanel — data refresh group", () => {
  test("update proposal: plain Approve button POSTs approve and refreshes", async () => {
    mockFetch.mockResolvedValueOnce(okJsonResponse());
    render(<NeedsDecisionPanel {...emptyProps()} proposals={[makeProposal()]} proposalsTotal={1} />);

    await userEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenCalledWith("/api/admin/proposals/1/approve", { method: "POST" });
  });

  test("remove proposal: confirm() gates a danger 'Archive' button before approving", async () => {
    mockFetch.mockResolvedValueOnce(okJsonResponse());
    render(
      <NeedsDecisionPanel
        {...emptyProps()}
        proposals={[makeProposal({ change_type: "remove" }, { fields_changed: [] })]}
        proposalsTotal={1}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Archive" }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith("/api/admin/proposals/1/approve", { method: "POST" }));
  });

  test("link_health proposal: no blind Approve button, only a Link to the venue's edit screen", () => {
    render(
      <NeedsDecisionPanel {...emptyProps()} proposals={[makeProposal({ source: "link_health" })]} proposalsTotal={1} />,
    );

    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.getByRole("link", { name: /Review & fix link/ }).getAttribute("href")).toBe(
      "/admin/venues/osm-node-1/edit?proposal=1",
    );
  });

  test("'Unusual run' badge shows when anomaly = 1", () => {
    render(<NeedsDecisionPanel {...emptyProps()} proposals={[makeProposal({ anomaly: 1 })]} proposalsTotal={1} />);
    expect(screen.getByText("Unusual run")).toBeDefined();
  });
});

describe("NeedsDecisionPanel — blessing boxes group", () => {
  test("photo row: Approve POSTs the same route BoxPhotosReviewView uses", async () => {
    mockFetch.mockResolvedValueOnce(okJsonResponse());
    render(<NeedsDecisionPanel {...emptyProps()} photos={[makePhoto()]} photosTotal={1} />);

    expect(screen.getByText("Blessing Box - Routt")).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith("/api/admin/box-photos/10/approve", { method: "POST" }));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  test("adopter row: shows email-confirmed state, and a 409 approve response surfaces the unconfirmed message", async () => {
    mockFetch.mockResolvedValueOnce({ status: 409, json: async () => ({}) } as Response);
    render(
      <NeedsDecisionPanel
        {...emptyProps()}
        adopters={[makeAdopter({ email_confirmed_at: null })]}
        adoptersTotal={1}
      />,
    );

    expect(screen.getByText(/Awaiting confirmation/)).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(await screen.findByText("Not confirmed yet")).toBeDefined();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  test("heading count combines photos + adopters totals", () => {
    render(
      <NeedsDecisionPanel {...emptyProps()} photos={[makePhoto()]} photosTotal={2} adopters={[makeAdopter()]} adoptersTotal={3} />,
    );
    expect(screen.getByText("Blessing boxes")).toBeDefined();
    expect(screen.getByText("(5)")).toBeDefined();
  });
});
