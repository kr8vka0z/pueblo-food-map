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

  test("archived counts a PREVIOUSLY-PUBLISHED venue that was then archived (will be removed)", () => {
    const rows = [makeRow({ status: "archived", published_at: "2026-01-01T00:00:00.000Z" })];
    expect(summarizePublishChanges(rows)).toEqual({ newDrafts: 0, editedSincePublish: 0, archived: 1 });
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
      makeRow({ id: "e", status: "archived", published_at: "2026-01-01T00:00:00.000Z" }),
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
