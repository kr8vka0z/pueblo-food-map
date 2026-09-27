/**
 * Tests for VenueListView's name-as-edit-link affordance (#255, moved onto
 * the name and the separate Actions column removed by #672). Pre-#255
 * rendering (search/filter behavior) shipped in #253 with no dedicated test
 * file of its own; this file covers only the per-row name link rather than
 * retroactively writing full regression coverage for #253's own behavior —
 * out of scope for this slice.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VenueListView from "@/components/VenueListView";
import type { AdminVenueRow } from "@/types/venue";
import type { AdminDisplayStatus } from "@/lib/adminVenues";
import type { ParsedProposal } from "@/lib/adminProposals";

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

  test("no name link is rendered when the filtered list is empty", () => {
    render(<VenueListView venues={[]} statusByVenueId={{}} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  test("there is no separate Edit column or link — the name IS the link", () => {
    const venues = [makeVenue()];
    render(<VenueListView venues={venues} statusByVenueId={makeStatusMap(venues)} />);
    expect(screen.queryByText(/^Edit$/)).toBeNull();
    expect(screen.queryByRole("columnheader", { name: /actions/i })).toBeNull();
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

describe("VenueListView — quick-filter chips (#674)", () => {
  test("shows a count next to each chip, and 'All places' matches everything", () => {
    const venues = [makeVenue({ id: "manual-abc", name: "Eastside Pantry" }), makeVenue({ id: "manual-xyz", name: "Westside Grocery" })];
    render(
      <VenueListView
        venues={venues}
        statusByVenueId={{ "manual-abc": "draft", "manual-xyz": "live" }}
        proposalsByVenueId={{ "manual-abc": [makeUpdateProposal()] }}
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
        proposalsByVenueId={{ "manual-abc": [makeUpdateProposal()] }}
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
        proposalsByVenueId={{ "manual-abc": [makeUpdateProposal()] }}
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
        proposalsByVenueId={{ "manual-abc": [makeUpdateProposal()] }}
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
        proposalsByVenueId={{ "manual-z": [makeUpdateProposal({ row: { ...makeUpdateProposal().row, target_venue_id: "manual-z" } })] }}
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
        addProposals={[makeAddProposal()]}
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
        addProposals={[makeAddProposal()]}
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
  });

  test("archived + a pending restore proposal -> stays a real link (its edit page's Suggestions box is a real action)", () => {
    const venues = [makeVenue({ id: "manual-abc", status: "archived" })];
    render(
      <VenueListView
        venues={venues}
        statusByVenueId={{ "manual-abc": "removed" }}
        proposalsByVenueId={{ "manual-abc": [makeAddProposal({ row: { ...makeAddProposal().row, target_venue_id: "manual-abc" } })] }}
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
        proposalsByVenueId={{ "manual-abc": [makeUpdateProposal()] }}
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
        proposalsByVenueId={{
          "manual-abc": [makeUpdateProposal({ row: { ...makeUpdateProposal().row, source: "osm" } })],
          "manual-xyz": [makeUpdateProposal({ row: { ...makeUpdateProposal().row, source: "plentiful", target_venue_id: "manual-xyz" } })],
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "OpenStreetMap" }));

    expect(screen.getByRole("link", { name: "Eastside Pantry" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Westside Grocery" })).toBeNull();
  });
});
