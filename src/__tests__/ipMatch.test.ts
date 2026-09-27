/**
 * Unit tests for isExcludedIp (see src/lib/ipMatch.ts for the WHY) — the
 * matcher custom-worker.ts's /ingest proxy uses to drop Kyle's own home
 * traffic before it reaches PostHog (#485 comment, 2026-09-26).
 */
import { describe, test, expect } from "vitest";
import { isExcludedIp } from "@/lib/ipMatch";

const HOME_LIST = "66.33.12.72,2607:3640:121:e110::/64";

describe("isExcludedIp — IPv4", () => {
  test("exact match", () => {
    expect(isExcludedIp("66.33.12.72", HOME_LIST)).toBe(true);
  });

  test("non-match", () => {
    expect(isExcludedIp("66.33.12.73", HOME_LIST)).toBe(false);
  });

  test("IPv4 CIDR match", () => {
    expect(isExcludedIp("10.0.0.5", "10.0.0.0/24")).toBe(true);
    expect(isExcludedIp("10.0.1.5", "10.0.0.0/24")).toBe(false);
  });
});

describe("isExcludedIp — IPv6", () => {
  test("address inside the /64 prefix matches (device part rotates)", () => {
    expect(isExcludedIp("2607:3640:121:e110:abcd:1234:5678:9abc", HOME_LIST)).toBe(true);
    expect(isExcludedIp("2607:3640:121:e110::1", HOME_LIST)).toBe(true);
  });

  test("address outside the prefix does not match", () => {
    expect(isExcludedIp("2607:3640:121:e111::1", HOME_LIST)).toBe(false);
  });
});

describe("isExcludedIp — malformed input, never throws", () => {
  test("empty/undefined IP or list", () => {
    expect(isExcludedIp("", HOME_LIST)).toBe(false);
    expect(isExcludedIp(null, HOME_LIST)).toBe(false);
    expect(isExcludedIp("66.33.12.72", undefined)).toBe(false);
    expect(isExcludedIp("66.33.12.72", "")).toBe(false);
  });

  test("whitespace around commas is tolerated", () => {
    expect(isExcludedIp("66.33.12.72", " 66.33.12.72 , 2607:3640:121:e110::/64 ")).toBe(true);
  });

  test("a garbage entry in the list is skipped, not thrown", () => {
    expect(() => isExcludedIp("66.33.12.72", "not-an-ip,66.33.12.72")).not.toThrow();
    expect(isExcludedIp("66.33.12.72", "not-an-ip,66.33.12.72")).toBe(true);
  });

  test("a garbage candidate IP never matches", () => {
    expect(isExcludedIp("not-an-ip", HOME_LIST)).toBe(false);
  });

  test("an entry with an empty prefix (trailing slash) matches nothing, not everything", () => {
    expect(isExcludedIp("8.8.8.8", "66.33.12.72/")).toBe(false);
    expect(isExcludedIp("2001:db8::1", "2607:3640:121:e110::/")).toBe(false);
    expect(isExcludedIp("66.33.12.72", "66.33.12.72/")).toBe(false);
  });
});
