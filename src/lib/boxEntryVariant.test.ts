/**
 * Regression coverage for the B4 preview-switch resolver (slice 4 blocker
 * fix, PR #473) — the MapWrapper-level behavior the coordinator asked for,
 * proved via the extracted pure function since MapWrapper itself has no
 * test harness (see boxEntryVariant.ts's own header).
 */

import { describe, test, expect } from "vitest";
import { resolveBoxEntryVariant } from "./boxEntryVariant";

describe("resolveBoxEntryVariant", () => {
  test("no ?boxEntry= param -> null (neutral: today's exact 4-item bar, no floating button)", () => {
    expect(resolveBoxEntryVariant("")).toBeNull();
    expect(resolveBoxEntryVariant("?venue=abc")).toBeNull();
  });

  test("?boxEntry=nav -> 'nav' (BottomNav candidate opt-in)", () => {
    expect(resolveBoxEntryVariant("?boxEntry=nav")).toBe("nav");
  });

  test("?boxEntry=map -> 'map' (floating button candidate opt-in)", () => {
    expect(resolveBoxEntryVariant("?boxEntry=map")).toBe("map");
  });

  test("an unrecognized value falls back to neutral null, not a guess", () => {
    expect(resolveBoxEntryVariant("?boxEntry=bogus")).toBeNull();
  });
});
