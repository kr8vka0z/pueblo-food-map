/**
 * mapVenueRowToFormValues()'s hours_irregular pre-fill (#400). New, scoped
 * file rather than an addition to adminVenueForm.test.ts — same convention
 * this repo already uses for a slice of behavior added to an existing
 * module (route.archivedGuard.test.ts, etc.).
 */

import { describe, test, expect } from "vitest";
import { mapVenueRowToFormValues } from "@/lib/adminVenueForm";
import type { AdminVenueRow } from "@/types/venue";

function makeRow(overrides: Partial<AdminVenueRow> = {}): AdminVenueRow {
  return {
    id: "manual-abc",
    name: "Lynn Gardens Baptist Church",
    category: "pantry",
    lat: 38.223992,
    lng: -104.656767,
    address: "3804 W. Pueblo Blvd, Pueblo, CO 81005",
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
    status: "draft",
    source_type: "manual",
    outside_county: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    created_by: "admin@pueblofoodmap.com",
    updated_at: "2026-01-01T00:00:00.000Z",
    updated_by: "admin@pueblofoodmap.com",
    published_at: null,
    published_by: null,
    ...overrides,
  };
}

describe("mapVenueRowToFormValues — hours_irregular", () => {
  test("null hours_irregular maps to an empty draft list", () => {
    const values = mapVenueRowToFormValues(makeRow());
    expect(values.hoursIrregular).toEqual([]);
  });

  test("malformed JSON degrades to an empty list, never throws", () => {
    const values = mapVenueRowToFormValues(makeRow({ hours_irregular: "{not json" }));
    expect(values.hoursIrregular).toEqual([]);
  });

  test("a monthly_ordinal entry maps to string-form select/input values", () => {
    const stored = JSON.stringify([
      { recurrence: "monthly_ordinal", ordinal: 4, weekday: "tue", slots: ["11:00-12:00"], note: "Enter via side door" },
    ]);
    const values = mapVenueRowToFormValues(makeRow({ hours_irregular: stored }));
    expect(values.hoursIrregular).toEqual([
      { recurrence: "monthly_ordinal", ordinal: "4", weekday: "tue", dayOfMonth: "", slots: "11:00-12:00", note: "Enter via side door" },
    ]);
  });

  test("a 'last' ordinal round-trips as the literal string 'last', not the number NaN", () => {
    const stored = JSON.stringify([
      { recurrence: "monthly_ordinal", ordinal: "last", weekday: "fri", slots: ["09:00-10:00"] },
    ]);
    const values = mapVenueRowToFormValues(makeRow({ hours_irregular: stored }));
    expect(values.hoursIrregular?.[0]?.ordinal).toBe("last");
  });

  test("a monthly_date entry maps day_of_month to a string", () => {
    const stored = JSON.stringify([{ recurrence: "monthly_date", day_of_month: 15, slots: ["10:00-11:00"] }]);
    const values = mapVenueRowToFormValues(makeRow({ hours_irregular: stored }));
    expect(values.hoursIrregular).toEqual([
      { recurrence: "monthly_date", ordinal: "", weekday: "", dayOfMonth: "15", slots: "10:00-11:00", note: "" },
    ]);
  });

  test("Lynn Gardens shape: weekly + two monthly_ordinal entries both map correctly", () => {
    const stored = JSON.stringify([
      { recurrence: "monthly_ordinal", ordinal: 2, weekday: "thu", slots: ["11:00 AM - 12:45 PM"] },
      { recurrence: "monthly_ordinal", ordinal: 4, weekday: "thu", slots: ["11:00 AM - 12:45 PM"] },
    ]);
    const values = mapVenueRowToFormValues(
      makeRow({ hours_weekly: JSON.stringify({ thu: ["11:00 AM - 12:45 PM"] }), hours_irregular: stored }),
    );
    expect(values.hours?.thu).toBe("11:00 AM - 12:45 PM");
    expect(values.hoursIrregular).toHaveLength(2);
    expect(values.hoursIrregular?.[0]?.ordinal).toBe("2");
    expect(values.hoursIrregular?.[1]?.ordinal).toBe("4");
  });

  test("'other' recurrence with no note defaults to an empty string, never undefined", () => {
    const stored = JSON.stringify([{ recurrence: "other", slots: [] }]);
    const values = mapVenueRowToFormValues(makeRow({ hours_irregular: stored }));
    expect(values.hoursIrregular?.[0]?.note).toBe("");
  });
});
