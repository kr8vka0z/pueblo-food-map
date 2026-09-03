/**
 * Unit tests for formatPublishedDate() (board review finding #2).
 */

import { describe, test, expect } from "vitest";
import { formatPublishedDate } from "@/lib/dataFreshness";

describe("formatPublishedDate", () => {
  test("formats an ISO timestamp as a human-readable EN date", () => {
    expect(formatPublishedDate("2026-07-22T04:35:18.344Z", "en")).toBe("July 22, 2026");
  });

  test("formats the same timestamp as a human-readable ES date", () => {
    expect(formatPublishedDate("2026-07-22T04:35:18.344Z", "es")).toBe("22 de julio de 2026");
  });

  test("EN and ES output differ (real translation, not a copy)", () => {
    const iso = "2026-01-05T00:00:00.000Z";
    expect(formatPublishedDate(iso, "en")).not.toBe(formatPublishedDate(iso, "es"));
  });

  test("drops the time-of-day component — date only", () => {
    const withTime = formatPublishedDate("2026-03-14T23:59:59.999Z", "en");
    expect(withTime).not.toMatch(/\d{1,2}:\d{2}/);
  });
});
