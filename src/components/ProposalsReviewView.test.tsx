/**
 * ProposalsReviewView tests. Covers the issue's own acceptance shape:
 *   - Empty state when there's nothing pending.
 *   - Each card shows the venue + a clear before/after diff for `update`.
 *   - `remove` cards require a confirm() before POSTing approve, and use
 *     the danger button treatment — never a single click.
 *   - `link_health` cards render NO Approve button, only a real Link to the
 *     venue's edit screen — approving one must never blindly apply
 *     anything.
 *   - Reject flow (every kind) — reveal reason, POST reject, refresh on
 *     success, inline error (including the 409 "stale" message) on failure.
 *   - A 409 stale response from approve surfaces its message inline rather
 *     than a generic failure string.
 *
 * next/navigation's useRouter is mocked module-wide, same pattern as
 * SubmissionsReviewView.test.tsx.
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

import ProposalsReviewView from "@/components/ProposalsReviewView";

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

function makeUpdateProposal(overrides: Partial<ParsedProposal> = {}): ParsedProposal {
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
    diff: {
      before: { phone: "719-555-0100", last_verified: "2026-08-01" },
      after: { phone: "719-555-0199", last_verified: "2026-09-01" },
      fields_changed: ["phone", "last_verified"],
    },
    ...overrides,
  } as ParsedProposal;
}

function makeRemoveProposal(): ParsedProposal {
  return {
    row: {
      id: 2,
      source: "plentiful",
      target_venue_id: "plentiful-old-pantry",
      change_type: "remove",
      proposed_diff: "",
      diff_hash: "h2",
      run_id: "run-1",
      anomaly: 0,
      status: "pending",
      created_at: "2026-09-01T12:00:00.000Z",
      reviewed_by: null,
      reviewed_at: null,
      applied_at: null,
    },
    parseError: false,
    diff: { before: { id: "plentiful-old-pantry", name: "Old Pantry" }, after: null, fields_changed: [] },
  } as ParsedProposal;
}

function makeLinkHealthProposal(): ParsedProposal {
  return {
    row: {
      id: 3,
      source: "link_health",
      target_venue_id: "osm-node-1",
      change_type: "update",
      proposed_diff: "",
      diff_hash: "h3",
      run_id: "run-1",
      anomaly: 0,
      status: "pending",
      created_at: "2026-09-01T12:00:00.000Z",
      reviewed_by: null,
      reviewed_at: null,
      applied_at: null,
    },
    parseError: false,
    diff: {
      before: { url: "https://dead.example.com" },
      // Matches diffEngine.ts's own buildLinkHealthProposal cast — `Venue.url`
      // is `string | undefined`, but the real proposal payload (round-tripped
      // through JSON) carries an explicit `null` "clear this field" signal.
      after: { url: null as unknown as string },
      fields_changed: ["url"],
      meta: { http_status: 404, checked_at: "2026-09-01T12:00:00.000Z" },
    },
  } as ParsedProposal;
}

describe("ProposalsReviewView — empty state", () => {
  test("renders an empty-state message when there are no proposals", () => {
    render(<ProposalsReviewView proposals={[]} venueLookup={{}} />);
    expect(screen.getByText(/No proposals to review/i)).toBeDefined();
  });
});

describe("ProposalsReviewView — update card (before/after diff)", () => {
  test("shows the venue name and a clear before -> after for each changed field", () => {
    render(
      <ProposalsReviewView
        proposals={[makeUpdateProposal()]}
        venueLookup={{ "osm-node-1": { name: "Eastside Grocery", status: "published" } }}
      />,
    );
    expect(screen.getByText("Eastside Grocery")).toBeDefined();
    expect(screen.getByText("Phone")).toBeDefined();
    expect(screen.getByText("719-555-0100")).toBeDefined();
    expect(screen.getByText("719-555-0199")).toBeDefined();
    // last_verified is excluded from the visible diff rows (freshness stamp, not a review-worthy field).
    expect(screen.queryByText("Last verified")).toBeNull();
  });

  test("update card renders a plain 'Approve' button, no confirm required", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true }) });
    const user = userEvent.setup();
    render(<ProposalsReviewView proposals={[makeUpdateProposal()]} venueLookup={{}} />);

    await user.click(screen.getByRole("button", { name: /^Approve$/i }));

    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith("/api/admin/proposals/1/approve", expect.anything()));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  });

  test("a 409 'stale' approve response surfaces its message inline, not a generic failure string", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 409,
      json: async () => ({ ok: false, error: "stale", message: "This venue's \"phone\" changed since the proposal was generated." }),
    });
    const user = userEvent.setup();
    render(<ProposalsReviewView proposals={[makeUpdateProposal()]} venueLookup={{}} />);

    await user.click(screen.getByRole("button", { name: /^Approve$/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByRole("alert").textContent).toMatch(/changed since the proposal was generated/);
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("ProposalsReviewView — remove card (never a single click)", () => {
  test("removal shows a danger 'Archive this venue' button and requires window.confirm before POSTing", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true }) });
    const user = userEvent.setup();
    render(
      <ProposalsReviewView
        proposals={[makeRemoveProposal()]}
        venueLookup={{ "plentiful-old-pantry": { name: "Old Pantry", status: "published" } }}
      />,
    );

    const button = screen.getByRole("button", { name: /Archive this venue/i });
    await user.click(button);

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0]).toMatch(/Old Pantry/);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith("/api/admin/proposals/2/approve", expect.anything()));
  });

  test("declining the confirm dialog never calls fetch", async () => {
    confirmSpy.mockReturnValue(false);
    const user = userEvent.setup();
    render(
      <ProposalsReviewView
        proposals={[makeRemoveProposal()]}
        venueLookup={{ "plentiful-old-pantry": { name: "Old Pantry", status: "published" } }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Archive this venue/i }));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("a remove card never renders a plain 'Approve' button", () => {
    render(<ProposalsReviewView proposals={[makeRemoveProposal()]} venueLookup={{}} />);
    expect(screen.queryByRole("button", { name: /^Approve$/i })).toBeNull();
  });
});

describe("ProposalsReviewView — link_health card (routes to edit, never blindly applied)", () => {
  test("renders NO Approve button — only a 'Review & fix link' navigation Link to the venue edit screen", () => {
    render(<ProposalsReviewView proposals={[makeLinkHealthProposal()]} venueLookup={{}} />);

    expect(screen.queryByRole("button", { name: /^Approve$/i })).toBeNull();
    const link = screen.getByRole("link", { name: /Review & fix link/i });
    expect(link.getAttribute("href")).toBe("/admin/venues/osm-node-1/edit?proposal=3");
  });

  test("shows the dead URL and its HTTP status", () => {
    render(<ProposalsReviewView proposals={[makeLinkHealthProposal()]} venueLookup={{}} />);
    expect(screen.getByText(/dead\.example\.com/)).toBeDefined();
    expect(screen.getByText(/404/)).toBeDefined();
  });
});

describe("ProposalsReviewView — reject (every kind)", () => {
  test("reveals a reason textarea, POSTs reject, and refreshes on success", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true }) });
    const user = userEvent.setup();
    render(<ProposalsReviewView proposals={[makeUpdateProposal()]} venueLookup={{}} />);

    await user.click(screen.getByRole("button", { name: /^Reject$/i }));
    await user.click(screen.getByRole("button", { name: /Confirm reject/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith("/api/admin/proposals/1/reject", expect.anything()));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  });

  test("a failed reject shows an inline error, no refresh", async () => {
    mockFetch.mockResolvedValueOnce({ status: 404, json: async () => ({ ok: false, error: "stale" }) });
    const user = userEvent.setup();
    render(<ProposalsReviewView proposals={[makeUpdateProposal()]} venueLookup={{}} />);

    await user.click(screen.getByRole("button", { name: /^Reject$/i }));
    await user.click(screen.getByRole("button", { name: /Confirm reject/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("ProposalsReviewView — malformed proposal degrades gracefully", () => {
  test("a parseError row shows a fallback message and still offers Reject", async () => {
    const malformed: ParsedProposal = {
      row: {
        id: 5,
        source: "osm",
        target_venue_id: "osm-node-9",
        change_type: "update",
        proposed_diff: "{not valid",
        diff_hash: "h5",
        run_id: "run-1",
        anomaly: 0,
        status: "pending",
        created_at: "2026-09-01T12:00:00.000Z",
        reviewed_by: null,
        reviewed_at: null,
        applied_at: null,
      },
      parseError: true,
      diff: null,
    };
    render(<ProposalsReviewView proposals={[malformed]} venueLookup={{}} />);

    expect(screen.getByText(/Couldn.t read details/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /^Reject$/i })).toBeDefined();
    // A malformed proposal must never get an Approve button — there's
    // nothing valid to apply.
    expect(screen.queryByRole("button", { name: /^Approve$/i })).toBeNull();
  });
});

describe("ProposalsReviewView — filters", () => {
  test("filter chips narrow the visible list by source and change_type", async () => {
    const user = userEvent.setup();
    render(
      <ProposalsReviewView
        proposals={[makeUpdateProposal(), makeRemoveProposal()]}
        venueLookup={{
          "osm-node-1": { name: "Eastside Grocery", status: "published" },
          "plentiful-old-pantry": { name: "Old Pantry", status: "published" },
        }}
      />,
    );

    expect(screen.getByText("Eastside Grocery")).toBeDefined();
    expect(screen.getByText("Old Pantry")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "OpenStreetMap" }));
    expect(screen.getByText("Eastside Grocery")).toBeDefined();
    expect(screen.queryByText("Old Pantry")).toBeNull();
  });
});
