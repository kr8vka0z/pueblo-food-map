/**
 * SubmissionsReviewView tests (#259).
 *
 * Covers all five acceptance criteria at the component layer:
 *   - AC1: empty state when there's nothing pending; otherwise every
 *     submission renders as a card with kind + submitted details.
 *   - AC2: a new_venue card's "Review & approve" is a real link to
 *     /admin/venues/new?submission=<id> (the actual create-and-approve
 *     happens on that page/route, covered by their own test files).
 *   - AC3/AC5: the shared Reject flow (both kinds) — reveal reason textarea,
 *     POST /api/admin/submissions/<id>/reject, refresh on success, inline
 *     error on failure.
 *   - AC4 (updated #270): a closure card's "Review & approve" is a real
 *     link to /admin/venues/<target_venue_id>/edit?submission=<id> —
 *     edit-before-approve, matching new_venue's own hand-off shape; the
 *     actual archive-and-approve happens on that page via
 *     ArchiveVenueButton, covered by its own test file. Originally a
 *     one-click confirm+archive; changed because a closure report can mean
 *     "the hours changed," not only "this place is gone."
 *
 * next/navigation's useRouter is mocked module-wide, same pattern as
 * ArchiveVenueButton.test.tsx / AddVenueForm.test.tsx.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReviewSubmission } from "@/components/SubmissionsReviewView";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

import SubmissionsReviewView from "@/components/SubmissionsReviewView";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  mockPush.mockReset();
  mockRefresh.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeNewVenueSubmission(overrides: Partial<ReviewSubmission> = {}): ReviewSubmission {
  return {
    id: 5,
    kind: "new_venue",
    createdAt: "2026-07-01T15:30:00.000Z",
    submitterEmail: "suggester@example.com",
    targetVenueId: null,
    parseError: false,
    payload: {
      venueName: "Eastside Pantry",
      address: "123 Test St, Pueblo, CO",
      category: "pantry",
      hours: "Mon-Fri 9-5",
      contact: "719-555-0100",
      acceptsSnap: true,
      acceptsWic: false,
      notes: "Enter through the side door.",
      submitterEmail: "suggester@example.com",
    },
    ...overrides,
  } as ReviewSubmission;
}

function makeClosureSubmission(overrides: Partial<ReviewSubmission> = {}): ReviewSubmission {
  return {
    id: 9,
    kind: "closure",
    createdAt: "2026-07-02T09:00:00.000Z",
    submitterEmail: "reporter@example.com",
    targetVenueId: "manual-existing-1",
    parseError: false,
    payload: {
      venueId: "manual-existing-1",
      venueName: "Main Street Grocery",
      venueAddress: "456 Main Ave, Pueblo, CO",
      issueType: "closed",
      description: "This store shut down last month.",
      contactEmail: "reporter@example.com",
    },
    ...overrides,
  } as ReviewSubmission;
}

describe("SubmissionsReviewView — empty state (AC1)", () => {
  test("renders a calm empty-state panel when there are no pending submissions", () => {
    render(<SubmissionsReviewView submissions={[]} />);
    expect(screen.getByText(/No submissions to review/i)).toBeDefined();
    expect(screen.queryByRole("link", { name: /Review & approve/i })).toBeNull();
  });
});

describe("SubmissionsReviewView — new_venue card (AC1, AC2)", () => {
  test("renders the kind badge, submitted details, and every payload field", () => {
    render(<SubmissionsReviewView submissions={[makeNewVenueSubmission()]} />);

    expect(screen.getByText(/New place/i)).toBeDefined();
    expect(screen.getByText("Eastside Pantry")).toBeDefined();
    expect(screen.getByText(/123 Test St, Pueblo, CO/)).toBeDefined();
    expect(screen.getByText(/Food Pantry/)).toBeDefined();
    expect(screen.getByText(/Mon-Fri 9-5/)).toBeDefined();
    expect(screen.getByText(/719-555-0100/)).toBeDefined();
    expect(screen.getByText(/Enter through the side door\./)).toBeDefined();
    expect(screen.getByText(/suggester@example\.com/)).toBeDefined();
  });

  test("'Review & approve' is a real link to /admin/venues/new?submission=<id>", () => {
    render(<SubmissionsReviewView submissions={[makeNewVenueSubmission({ id: 7 })]} />);

    const link = screen.getByRole("link", { name: /Review & approve/i });
    expect(link.getAttribute("href")).toBe("/admin/venues/new?submission=7");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("SubmissionsReviewView — closure card (AC1, AC4)", () => {
  test("renders the kind badge and every payload field", () => {
    render(<SubmissionsReviewView submissions={[makeClosureSubmission()]} />);

    expect(screen.getByText(/Closure report/i)).toBeDefined();
    expect(screen.getByText("Main Street Grocery")).toBeDefined();
    expect(screen.getByText(/456 Main Ave, Pueblo, CO/)).toBeDefined();
    expect(screen.getByText(/This store shut down last month\./)).toBeDefined();
    // Renders twice by design: once in the card's "submitted by" metadata
    // line (submitter_email column) and once in the labeled "Reporter
    // contact" detail row (payload.contactEmail) — realistically the same
    // value (report/submit/route.ts derives submitterEmail FROM
    // contactEmail), so getAllByText, not getByText, is the correct query.
    expect(screen.getAllByText(/reporter@example\.com/).length).toBeGreaterThanOrEqual(1);
  });

  test("'Review & approve' is a real link to /admin/venues/<target_venue_id>/edit?submission=<id> (#270)", () => {
    render(
      <SubmissionsReviewView
        submissions={[makeClosureSubmission({ id: 9, targetVenueId: "manual-existing-1" })]}
      />,
    );

    const link = screen.getByRole("link", { name: /Review & approve/i });
    expect(link.getAttribute("href")).toBe("/admin/venues/manual-existing-1/edit?submission=9");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("SubmissionsReviewView — closure parseError still allows approve (#270)", () => {
  test("a parseError closure row with a target_venue_id still renders the Review & approve link (target_venue_id is a real column, not from the unparseable payload)", () => {
    const broken: ReviewSubmission = {
      id: 12,
      kind: "closure",
      createdAt: "2026-07-02T00:00:00.000Z",
      submitterEmail: null,
      targetVenueId: "manual-existing-2",
      parseError: true,
      payload: null,
    };
    render(<SubmissionsReviewView submissions={[broken]} />);

    const link = screen.getByRole("link", { name: /Review & approve/i });
    expect(link.getAttribute("href")).toBe("/admin/venues/manual-existing-2/edit?submission=12");
  });
});

describe("SubmissionsReviewView — reject flow, shared by both kinds (AC3, AC5)", () => {
  test("clicking Reject reveals a labeled, optional reason textarea", async () => {
    const user = userEvent.setup();
    render(<SubmissionsReviewView submissions={[makeNewVenueSubmission()]} />);

    expect(screen.queryByLabelText(/reason/i)).toBeNull();
    await user.click(screen.getByRole("button", { name: /^Reject$/i }));

    expect(screen.getByLabelText(/reason/i)).toBeDefined();
  });

  test("confirming reject POSTs the reject route with the typed reason, then refreshes", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true }) });
    const user = userEvent.setup();
    render(<SubmissionsReviewView submissions={[makeNewVenueSubmission({ id: 5 })]} />);

    await user.click(screen.getByRole("button", { name: /^Reject$/i }));
    await user.type(screen.getByLabelText(/reason/i), "Duplicate of an existing venue.");
    await user.click(screen.getByRole("button", { name: /Confirm reject/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/submissions/5/reject");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ reason: "Duplicate of an existing venue." });

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  });

  test("confirming reject with no reason typed still POSTs (reason is optional)", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true }) });
    const user = userEvent.setup();
    render(<SubmissionsReviewView submissions={[makeClosureSubmission({ id: 9 })]} />);

    await user.click(screen.getByRole("button", { name: /^Reject$/i }));
    await user.click(screen.getByRole("button", { name: /Confirm reject/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe("/api/admin/submissions/9/reject");
  });

  test("a non-200 reject response shows an inline error and does not refresh", async () => {
    mockFetch.mockResolvedValueOnce({ status: 404, json: async () => ({ ok: false, error: "Not found" }) });
    const user = userEvent.setup();
    render(<SubmissionsReviewView submissions={[makeNewVenueSubmission()]} />);

    await user.click(screen.getByRole("button", { name: /^Reject$/i }));
    await user.click(screen.getByRole("button", { name: /Confirm reject/i }));

    expect(await screen.findByRole("alert")).toBeDefined();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  test("a network-level reject failure shows an inline error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network down"));
    const user = userEvent.setup();
    render(<SubmissionsReviewView submissions={[makeClosureSubmission()]} />);

    await user.click(screen.getByRole("button", { name: /^Reject$/i }));
    await user.click(screen.getByRole("button", { name: /Confirm reject/i }));

    expect(await screen.findByRole("alert")).toBeDefined();
  });
});

describe("SubmissionsReviewView — malformed payload degrades gracefully", () => {
  test("a parseError row shows a 'couldn't read details' message, still offers Reject, no approve action", () => {
    const broken: ReviewSubmission = {
      id: 11,
      kind: "new_venue",
      createdAt: "2026-07-01T00:00:00.000Z",
      submitterEmail: null,
      targetVenueId: null,
      parseError: true,
      payload: null,
    };
    render(<SubmissionsReviewView submissions={[broken]} />);

    expect(screen.getByText(/couldn't read details/i)).toBeDefined();
    expect(screen.queryByRole("link", { name: /Review & approve/i })).toBeNull();
    expect(screen.getByRole("button", { name: /^Reject$/i })).toBeDefined();
  });
});

describe("SubmissionsReviewView — multiple cards render independently", () => {
  test("two cards each get their own working Reject flow without cross-talk", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true }) });
    const user = userEvent.setup();
    render(
      <SubmissionsReviewView
        submissions={[makeNewVenueSubmission({ id: 1 }), makeClosureSubmission({ id: 2 })]}
      />,
    );

    const rejectButtons = screen.getAllByRole("button", { name: /^Reject$/i });
    expect(rejectButtons).toHaveLength(2);

    await user.click(rejectButtons[0]!);
    // Only the first card's textarea should appear.
    expect(screen.getAllByLabelText(/reason/i)).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /Confirm reject/i }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe("/api/admin/submissions/1/reject");
  });
});
