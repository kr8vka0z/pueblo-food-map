/**
 * VenueListView tests — the admin's searchable/filterable Places table (#253):
 * rendering, the status key and badges (#673), search, the quick-filter chips
 * (#674, formerly a status <select>), the category filter, the empty state,
 * the result count, the name-as-edit-link (#255, moved onto the name and the
 * separate Actions column removed by #672), and the review items folded in
 * from the Data refresh tab (#674) and the public Review queue (#675). The
 * Server Component page that fetches D1 rows (src/app/(site)/admin/places/
 * page.tsx) has its own page.test.tsx; this file covers the presentational
 * component.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VenueListView from "@/components/VenueListView";
import type { AdminVenueRow } from "@/types/venue";
import type { AdminDisplayStatus } from "@/lib/adminVenues";
import type { ParsedProposal } from "@/lib/adminProposals";
import type { ReviewItem } from "@/lib/publicSubmissions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function makeVenue(overrides: Partial<AdminVenueRow> = {}): AdminVenueRow {
  return {
    id: "manual-abc",
    name: "Eastside Pantry",
    category: "pantry",
    lat: 38.25,
    lng: -104.6,
    address: "123 Test St, Pueblo, CO",
    hours_weekly: null,
    hours_irregular: null,
    accepts_snap: null,
    accepts_wic: null,
    phone: null,
    email: null,
    url: null,
    notes: null,
    operator: null,
    source: "Manual entry",
    last_verified: "2026-07-03",
    status: "draft",
    source_type: "manual",
    outside_county: 0,
    created_at: "2026-07-01T00:00:00.000Z",
    created_by: "admin@pueblofoodmap.com",
    updated_at: "2026-07-01T00:00:00.000Z",
    updated_by: "admin@pueblofoodmap.com",
    published_at: null,
    published_by: null,
    ...overrides,
  };
}

function makeStatusMap(venues: AdminVenueRow[], status: AdminDisplayStatus = "draft"): Record<string, AdminDisplayStatus> {
  return Object.fromEntries(venues.map((v) => [v.id, status]));
}

// A four-row table, one per #673 status. last_verified is pinned so the
// date-format case has a known value.
const VENUES: AdminVenueRow[] = [
  makeVenue({ id: "v1", name: "Eastside Pantry", category: "pantry", address: "101 E 5th St, Pueblo, CO 81001", status: "published", last_verified: "2026-01-01" }),
  makeVenue({ id: "v2", name: "Main Street Grocery", category: "grocery", address: "200 N Main St, Pueblo, CO 81003", status: "published", last_verified: "2026-01-01" }),
  makeVenue({ id: "v3", name: "Westside Garden", category: "garden", address: "300 W 4th St, Pueblo, CO 81003", status: "draft", last_verified: "2026-01-01" }),
  makeVenue({ id: "v4", name: "Old Convenience Stop", category: "convenience", address: "400 S Elm St, Pueblo, CO 81003", status: "archived", last_verified: "2026-01-01" }),
];

// v1: unedited (live). v2: edited since publish (live · edits waiting).
// v3: draft. v4: archived (removed).
const STATUS_BY_ID: Record<string, AdminDisplayStatus> = {
  v1: "live",
  v2: "live_edits_waiting",
  v3: "draft",
  v4: "removed",
};

describe("VenueListView — name-as-edit-link affordance (#255, #672)", () => {
  test("each row's name links to /admin/venues/<id>/edit", () => {
    const venues = [makeVenue({ id: "manual-abc" }), makeVenue({ id: "manual-xyz", name: "Westside Grocery" })];
    render(<VenueListView venues={venues} statusByVenueId={makeStatusMap(venues)} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Eastside Pantry" })).toHaveAttribute(
      "href",
      "/admin/venues/manual-abc/edit",
    );
    expect(screen.getByRole("link", { name: "Westside Grocery" })).toHaveAttribute(
      "href",
      "/admin/venues/manual-xyz/edit",
    );
  });
});

// ─── Rendering ───────────────────────────────────────────────────────────────

describe("VenueListView — renders venue table", () => {
  test("renders a row for every venue", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    expect(screen.getByText("Eastside Pantry")).toBeDefined();
    expect(screen.getByText("Main Street Grocery")).toBeDefined();
    expect(screen.getByText("Westside Garden")).toBeDefined();
    expect(screen.getByText("Old Convenience Stop")).toBeDefined();
  });

  test("renders a real table with column headers, and no Actions/Edit column (#672)", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    expect(screen.getByRole("table")).toBeDefined();
    expect(screen.getByRole("columnheader", { name: /name/i })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: /category/i })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: /status/i })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: /address/i })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: /last verified/i })).toBeDefined();
    expect(screen.queryByRole("columnheader", { name: /actions/i })).toBeNull();
    // The name IS the edit link — no separate Edit text either.
    expect(screen.queryByText(/^Edit$/)).toBeNull();
  });

  test("renders the human category label, not the raw category key", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    // Scoped to the table: "Grocery / Supermarket" / "grocery" also appear as
    // an <option> in the category filter select, which would otherwise make
    // this query ambiguous.
    const table = screen.getByRole("table");
    expect(within(table).getByText("Grocery / Supermarket")).toBeDefined();
    expect(within(table).queryByText("grocery")).toBeNull();
  });

  test("renders one status badge per row, with human labels (#673)", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    const table = screen.getByRole("table");
    expect(within(within(table).getByRole("row", { name: /Eastside Pantry/i })).getByText("Live")).toBeDefined();
    expect(
      within(within(table).getByRole("row", { name: /Main Street Grocery/i })).getByText("Live · edits waiting"),
    ).toBeDefined();
    expect(within(within(table).getByRole("row", { name: /Westside Garden/i })).getByText("Draft")).toBeDefined();
    expect(
      within(within(table).getByRole("row", { name: /Old Convenience Stop/i })).getByText("Removed"),
    ).toBeDefined();
  });

  test("formats last_verified readably", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    expect(screen.getAllByText("Jan 1, 2026").length).toBeGreaterThan(0);
  });
});

// ─── Status key (#673 pt.2) ──────────────────────────────────────────────────

describe("VenueListView — status key", () => {
  test("shows one line per status above the table", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    expect(screen.getByText("New, not on the public map yet.")).toBeDefined();
    expect(screen.getByText("On the public map, exactly as shown.")).toBeDefined();
    expect(screen.getByText("Approved or saved changes the map doesn't show until Publish.")).toBeDefined();
    expect(screen.getByText("Taken off the map, kept for the record.")).toBeDefined();
  });
});

// ─── Search ──────────────────────────────────────────────────────────────────

describe("VenueListView — search", () => {
  test("has an accessible search input", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    expect(screen.getByLabelText(/search/i)).toBeDefined();
  });

  test("narrows results by name", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    fireEvent.change(screen.getByLabelText(/search/i), { target: { value: "garden" } });
    expect(screen.getByText("Westside Garden")).toBeDefined();
    expect(screen.queryByText("Eastside Pantry")).toBeNull();
    expect(screen.queryByText("Main Street Grocery")).toBeNull();
    expect(screen.queryByText("Old Convenience Stop")).toBeNull();
  });

  test("narrows results by address", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    fireEvent.change(screen.getByLabelText(/search/i), { target: { value: "Elm" } });
    expect(screen.getByText("Old Convenience Stop")).toBeDefined();
    expect(screen.queryByText("Eastside Pantry")).toBeNull();
  });

  test("search is case-insensitive", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    fireEvent.change(screen.getByLabelText(/search/i), { target: { value: "GARDEN" } });
    expect(screen.getByText("Westside Garden")).toBeDefined();
  });
});

// ─── Filters ─────────────────────────────────────────────────────────────────
//
// #674 replaced the status <select> with quick-filter chips (the issue's own
// spec: "quick-filter chips with counts (All / To review / Waiting to
// publish / Draft / Live / Removed)") — these cases are rewritten, not just
// added to, to exercise that new control instead of a dropdown that no
// longer exists.

describe("VenueListView — quick-filter chips (#674, formerly a status <select>)", () => {
  test("has an accessible chip for every #673 status plus 'All places' and 'To review'", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    for (const label of ["All places", "To review", "Live · edits waiting", "Draft", "Removed"]) {
      expect(screen.getByRole("button", { name: new RegExp(`^${label}`) })).toBeDefined();
    }
    // Exact match for "Live" — "Live · edits waiting" also starts with "Live ".
    expect(screen.getByRole("button", { name: "Live (1)" })).toBeDefined();
  });

  test("filtering to Draft shows only draft venues", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    fireEvent.click(screen.getByRole("button", { name: /^Draft/ }));
    expect(screen.getByText("Westside Garden")).toBeDefined();
    expect(screen.queryByText("Eastside Pantry")).toBeNull();
    expect(screen.queryByText("Main Street Grocery")).toBeNull();
    expect(screen.queryByText("Old Convenience Stop")).toBeNull();
  });

  test("filtering to Live shows only unedited live venues", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    // Exact match, not a `/^Live/` regex — "Live · edits waiting" also
    // starts with "Live " and would otherwise match too.
    fireEvent.click(screen.getByRole("button", { name: "Live (1)" }));
    expect(screen.getByText("Eastside Pantry")).toBeDefined();
    expect(screen.queryByText("Main Street Grocery")).toBeNull();
    expect(screen.queryByText("Westside Garden")).toBeNull();
    expect(screen.queryByText("Old Convenience Stop")).toBeNull();
  });

  test("filtering to Live · edits waiting shows only that status", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    fireEvent.click(screen.getByRole("button", { name: /^Live · edits waiting/ }));
    expect(screen.getByText("Main Street Grocery")).toBeDefined();
    expect(screen.queryByText("Eastside Pantry")).toBeNull();
  });

  test("filtering to Removed shows only archived venues", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    fireEvent.click(screen.getByRole("button", { name: /^Removed/ }));
    expect(screen.getByText("Old Convenience Stop")).toBeDefined();
    expect(screen.queryByText("Eastside Pantry")).toBeNull();
  });
});

describe("VenueListView — category filter", () => {
  test("has an accessible category filter", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    expect(screen.getByLabelText(/category/i)).toBeDefined();
  });

  test("filtering to Grocery / Supermarket shows only that category", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: "grocery" } });
    expect(screen.getByText("Main Street Grocery")).toBeDefined();
    expect(screen.queryByText("Eastside Pantry")).toBeNull();
    expect(screen.queryByText("Westside Garden")).toBeNull();
  });
});

// ─── Empty state ─────────────────────────────────────────────────────────────

describe("VenueListView — empty state", () => {
  test("shows a friendly message when no venues match", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    fireEvent.change(screen.getByLabelText(/search/i), { target: { value: "no-such-venue-xyz" } });
    expect(screen.getByText(/no venues match your search/i)).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
  });

  test("renders the empty state, and no name link, when the venues prop itself is empty", () => {
    render(<VenueListView venues={[]} statusByVenueId={{}} />);
    expect(screen.getByText(/no venues match your search/i)).toBeDefined();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

// ─── Count summary ───────────────────────────────────────────────────────────

describe("VenueListView — result count", () => {
  // #674: the count now reads "places" (rows can also be a synthetic
  // "Suggested new place" row, not only a real venue) — see this file's own
  // header note on the chip-filter rewrite above for why.
  test("shows a count of filtered vs total places that updates on filter", () => {
    render(<VenueListView venues={VENUES} statusByVenueId={STATUS_BY_ID} />);
    expect(screen.getByText(/4 of 4 places/i)).toBeDefined();
    fireEvent.change(screen.getByLabelText(/search/i), { target: { value: "garden" } });
    expect(screen.getByText(/1 of 4 places/i)).toBeDefined();
  });
});

// ─── #674: folding the Data refresh tab into Places ───────────────────────

function makeUpdateProposal(overrides: Partial<ParsedProposal> = {}): ParsedProposal {
  return {
    row: {
      id: 1,
      source: "osm",
      target_venue_id: "manual-abc",
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
    ...overrides,
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
      before: null,
      after: { name: "Northside Pantry", category: "pantry", address: "900 Elm St, Pueblo, CO" },
      fields_changed: ["name", "category", "address"],
    },
    ...overrides,
  } as ParsedProposal;
}

function wrapProposal(proposal: ParsedProposal): ReviewItem {
  return { kind: "proposal", proposal };
}

describe("VenueListView — quick-filter chips (#674)", () => {
  test("shows a count next to each chip, and 'All places' matches everything", () => {
    const venues = [makeVenue({ id: "manual-abc", name: "Eastside Pantry" }), makeVenue({ id: "manual-xyz", name: "Westside Grocery" })];
    render(
      <VenueListView
        venues={venues}
        statusByVenueId={{ "manual-abc": "draft", "manual-xyz": "live" }}
        itemsByVenueId={{ "manual-abc": [makeUpdateProposal()].map(wrapProposal) }}
      />,
    );

    expect(screen.getByRole("button", { name: /All places \(2\)/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /To review \(1\)/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Draft \(1\)/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Live \(1\)/ })).toBeDefined();
  });

  test("clicking 'To review' shows only rows with a pending proposal", async () => {
    const venues = [makeVenue({ id: "manual-abc", name: "Eastside Pantry" }), makeVenue({ id: "manual-xyz", name: "Westside Grocery" })];
    const user = userEvent.setup();
    render(
      <VenueListView
        venues={venues}
        statusByVenueId={makeStatusMap(venues)}
        itemsByVenueId={{ "manual-abc": [makeUpdateProposal()].map(wrapProposal) }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /To review/ }));

    expect(screen.getByRole("link", { name: "Eastside Pantry" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Westside Grocery" })).toBeNull();
  });

  test("?show=review pre-selects the To review chip", () => {
    const venues = [makeVenue({ id: "manual-abc", name: "Eastside Pantry" }), makeVenue({ id: "manual-xyz", name: "Westside Grocery" })];
    render(
      <VenueListView
        venues={venues}
        statusByVenueId={makeStatusMap(venues)}
        itemsByVenueId={{ "manual-abc": [makeUpdateProposal()].map(wrapProposal) }}
        initialShowReview
      />,
    );

    expect(screen.getByRole("link", { name: "Eastside Pantry" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Westside Grocery" })).toBeNull();
  });
});

describe("VenueListView — To review column", () => {
  test("a venue with a pending proposal shows a short summary + lane tag", () => {
    const venues = [makeVenue({ id: "manual-abc" })];
    render(
      <VenueListView
        venues={venues}
        statusByVenueId={makeStatusMap(venues)}
        itemsByVenueId={{ "manual-abc": [makeUpdateProposal()].map(wrapProposal) }}
      />,
    );

    expect(screen.getByText(/phone number/i)).toBeDefined();
  });

  test("a venue with nothing pending shows a dash", () => {
    const venues = [makeVenue({ id: "manual-abc" })];
    render(<VenueListView venues={venues} statusByVenueId={makeStatusMap(venues)} />);
    expect(screen.getByText("—")).toBeDefined();
  });
});

describe("VenueListView — default sort puts something-to-review rows first", () => {
  test("a place with a pending proposal sorts before an alphabetically-earlier place with nothing pending", () => {
    const venues = [
      makeVenue({ id: "manual-a", name: "Alpha Pantry" }),
      makeVenue({ id: "manual-z", name: "Zeta Grocery" }),
    ];
    render(
      <VenueListView
        venues={venues}
        statusByVenueId={makeStatusMap(venues)}
        itemsByVenueId={{ "manual-z": [makeUpdateProposal({ row: { ...makeUpdateProposal().row, target_venue_id: "manual-z" } })].map(wrapProposal) }}
      />,
    );

    const names = screen.getAllByRole("link").map((el) => el.textContent);
    expect(names.indexOf("Zeta Grocery")).toBeLessThan(names.indexOf("Alpha Pantry"));
  });
});

describe("VenueListView — 'Suggested new place' rows (#674)", () => {
  test("a genuinely-new add proposal renders its own row, linking to the new-venue form", () => {
    const venues = [makeVenue({ id: "manual-abc" })];
    render(
      <VenueListView
        venues={venues}
        statusByVenueId={makeStatusMap(venues)}
        addItems={[wrapProposal(makeAddProposal())]}
      />,
    );

    const link = screen.getByRole("link", { name: "Northside Pantry" });
    expect(link.getAttribute("href")).toBe("/admin/venues/new?proposal=10");
    // "Suggested new place" appears twice — the status badge AND the To
    // review column's own summary for an `add` proposal (both correct).
    expect(screen.getAllByText("Suggested new place").length).toBeGreaterThanOrEqual(1);
  });

  test("counts toward the total and the 'To review' chip", () => {
    const venues = [makeVenue({ id: "manual-abc" })];
    render(
      <VenueListView
        venues={venues}
        statusByVenueId={makeStatusMap(venues)}
        addItems={[wrapProposal(makeAddProposal())]}
      />,
    );

    expect(screen.getByRole("button", { name: /All places \(2\)/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /To review \(1\)/ })).toBeDefined();
  });
});

describe("VenueListView — an archived venue's name stays a link when it has a pending proposal (a restore)", () => {
  test("archived + no pending proposal -> plain text (unchanged #568 behavior)", () => {
    const venues = [makeVenue({ id: "manual-abc", status: "archived" })];
    render(<VenueListView venues={venues} statusByVenueId={{ "manual-abc": "removed" }} />);
    expect(screen.queryByRole("link", { name: "Eastside Pantry" })).toBeNull();
    expect(screen.getByText("Eastside Pantry")).toBeDefined();
  });

  test("archived + a pending restore proposal -> stays a real link (its edit page's Suggestions box is a real action)", () => {
    const venues = [makeVenue({ id: "manual-abc", status: "archived" })];
    render(
      <VenueListView
        venues={venues}
        statusByVenueId={{ "manual-abc": "removed" }}
        itemsByVenueId={{ "manual-abc": [makeAddProposal({ row: { ...makeAddProposal().row, target_venue_id: "manual-abc" } })].map(wrapProposal) }}
      />,
    );
    expect(screen.getByRole("link", { name: "Eastside Pantry" })).toBeDefined();
  });
});

describe("VenueListView — source/lane filters (moved from /admin/flags)", () => {
  test("not shown when only one source/lane is present", () => {
    const venues = [makeVenue({ id: "manual-abc" })];
    render(
      <VenueListView
        venues={venues}
        statusByVenueId={makeStatusMap(venues)}
        itemsByVenueId={{ "manual-abc": [makeUpdateProposal()].map(wrapProposal) }}
      />,
    );
    expect(screen.queryByRole("button", { name: "All sources" })).toBeNull();
  });

  test("filters rows by proposal source when more than one source is present", async () => {
    const venues = [
      makeVenue({ id: "manual-abc", name: "Eastside Pantry" }),
      makeVenue({ id: "manual-xyz", name: "Westside Grocery" }),
    ];
    const user = userEvent.setup();
    render(
      <VenueListView
        venues={venues}
        statusByVenueId={makeStatusMap(venues)}
        itemsByVenueId={{
          "manual-abc": [makeUpdateProposal({ row: { ...makeUpdateProposal().row, source: "osm" } })].map(wrapProposal),
          "manual-xyz": [makeUpdateProposal({ row: { ...makeUpdateProposal().row, source: "plentiful", target_venue_id: "manual-xyz" } })].map(wrapProposal),
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "OpenStreetMap" }));

    expect(screen.getByRole("link", { name: "Eastside Pantry" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Westside Grocery" })).toBeNull();
  });
});

// ─── #675: folding the public Review queue into Places ─────────────────────

function makeClosureSubmissionItem(overrides: Partial<ReviewItem & { kind: "submission" }> = {}): ReviewItem {
  return {
    kind: "submission",
    submission: {
      id: 9,
      kind: "closure",
      createdAt: "2026-09-01T12:00:00.000Z",
      submitterEmail: "reporter@example.com",
      targetVenueId: "manual-abc",
      parseError: false,
      payload: {
        venueId: "manual-abc",
        venueName: "Eastside Pantry",
        venueAddress: "123 Test St, Pueblo, CO",
        issueType: "hours",
        description: "Hours are wrong.",
        contactEmail: "reporter@example.com",
      },
    },
    ...overrides,
  } as ReviewItem;
}

function makeNewVenueSubmissionItem(): ReviewItem {
  return {
    kind: "submission",
    submission: {
      id: 5,
      kind: "new_venue",
      createdAt: "2026-09-01T12:00:00.000Z",
      submitterEmail: "suggester@example.com",
      targetVenueId: null,
      parseError: false,
      payload: {
        venueName: "Northside Pantry",
        address: "900 Elm St, Pueblo, CO",
        category: "pantry",
        acceptsSnap: true,
        acceptsWic: false,
        submitterEmail: "suggester@example.com",
      },
    },
  } as ReviewItem;
}

describe("VenueListView — public submissions in the To review column (#675)", () => {
  test("a venue with a pending public report shows 'Public: <issue label>' and a Public tag", () => {
    const venues = [makeVenue({ id: "manual-abc" })];
    render(
      <VenueListView
        venues={venues}
        statusByVenueId={makeStatusMap(venues)}
        itemsByVenueId={{ "manual-abc": [makeClosureSubmissionItem()] }}
      />,
    );

    expect(screen.getByText(/Public: "Hours are wrong or out of date"/)).toBeDefined();
    expect(screen.getByText("Public")).toBeDefined();
  });

  test("a report against an archived (Removed) venue still shows on that venue's row", () => {
    const venues = [makeVenue({ id: "manual-abc", status: "archived" })];
    render(
      <VenueListView
        venues={venues}
        statusByVenueId={{ "manual-abc": "removed" }}
        itemsByVenueId={{ "manual-abc": [makeClosureSubmissionItem()] }}
      />,
    );

    expect(screen.getByRole("link", { name: "Eastside Pantry" })).toBeDefined();
    expect(screen.getByText(/Public: "Hours are wrong or out of date"/)).toBeDefined();
  });
});

describe("VenueListView — a new_venue submission renders its own 'Suggested new place' row, tagged Public (#675)", () => {
  test("links to the new-venue form via ?submission=<id>, and shows a Public tag alongside 'Suggested new place'", () => {
    const venues = [makeVenue({ id: "manual-abc" })];
    render(
      <VenueListView
        venues={venues}
        statusByVenueId={makeStatusMap(venues)}
        addItems={[makeNewVenueSubmissionItem()]}
      />,
    );

    const link = screen.getByRole("link", { name: "Northside Pantry" });
    expect(link.getAttribute("href")).toBe("/admin/venues/new?submission=5");
    expect(screen.getAllByText("Suggested new place").length).toBeGreaterThanOrEqual(1);
    // "Public" appears twice — the row-status badge AND the To review
    // column's own item tag (both correct, same reasoning as the
    // "Suggested new place" double-render above).
    expect(screen.getAllByText("Public").length).toBeGreaterThanOrEqual(1);
  });
});

describe("VenueListView — source filter gains 'The public' (#675)", () => {
  test("filtering by 'The public' shows only rows with a pending submission", async () => {
    const venues = [
      makeVenue({ id: "manual-abc", name: "Eastside Pantry" }),
      makeVenue({ id: "manual-xyz", name: "Westside Grocery" }),
    ];
    const user = userEvent.setup();
    render(
      <VenueListView
        venues={venues}
        statusByVenueId={makeStatusMap(venues)}
        itemsByVenueId={{
          "manual-abc": [wrapProposal(makeUpdateProposal({ row: { ...makeUpdateProposal().row, source: "osm" } }))],
          "manual-xyz": [
            {
              kind: "submission",
              submission: { ...(makeClosureSubmissionItem() as Extract<ReviewItem, { kind: "submission" }>).submission, targetVenueId: "manual-xyz" },
            },
          ],
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "The public" }));

    expect(screen.getByRole("link", { name: "Westside Grocery" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Eastside Pantry" })).toBeNull();
  });

  test("?from=public pre-selects 'The public' source filter chip", () => {
    const venues = [
      makeVenue({ id: "manual-abc", name: "Eastside Pantry" }),
      makeVenue({ id: "manual-xyz", name: "Westside Grocery" }),
    ];
    render(
      <VenueListView
        venues={venues}
        statusByVenueId={makeStatusMap(venues)}
        itemsByVenueId={{
          "manual-abc": [wrapProposal(makeUpdateProposal({ row: { ...makeUpdateProposal().row, source: "osm" } }))],
          "manual-xyz": [makeClosureSubmissionItem()],
        }}
        initialSourceFilter="public"
      />,
    );

    expect(screen.getByRole("link", { name: "Westside Grocery" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Eastside Pantry" })).toBeNull();
  });
});
