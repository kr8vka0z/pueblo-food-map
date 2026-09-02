/**
 * Tests for src/lib/rateLimit.ts's isValidEmail (#269).
 *
 * checkRateLimit itself is exercised indirectly through the three submit
 * routes' own test suites (reportSubmit.test.ts etc.) via their POST
 * handlers — this file covers only the pure email helper, which has no
 * existing direct test coverage of its own.
 */

import { describe, test, expect } from "vitest";
import { isValidEmail } from "@/lib/rateLimit";
import { FIELD_LIMITS } from "@/lib/fieldLimits";

describe("isValidEmail", () => {
  test("accepts a well-formed email", () => {
    expect(isValidEmail("person@example.com")).toBe(true);
  });

  test("rejects a malformed email", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
  });

  test("rejects an over-length input instead of hanging — bounds the regex against pathological input (#269)", () => {
    // A local-part far past FIELD_LIMITS.EMAIL (254, RFC 5321). This isn't a
    // classic catastrophic-backtracking pattern for EMAIL_RE's specific
    // regex, but the fix's whole point is a structural bound at the test
    // call site regardless of the specific pattern -- so this asserts the
    // behavior (rejected, and the call returns) rather than timing it.
    const pathological = "a".repeat(100_000) + "@example.com";
    expect(isValidEmail(pathological)).toBe(false);
  });

  test("a value exactly at the length cap with a valid shape still passes", () => {
    // "a...a@b.co" sized to land exactly at FIELD_LIMITS.EMAIL so the slice
    // bound isn't accidentally truncating a legitimately-sized address.
    const localLength = FIELD_LIMITS.EMAIL - "@b.co".length;
    const atCap = "a".repeat(localLength) + "@b.co";
    expect(atCap.length).toBe(FIELD_LIMITS.EMAIL);
    expect(isValidEmail(atCap)).toBe(true);
  });
});
