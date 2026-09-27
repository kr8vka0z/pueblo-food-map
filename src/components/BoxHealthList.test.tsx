/**
 * BoxHealthList render tests (admin dashboard build) — fixture-props
 * coverage, same convention every other *View.test.tsx file in this app
 * uses for its presentational component. Covers both variants this
 * component renders (the Dashboard's own "needs-help", plus "quiet" — see
 * this component's own header for why "quiet" has no live caller since
 * #671) and the empty state each caller passes its own message for.
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
    sponsors: [],
    removedOn: null,
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

  test("quiet variant shows days-since and sponsor (or 'Needs a sponsor')", () => {
    const withSponsor = makeEntry({
      venueId: "box-2",
      sponsors: ["Jamie R."],
      health: { status: "quiet", latest: null, daysSinceLastReport: 45 },
    });
    const noSponsor = makeEntry({
      venueId: "box-3",
      name: "Blessing Box - Elm St",
      sponsors: [],
      health: { status: "quiet", latest: null, daysSinceLastReport: null },
    });

    render(<BoxHealthList entries={[withSponsor, noSponsor]} variant="quiet" emptyMessage="unused" />);

    expect(screen.getByText(/Quiet 45 days ago/)).toBeDefined();
    expect(screen.getByText(/Sponsored by Jamie R\./)).toBeDefined();
    expect(screen.getByText(/No reports yet/)).toBeDefined();
    expect(screen.getByText(/Needs a sponsor/)).toBeDefined();
  });
});
