/**
 * Unit tests for emailRetention.ts's once-a-day cron gate
 * (shouldRunEmailRetention). The actual D1 statements are proven for real
 * against SQLite in emailRetention.sql.test.ts — this file covers only the
 * pure time-based gate that keeps them from running 288x/day.
 */

import { describe, test, expect } from "vitest";
import { shouldRunEmailRetention } from "@/lib/emailRetention";

describe("shouldRunEmailRetention", () => {
  test("true at the 09:00 UTC slot", () => {
    expect(shouldRunEmailRetention(Date.UTC(2026, 8, 24, 9, 0))).toBe(true);
  });

  test("false 5 minutes later — the next cron tick that same hour", () => {
    expect(shouldRunEmailRetention(Date.UTC(2026, 8, 24, 9, 5))).toBe(false);
  });

  test("false one hour earlier", () => {
    expect(shouldRunEmailRetention(Date.UTC(2026, 8, 24, 8, 0))).toBe(false);
  });

  test("false one hour later", () => {
    expect(shouldRunEmailRetention(Date.UTC(2026, 8, 24, 10, 0))).toBe(false);
  });

  test("true regardless of the date — one slot every day", () => {
    expect(shouldRunEmailRetention(Date.UTC(2026, 0, 1, 9, 0))).toBe(true);
    expect(shouldRunEmailRetention(Date.UTC(2027, 11, 31, 9, 0))).toBe(true);
  });
});
