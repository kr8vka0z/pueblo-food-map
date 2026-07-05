/**
 * Unit tests for computeOpenStatus(), formatSlot(), and slotToIsoTimes() in
 * src/lib/hours.ts.
 *
 * Uses the injectable `now: Date` parameter throughout — no real-clock calls.
 * Covers: 24h slots, 12h AM/PM slots, reversed multi-slot ordering,
 * currently-open, closed_today, no_hours, noon/midnight boundaries, a
 * real pantry shape from pantries-plentiful.ts, formatSlot display
 * formatting for both 24h and 12h slot strings, and slotToIsoTimes's
 * ISO-8601 ("HH:MM") conversion for JSON-LD (venueSchema.ts).
 */

import { describe, test, expect } from "vitest";
import { computeOpenStatus, formatSlot, slotToIsoTimes } from "@/lib/hours";
import type { WeeklyHours } from "@/types/venue";

/** Helper: create a Date at a given local clock time on a Monday */
function monAt(hour: number, minute = 0): Date {
  // 2026-06-15 is a Monday
  const d = new Date(2026, 5, 15, hour, minute, 0, 0);
  return d;
}

// ─── no_hours / closed_today ──────────────────────────────────────────────────

describe("no_hours", () => {
  test("returns no_hours when hours is undefined", () => {
    expect(computeOpenStatus(undefined, monAt(10))).toEqual({ state: "no_hours" });
  });

  test("returns no_hours when no day has any slots", () => {
    const hours: WeeklyHours = {};
    expect(computeOpenStatus(hours, monAt(10))).toEqual({ state: "no_hours" });
  });
});

describe("closed_today", () => {
  test("returns closed_today when today has no slots but other days do", () => {
    // Monday is empty; Tuesday has hours
    const hours: WeeklyHours = { tue: ["09:00-17:00"] };
    expect(computeOpenStatus(hours, monAt(10))).toEqual({ state: "closed_today" });
  });
});

// ─── 24-hour slot parsing ─────────────────────────────────────────────────────

describe("24-hour slots", () => {
  const hours: WeeklyHours = { mon: ["09:00-17:00"] };

  test("open during 24h slot", () => {
    const result = computeOpenStatus(hours, monAt(12));
    expect(result.state).toBe("open");
    if (result.state === "open") expect(result.time).toBe("5pm");
  });

  test("opens_at before 24h slot starts", () => {
    const result = computeOpenStatus(hours, monAt(8, 30));
    expect(result.state).toBe("opens_at");
    if (result.state === "opens_at") expect(result.time).toBe("9am");
  });

  test("closed_today after 24h slot ends", () => {
    expect(computeOpenStatus(hours, monAt(18))).toEqual({ state: "closed_today" });
  });

  test("closed at exact end boundary (half-open interval)", () => {
    // 17:00 = 1020 minutes — the interval is [open, close), so exactly at close = closed
    expect(computeOpenStatus(hours, monAt(17))).toEqual({ state: "closed_today" });
  });

  test("open at exact open boundary", () => {
    const result = computeOpenStatus(hours, monAt(9, 0));
    expect(result.state).toBe("open");
  });
});

// ─── 12-hour AM/PM slot parsing ───────────────────────────────────────────────

describe("12-hour AM/PM slots (Plentiful format)", () => {
  // Plentiful format: "H:MM AM - H:MM PM" (spaces around dash, spaces around AM/PM)
  const hours: WeeklyHours = { mon: ["10:30 AM - 12:00 PM"] };

  test("open during 12h slot", () => {
    const result = computeOpenStatus(hours, monAt(11, 0));
    expect(result.state).toBe("open");
    if (result.state === "open") expect(result.time).toBe("12pm");
  });

  test("opens_at before 12h slot starts", () => {
    const result = computeOpenStatus(hours, monAt(9, 0));
    expect(result.state).toBe("opens_at");
    if (result.state === "opens_at") expect(result.time).toBe("10:30am");
  });

  test("closed_today after 12h slot ends", () => {
    // After 12:00 PM (noon = 720 min)
    expect(computeOpenStatus(hours, monAt(13))).toEqual({ state: "closed_today" });
  });

  test("PM hours: 1:00 PM - 5:00 PM", () => {
    const h: WeeklyHours = { mon: ["1:00 PM - 5:00 PM"] };
    const result = computeOpenStatus(h, monAt(14));
    expect(result.state).toBe("open");
    if (result.state === "open") expect(result.time).toBe("5pm");
  });

  test("AM hours: 8:30 AM - 9:30 AM", () => {
    const h: WeeklyHours = { mon: ["8:30 AM - 9:30 AM"] };
    const result = computeOpenStatus(h, monAt(9, 0));
    expect(result.state).toBe("open");
    if (result.state === "open") expect(result.time).toBe("9:30am");
  });
});

// ─── Noon/midnight boundary cases ─────────────────────────────────────────────

describe("noon and midnight boundaries", () => {
  test("12:00 PM = noon (720 min)", () => {
    // A slot that closes at 12:00 PM — at 11:55 AM should be open
    const h: WeeklyHours = { mon: ["10:00 AM - 12:00 PM"] };
    const result = computeOpenStatus(h, monAt(11, 55));
    expect(result.state).toBe("open");
    if (result.state === "open") expect(result.time).toBe("12pm");
  });

  test("12:00 AM = midnight (0 min) treated correctly for opens_at", () => {
    // A slot starting at 12:00 AM (midnight) — at 00:05 should be inside
    // But practically this shouldn't happen for food pantries; test the parser
    const h: WeeklyHours = { mon: ["12:00 AM - 2:00 AM"] };
    const result = computeOpenStatus(h, monAt(1));
    expect(result.state).toBe("open");
  });

  test("12:30 PM slot is after noon", () => {
    const h: WeeklyHours = { mon: ["12:30 PM - 2:00 PM"] };
    // 12:00 PM is before the slot (not yet open)
    const result = computeOpenStatus(h, monAt(12, 0));
    expect(result.state).toBe("opens_at");
    if (result.state === "opens_at") expect(result.time).toBe("12:30pm");
  });
});

// ─── Reversed multi-slot ordering (the real Plentiful bug) ────────────────────
//
// pantries-plentiful.ts:32 has slots in reverse chronological order:
//   ["10:30 AM - 12:00 PM", "8:30 AM - 9:30 AM"]
// Before the fix, computeOpenStatus returned the FIRST slot > now, so at 7:00 AM
// it would say "opens at 10:30" instead of "opens at 8:30".
// After the sort fix it must say "opens at 8:30".

describe("reversed multi-slot ordering", () => {
  const hours: WeeklyHours = {
    mon: ["10:30 AM - 12:00 PM", "8:30 AM - 9:30 AM"],
  };

  test("at 7:00 AM, opens_at should be 8:30 (earliest slot), not 10:30", () => {
    const result = computeOpenStatus(hours, monAt(7, 0));
    expect(result.state).toBe("opens_at");
    if (result.state === "opens_at") expect(result.time).toBe("8:30am");
  });

  test("at 9:00 AM, is open (inside the earlier 8:30–9:30 slot)", () => {
    const result = computeOpenStatus(hours, monAt(9, 0));
    expect(result.state).toBe("open");
    if (result.state === "open") expect(result.time).toBe("9:30am");
  });

  test("at 9:45 AM (between slots), opens_at should be 10:30 (next slot)", () => {
    const result = computeOpenStatus(hours, monAt(9, 45));
    expect(result.state).toBe("opens_at");
    if (result.state === "opens_at") expect(result.time).toBe("10:30am");
  });

  test("at 11:00 AM, open inside the later 10:30–12:00 slot", () => {
    const result = computeOpenStatus(hours, monAt(11, 0));
    expect(result.state).toBe("open");
    if (result.state === "open") expect(result.time).toBe("12pm");
  });

  test("at 14:00, closed_today (both slots over)", () => {
    expect(computeOpenStatus(hours, monAt(14))).toEqual({ state: "closed_today" });
  });
});

// ─── Real Plentiful pantry shape ──────────────────────────────────────────────
//
// Validates that a venue from pantries-plentiful.ts is correctly read as
// open/opens_at after the AM/PM parser fix. Uses the Pueblo Community Soup
// Kitchen shape (plentiful-3195): reversed slots on every weekday.

describe("real Plentiful pantry — Pueblo Community Soup Kitchen", () => {
  const soupKitchen: WeeklyHours = {
    mon: ["10:30 AM - 12:00 PM", "8:30 AM - 9:30 AM"],
    tue: ["10:30 AM - 12:00 PM", "8:30 AM - 9:30 AM"],
    wed: ["10:30 AM - 12:00 PM", "8:30 AM - 9:30 AM"],
    thu: ["10:30 AM - 12:00 PM", "8:30 AM - 9:30 AM"],
    fri: ["10:30 AM - 12:00 PM", "8:30 AM - 9:30 AM"],
    sat: ["10:30 AM - 12:00 PM", "8:30 AM - 9:30 AM"],
  };

  test("at 9:00 AM Monday, open (before fix would have been closed or NaN)", () => {
    expect(computeOpenStatus(soupKitchen, monAt(9, 0)).state).toBe("open");
  });

  test("at 7:00 AM Monday, opens_at 8:30 (earliest — before fix said 10:30)", () => {
    const result = computeOpenStatus(soupKitchen, monAt(7, 0));
    expect(result.state).toBe("opens_at");
    if (result.state === "opens_at") expect(result.time).toBe("8:30am");
  });

  test("Sunday (not in hours) → closed_today (other days have slots)", () => {
    // 2026-06-14 is a Sunday
    const sunday = new Date(2026, 5, 14, 10, 0, 0, 0);
    expect(computeOpenStatus(soupKitchen, sunday)).toEqual({ state: "closed_today" });
  });
});

// ─── formatSlot display formatting ───────────────────────────────────────────
//
// formatSlot must handle both slot formats and produce identical output style.
// 24h slots must render byte-identically to before (regression guard).
// 12h slots must preserve minutes — the P0 display bug this commit fixes.

describe("formatSlot", () => {
  // ── 12-hour Plentiful format ─────────────────────────────────────────────

  test("12h slot with minutes on start: 10:30 AM - 12:00 PM → 10:30am – 12pm", () => {
    // Before fix: formatSlot split on "-" producing start="10:30 AM " end=" 12:00 PM"
    // which parsed as NaN minutes → "10am – 12pm" (minutes silently dropped)
    expect(formatSlot("10:30 AM - 12:00 PM")).toBe("10:30am – 12pm");
  });

  test("12h slot with minutes on both sides: 8:30 AM - 9:30 AM → 8:30am – 9:30am", () => {
    expect(formatSlot("8:30 AM - 9:30 AM")).toBe("8:30am – 9:30am");
  });

  test("12h slot with no minutes on either side: 1:00 PM - 5:00 PM → 1pm – 5pm", () => {
    expect(formatSlot("1:00 PM - 5:00 PM")).toBe("1pm – 5pm");
  });

  test("12h slot spanning noon: 10:00 AM - 12:00 PM → 10am – 12pm", () => {
    expect(formatSlot("10:00 AM - 12:00 PM")).toBe("10am – 12pm");
  });

  // ── 24-hour format — regression guard (output must be byte-identical to before) ─

  test("24h slot whole hours: 09:00-17:00 → 9am – 5pm", () => {
    expect(formatSlot("09:00-17:00")).toBe("9am – 5pm");
  });

  test("24h slot with minutes on open: 09:30-17:00 → 9:30am – 5pm", () => {
    expect(formatSlot("09:30-17:00")).toBe("9:30am – 5pm");
  });

  test("24h slot with minutes on close: 09:00-17:30 → 9am – 5:30pm", () => {
    expect(formatSlot("09:00-17:30")).toBe("9am – 5:30pm");
  });

  test("24h slot noon close: 09:00-13:00 → 9am – 1pm", () => {
    // Used by HoursList.test.tsx fixtures — must stay unchanged
    expect(formatSlot("9:00-13:00")).toBe("9am – 1pm");
  });

  // ── Fail-safe ────────────────────────────────────────────────────────────

  test("malformed slot returns raw slot unchanged (no throw)", () => {
    expect(formatSlot("not-a-slot")).toBe("not-a-slot");
  });
});

// ─── slotToIsoTimes — ISO 8601 conversion for JSON-LD ─────────────────────────
//
// Thin wrapper over the same parseSlot() minutes-since-midnight logic covered
// above — schema.org OpeningHoursSpecification needs "HH:MM" strings, not the
// "9am"-style display text formatSlot produces.

describe("slotToIsoTimes", () => {
  test("24h slot: 09:00-17:00 → { opens: '09:00', closes: '17:00' }", () => {
    expect(slotToIsoTimes("09:00-17:00")).toEqual({ opens: "09:00", closes: "17:00" });
  });

  test("AM/PM slot: 9:00 AM - 5:00 PM → { opens: '09:00', closes: '17:00' } (12h→24h + zero-pad)", () => {
    // Proves both the AM/PM-to-24h hour conversion (5 PM → 17) and zero-padding
    // of single-digit hours (9 → "09"), not just a pass-through of the input.
    expect(slotToIsoTimes("9:00 AM - 5:00 PM")).toEqual({ opens: "09:00", closes: "17:00" });
  });

  test("malformed slot returns null", () => {
    expect(slotToIsoTimes("not-a-slot")).toBeNull();
  });
});
