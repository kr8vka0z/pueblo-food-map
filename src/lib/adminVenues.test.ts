/**
 * adminVenues.test.ts (#253; #673 "one status per place" rework) — unit
 * tests for the read-only admin venue list's pure helpers: status labels,
 * displayStatusOf (the single-status rule), the publish-change summary, the
 * "Waiting to publish" field diff + attribution, and the last-verified date
 * formatter.
 *
 * `@/data/published-venues` is mocked to a small fixture rather than the
 * real ~2000-line generated snapshot — these tests need full control over
 * what "the public map is currently serving" holds, and pinning behavior to
 * the real file's contents would make every future publish a silent test
 * hazard.
 */

import { describe, test, expect, vi } from "vitest";
import {
  STATUS_LABELS,
  DISPLAY_STATUS_LABELS,
  DISPLAY_STATUS_KEY,
  displayStatusOf,
  formatLastVerified,
  summarizePublishChanges,
  diffPublishedFields,
  attributeFieldChange,
} from "@/lib/adminVenues";
import type { AdminVenueRow } from "@/types/venue";
import type { Venue } from "@/types/venue";

// The fixture matching makeRow()'s default fields, mapped exactly the way
// validateAndMapRow (publishVenues.ts) would — see venueSignature's own
// comment in adminVenues.ts for why both sides must agree bit-for-bit.
const PUBLISHED_VENUE_A: Venue = {
  id: "venue-a",
  name: "Venue A",
  category: "pantry",
  lat: 38.25,
  lng: -104.6,
  address: "123 Test St",
  source: "test",
  last_verified: "2026-01-01",
};

vi.mock("@/data/published-venues", () => ({
  publishedVenues: [
    {
      id: "venue-a",
      name: "Venue A",
      category: "pantry",
      lat: 38.25,
      lng: -104.6,
      address: "123 Test St",
      source: "test",
      last_verified: "2026-01-01",
    },
  ],
}));

function makeRow(overrides: Partial<AdminVenueRow> = {}): AdminVenueRow {
  return {
    id: "venue-a",
    name: "Venue A",
    category: "pantry",
    lat: 38.25,
    lng: -104.6,
    address: "123 Test St",
    hours_weekly: null,
    hours_irregular: null,
    accepts_snap: null,
    accepts_wic: null,
    phone: null,
    email: null,
    url: null,
    notes: null,
    operator: null,
    source: "test",
    last_verified: "2026-01-01",
    status: "published",
    source_type: "manual",
    outside_county: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    created_by: "admin@pueblofoodmap.com",
    updated_at: "2026-01-01T00:00:00.000Z",
    updated_by: "admin@pueblofoodmap.com",
    published_at: "2026-01-01T00:00:00.000Z",
    published_by: "admin@pueblofoodmap.com",
    ...overrides,
  };
}

describe("STATUS_LABELS", () => {
  test("maps every admin status to its human label", () => {
    expect(STATUS_LABELS.published).toBe("Live");
    expect(STATUS_LABELS.draft).toBe("Draft");
    expect(STATUS_LABELS.archived).toBe("Removed");
  });
});

describe("DISPLAY_STATUS_LABELS / DISPLAY_STATUS_KEY", () => {
  test("maps every AdminDisplayStatus to its human label", () => {
    expect(DISPLAY_STATUS_LABELS.draft).toBe("Draft");
    expect(DISPLAY_STATUS_LABELS.live).toBe("Live");
    expect(DISPLAY_STATUS_LABELS.live_edits_waiting).toBe("Live · edits waiting");
    expect(DISPLAY_STATUS_LABELS.removed).toBe("Removed");
  });

  test("the status key has one entry per status, in the same order the labels are listed in", () => {
    expect(DISPLAY_STATUS_KEY.map((k) => k.status)).toEqual(["draft", "live", "live_edits_waiting", "removed"]);
    expect(DISPLAY_STATUS_KEY.every((k) => k.description.length > 0)).toBe(true);
  });
});

describe("displayStatusOf", () => {
  test("draft -> 'draft', regardless of published_at", () => {
    expect(displayStatusOf(makeRow({ status: "draft", published_at: null }), undefined)).toBe("draft");
  });

  test("archived -> 'removed'", () => {
    expect(displayStatusOf(makeRow({ status: "archived" }), PUBLISHED_VENUE_A)).toBe("removed");
  });

  test("a blessing_box is always 'live', even with status: 'draft' (boxes are live without publishing)", () => {
    expect(displayStatusOf(makeRow({ status: "draft", category: "blessing_box" }), undefined)).toBe("live");
  });

  test("published, identical to what's live -> 'live'", () => {
    expect(displayStatusOf(makeRow({ status: "published" }), PUBLISHED_VENUE_A)).toBe("live");
  });

  test("published, a real field differs from what's live -> 'live_edits_waiting'", () => {
    const row = makeRow({ status: "published", name: "Venue A (renamed)" });
    expect(displayStatusOf(row, PUBLISHED_VENUE_A)).toBe("live_edits_waiting");
  });

  // #673 pt.4 — a "last checked" bump alone must never flag a place.
  test("published, only last_verified differs -> stays 'live'", () => {
    const row = makeRow({ status: "published", last_verified: "2026-08-01" });
    expect(displayStatusOf(row, PUBLISHED_VENUE_A)).toBe("live");
  });

  test("published with no matching published-snapshot entry -> 'live_edits_waiting' (can't confirm parity)", () => {
    const row = makeRow({ id: "no-such-id", status: "published" });
    expect(displayStatusOf(row, undefined)).toBe("live_edits_waiting");
  });

  // #673 pt.6 — staging can never Publish, so "edits waiting" there is
  // always a false alarm.
  test("on staging, a published row with real differences still reads 'live', never 'live_edits_waiting'", () => {
    const row = makeRow({ status: "published", name: "Venue A (renamed)" });
    expect(displayStatusOf(row, PUBLISHED_VENUE_A, { isStaging: true })).toBe("live");
  });
});

describe("summarizePublishChanges", () => {
  test("all-zero case: nothing to publish", () => {
    const rows = [makeRow({ status: "published" })];
    expect(summarizePublishChanges(rows)).toEqual({ newDrafts: 0, editedSincePublish: 0, archived: 0 });
  });

  test("newDrafts counts every draft row, regardless of published_at", () => {
    const rows = [
      makeRow({ id: "a", status: "draft", published_at: null }),
      makeRow({ id: "b", status: "draft", published_at: null }),
      makeRow({ id: "venue-a", status: "published" }),
    ];
    expect(summarizePublishChanges(rows)).toEqual({ newDrafts: 2, editedSincePublish: 0, archived: 0 });
  });

  test("editedSincePublish counts a published row whose content differs from what's live", () => {
    const rows = [makeRow({ status: "published", name: "Venue A (renamed)" })];
    expect(summarizePublishChanges(rows)).toEqual({ newDrafts: 0, editedSincePublish: 1, archived: 0 });
  });

  // #673 pt.4 regression: the OLD rule (updated_at > published_at) counted
  // this as "edited" even though nothing a visitor would see actually
  // changed — the exact false alarm #673 was filed over.
  test("editedSincePublish does NOT count a published row whose only difference is last_verified", () => {
    const rows = [
      makeRow({
        status: "published",
        last_verified: "2026-08-01",
        updated_at: "2026-08-01T00:00:00.000Z", // bumped well after published_at
      }),
    ];
    expect(summarizePublishChanges(rows)).toEqual({ newDrafts: 0, editedSincePublish: 0, archived: 0 });
  });

  test("editedSincePublish does not count a published row identical to what's live", () => {
    const rows = [makeRow({ status: "published" })];
    expect(summarizePublishChanges(rows)).toEqual({ newDrafts: 0, editedSincePublish: 0, archived: 0 });
  });

  // Item 1 fix: "archived" only means "pending removal on the next
  // publish" when the archive happened AFTER the last publish
  // (updated_at > published_at) — see summarizePublishChanges' own header.
  test("archived counts a PREVIOUSLY-PUBLISHED venue archived AFTER its last publish (pending removal)", () => {
    const rows = [
      makeRow({
        status: "archived",
        published_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-02-01T00:00:00.000Z", // archived (updated) after the publish
      }),
    ];
    expect(summarizePublishChanges(rows)).toEqual({ newDrafts: 0, editedSincePublish: 0, archived: 1 });
  });

  // Regression for the reported bug: prod's 5 archived venues kept inflating
  // this count FOREVER because nothing ever advanced published_at past the
  // row's original publish date. Once a publish re-stamps published_at (the
  // publishVenues.ts half of this fix), the SAME row must read "already
  // removed" (archived: 0), not "still pending."
  test("archived does NOT count an archived row whose published_at already reflects the removal", () => {
    const rows = [
      makeRow({
        status: "archived",
        published_at: "2026-02-01T00:00:00.000Z", // re-stamped by the publish that removed it
        updated_at: "2026-01-01T00:00:00.000Z", // the archive action itself, before that publish
      }),
    ];
    expect(summarizePublishChanges(rows)).toEqual({ newDrafts: 0, editedSincePublish: 0, archived: 0 });
  });

  test("archived does NOT count a draft that was archived without ever being published", () => {
    // published_at is null -> this venue was never live, so archiving it
    // changes nothing the public map would show; it must not inflate the
    // "will be removed" count.
    const rows = [makeRow({ status: "archived", published_at: null })];
    expect(summarizePublishChanges(rows)).toEqual({ newDrafts: 0, editedSincePublish: 0, archived: 0 });
  });

  test("sums each count independently across a mixed set of rows", () => {
    const rows = [
      makeRow({ id: "a", status: "draft", published_at: null }),
      makeRow({ id: "b", status: "draft", published_at: null }),
      makeRow({ id: "venue-a", status: "published", name: "Venue A (renamed)" }), // real diff -> edits waiting
      makeRow({ id: "venue-a", status: "published" }), // identical to what's live -> live
      makeRow({
        id: "e",
        status: "archived",
        published_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-02-01T00:00:00.000Z", // archived after its last publish -> pending removal
      }),
      makeRow({ id: "f", status: "archived", published_at: null }),
    ];
    expect(summarizePublishChanges(rows)).toEqual({ newDrafts: 2, editedSincePublish: 1, archived: 1 });
  });
});

describe("diffPublishedFields", () => {
  test("returns [] when the row matches what's live", () => {
    expect(diffPublishedFields(makeRow({ status: "published" }), PUBLISHED_VENUE_A)).toEqual([]);
  });

  test("returns [] when the only difference is last_verified (#673 pt.4)", () => {
    const row = makeRow({ status: "published", last_verified: "2026-08-01" });
    expect(diffPublishedFields(row, PUBLISHED_VENUE_A)).toEqual([]);
  });

  test("reports one entry per differing field, with a readable before/after", () => {
    const row = makeRow({ status: "published", name: "Venue A (renamed)", phone: "555-1234" });
    const diffs = diffPublishedFields(row, PUBLISHED_VENUE_A);
    expect(diffs).toEqual(
      expect.arrayContaining([
        { field: "name", label: "Name", onMapNow: "Venue A", afterPublish: "Venue A (renamed)" },
        { field: "phone", label: "Phone", onMapNow: "(not set)", afterPublish: "555-1234" },
      ]),
    );
  });

  test("formats a SNAP/WIC boolean field as Yes/No, not 1/0", () => {
    const row = makeRow({ status: "published", accepts_snap: 1 });
    const diffs = diffPublishedFields(row, PUBLISHED_VENUE_A);
    expect(diffs.find((d) => d.field === "accepts_snap")).toMatchObject({ onMapNow: "No", afterPublish: "Yes" });
  });
});

describe("attributeFieldChange", () => {
  const auditEntryChangingName = {
    actor_email: "admin@pueblofoodmap.com",
    before_json: JSON.stringify({ name: "Venue A" }),
    after_json: JSON.stringify({ name: "Venue A (renamed)" }),
    timestamp: "2026-03-01T00:00:00.000Z",
  };

  test("names the viewer 'You' when they made the change", () => {
    const who = attributeFieldChange(
      "name",
      [auditEntryChangingName],
      [],
      "admin@pueblofoodmap.com",
      "admin@pueblofoodmap.com",
    );
    expect(who).toBe("You");
  });

  test("names another admin by email", () => {
    const who = attributeFieldChange("name", [auditEntryChangingName], [], "someone-else@pueblofoodmap.com", "admin@pueblofoodmap.com");
    expect(who).toBe("admin@pueblofoodmap.com");
  });

  test("labels the refresh pipeline's own auto-apply actor 'Automatic data refresh'", () => {
    const entry = { ...auditEntryChangingName, actor_email: "refresh-pipeline" };
    const who = attributeFieldChange("name", [entry], [], "admin@pueblofoodmap.com", "refresh-pipeline");
    expect(who).toBe("Automatic data refresh");
  });

  test("labels an admin's proposal approval 'Approved from Data refresh by <email>' when the applied_at matches", () => {
    const who = attributeFieldChange(
      "name",
      [auditEntryChangingName],
      [{ actor_email: "admin@pueblofoodmap.com", applied_at: "2026-03-01T00:00:00.000Z" }],
      "someone-else@pueblofoodmap.com",
      "admin@pueblofoodmap.com",
    );
    expect(who).toBe("Approved from Data refresh by admin@pueblofoodmap.com");
  });

  test("does not label a plain hand-edit as an approval when applied_at doesn't match", () => {
    const who = attributeFieldChange(
      "name",
      [auditEntryChangingName],
      [{ actor_email: "admin@pueblofoodmap.com", applied_at: "2026-01-01T00:00:00.000Z" }],
      "someone-else@pueblofoodmap.com",
      "admin@pueblofoodmap.com",
    );
    expect(who).toBe("admin@pueblofoodmap.com");
  });

  test("falls back to the venue row's own updated_by when no audit entry shows this field changing", () => {
    const entryChangingOtherField = { ...auditEntryChangingName, before_json: JSON.stringify({ phone: "1" }), after_json: JSON.stringify({ phone: "2" }) };
    const who = attributeFieldChange("name", [entryChangingOtherField], [], "admin@pueblofoodmap.com", "fallback@pueblofoodmap.com");
    expect(who).toBe("fallback@pueblofoodmap.com");
  });
});

describe("formatLastVerified", () => {
  test("formats a date-only ISO string readably", () => {
    expect(formatLastVerified("2026-01-01")).toBe("Jan 1, 2026");
  });

  test("does not roll the date back a day on a negative-UTC-offset host", () => {
    // Regression guard: new Date("YYYY-MM-DD") parses as UTC midnight.
    // Formatting in the host's LOCAL timezone instead of UTC would print
    // Jul 3 on any host west of UTC. formatLastVerified must pin UTC.
    expect(formatLastVerified("2026-07-04")).toBe("Jul 4, 2026");
  });

  test("falls back to the raw string for an unparsable date", () => {
    expect(formatLastVerified("not-a-date")).toBe("not-a-date");
  });
});
