/**
 * Unit tests for the admin allowlist helper (#315 Phase 2). Pure logic, no
 * Better Auth instance needed — see adminAuthAllowlistPlugin.test.ts for
 * the integration-level proof that these checks are actually wired into
 * both hook points.
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { getAdminAllowlist, isAllowlistedEmail } from "@/lib/adminAllowlist";

describe("getAdminAllowlist", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("defaults to kysboyd@gmail.com when ADMIN_ALLOWLIST is unset", () => {
    vi.stubEnv("ADMIN_ALLOWLIST", "");
    expect(getAdminAllowlist()).toEqual(["kysboyd@gmail.com"]);
  });

  test("parses a comma-separated ADMIN_ALLOWLIST, trimmed and lowercased", () => {
    vi.stubEnv("ADMIN_ALLOWLIST", " Alice@Example.com, bob@example.com ,");
    expect(getAdminAllowlist()).toEqual([
      "alice@example.com",
      "bob@example.com",
    ]);
  });

  test("falls back to the default if ADMIN_ALLOWLIST resolves to zero entries", () => {
    vi.stubEnv("ADMIN_ALLOWLIST", " , , ");
    expect(getAdminAllowlist()).toEqual(["kysboyd@gmail.com"]);
  });
});

describe("isAllowlistedEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("matches case-insensitively and ignores surrounding whitespace", () => {
    expect(isAllowlistedEmail("KysBoyd@Gmail.com")).toBe(true);
    expect(isAllowlistedEmail("  kysboyd@gmail.com  ")).toBe(true);
  });

  test("rejects an email not on the allowlist", () => {
    expect(isAllowlistedEmail("attacker@evil.com")).toBe(false);
  });

  test("respects a custom ADMIN_ALLOWLIST", () => {
    vi.stubEnv("ADMIN_ALLOWLIST", "someone-else@example.com");
    expect(isAllowlistedEmail("kysboyd@gmail.com")).toBe(false);
    expect(isAllowlistedEmail("someone-else@example.com")).toBe(true);
  });
});
