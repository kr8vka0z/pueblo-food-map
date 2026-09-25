// @vitest-environment node
/**
 * diffEngineIrregular.test.ts — hours_irregular (#400) in the refresh
 * pipeline's diff: a new/changed monthly schedule is proposed, a populated
 * one is never proposed cleared (scraper-hiccup guard), and key/entry
 * order alone never produces a noise proposal on a monthly re-scrape.
 */
import { describe, test, expect } from "vitest";
import type { IrregularSchedule, Venue } from "@/types/venue";
import { validateIrregularSchedule } from "@/lib/adminVenueValidation";
import { diffSource, currentFieldValue, SOURCE_OWNED_FIELDS, type CurrentVenueRow } from "./diffEngine";

const TODAY = "2026-09-24";
const RUN_ID = "run-irregular";
const ID = "plentiful-lynn-gardens-baptist-church-d9ee705e";

const FOURTH_TUE: IrregularSchedule = { recurrence: "monthly_ordinal", ordinal: 4, weekday: "tue", slots: ["11:00 AM - 12:00 PM"] };
const SECOND_THU: IrregularSchedule = { recurrence: "monthly_ordinal", ordinal: 2, weekday: "thu", slots: ["11:00 AM - 12:45 PM"] };

function row(overrides: Partial<CurrentVenueRow> = {}): CurrentVenueRow {
  return {
    id: ID,
    name: "Lynn Gardens Baptist Church",
    category: "pantry",
    lat: 38.223992,
    lng: -104.656767,
    address: "3804 W. Pueblo Blvd., Pueblo, CO 81005",
    hours_weekly: null,
    hours_irregular: null,
    phone: null,
    url: null,
    operator: null,
    last_verified: "2026-05-14",
    ...overrides,
  };
}

function venue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: ID,
    name: "Lynn Gardens Baptist Church",
    category: "pantry",
    lat: 38.223992,
    lng: -104.656767,
    address: "3804 W. Pueblo Blvd., Pueblo, CO 81005",
    source: "directory.plentiful.org/colorado/pueblo",
    last_verified: "2026-05-14",
    ...overrides,
  };
}

function diff(current: CurrentVenueRow, incoming: Venue) {
  return diffSource({ source: "plentiful", currentRows: [current], incoming: [incoming], runId: RUN_ID, today: TODAY });
}

describe("hours_irregular is a Plentiful source-owned field", () => {
  test("listed in SOURCE_OWNED_FIELDS.plentiful, not osm", () => {
    expect(SOURCE_OWNED_FIELDS.plentiful).toContain("hours_irregular");
    expect(SOURCE_OWNED_FIELDS.osm).not.toContain("hours_irregular");
  });

  test("a monthly schedule appearing for an existing venue is proposed as an update", () => {
    const result = diff(row(), venue({ hours_irregular: [FOURTH_TUE] }));
    expect(result.proposals).toHaveLength(1);
    const p = result.proposals[0];
    expect(p.proposedDiff.fields_changed).toEqual(["hours_irregular", "last_verified"]);
    expect(p.proposedDiff.before?.hours_irregular).toBe("");
    // Carried as D1's JSON-text form — adminProposals.toColumnValue() stores a string as-is.
    const after = JSON.parse(p.proposedDiff.after?.hours_irregular as unknown as string);
    expect(after).toEqual([{ ordinal: 4, recurrence: "monthly_ordinal", slots: ["11:00 AM - 12:00 PM"], weekday: "tue" }]);
  });

  test("a changed monthly schedule (4th Tuesday -> 2nd Thursday) is proposed", () => {
    const result = diff(row({ hours_irregular: JSON.stringify([FOURTH_TUE]) }), venue({ hours_irregular: [SECOND_THU] }));
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].proposedDiff.fields_changed).toEqual(["hours_irregular", "last_verified"]);
  });

  test("a changed time slot on the same monthly day is proposed", () => {
    const moved = { ...FOURTH_TUE, slots: ["1:00 PM - 2:00 PM"] };
    const result = diff(row({ hours_irregular: JSON.stringify([FOURTH_TUE]) }), venue({ hours_irregular: [moved] }));
    expect(result.proposals[0].proposedDiff.fields_changed).toEqual(["hours_irregular", "last_verified"]);
  });
});

describe("destructive-clear guard", () => {
  test("a populated schedule going missing from the scrape is NEVER proposed cleared", () => {
    const result = diff(row({ hours_irregular: JSON.stringify([FOURTH_TUE]) }), venue({ hours_irregular: undefined }));
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].proposedDiff.fields_changed).toEqual(["last_verified"]);
  });

  test("an empty incoming list is treated the same as missing — still no clear", () => {
    const result = diff(row({ hours_irregular: JSON.stringify([FOURTH_TUE]) }), venue({ hours_irregular: [] }));
    expect(result.proposals[0].proposedDiff.fields_changed).toEqual(["last_verified"]);
  });
});

describe("normalization — order-only differences are equal", () => {
  test("different key order, entry order and slot order produce no hours_irregular proposal", () => {
    // D1 text written by some other path with a different key order + entry order.
    const stored =
      '[{"weekday":"thu","slots":["11:00 AM - 12:45 PM"],"recurrence":"monthly_ordinal","ordinal":2},' +
      '{"slots":["3:00 PM - 4:00 PM","11:00 AM - 12:00 PM"],"ordinal":4,"weekday":"tue","recurrence":"monthly_ordinal"}]';
    const incoming: IrregularSchedule[] = [
      { ...FOURTH_TUE, slots: ["11:00 AM - 12:00 PM", "3:00 PM - 4:00 PM"] },
      SECOND_THU,
    ];
    const result = diff(row({ hours_irregular: stored }), venue({ hours_irregular: incoming }));
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0].proposedDiff.fields_changed).toEqual(["last_verified"]);
  });

  test("an empty-array D1 value and no incoming schedule are equal (no proposal)", () => {
    const result = diff(row({ hours_irregular: "[]" }), venue());
    expect(result.proposals[0].proposedDiff.fields_changed).toEqual(["last_verified"]);
  });

  test("the normalized value a proposal carries still passes publish's shape validation once approved", () => {
    const result = diff(row(), venue({ hours_irregular: [FOURTH_TUE, SECOND_THU] }));
    const stored = result.proposals[0].proposedDiff.after?.hours_irregular as unknown as string;
    const errors: Record<string, string> = {};
    expect(validateIrregularSchedule(JSON.parse(stored), errors)).not.toBeNull();
    expect(errors).toEqual({});
  });

  test("currentFieldValue is idempotent on its own output (stale-apply guard re-feeds a `before` snapshot)", () => {
    const once = currentFieldValue(row({ hours_irregular: JSON.stringify([SECOND_THU, FOURTH_TUE]) }), "hours_irregular");
    const twice = currentFieldValue({ hours_irregular: once } as unknown as CurrentVenueRow, "hours_irregular");
    expect(twice).toBe(once);
    expect(currentFieldValue({ hours_irregular: "" } as unknown as CurrentVenueRow, "hours_irregular")).toBe("");
  });
});
