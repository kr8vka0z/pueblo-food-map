/**
 * Unit tests for getDisplayNotes() (board review finding #3).
 *
 * Fixtures below are copied verbatim from real rows in
 * src/data/published-venues.ts (not synthesized) — the exact shape the
 * Plentiful directory scraper produces, and the exact shape a genuinely
 * informative note takes.
 */

import { describe, test, expect } from "vitest";
import { getDisplayNotes } from "@/lib/venueNotes";
import type { Venue } from "@/types/venue";

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: "test",
    name: "Test Venue",
    category: "pantry",
    lat: 38.25,
    lng: -104.6,
    address: "1 Main St, Pueblo, CO 81003",
    source: "test",
    last_verified: "2026-05-14",
    ...overrides,
  };
}

describe("getDisplayNotes — Plentiful boilerplate suppression (real data examples)", () => {
  // published-venues.ts:1364-1374 — "plentiful-center-toward-self-reliance-1c29edf8"
  test("suppresses boilerplate with a phone suffix (Center Toward Self-Reliance)", () => {
    const venue = makeVenue({
      name: "Center Toward Self-Reliance",
      phone: "(719) 546-1271",
      notes: "Center Toward Self-Reliance. in Pueblo, CO. Phone: (719) 546-1271.",
    });
    expect(getDisplayNotes(venue)).toBeUndefined();
  });

  // published-venues.ts:1352-1362 — "plentiful-care-and-share-..."
  test("suppresses boilerplate with the 'Hours and directions available' filler suffix", () => {
    const venue = makeVenue({
      name: "Care and Share Food Bank for Southern Colorado - Main Location",
      notes:
        "Care and Share Food Bank for Southern Colorado - Main Location. in Pueblo, CO. Hours and directions available.",
    });
    expect(getDisplayNotes(venue)).toBeUndefined();
  });

  // published-venues.ts:1383-1385 — "plentiful-colorado-division-of-housing-..."
  test("suppresses boilerplate with no suffix at all (bare 'Name. in Pueblo, CO.')", () => {
    const venue = makeVenue({
      name: "Colorado Division Of Housing - Food Distribution Center",
      notes: "Colorado Division Of Housing - Food Distribution Center. in Pueblo, CO.",
    });
    expect(getDisplayNotes(venue)).toBeUndefined();
  });

  // published-venues.ts:22 — a real garden venue note, genuinely informative
  test("keeps a genuinely informative note (garden partner/program info)", () => {
    const venue = makeVenue({
      category: "garden",
      name: "Bethany Lutheran Church Garden",
      notes:
        "Open to public. Produce donated to food pantries. Partner: Pueblo County Extension Master Gardener Program.",
    });
    expect(getDisplayNotes(venue)).toBe(
      "Open to public. Produce donated to food pantries. Partner: Pueblo County Extension Master Gardener Program.",
    );
  });

  // published-venues.ts:1264 — real convenience-store note (already covered by
  // osm-guard.test.tsx as the "clean notes" case; pinned here too since it's
  // the exact kind of short, name-independent note the conservative match
  // must never touch).
  test("keeps a short, genuinely informative note unrelated to the venue's own name", () => {
    const venue = makeVenue({ category: "convenience", notes: "surcharge for using cards" });
    expect(getDisplayNotes(venue)).toBe("surcharge for using cards");
  });

  test("suppresses OSM raw-tag artifacts (pre-existing #98 guard, unchanged)", () => {
    const venue = makeVenue({ notes: "Hours (OSM opening_hours): Mo-Su 08:00-17:00" });
    expect(getDisplayNotes(venue)).toBeUndefined();
  });

  test("returns undefined when notes is absent", () => {
    const venue = makeVenue({ notes: undefined });
    expect(getDisplayNotes(venue)).toBeUndefined();
  });

  test("conservative: a note starting with the venue name but NOT matching the exact boilerplate suffix still renders", () => {
    // Proves the match is a strict suffix check, not a loose "starts with
    // name" heuristic — spec: "when in doubt, show the note."
    const venue = makeVenue({
      name: "Example Pantry",
      notes: "Example Pantry. in Pueblo, CO. Open Tuesdays only, bring your own bags.",
    });
    expect(getDisplayNotes(venue)).toBe(
      "Example Pantry. in Pueblo, CO. Open Tuesdays only, bring your own bags.",
    );
  });

  test("phone-suffix boilerplate only suppresses when the phone in the note matches venue.phone", () => {
    // Defensive: if the scraper's phone digit ever drifted from the stored
    // field, suppressing would silently hide a real discrepancy.
    const venue = makeVenue({
      name: "Example Pantry",
      phone: "(719) 000-0000",
      notes: "Example Pantry. in Pueblo, CO. Phone: (719) 999-9999.",
    });
    expect(getDisplayNotes(venue)).toBe("Example Pantry. in Pueblo, CO. Phone: (719) 999-9999.");
  });
});
