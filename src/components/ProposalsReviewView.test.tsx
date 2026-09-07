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
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ParsedProposal } from "@/lib/adminProposals";
import type { VenueLookup } from "@/app/admin/flags/page";

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

/**
 * Widened VenueLookup fixture (#390 review, widened again for the preview
 * panel — lat/lng/hours_weekly/accepts_snap/accepts_wic/source are what
 * buildPreviewVenue()/VenueCard need to render a real card) — every test
 * that needs a lookup entry builds off this rather than repeating the full
 * shape.
 */
function makeVenueLookup(overrides: Partial<VenueLookup> = {}): VenueLookup {
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
        venueLookup={{ "osm-node-1": makeVenueLookup() }}
      />,
    );
    // Scoped to the detail column — the right-hand preview also renders this
    // venue's name/address via the real VenueCard (#390 preview-panel
    // addition), so an unscoped query now legitimately matches twice.
    const detail = within(screen.getByTestId("proposal-detail"));
    expect(detail.getByText("Eastside Grocery")).toBeDefined();
    // Address renders alongside the name so an admin can recognise the place, not just match an id.
    expect(detail.getByText("123 Main St, Pueblo, CO")).toBeDefined();
    expect(detail.getByText("Phone")).toBeDefined();
    expect(detail.getByText("719-555-0100")).toBeDefined();
    expect(detail.getByText("719-555-0199")).toBeDefined();
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
        venueLookup={{ "plentiful-old-pantry": makeVenueLookup({ name: "Old Pantry", address: "45 Elm St, Pueblo, CO" }) }}
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
        venueLookup={{ "plentiful-old-pantry": makeVenueLookup({ name: "Old Pantry", address: "45 Elm St, Pueblo, CO" }) }}
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
          "osm-node-1": makeVenueLookup(),
          "plentiful-old-pantry": makeVenueLookup({ name: "Old Pantry", address: "45 Elm St, Pueblo, CO" }),
        }}
      />,
    );

    // getAllByText, not getByText — the right-hand preview panel also
    // renders each venue's name via the real VenueCard (#390 preview-panel
    // addition), so both names now legitimately appear twice.
    expect(screen.getAllByText("Eastside Grocery").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Old Pantry").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "OpenStreetMap" }));
    expect(screen.getAllByText("Eastside Grocery").length).toBeGreaterThan(0);
    expect(screen.queryByText("Old Pantry")).toBeNull();
  });
});

// ─── #390 review — detail rendering per card type ─────────────────────────

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

describe("ProposalsReviewView — remove card detail (venue context, no freshness message)", () => {
  test("shows the venue's current address (header) and category (body) alongside the removal explanation", () => {
    render(
      <ProposalsReviewView
        proposals={[makeRemoveProposal()]}
        venueLookup={{
          "plentiful-old-pantry": makeVenueLookup({ name: "Old Pantry", category: "pantry", address: "45 Elm St, Pueblo, CO" }),
        }}
      />,
    );
    // Address renders once, in the card header (shared by every non-add card).
    expect(screen.getByText("45 Elm St, Pueblo, CO")).toBeDefined();
    expect(screen.getByText("Food Pantry")).toBeDefined();
    expect(screen.getByText(/no longer lists/i)).toBeDefined();
  });

  test("names the source that dropped it", () => {
    render(
      <ProposalsReviewView
        proposals={[makeRemoveProposal()]}
        venueLookup={{ "plentiful-old-pantry": makeVenueLookup({ name: "Old Pantry" }) }}
      />,
    );
    // makeRemoveProposal's row.source is "plentiful" -> badge label "Plentiful".
    expect(screen.getByText(/Plentiful no longer lists/)).toBeDefined();
  });

  test("a remove card never renders the freshness-only message", () => {
    render(
      <ProposalsReviewView
        proposals={[makeRemoveProposal()]}
        venueLookup={{ "plentiful-old-pantry": makeVenueLookup({ name: "Old Pantry" }) }}
      />,
    );
    expect(screen.queryByText(/Confirmed still present/i)).toBeNull();
  });
});

describe("ProposalsReviewView — add card (no existing venue) renders the full proposed record", () => {
  test("renders name, address, category, phone, website, and hours — marked as not on the map", () => {
    render(<ProposalsReviewView proposals={[makeAddProposal()]} venueLookup={{}} />);

    // Name/address/category scoped to the detail column — the right-hand
    // preview also renders these three via the real VenueCard (#390
    // preview-panel addition), so an unscoped query now matches twice.
    // Phone/website aren't rendered by VenueCard at all, so those stay
    // unscoped (still a single match each, now inside a link — see the
    // clickable-link tests below for the anchor-specific assertions).
    const detail = within(screen.getByTestId("proposal-detail"));
    expect(detail.getByText("Northside Pantry")).toBeDefined();
    expect(detail.getByText("900 Elm St, Pueblo, CO")).toBeDefined();
    expect(detail.getByText("Food Pantry")).toBeDefined();
    expect(screen.getByText("719-555-0200")).toBeDefined();
    expect(screen.getByText("https://northside.example.com")).toBeDefined();
    expect(screen.getByText(/not currently on the map/i)).toBeDefined();
  });

  test("hours render human-readably (formatSlot), never a raw 24h string or JSON", () => {
    render(<ProposalsReviewView proposals={[makeAddProposal()]} venueLookup={{}} />);

    expect(screen.getByText(/9am\s*–\s*5pm/)).toBeDefined();
    expect(screen.queryByText(/09:00-17:00/)).toBeNull();
    expect(screen.queryByText(/\{"mon"/)).toBeNull();
  });

  test("an add targeting an already-archived id is labeled Restore, not New venue", () => {
    render(
      <ProposalsReviewView
        proposals={[makeAddProposal()]}
        venueLookup={{ "osm-node-new": makeVenueLookup({ name: "Northside Pantry", status: "archived" }) }}
      />,
    );
    expect(screen.getByText("Restore")).toBeDefined();
    expect(screen.getByText(/lists this place again/i)).toBeDefined();
  });
});

describe("ProposalsReviewView — freshness-only update names the source and date", () => {
  test("states which source confirmed the venue and when, not a source-less sentence", () => {
    const freshnessOnly = makeUpdateProposal({
      diff: {
        before: { last_verified: "2026-08-01" },
        after: { last_verified: "2026-09-01" },
        fields_changed: ["last_verified"],
      },
    });
    render(<ProposalsReviewView proposals={[freshnessOnly]} venueLookup={{ "osm-node-1": makeVenueLookup() }} />);

    // makeUpdateProposal's row.source is "osm" -> badge label "OpenStreetMap".
    // One combined match (not two separate getByText calls) — the card
    // header ALSO renders a "Sep 1, 2026" timestamp, so asserting the date
    // fragment on its own would hit two elements.
    expect(screen.getByText(/Confirmed still present by OpenStreetMap on Sep 1, 2026/)).toBeDefined();
  });
});

describe("ProposalsReviewView — hours render human-readably in an update diff", () => {
  test("an hours_weekly field change shows formatted slots, not raw 24h strings", () => {
    const hoursUpdate = makeUpdateProposal({
      diff: {
        before: { hours_weekly: { mon: ["09:00-17:00"] }, last_verified: "2026-08-01" },
        after: { hours_weekly: { mon: ["08:00-18:00"] }, last_verified: "2026-09-01" },
        fields_changed: ["hours_weekly", "last_verified"],
      },
    });
    render(<ProposalsReviewView proposals={[hoursUpdate]} venueLookup={{}} />);

    expect(screen.getByText(/9am\s*–\s*5pm/)).toBeDefined();
    expect(screen.getByText(/8am\s*–\s*6pm/)).toBeDefined();
    expect(screen.queryByText(/09:00-17:00/)).toBeNull();
  });
});

describe("ProposalsReviewView — link_health shows when it was checked", () => {
  test("includes the checked_at timestamp alongside the dead URL and status", () => {
    render(<ProposalsReviewView proposals={[makeLinkHealthProposal()]} venueLookup={{}} />);
    // One combined match — the card header also renders a "Sep 1, 2026"
    // timestamp, so asserting the date fragment alone would hit two elements.
    expect(screen.getByText(/on the last check, Sep 1, 2026/)).toBeDefined();
  });
});

describe("ProposalsReviewView — card header shows which run produced it", () => {
  test("shows the run_id alongside the submitted date", () => {
    render(<ProposalsReviewView proposals={[makeUpdateProposal()]} venueLookup={{}} />);
    expect(screen.getByText(/run-1/)).toBeDefined();
  });
});

// ─── Clickable URL/phone values (staging review, second pass) ─────────────

describe("ProposalsReviewView — Website/Phone values render as real links", () => {
  test("an add proposal's Website value is a real link — correct href, opens a new tab safely", () => {
    render(<ProposalsReviewView proposals={[makeAddProposal()]} venueLookup={{}} />);

    const link = screen.getByRole("link", { name: "https://northside.example.com" });
    expect(link.getAttribute("href")).toBe("https://northside.example.com");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  test("an add proposal's Phone value is a tel: link", () => {
    render(<ProposalsReviewView proposals={[makeAddProposal()]} venueLookup={{}} />);

    const link = screen.getByRole("link", { name: "719-555-0200" });
    expect(link.getAttribute("href")).toBe("tel:719-555-0200");
  });

  test("an update proposal's url field diff renders the resulting (after) value as a real link", () => {
    const urlUpdate = makeUpdateProposal({
      diff: {
        before: { url: "https://old.example.com" },
        after: { url: "https://new.example.com" },
        fields_changed: ["url"],
      },
    });
    render(<ProposalsReviewView proposals={[urlUpdate]} venueLookup={{}} />);

    const link = screen.getByRole("link", { name: "https://new.example.com" });
    expect(link.getAttribute("href")).toBe("https://new.example.com");
    // The struck-through "before" value is being replaced, not something
    // worth clicking through to — it stays plain text.
    expect(screen.queryByRole("link", { name: "https://old.example.com" })).toBeNull();
    expect(screen.getByText("https://old.example.com")).toBeDefined();
  });

  test("a non-http(s) url never becomes a link (safeUrl guard)", () => {
    const unsafeUpdate = makeUpdateProposal({
      diff: {
        before: { url: "https://old.example.com" },
        after: { url: "javascript:alert(1)" },
        fields_changed: ["url"],
      },
    });
    render(<ProposalsReviewView proposals={[unsafeUpdate]} venueLookup={{}} />);

    expect(screen.queryByRole("link", { name: /javascript:alert/ })).toBeNull();
    expect(screen.getByText("javascript:alert(1)")).toBeDefined();
  });

  test("the link_health dead-link URL is itself a real, clickable link", () => {
    render(<ProposalsReviewView proposals={[makeLinkHealthProposal()]} venueLookup={{}} />);

    const link = screen.getByRole("link", { name: "https://dead.example.com" });
    expect(link.getAttribute("href")).toBe("https://dead.example.com");
    expect(link.getAttribute("target")).toBe("_blank");
  });
});

// ─── Right-hand preview panel (staging review, second pass) ───────────────

describe("ProposalsReviewView — preview panel shows the RESULTING venue, not today's", () => {
  test("an update proposal's preview reflects the proposed value, not the current one", () => {
    const categoryUpdate = makeUpdateProposal({
      diff: {
        before: { category: "grocery" },
        after: { category: "pantry" },
        fields_changed: ["category"],
      },
    });
    render(
      <ProposalsReviewView
        proposals={[categoryUpdate]}
        venueLookup={{ "osm-node-1": makeVenueLookup({ category: "grocery" }) }}
      />,
    );

    const preview = within(screen.getByTestId("proposal-preview"));
    // The preview must show the PROPOSED category (pantry -> "Food Pantry"),
    // never the current one (grocery -> "Grocery / Supermarket") — a test
    // that would pass against either would prove nothing about the merge.
    expect(preview.getByText(/Food Pantry/)).toBeDefined();
    expect(preview.queryByText(/Grocery \/ Supermarket/)).toBeNull();
  });

  test("an add proposal's preview renders the real VenueCard for the new venue", () => {
    render(<ProposalsReviewView proposals={[makeAddProposal()]} venueLookup={{}} />);

    const preview = within(screen.getByTestId("proposal-preview"));
    expect(preview.getByText("Northside Pantry")).toBeDefined();
    expect(preview.getByText(/Food Pantry/)).toBeDefined();
  });

  test("a remove proposal's preview never presents the venue as if it were staying — dimmed card, explicit off-map sentence, no plain normal-looking card", () => {
    render(
      <ProposalsReviewView
        proposals={[makeRemoveProposal()]}
        venueLookup={{ "plentiful-old-pantry": makeVenueLookup({ name: "Old Pantry", category: "pantry" }) }}
      />,
    );

    const preview = within(screen.getByTestId("proposal-preview"));
    expect(preview.getByText(/no longer appear on the public map/i)).toBeDefined();
    // The card itself is still shown (dimmed, not hidden) so the reviewer
    // can still recognise which place is leaving — but it's marked `inert`
    // (removed from the accessibility tree and keyboard-unreachable), not a
    // normal interactive card sitting there as if nothing were happening.
    const card = preview.getByText("Old Pantry").closest("ul");
    expect(card).not.toBeNull();
    expect(card?.hasAttribute("inert")).toBe(true);
  });

  test("a link_health card renders no preview panel — there's no proposed field change to preview", () => {
    render(<ProposalsReviewView proposals={[makeLinkHealthProposal()]} venueLookup={{}} />);
    expect(screen.queryByTestId("proposal-preview")).toBeNull();
  });
});
