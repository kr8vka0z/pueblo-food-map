/**
 * SubmissionCard tests (#675, "fold the Review queue into Places") — moved
 * and adapted from the now-deleted SubmissionsReviewView.test.tsx (#259).
 * That file's own empty-state/list-shell tests are gone with the component
 * they covered (SuggestionsBox.test.tsx covers the box's own "renders one
 * card per item" contract); everything about ONE card's own rendering and
 * actions moves here.
 *
 * Kind-specific action change from the original (#270) behavior: a closure
 * card used to be a plain navigation Link to the venue's edit page
 * ("Review & approve") — now this card renders DIRECTLY INSIDE that edit
 * page's own "Suggestions to review" box (SuggestionsBox.tsx), so there is
 * nowhere left to navigate TO; its actions are inline **Mark done** (POST
 * .../done) and Reject instead. A new_venue card is unchanged — still a
 * plain Link to /admin/venues/new?submission=<id>, since that hand-off
 * genuinely leaves this page for the prefilled create form.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReviewSubmission } from "@/lib/publicSubmissions";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

import SubmissionCard from "@/components/SubmissionCard";

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

describe("SubmissionCard — new_venue (AC1, AC2)", () => {
  test("renders the kind badge, submitted details, and every payload field", () => {
    render(<SubmissionCard submission={makeNewVenueSubmission()} />);

    expect(screen.getByText(/New place/i)).toBeDefined();
    expect(screen.getByText("Eastside Pantry")).toBeDefined();
    expect(screen.getByText(/123 Test St, Pueblo, CO/)).toBeDefined();
    expect(screen.getByText(/Food Pantry/)).toBeDefined();
    expect(screen.getByText(/Mon-Fri 9-5/)).toBeDefined();
    expect(screen.getByText(/719-555-0100/)).toBeDefined();
    expect(screen.getByText(/Enter through the side door\./)).toBeDefined();
    expect(screen.getByText(/suggester@example\.com/)).toBeDefined();
  });

  test("'Review & approve' is a real link to /admin/venues/new?submission=<id>, no Mark done button", () => {
    render(<SubmissionCard submission={makeNewVenueSubmission({ id: 7 })} />);

    const link = screen.getByRole("link", { name: /Review & approve/i });
    expect(link.getAttribute("href")).toBe("/admin/venues/new?submission=7");
    expect(screen.queryByRole("button", { name: /Mark done/i })).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("SubmissionCard — closure (AC1, AC4)", () => {
  test("renders the kind badge and every payload field", () => {
    render(<SubmissionCard submission={makeClosureSubmission()} />);

    expect(screen.getByText(/Public report/i)).toBeDefined();
    expect(screen.getByText("Main Street Grocery")).toBeDefined();
    expect(screen.getByText(/456 Main Ave, Pueblo, CO/)).toBeDefined();
    expect(screen.getByText(/This store shut down last month\./)).toBeDefined();
    // Renders twice by design: once in the card's "submitted by" metadata
    // line (submitter_email column) and once in the labeled "Reporter
    // contact" detail row (payload.contactEmail).
    expect(screen.getAllByText(/reporter@example\.com/).length).toBeGreaterThanOrEqual(1);
  });

  test("renders a Mark done button, no navigation link (#675: the card lives directly on the edit page now)", () => {
    render(<SubmissionCard submission={makeClosureSubmission({ id: 9 })} />);

    expect(screen.getByRole("button", { name: /Mark done/i })).toBeDefined();
    expect(screen.queryByRole("link", { name: /Review & approve/i })).toBeNull();
  });

  test("clicking Mark done POSTs .../done with no body, then refreshes", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true }) });
    const user = userEvent.setup();
    render(<SubmissionCard submission={makeClosureSubmission({ id: 9 })} />);

    await user.click(screen.getByRole("button", { name: /Mark done/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit | undefined];
    expect(url).toBe("/api/admin/submissions/9/done");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeUndefined();

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  });

  test("a non-200 Mark done response shows an inline error and does not refresh", async () => {
    mockFetch.mockResolvedValueOnce({ status: 404, json: async () => ({ ok: false }) });
    const user = userEvent.setup();
    render(<SubmissionCard submission={makeClosureSubmission()} />);

    await user.click(screen.getByRole("button", { name: /Mark done/i }));

    expect(await screen.findByRole("alert")).toBeDefined();
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("SubmissionCard — closure parseError still allows Mark done + Reject (#270/#675)", () => {
  test("a parseError closure row still renders Mark done and Reject (target_venue_id is a real column, not from the unparseable payload)", () => {
    const broken: ReviewSubmission = {
      id: 12,
      kind: "closure",
      createdAt: "2026-07-02T00:00:00.000Z",
      submitterEmail: null,
      targetVenueId: "manual-existing-2",
      parseError: true,
      payload: null,
    };
    render(<SubmissionCard submission={broken} />);

    expect(screen.getByRole("button", { name: /Mark done/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Reject$/i })).toBeDefined();
  });
});

describe("SubmissionCard — reject flow, shared by both kinds (AC3, AC5)", () => {
  test("clicking Reject reveals a labeled, optional reason textarea", async () => {
    const user = userEvent.setup();
    render(<SubmissionCard submission={makeNewVenueSubmission()} />);

    expect(screen.queryByLabelText(/reason/i)).toBeNull();
    await user.click(screen.getByRole("button", { name: /^Reject$/i }));

    expect(screen.getByLabelText(/reason/i)).toBeDefined();
  });

  test("confirming reject POSTs the reject route with the typed reason, then refreshes", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true }) });
    const user = userEvent.setup();
    render(<SubmissionCard submission={makeNewVenueSubmission({ id: 5 })} />);

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
    render(<SubmissionCard submission={makeClosureSubmission({ id: 9 })} />);

    await user.click(screen.getByRole("button", { name: /^Reject$/i }));
    await user.click(screen.getByRole("button", { name: /Confirm reject/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe("/api/admin/submissions/9/reject");
  });

  test("a non-200 reject response shows an inline error and does not refresh", async () => {
    mockFetch.mockResolvedValueOnce({ status: 404, json: async () => ({ ok: false, error: "Not found" }) });
    const user = userEvent.setup();
    render(<SubmissionCard submission={makeNewVenueSubmission()} />);

    await user.click(screen.getByRole("button", { name: /^Reject$/i }));
    await user.click(screen.getByRole("button", { name: /Confirm reject/i }));

    expect(await screen.findByRole("alert")).toBeDefined();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  test("a network-level reject failure shows an inline error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network down"));
    const user = userEvent.setup();
    render(<SubmissionCard submission={makeClosureSubmission()} />);

    await user.click(screen.getByRole("button", { name: /^Reject$/i }));
    await user.click(screen.getByRole("button", { name: /Confirm reject/i }));

    expect(await screen.findByRole("alert")).toBeDefined();
  });
});

describe("SubmissionCard — malformed payload degrades gracefully", () => {
  test("a parseError new_venue row shows a 'couldn't read details' message, still offers Reject, no approve action", () => {
    const broken: ReviewSubmission = {
      id: 11,
      kind: "new_venue",
      createdAt: "2026-07-01T00:00:00.000Z",
      submitterEmail: null,
      targetVenueId: null,
      parseError: true,
      payload: null,
    };
    render(<SubmissionCard submission={broken} />);

    expect(screen.getByText(/couldn't read details/i)).toBeDefined();
    expect(screen.queryByRole("link", { name: /Review & approve/i })).toBeNull();
    expect(screen.getByRole("button", { name: /^Reject$/i })).toBeDefined();
  });
});
