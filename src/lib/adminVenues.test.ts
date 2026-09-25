/**
 * adminVenues.test.ts (#253) — unit tests for the read-only admin venue
 * list's pure helpers: status labels, the unpublished-changes predicate,
 * and the last-verified date formatter.
 */

import { describe, test, expect } from "vitest";
import {
  STATUS_LABELS,
  hasUnpublishedChanges,
  formatLastVerified,
  summarizePublishChanges,
} from "@/lib/adminVenues";
import type { AdminVenueRow } from "@/types/venue";

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

describe("hasUnpublishedChanges", () => {
  test("true for a draft row, even with published_at null", () => {
    expect(hasUnpublishedChanges(makeRow({ status: "draft", published_at: null }))).toBe(true);
  });

  test("true for a published row edited after its last publish", () => {
    const row = makeRow({
      status: "published",
      published_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-02-01T00:00:00.000Z",
    });
    expect(hasUnpublishedChanges(row)).toBe(true);
  });

  test("false for a published row unedited since its last publish", () => {
    const row = makeRow({
      status: "published",
      published_at: "2026-02-01T00:00:00.000Z",
      updated_at: "2026-02-01T00:00:00.000Z",
    });
    expect(hasUnpublishedChanges(row)).toBe(false);
  });

  test("false for a published row last updated BEFORE its last publish", () => {
    const row = makeRow({
      status: "published",
      published_at: "2026-02-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    expect(hasUnpublishedChanges(row)).toBe(false);
  });
});

describe("summarizePublishChanges", () => {
  test("all-zero case: nothing to publish", () => {
    const rows = [makeRow({ status: "published", published_at: "2026-02-01T00:00:00.000Z", updated_at: "2026-02-01T00:00:00.000Z" })];
    expect(summarizePublishChanges(rows)).toEqual({ newDrafts: 0, editedSincePublish: 0, archived: 0 });
  });

  test("newDrafts counts every draft row, regardless of published_at", () => {
    const rows = [
      makeRow({ id: "a", status: "draft", published_at: null }),
      makeRow({ id: "b", status: "draft", published_at: null }),
      makeRow({ id: "c", status: "published" }),
    ];
    expect(summarizePublishChanges(rows)).toEqual({ newDrafts: 2, editedSincePublish: 0, archived: 0 });
  });

  test("editedSincePublish counts a published row edited after its last publish", () => {
    const rows = [
      makeRow({
        status: "published",
        published_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-02-01T00:00:00.000Z",
      }),
    ];
    expect(summarizePublishChanges(rows)).toEqual({ newDrafts: 0, editedSincePublish: 1, archived: 0 });
  });

  test("editedSincePublish does not count a published row unedited since its last publish", () => {
    const rows = [
      makeRow({
        status: "published",
        published_at: "2026-02-01T00:00:00.000Z",
        updated_at: "2026-02-01T00:00:00.000Z",
      }),
    ];
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
      makeRow({
        id: "c",
        status: "published",
        published_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-02-01T00:00:00.000Z",
      }),
      makeRow({
        id: "d",
        status: "published",
        published_at: "2026-02-01T00:00:00.000Z",
        updated_at: "2026-02-01T00:00:00.000Z",
      }),
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
