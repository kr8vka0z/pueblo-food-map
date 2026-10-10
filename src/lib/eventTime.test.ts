// @vitest-environment node
/**
 * Pueblo time <-> UTC conversion (src/lib/eventTime.ts). vitest.setup.ts
 * pins process.env.TZ to America/Denver, which would make a conversion that
 * wrongly used the host's local clock pass by accident. This file moves the
 * process clock to Tokyo so only a real America/Denver conversion is right.
 */

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { puebloLocalToUtcIso, utcIsoToPuebloLocal } from "@/lib/eventTime";

const originalTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "Asia/Tokyo";
});
afterAll(() => {
  process.env.TZ = originalTz;
});

describe("puebloLocalToUtcIso", () => {
  test("winter (MST, UTC-7) and summer (MDT, UTC-6) offsets", () => {
    expect(puebloLocalToUtcIso("2026-01-15T10:00")).toBe("2026-01-15T17:00:00.000Z");
    expect(puebloLocalToUtcIso("2026-07-15T10:00")).toBe("2026-07-15T16:00:00.000Z");
  });

  test("spring-forward day (2026-03-08, 02:00 -> 03:00): before and after the jump", () => {
    expect(puebloLocalToUtcIso("2026-03-08T01:30")).toBe("2026-03-08T08:30:00.000Z"); // still MST
    expect(puebloLocalToUtcIso("2026-03-08T03:30")).toBe("2026-03-08T09:30:00.000Z"); // now MDT
  });

  test("a wall-clock time that does not exist (skipped hour) is rejected", () => {
    expect(puebloLocalToUtcIso("2026-03-08T02:30")).toBeNull();
  });

  test("fall-back day (2026-11-01, 02:00 -> 01:00): the repeated hour resolves to its first (MDT) occurrence", () => {
    expect(puebloLocalToUtcIso("2026-11-01T00:30")).toBe("2026-11-01T06:30:00.000Z"); // MDT
    expect(puebloLocalToUtcIso("2026-11-01T01:30")).toBe("2026-11-01T07:30:00.000Z"); // first 01:30 = MDT
    expect(puebloLocalToUtcIso("2026-11-01T02:30")).toBe("2026-11-01T09:30:00.000Z"); // MST
  });

  test("malformed or impossible input returns null", () => {
    for (const bad of ["", "2026-13-01T10:00", "2026-02-30T10:00", "2026-01-15 10:00", "2026-01-15T25:00", "tomorrow"]) {
      expect(puebloLocalToUtcIso(bad)).toBeNull();
    }
  });
});

describe("utcIsoToPuebloLocal", () => {
  test("round-trips an instant back to the Pueblo wall clock (form pre-fill)", () => {
    expect(utcIsoToPuebloLocal("2026-07-15T16:00:00.000Z")).toBe("2026-07-15T10:00");
    expect(utcIsoToPuebloLocal("2026-01-15T17:00:00.000Z")).toBe("2026-01-15T10:00");
    expect(utcIsoToPuebloLocal("2026-03-08T09:30:00.000Z")).toBe("2026-03-08T03:30");
  });

  test("midnight renders as 00:00, not 24:00", () => {
    expect(utcIsoToPuebloLocal("2026-07-15T06:00:00.000Z")).toBe("2026-07-15T00:00");
  });
});
