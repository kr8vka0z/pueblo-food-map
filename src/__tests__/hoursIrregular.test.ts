/**
 * Unit tests for the irregular-schedule (monthly-ordinal etc.) logic added
 * to src/lib/hours.ts by #400: computeIrregularOpenStatus(),
 * computeVenueOpenStatus(), nextIrregularOccurrence(), and
 * formatIrregularOccurrence().
 *
 * A separate file from hours.test.ts (not an addition to it) — keeps this
 * new-behavior coverage clear of that existing test file's own write-guard
 * question on a feat/* branch (see RULES.md).
 *
 * Every calendar fact below (which Tuesdays fall in which 2026/2027 month,
 * the 2026-11-01 US DST fall-back date) was verified against Python's
 * `calendar` module before being hardcoded here — see this PR's own report
 * for the exact figures. Denver-time "now" instants are built via
 * denverInstant() with an EXPLICIT MDT/MST offset (never computed by a
 * second DST algorithm in this file), so a real bug in
 * getDenverDateTime()'s own DST handling can't hide behind a test helper
 * that makes the same mistake.
 */

import { describe, test, expect } from "vitest";
import {
  computeIrregularOpenStatus,
  computeVenueOpenStatus,
  nextIrregularOccurrence,
  formatIrregularOccurrence,
} from "@/lib/hours";
import type { IrregularSchedule } from "@/types/venue";

/**
 * Builds a UTC Date instant equal to a specific Denver wall-clock time.
 * `offsetHours` (6 = MDT/UTC-6, roughly mid-March-early Nov; 7 = MST/UTC-7,
 * the rest of the year) is always passed explicitly by the caller for the
 * real calendar date under test, never inferred here.
 */
function denverInstant(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  offsetHours: 6 | 7,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour + offsetHours, minute));
}

const fourthTuesday: IrregularSchedule = {
  recurrence: "monthly_ordinal",
  ordinal: 4,
  weekday: "tue",
  slots: ["11:00-12:00"],
};

const lastTuesday: IrregularSchedule = {
  recurrence: "monthly_ordinal",
  ordinal: "last",
  weekday: "tue",
  slots: ["11:00-12:00"],
};

const fifthTuesday: IrregularSchedule = {
  recurrence: "monthly_ordinal",
  ordinal: 5,
  weekday: "tue",
  slots: ["09:00-10:00"],
};

const firstMonday: IrregularSchedule = {
  recurrence: "monthly_ordinal",
  ordinal: 1,
  weekday: "mon",
  slots: ["09:00-10:00"],
};

const day31: IrregularSchedule = {
  recurrence: "monthly_date",
  day_of_month: 31,
  slots: ["10:00-11:00"],
};

const otherOnly: IrregularSchedule = {
  recurrence: "other",
  slots: [],
  note: "3rd weekend, call ahead",
};

// ─── computeIrregularOpenStatus ────────────────────────────────────────────

describe("computeIrregularOpenStatus", () => {
  test("open during the matching date's slot (Oct 27 2026 = 4th Tuesday, MDT)", () => {
    const now = denverInstant(2026, 10, 27, 11, 30, 6); // 11:30am Denver
    expect(computeIrregularOpenStatus([fourthTuesday], now)).toEqual({ state: "open", time: "12pm" });
  });

  test("opens_at later the same matching day", () => {
    const now = denverInstant(2026, 10, 27, 9, 0, 6); // 9am, before the 11am slot
    expect(computeIrregularOpenStatus([fourthTuesday], now)).toEqual({ state: "opens_at", time: "11am" });
  });

  test("closed_today (never no_hours) on a non-matching day", () => {
    const now = denverInstant(2026, 10, 6, 11, 30, 6); // Oct 6 2026 — a Tuesday, but not the 4th
    expect(computeIrregularOpenStatus([fourthTuesday], now)).toEqual({ state: "closed_today" });
  });

  test("closed_today after the matching day's slot has passed", () => {
    const now = denverInstant(2026, 10, 27, 14, 0, 6); // 2pm, after the 11-12 slot
    expect(computeIrregularOpenStatus([fourthTuesday], now)).toEqual({ state: "closed_today" });
  });

  test("null when there are no schedules at all", () => {
    expect(computeIrregularOpenStatus(undefined, new Date())).toBeNull();
    expect(computeIrregularOpenStatus([], new Date())).toBeNull();
  });

  test("a UTC instant whose UTC calendar date differs from the Denver date still resolves against the Denver date", () => {
    // 2026-10-28T03:00Z = 2026-10-27 21:00 MDT (UTC-6) — the UTC date is the
    // 28th, but Denver's is the 27th (the 4th Tuesday). A schedule slot late
    // that Denver evening must read as "opens later today" (Oct 27), not be
    // silently skipped because the UTC calendar already flipped to the 28th.
    const now = new Date("2026-10-28T03:00:00.000Z");
    expect(computeIrregularOpenStatus([{ ...fourthTuesday, slots: ["22:00-23:00"] }], now)).toEqual({
      state: "opens_at",
      time: "10pm",
    });
  });
});

// ─── computeVenueOpenStatus (weekly + irregular combined) ──────────────────

describe("computeVenueOpenStatus", () => {
  test("no_hours only when neither weekly nor irregular data exists", () => {
    expect(computeVenueOpenStatus({}, new Date())).toEqual({ state: "no_hours" });
  });

  test("an irregular-only venue is NEVER no_hours, even on a non-matching day (#400 acceptance)", () => {
    const now = denverInstant(2026, 10, 6, 11, 30, 6); // not the 4th Tuesday
    expect(computeVenueOpenStatus({ hours_irregular: [fourthTuesday] }, now)).toEqual({ state: "closed_today" });
  });

  test("irregular-only venue reads open during its actual matching slot", () => {
    const now = denverInstant(2026, 10, 27, 11, 30, 6);
    expect(computeVenueOpenStatus({ hours_irregular: [fourthTuesday] }, now)).toEqual({ state: "open", time: "12pm" });
  });

  test("weekly open takes priority when both are present", () => {
    const now = denverInstant(2026, 10, 27, 11, 30, 6);
    expect(
      computeVenueOpenStatus(
        { hours_weekly: { tue: ["09:00-17:00"] }, hours_irregular: [fourthTuesday] },
        now,
      ),
    ).toEqual({ state: "open", time: "5pm" });
  });

  test("Lynn Gardens shape: weekly closed today, irregular open today -> open via irregular", () => {
    const now = denverInstant(2026, 10, 27, 11, 30, 6);
    expect(
      computeVenueOpenStatus(
        { hours_weekly: { mon: ["09:00-17:00"] }, hours_irregular: [fourthTuesday] }, // no Tuesday in weekly
        now,
      ),
    ).toEqual({ state: "open", time: "12pm" });
  });
});

// ─── nextIrregularOccurrence ────────────────────────────────────────────────

describe("nextIrregularOccurrence", () => {
  test("4th Tuesday in a 5-Tuesday month is NOT the same as 'last' (June 2026: 4th=23rd, last=30th)", () => {
    const now = denverInstant(2026, 6, 1, 0, 0, 6);
    expect(nextIrregularOccurrence([fourthTuesday], now)).toMatchObject({ year: 2026, month: 6, day: 23 });
    expect(nextIrregularOccurrence([lastTuesday], now)).toMatchObject({ year: 2026, month: 6, day: 30 });
  });

  test("'last' Tuesday equals the 4th in a 4-Tuesday month (Oct 2026: both the 27th)", () => {
    const now = denverInstant(2026, 10, 1, 0, 0, 6);
    expect(nextIrregularOccurrence([lastTuesday], now)).toMatchObject({ year: 2026, month: 10, day: 27 });
  });

  test("5th-ordinal month gap: from July 2026 (no 5th Tuesday), skips August too, lands September 29", () => {
    const now = denverInstant(2026, 7, 1, 0, 0, 6);
    expect(nextIrregularOccurrence([fifthTuesday], now)).toMatchObject({ year: 2026, month: 9, day: 29 });
  });

  test("Dec -> Jan year rollover: from Dec 29 2026 (past Dec's 1st Monday), next is Jan 4 2027", () => {
    const now = denverInstant(2026, 12, 29, 0, 0, 7);
    expect(nextIrregularOccurrence([firstMonday], now)).toMatchObject({ year: 2027, month: 1, day: 4 });
  });

  test("today's slot already started/passed rolls to next month, not today", () => {
    const now = denverInstant(2026, 10, 27, 14, 0, 6); // 2pm, after the 11-12 slot
    expect(nextIrregularOccurrence([fourthTuesday], now)).toMatchObject({ year: 2026, month: 11, day: 24 });
  });

  test("today's slot not yet started still counts as the next occurrence (today)", () => {
    const now = denverInstant(2026, 10, 27, 9, 0, 6);
    expect(nextIrregularOccurrence([fourthTuesday], now)).toMatchObject({ year: 2026, month: 10, day: 27 });
  });

  test("monthly_date day 31 in a 30-day month (April) skips to the next month that has a 31st (May)", () => {
    const now = denverInstant(2026, 4, 1, 0, 0, 6);
    expect(nextIrregularOccurrence([day31], now)).toMatchObject({ year: 2026, month: 5, day: 31 });
  });

  test("a UTC instant whose UTC date differs from the Denver date resolves 'today' correctly, not one day off", () => {
    const now = new Date("2026-10-28T03:00:00.000Z"); // Denver: Oct 27, 9pm MDT
    expect(nextIrregularOccurrence([{ ...fourthTuesday, slots: ["22:00-23:00"] }], now)).toMatchObject({
      year: 2026,
      month: 10,
      day: 27, // NOT the 28th — proves the Denver date, not the UTC date, drives the calculation
    });
  });

  test("straddles the 2026-11-01 US DST fall-back and still resolves the same Denver calendar date on both sides", () => {
    const firstSunday: IrregularSchedule = {
      recurrence: "monthly_ordinal",
      ordinal: 1,
      weekday: "sun",
      slots: ["00:30-01:00"],
    };
    // Pre-fallback: Denver 00:15 MDT (offset 6) on Nov 1 2026 (a Sunday) —
    // before the slot starts.
    const beforeFallback = denverInstant(2026, 11, 1, 0, 15, 6);
    expect(nextIrregularOccurrence([firstSunday], beforeFallback)).toMatchObject({
      year: 2026,
      month: 11,
      day: 1,
    });
    // Post-fallback: Denver 01:15 MST (offset 7) — clocks already fell back,
    // same calendar date (Nov 1), but the slot has now passed -> rolls to
    // December's 1st Sunday (Dec 6 2026).
    const afterFallback = denverInstant(2026, 11, 1, 1, 15, 7);
    expect(nextIrregularOccurrence([firstSunday], afterFallback)).toMatchObject({
      year: 2026,
      month: 12,
      day: 6,
    });
  });

  test("'other'-only schedules have no computable date", () => {
    expect(nextIrregularOccurrence([otherOnly], new Date())).toBeNull();
  });

  test("null for no schedules", () => {
    expect(nextIrregularOccurrence(undefined, new Date())).toBeNull();
    expect(nextIrregularOccurrence([], new Date())).toBeNull();
  });

  test("picks the earliest across multiple schedules", () => {
    const now = denverInstant(2026, 10, 1, 0, 0, 6);
    // firstMonday's Oct occurrence (Oct 5) is earlier than fourthTuesday's (Oct 27)
    expect(nextIrregularOccurrence([fourthTuesday, firstMonday], now)).toMatchObject({
      year: 2026,
      month: 10,
      day: 5,
    });
  });
});

// ─── formatIrregularOccurrence ──────────────────────────────────────────────

describe("formatIrregularOccurrence", () => {
  test("formats as 'Tue, Oct 27, 11am' in English", () => {
    const occurrence = nextIrregularOccurrence([fourthTuesday], denverInstant(2026, 10, 1, 0, 0, 6));
    expect(occurrence).not.toBeNull();
    expect(formatIrregularOccurrence(occurrence!, "en")).toBe("Tue, Oct 27, 11am");
  });

  test("localizes the weekday/month in Spanish", () => {
    const occurrence = nextIrregularOccurrence([fourthTuesday], denverInstant(2026, 10, 1, 0, 0, 6));
    expect(occurrence).not.toBeNull();
    const label = formatIrregularOccurrence(occurrence!, "es");
    expect(label).toContain("oct");
    expect(label).toContain("11am"); // time stays English am/pm, matching formatSlot's existing convention
  });
});
