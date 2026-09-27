/**
 * AllBoxesTable tests (#671 rework) — status filter buttons + counts,
 * search, the Sponsor filter, the default "Needs attention first" sort, the
 * "Showing X of N" line, both empty states (zero boxes vs. zero matches),
 * the box-name-as-edit-link (no separate Edit column), and the Sponsor
 * column's public-card-style formatting.
 */

import { describe, expect, test } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AllBoxesTable from "@/components/AllBoxesTable";
import type { BoxHealthEntry, BoxHealthStatus } from "@/lib/boxHealth";

function makeEntry(overrides: Partial<BoxHealthEntry> = {}): BoxHealthEntry {
  return {
    venueId: "box-1",
    name: "Blessing Box - Routt",
    address: "216 W Routt Ave, Pueblo, CO",
    lat: 38.27,
    lng: -104.6,
    health: { status: "ok", latest: null, daysSinceLastReport: 2 },
    sponsors: [],
    removedOn: null,
    ...overrides,
  };
}

function entryWithStatus(id: string, status: BoxHealthStatus, days: number | null): BoxHealthEntry {
  return makeEntry({ venueId: id, name: `Box ${id}`, health: { status, latest: null, daysSinceLastReport: days } });
}

describe("AllBoxesTable — empty states", () => {
  test("zero boxes at all: no table, no filter bar", () => {
    render(<AllBoxesTable entries={[]} />);
    expect(screen.getByText("No blessing boxes yet.")).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("group", { name: "Filter boxes by status" })).toBeNull();
  });

  test("boxes exist but none match the filters: one row with the empty-filter message", async () => {
    const user = userEvent.setup();
    render(<AllBoxesTable entries={[entryWithStatus("a", "ok", 1)]} />);
    await user.type(screen.getByLabelText("Search boxes"), "no such box");
    expect(screen.getByText("No boxes match these filters.")).toBeDefined();
    expect(screen.getByText("Showing 0 of 1 boxes")).toBeDefined();
  });
});

describe("AllBoxesTable — row content", () => {
  test("box name links to its edit page; there is no separate Edit column", () => {
    render(<AllBoxesTable entries={[makeEntry({ venueId: "box-9" })]} />);
    const link = screen.getByRole("link", { name: "Blessing Box - Routt" });
    expect(link.getAttribute("href")).toBe("/admin/venues/box-9/edit");
    expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
    expect(screen.getByText("216 W Routt Ave, Pueblo, CO")).toBeDefined();
  });

  test("a removed box shows a 'Removed from service' note", () => {
    render(<AllBoxesTable entries={[makeEntry({ removedOn: "2026-08-01" })]} />);
    expect(screen.getByText("Removed from service")).toBeDefined();
  });

  test("Sponsor column: 0/1/2/3+ sponsors format like the public card ('Needs a sponsor', 'A', 'A, B', 'A, B, +N more')", () => {
    render(
      <AllBoxesTable
        entries={[
          makeEntry({ venueId: "none", sponsors: [] }),
          makeEntry({ venueId: "one", sponsors: ["Jamie R."] }),
          makeEntry({ venueId: "two", sponsors: ["Jamie R.", "Sam T."] }),
          makeEntry({ venueId: "three", sponsors: ["Jamie R.", "Sam T.", "Alex P."] }),
        ]}
      />,
    );
    // "Needs a sponsor" also names a <select> option (the Sponsor filter) —
    // scope to the table cell so the two don't collide.
    expect(within(screen.getByRole("table")).getByText("Needs a sponsor")).toBeDefined();
    expect(screen.getByText("Jamie R.")).toBeDefined();
    expect(screen.getByText("Jamie R., Sam T.")).toBeDefined();
    expect(screen.getByText("Jamie R., Sam T., +1 more")).toBeDefined();
  });
});

describe("AllBoxesTable — status filter buttons", () => {
  const entries = [
    entryWithStatus("empty-1", "empty", 1),
    entryWithStatus("problem-1", "problem", 1),
    entryWithStatus("low-1", "low", 1),
    entryWithStatus("quiet-1", "quiet", 40),
    entryWithStatus("ok-1", "ok", 1),
    entryWithStatus("ok-2", "ok", 1),
  ];

  test("counts: All=6, Needs help=3 (empty+problem+low), and each individual status", () => {
    render(<AllBoxesTable entries={entries} />);
    expect(screen.getByRole("button", { name: "All (6)" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Needs help (3)" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Empty (1)" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Problem (1)" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Low (1)" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Quiet (1)" })).toBeDefined();
    expect(screen.getByRole("button", { name: "OK (2)" })).toBeDefined();
  });

  test("a zero-count button is disabled, except All", () => {
    render(<AllBoxesTable entries={[entryWithStatus("ok-1", "ok", 1)]} />);
    expect(screen.getByRole("button", { name: "All (1)" })).not.toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Empty (0)" })).toHaveProperty("disabled", true);
  });

  test("clicking 'Needs help' filters to empty/problem/low only", async () => {
    const user = userEvent.setup();
    render(<AllBoxesTable entries={entries} />);
    await user.click(screen.getByRole("button", { name: "Needs help (3)" }));

    const rows = screen.getAllByRole("row").slice(1); // drop the header row
    expect(rows).toHaveLength(3);
    expect(screen.getByText("Showing 3 of 6 boxes")).toBeDefined();
  });

  test("clicking a specific status (Quiet) filters to only that status", async () => {
    const user = userEvent.setup();
    render(<AllBoxesTable entries={entries} />);
    await user.click(screen.getByRole("button", { name: "Quiet (1)" }));
    expect(screen.getByText("Box quiet-1")).toBeDefined();
    expect(screen.queryByText("Box ok-1")).toBeNull();
  });
});

describe("AllBoxesTable — search", () => {
  const entries = [
    makeEntry({ venueId: "a", name: "Eastside Box", address: "100 East St", sponsors: [] }),
    makeEntry({ venueId: "b", name: "Westside Box", address: "200 West St", sponsors: ["Jamie R."] }),
  ];

  test("matches by name", async () => {
    const user = userEvent.setup();
    render(<AllBoxesTable entries={entries} />);
    await user.type(screen.getByLabelText("Search boxes"), "eastside");
    expect(screen.getByText("Eastside Box")).toBeDefined();
    expect(screen.queryByText("Westside Box")).toBeNull();
  });

  test("matches by address", async () => {
    const user = userEvent.setup();
    render(<AllBoxesTable entries={entries} />);
    await user.type(screen.getByLabelText("Search boxes"), "200 west");
    expect(screen.getByText("Westside Box")).toBeDefined();
    expect(screen.queryByText("Eastside Box")).toBeNull();
  });

  test("matches by sponsor name, case-insensitively", async () => {
    const user = userEvent.setup();
    render(<AllBoxesTable entries={entries} />);
    await user.type(screen.getByLabelText("Search boxes"), "JAMIE");
    expect(screen.getByText("Westside Box")).toBeDefined();
    expect(screen.queryByText("Eastside Box")).toBeNull();
  });
});

describe("AllBoxesTable — Sponsor filter", () => {
  const entries = [
    makeEntry({ venueId: "sponsored", sponsors: ["Jamie R."] }),
    makeEntry({ venueId: "unsponsored", sponsors: [] }),
  ];

  test("'Has a sponsor' keeps only boxes with sponsors", async () => {
    const user = userEvent.setup();
    render(<AllBoxesTable entries={entries} />);
    await user.selectOptions(screen.getByLabelText("Sponsor"), "has");
    expect(screen.getByText("Showing 1 of 2 boxes")).toBeDefined();
  });

  test("'Needs a sponsor' keeps only boxes without sponsors", async () => {
    const user = userEvent.setup();
    render(<AllBoxesTable entries={entries} />);
    await user.selectOptions(screen.getByLabelText("Sponsor"), "needs");
    expect(screen.getByText("Showing 1 of 2 boxes")).toBeDefined();
  });
});

describe("AllBoxesTable — sort", () => {
  test("default 'Needs attention first': Empty -> Problem -> Low -> Quiet -> OK, ties broken by longest since last report", () => {
    const entries = [
      entryWithStatus("ok-fresh", "ok", 1),
      entryWithStatus("quiet-old", "quiet", 50),
      entryWithStatus("low-1", "low", 1),
      entryWithStatus("empty-1", "empty", 1),
      entryWithStatus("problem-1", "problem", 1),
      entryWithStatus("empty-2-older", "empty", 10),
    ];
    render(<AllBoxesTable entries={entries} />);
    const bodyRows = screen.getAllByRole("row").slice(1);
    const names = bodyRows.map((row) => within(row).getByRole("link").textContent);
    expect(names).toEqual(["Box empty-2-older", "Box empty-1", "Box problem-1", "Box low-1", "Box quiet-old", "Box ok-fresh"]);
  });

  test("'Last report: oldest first' sorts by days-since descending, 'No reports yet' first", async () => {
    const user = userEvent.setup();
    const entries = [
      entryWithStatus("recent", "ok", 1),
      makeEntry({ venueId: "never", name: "Box never", health: { status: "quiet", latest: null, daysSinceLastReport: null } }),
      entryWithStatus("old", "quiet", 40),
    ];
    render(<AllBoxesTable entries={entries} />);
    await user.selectOptions(screen.getByLabelText("Sort"), "oldest");
    const bodyRows = screen.getAllByRole("row").slice(1);
    const names = bodyRows.map((row) => within(row).getByRole("link").textContent);
    expect(names).toEqual(["Box never", "Box old", "Box recent"]);
  });

  test("'Last report: newest first' sorts ascending, 'No reports yet' last", async () => {
    const user = userEvent.setup();
    const entries = [
      entryWithStatus("old", "quiet", 40),
      makeEntry({ venueId: "never", name: "Box never", health: { status: "quiet", latest: null, daysSinceLastReport: null } }),
      entryWithStatus("recent", "ok", 1),
    ];
    render(<AllBoxesTable entries={entries} />);
    await user.selectOptions(screen.getByLabelText("Sort"), "newest");
    const bodyRows = screen.getAllByRole("row").slice(1);
    const names = bodyRows.map((row) => within(row).getByRole("link").textContent);
    expect(names).toEqual(["Box recent", "Box old", "Box never"]);
  });

  test("'Name A–Z' sorts alphabetically", async () => {
    const user = userEvent.setup();
    const entries = [
      makeEntry({ venueId: "z", name: "Zeta Box" }),
      makeEntry({ venueId: "a", name: "Alpha Box" }),
    ];
    render(<AllBoxesTable entries={entries} />);
    await user.selectOptions(screen.getByLabelText("Sort"), "name");
    const bodyRows = screen.getAllByRole("row").slice(1);
    const names = bodyRows.map((row) => within(row).getByRole("link").textContent);
    expect(names).toEqual(["Alpha Box", "Zeta Box"]);
  });
});
