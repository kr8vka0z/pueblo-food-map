// @vitest-environment node
/**
 * nextIrregularOccurrence with more than one slot on the day (#400, CI
 * reviewer finding): between two same-day slots the "Next:" line must be
 * today's later slot, agreeing with computeIrregularOpenStatus's badge —
 * not next month.
 */
import { describe, test, expect } from "vitest";
import { computeIrregularOpenStatus, nextIrregularOccurrence } from "@/lib/hours";
import type { IrregularSchedule } from "@/types/venue";

// 2026-10-27 is the 4th Tuesday; Denver is on MDT (UTC-6) that day.
const at = (hour: number, minute = 0) => new Date(Date.UTC(2026, 9, 27, hour + 6, minute));

const twoSlots: IrregularSchedule = {
  recurrence: "monthly_ordinal",
  ordinal: 4,
  weekday: "tue",
  slots: ["14:00-15:00", "11:00-12:00"],
};

describe("nextIrregularOccurrence — multi-slot day", () => {
  test("between the two slots, next is today's later slot", () => {
    const now = at(13);
    expect(computeIrregularOpenStatus([twoSlots], now)).toEqual({ state: "opens_at", time: "2pm" });
    expect(nextIrregularOccurrence([twoSlots], now)).toMatchObject({ year: 2026, month: 10, day: 27, slot: "14:00-15:00" });
  });

  test("before both slots, next is today's earliest slot", () => {
    expect(nextIrregularOccurrence([twoSlots], at(9))).toMatchObject({ day: 27, slot: "11:00-12:00" });
  });

  test("after both slots, next rolls to next month's earliest slot", () => {
    // 4th Tuesday of November 2026 is the 24th.
    expect(nextIrregularOccurrence([twoSlots], at(16))).toMatchObject({ month: 11, day: 24, slot: "11:00-12:00" });
  });
});
