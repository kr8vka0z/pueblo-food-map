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

  // Item 3 regression: one-click Reject had NO confirm at all before this
  // fix — a mis-click was irreversible with zero warning.
  test("Reject asks for confirmation first; cancelling the confirm makes no request", async () => {
    confirmSpy.mockReturnValue(false);
    render(<NeedsDecisionPanel {...emptyProps()} submissions={[makeSubmission()]} submissionsTotal={1} />);

    await userEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0]).toMatch(/reject this suggestion/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // Item 5 regression: a stale card (already rejected/approved elsewhere)
  // must refresh quietly instead of showing "Try again" forever.
  test("Reject: a 404 response (row already gone) refreshes instead of showing an error", async () => {
    mockFetch.mockResolvedValueOnce({ status: 404, json: async () => ({ ok: false, error: "Not found" }) } as Response);
    render(<NeedsDecisionPanel {...emptyProps()} submissions={[makeSubmission()]} submissionsTotal={1} />);

    await userEvent.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Try again")).toBeNull();
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

  // Item 4 regression: the row used to show only a name + "Field update"
  // badge, with no source and no hint what actually changed — an admin was
  // approving a change they couldn't see.
  test("update proposal shows its source label and a one-line before -> after diff", () => {
    render(
      <NeedsDecisionPanel
        {...emptyProps()}
        proposals={[makeProposal({ source: "osm" }, { before: { phone: "111" }, after: { phone: "222" }, fields_changed: ["phone"] })]}
        proposalsTotal={1}
      />,
    );
    expect(screen.getByText(/OpenStreetMap/)).toBeDefined();
    expect(screen.getByText("111")).toBeDefined();
    expect(screen.getByText("222")).toBeDefined();
  });

  test("a single-field update still gets a plain inline Approve button", () => {
    render(
      <NeedsDecisionPanel
        {...emptyProps()}
        proposals={[makeProposal({}, { before: { phone: "111" }, after: { phone: "222" }, fields_changed: ["phone"] })]}
        proposalsTotal={1}
      />,
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeDefined();
  });

  // Item 4: more changed fields than fit on one line -> show the first plus
  // "+N more", and route Approve to the full queue instead of a blind
  // one-click approve.
  test("a multi-field update shows '+N more' and replaces Approve with a link to /admin/flags", () => {
    render(
      <NeedsDecisionPanel
        {...emptyProps()}
        proposals={[
          makeProposal(
            {},
            {
              before: { phone: "111", url: "http://old.example.com" },
              after: { phone: "222", url: "http://new.example.com" },
              fields_changed: ["phone", "url"],
            },
          ),
        ]}
        proposalsTotal={1}
      />,
    );
    expect(screen.getByText("(+1 more)")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.getByRole("link", { name: "Review in queue" }).getAttribute("href")).toBe("/admin/flags");
  });

  test("a freshness-only update (no reviewable fields) shows no diff line", () => {
    render(
      <NeedsDecisionPanel
        {...emptyProps()}
        proposals={[makeProposal({}, { before: {}, after: { last_verified: "2026-09-01" }, fields_changed: ["last_verified"] })]}
        proposalsTotal={1}
      />,
    );
    expect(screen.queryByText(/→/)).toBeNull();
  });

  // Item 5 regression: a proposal already reviewed/superseded elsewhere
  // (POST .../approve returns 409 "stale") must refresh quietly.
  test("Approve: a 409 (stale/superseded) response refreshes instead of showing an error", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 409,
      json: async () => ({ ok: false, error: "stale", message: "This proposal is no longer current." }),
    } as Response);
    render(<NeedsDecisionPanel {...emptyProps()} proposals={[makeProposal()]} proposalsTotal={1} />);

    await userEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("This proposal is no longer current.")).toBeNull();
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

  // Item 3 regression: rejecting a photo permanently deletes its stored R2
  // object (box-photos/[id]/reject/route.ts) — the confirm wording must warn
  // about that, not just say "reject."
  test("photo row: Reject's confirm warns the photo will be permanently deleted", async () => {
    confirmSpy.mockReturnValue(false);
    render(<NeedsDecisionPanel {...emptyProps()} photos={[makePhoto()]} photosTotal={1} />);

    await userEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(confirmSpy.mock.calls[0][0]).toMatch(/permanently deleted/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("adopter row: shows email-confirmed state, and a 409 approve response surfaces the unconfirmed message", async () => {
    // Real shape POST /api/admin/box-adopters/[id]/approve returns for this
    // case (route.ts: `{ ok: false, error: "unconfirmed" }`, status 409) —
    // ApproveButton's default 404/409 "already handled" behavior must NOT
    // swallow this real, non-stale business rule (item 5's own scope).
    mockFetch.mockResolvedValueOnce({ status: 409, json: async () => ({ ok: false, error: "unconfirmed" }) } as Response);
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
