/**
 * ProposalCard tests — moved from ProposalsReviewView.test.tsx (issue #674:
 * the /admin/flags queue's filter chips/bulk-approve UI is gone; this file
 * keeps every per-card behavior test that isn't about a multi-card list).
 * Covers:
 *   - Each card shows the venue + a clear before/after diff for `update`.
 *   - `remove` cards require a confirm() before POSTing approve, and use
 *     the danger button treatment — never a single click.
 *   - `link_health` cards render NO Approve button, only a real Link to the
 *     venue's edit screen.
 *   - A genuinely-new `add` (no existing venue) renders NO Approve button,
 *     only a "Review as new place" Link to /admin/venues/new?proposal=<id>
 *     (#674 behavior change — see ProposalCard.tsx's own header for why).
 *   - A restore (`add` targeting an archived venue) still renders a normal
 *     Approve button — unaffected by the #674 change above.
 *   - Reject flow (every kind) — reveal reason, POST reject, refresh on
 *     success, inline error (including the 409 "stale" message) on failure.
 *
 * next/navigation's useRouter is mocked module-wide, same pattern as
 * SubmissionsReviewView.test.tsx.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ParsedProposal } from "@/lib/adminProposals";
import type { VenueLookup } from "@/lib/adminVenueLookup";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

import ProposalCard from "@/components/ProposalCard";

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

function makeVenue(overrides: Partial<VenueLookup> = {}): VenueLookup {
  return {
    name: "Eastside Grocery",
    category: "grocery",
    lat: 38.27,
    lng: -104.6,
    address: "123 Main St, Pueblo, CO",
    phone: "719-555-0100",
    url: "https://eastside.example.com",
    hours_weekly: { mon: ["09:00-17:00"] },
    accepts_snap: undefined,
    accepts_wic: undefined,
    source: "OpenStreetMap (node/4041375052)",
    last_verified: "2026-09-01",
    status: "published",
    ...overrides,
  };
}

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
      after: { url: null as unknown as string },
      fields_changed: ["url"],
      meta: { http_status: 404, checked_at: "2026-09-01T12:00:00.000Z" },
    },
  } as ParsedProposal;
}

function makeAddProposal(overrides: Partial<ParsedProposal> = {}): ParsedProposal {
  return {
    row: {
      id: 10,
      source: "osm",
      target_venue_id: "osm-node-new",
      change_type: "add",
      proposed_diff: "",
      diff_hash: "h10",
      run_id: "run-42",
      anomaly: 0,
      status: "pending",
      created_at: "2026-09-01T12:00:00.000Z",
      reviewed_by: null,
      reviewed_at: null,
      applied_at: null,
    },
    parseError: false,
    diff: {
      before: null,
      after: {
        id: "osm-node-new",
        name: "Northside Pantry",
        category: "pantry",
        lat: 38.27,
        lng: -104.6,
        address: "900 Elm St, Pueblo, CO",
        phone: "719-555-0200",
        url: "https://northside.example.com",
        hours_weekly: { mon: ["09:00-17:00"] },
        last_verified: "2026-09-01",
      },
      fields_changed: ["id", "name", "category", "lat", "lng", "address", "phone", "url", "hours_weekly", "last_verified"],
    },
    ...overrides,
  } as ParsedProposal;
}

describe("ProposalCard — update card (before/after diff)", () => {
  test("shows the venue name and a clear before -> after for each changed field", () => {
    render(<ProposalCard proposal={makeUpdateProposal()} venue={makeVenue()} />);
    const detail = within(screen.getByTestId("proposal-detail"));
    expect(detail.getByText("Eastside Grocery")).toBeDefined();
    expect(detail.getByText("123 Main St, Pueblo, CO")).toBeDefined();
    expect(detail.getByText("Phone")).toBeDefined();
    expect(detail.getByText("719-555-0100")).toBeDefined();
    expect(detail.getByText("719-555-0199")).toBeDefined();
    expect(screen.queryByText("Last verified")).toBeNull();
  });

  test("update card renders a plain 'Approve' button, no confirm required", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true }) });
    const user = userEvent.setup();
    render(<ProposalCard proposal={makeUpdateProposal()} />);

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
    render(<ProposalCard proposal={makeUpdateProposal()} />);

    await user.click(screen.getByRole("button", { name: /^Approve$/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByRole("alert").textContent).toMatch(/changed since the proposal was generated/);
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("ProposalCard — remove card (never a single click)", () => {
  test("removal shows a danger 'Archive this venue' button and requires window.confirm before POSTing", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true }) });
    const user = userEvent.setup();
    render(
      <ProposalCard
        proposal={makeRemoveProposal()}
        venue={makeVenue({ name: "Old Pantry", address: "45 Elm St, Pueblo, CO" })}
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
      <ProposalCard
        proposal={makeRemoveProposal()}
        venue={makeVenue({ name: "Old Pantry", address: "45 Elm St, Pueblo, CO" })}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Archive this venue/i }));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("a remove card never renders a plain 'Approve' button", () => {
    render(<ProposalCard proposal={makeRemoveProposal()} />);
    expect(screen.queryByRole("button", { name: /^Approve$/i })).toBeNull();
  });
});

describe("ProposalCard — link_health card (routes to edit, never blindly applied)", () => {
  test("renders NO Approve button — only a 'Review & fix link' navigation Link to the venue edit screen", () => {
    render(<ProposalCard proposal={makeLinkHealthProposal()} />);

    expect(screen.queryByRole("button", { name: /^Approve$/i })).toBeNull();
    const link = screen.getByRole("link", { name: /Review & fix link/i });
    expect(link.getAttribute("href")).toBe("/admin/venues/osm-node-1/edit?proposal=3");
  });

  test("shows the dead URL and its HTTP status", () => {
    render(<ProposalCard proposal={makeLinkHealthProposal()} />);
    expect(screen.getByText(/dead\.example\.com/)).toBeDefined();
    expect(screen.getByText(/404/)).toBeDefined();
  });
});

describe("ProposalCard — reject (every kind)", () => {
  test("reveals a reason textarea, POSTs reject, and refreshes on success", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true }) });
    const user = userEvent.setup();
    render(<ProposalCard proposal={makeUpdateProposal()} />);

    await user.click(screen.getByRole("button", { name: /^Reject$/i }));
    await user.click(screen.getByRole("button", { name: /Confirm reject/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith("/api/admin/proposals/1/reject", expect.anything()));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  });

  test("#675 fix: confirming reject sends the typed reason in the body, not an empty {}", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true }) });
    const user = userEvent.setup();
    render(<ProposalCard proposal={makeUpdateProposal()} />);

    await user.click(screen.getByRole("button", { name: /^Reject$/i }));
    await user.type(screen.getByLabelText(/reason/i), "Duplicate of an existing venue.");
    await user.click(screen.getByRole("button", { name: /Confirm reject/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/proposals/1/reject");
    expect(JSON.parse(init.body as string)).toEqual({ reason: "Duplicate of an existing venue." });
  });

  test("a failed reject shows an inline error, no refresh", async () => {
    mockFetch.mockResolvedValueOnce({ status: 404, json: async () => ({ ok: false, error: "stale" }) });
    const user = userEvent.setup();
    render(<ProposalCard proposal={makeUpdateProposal()} />);

    await user.click(screen.getByRole("button", { name: /^Reject$/i }));
    await user.click(screen.getByRole("button", { name: /Confirm reject/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});

describe("ProposalCard — malformed proposal degrades gracefully", () => {
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
    render(<ProposalCard proposal={malformed} />);

    expect(screen.getByText(/Couldn.t read details/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /^Reject$/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /^Approve$/i })).toBeNull();
  });
});

// ─── #674: a genuinely-new `add` routes to the new-place form, never a
// one-click Approve here; a restore (archived target) is unaffected ───────

describe("ProposalCard — new place (add, no existing venue)", () => {
  test("renders NO Approve button — only 'Review as new place' linking to /admin/venues/new?proposal=<id>", () => {
    render(<ProposalCard proposal={makeAddProposal()} />);

    expect(screen.queryByRole("button", { name: /^Approve$/i })).toBeNull();
    const link = screen.getByRole("link", { name: /Review as new place/i });
    expect(link.getAttribute("href")).toBe("/admin/venues/new?proposal=10");
  });

  test("Reject is still offered directly on the card", () => {
    render(<ProposalCard proposal={makeAddProposal()} />);
    expect(screen.getByRole("button", { name: /^Reject$/i })).toBeDefined();
  });

  test("renders name, address, category, phone, website, and hours — marked as not on the map", () => {
    render(<ProposalCard proposal={makeAddProposal()} />);

    const detail = within(screen.getByTestId("proposal-detail"));
    expect(detail.getByText("Northside Pantry")).toBeDefined();
    expect(detail.getByText("900 Elm St, Pueblo, CO")).toBeDefined();
    expect(detail.getByText("Food Pantry")).toBeDefined();
    expect(screen.getByText("719-555-0200")).toBeDefined();
    expect(screen.getByText("https://northside.example.com")).toBeDefined();
    expect(screen.getByText(/not currently on the map/i)).toBeDefined();
  });

  test("hours render human-readably (formatSlot), never a raw 24h string or JSON", () => {
    render(<ProposalCard proposal={makeAddProposal()} />);

    expect(screen.getByText(/9am\s*–\s*5pm/)).toBeDefined();
    expect(screen.queryByText(/09:00-17:00/)).toBeNull();
    expect(screen.queryByText(/\{"mon"/)).toBeNull();
  });
});

describe("ProposalCard — restore (add targeting an archived venue) keeps direct Approve", () => {
  test("an add targeting an already-archived id is labeled Restore, keeps a plain Approve button", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true }) });
    const user = userEvent.setup();
    render(<ProposalCard proposal={makeAddProposal()} venue={makeVenue({ name: "Northside Pantry", status: "archived" })} />);

    expect(screen.getByText("Restore")).toBeDefined();
    expect(screen.getByText(/lists this place again/i)).toBeDefined();
    expect(screen.queryByRole("link", { name: /Review as new place/i })).toBeNull();

    await user.click(screen.getByRole("button", { name: /^Approve$/i }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith("/api/admin/proposals/10/approve", expect.anything()));
  });
});

describe("ProposalCard — freshness-only update names the source and date", () => {
  test("states which source confirmed the venue and when, not a source-less sentence", () => {
    const freshnessOnly = makeUpdateProposal({
      diff: {
        before: { last_verified: "2026-08-01" },
        after: { last_verified: "2026-09-01" },
        fields_changed: ["last_verified"],
      },
    });
    render(<ProposalCard proposal={freshnessOnly} venue={makeVenue()} />);
    expect(screen.getByText(/Confirmed still present by OpenStreetMap on Sep 1, 2026/)).toBeDefined();
  });
});

describe("ProposalCard — website/phone values render as real links", () => {
  test("an add proposal's Website value is a real link — correct href, opens a new tab safely", () => {
    render(<ProposalCard proposal={makeAddProposal()} />);

    const link = screen.getByRole("link", { name: "https://northside.example.com" });
    expect(link.getAttribute("href")).toBe("https://northside.example.com");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  test("a non-http(s) url never becomes a link (safeUrl guard)", () => {
    const unsafeUpdate = makeUpdateProposal({
      diff: {
        before: { url: "https://old.example.com" },
        after: { url: "javascript:alert(1)" },
        fields_changed: ["url"],
      },
    });
    render(<ProposalCard proposal={unsafeUpdate} />);

    expect(screen.queryByRole("link", { name: /javascript:alert/ })).toBeNull();
    expect(screen.getByText("javascript:alert(1)")).toBeDefined();
  });
});

describe("ProposalCard — preview panel shows the RESULTING venue, not today's", () => {
  test("an update proposal's preview reflects the proposed value, not the current one", () => {
    const categoryUpdate = makeUpdateProposal({
      diff: {
        before: { category: "grocery" },
        after: { category: "pantry" },
        fields_changed: ["category"],
      },
    });
    render(<ProposalCard proposal={categoryUpdate} venue={makeVenue({ category: "grocery" })} />);

    const preview = within(screen.getByTestId("proposal-preview"));
    expect(preview.getByText(/Food Pantry/)).toBeDefined();
    expect(preview.queryByText(/Grocery \/ Supermarket/)).toBeNull();
  });

  test("a remove proposal's preview never presents the venue as if it were staying — dimmed, inert card", () => {
    render(<ProposalCard proposal={makeRemoveProposal()} venue={makeVenue({ name: "Old Pantry", category: "pantry" })} />);

    const preview = within(screen.getByTestId("proposal-preview"));
    expect(preview.getByText(/no longer appear on the public map/i)).toBeDefined();
    const card = preview.getByText("Old Pantry").closest("ul");
    expect(card).not.toBeNull();
    expect(card?.hasAttribute("inert")).toBe(true);
  });

  test("a link_health card renders no preview panel — there's no proposed field change to preview", () => {
    render(<ProposalCard proposal={makeLinkHealthProposal()} />);
    expect(screen.queryByTestId("proposal-preview")).toBeNull();
  });
});

describe("ProposalCard — card header shows which run produced it", () => {
  test("shows the run_id alongside the submitted date", () => {
    render(<ProposalCard proposal={makeUpdateProposal()} />);
    expect(screen.getByText(/run-1/)).toBeDefined();
  });
});
