/**
 * Tests for src/lib/relativeTime.ts (Blessing Boxes slice 2).
 */

import { describe, test, expect } from "vitest";
import { formatRelativeTime } from "@/lib/relativeTime";

const NOW = new Date("2026-09-17T12:00:00.000Z");

describe("formatRelativeTime", () => {
  test("a few minutes ago -> minute granularity (en)", () => {
    const iso = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso, "en", NOW)).toBe("5 minutes ago");
  });

  test("a few hours ago -> hour granularity (en)", () => {
    const iso = new Date(NOW.getTime() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso, "en", NOW)).toBe("3 hours ago");
  });

  test("a few days ago -> day granularity (en)", () => {
    const iso = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso, "en", NOW)).toBe("2 days ago");
  });

  test("less than a minute ago -> Intl's own 'this minute' phrasing", () => {
    const iso = new Date(NOW.getTime() - 10 * 1000).toISOString();
    expect(formatRelativeTime(iso, "en", NOW)).toBe("this minute");
  });

  test("Spanish locale produces Spanish phrasing", () => {
    const iso = new Date(NOW.getTime() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso, "es", NOW)).toBe("hace 3 horas");
  });
});
