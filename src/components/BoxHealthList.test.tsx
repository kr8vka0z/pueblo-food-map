/**
 * BoxHealthList render tests (admin dashboard build) — fixture-props
 * coverage, same convention every other *View.test.tsx file in this app
 * uses for its presentational component. Covers both variants this
 * component renders for its three real call sites (Dashboard's "Boxes that
 * need help" panel, the future /admin/boxes tab's "Needs help now"/"Gone
 * quiet" lists) and the empty state each of those callers passes its own
 * message for.
 */

import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import BoxHealthList from "@/components/BoxHealthList";
import type { BoxHealthEntry } from "@/lib/boxHealth";

function makeEntry(overrides: Partial<BoxHealthEntry> = {}): BoxHealthEntry {
  return {
    venueId: "box-1",
    name: "Blessing Box - 216 W Routt",
    address: "216 W Routt Ave, Pueblo, CO",
    lat: 38.27,
    lng: -104.6,
    health: { status: "ok", latest: null, daysSinceLastReport: null },
    caretaker: null,
    ...overrides,
  };
}

describe("BoxHealthList", () => {
  test("empty state shows the caller's own message and no list", () => {
    render(<BoxHealthList entries={[]} variant="needs-help" emptyMessage="Every box is doing fine." />);
    expect(screen.getByText("Every box is doing fine.")).toBeDefined();
    expect(screen.queryByRole("list")).toBeNull();
  });

  test("needs-help variant shows status label, note, and a link to the venue's edit screen", () => {
    const entry = makeEntry({
      health: {
        status: "empty",
        latest: { kind: "empty", visibility: "visible", createdAt: "2026-09-01T00:00:00.000Z", note: "Totally bare" },
        daysSinceLastReport: 3,
      },
    });
    render(<BoxHealthList entries={[entry]} variant="needs-help" emptyMessage="unused" />);

    expect(screen.getByText("Blessing Box - 216 W Routt")).toBeDefined();
    expect(screen.getByText(/Empty/)).toBeDefined();
    expect(screen.getByText(/Totally bare/)).toBeDefined();
    expect(screen.getByText(/3 days ago/)).toBeDefined();
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/admin/venues/box-1/edit");
  });

  test("quiet variant shows days-since and caretaker (or 'No caretaker')", () => {
    const withCaretaker = makeEntry({
      venueId: "box-2",
      caretaker: "Jamie R.",
      health: { status: "quiet", latest: null, daysSinceLastReport: 45 },
    });
    const noCaretaker = makeEntry({
      venueId: "box-3",
      name: "Blessing Box - Elm St",
      caretaker: null,
      health: { status: "quiet", latest: null, daysSinceLastReport: null },
    });

    render(<BoxHealthList entries={[withCaretaker, noCaretaker]} variant="quiet" emptyMessage="unused" />);

    expect(screen.getByText(/Quiet 45 days ago/)).toBeDefined();
    expect(screen.getByText(/Cared for by Jamie R\./)).toBeDefined();
    expect(screen.getByText(/No reports yet/)).toBeDefined();
    expect(screen.getByText(/No caretaker/)).toBeDefined();
  });
});
