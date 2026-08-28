// @vitest-environment node
/**
 * Tests for requireAdminOrigin() — the CSRF defense that remains in
 * cfAccess.ts after the Better Auth sole-gate cutover
 * (auth/betterauth-sole-gate). This file used to test requireAccessIdentity()
 * (the removed Cloudflare Access JWT verifier) — see git history / cfAccess.ts's
 * own header for what used to live here and why it's gone. requireAdminOrigin()
 * is otherwise exercised end-to-end by every /api/admin/* route's own test
 * file (e.g. src/app/api/admin/venues/route.test.ts's "wrong/missing Origin"
 * case); these are its direct unit tests.
 */

import { describe, expect, test } from "vitest";
import { AccessDeniedError, requireAdminOrigin, type HeaderSource } from "@/lib/cfAccess";

function headersWith(origin: string | null): HeaderSource {
  return { get: (name: string) => (name === "Origin" ? origin : null) };
}

describe("requireAdminOrigin", () => {
  test("accepts the prod apex origin", () => {
    expect(() => requireAdminOrigin(headersWith("https://pueblofoodmap.com"))).not.toThrow();
  });

  test("accepts the staging apex origin", () => {
    expect(() => requireAdminOrigin(headersWith("https://dev.pueblofoodmap.com"))).not.toThrow();
  });

  test("rejects a missing Origin header", () => {
    expect(() => requireAdminOrigin(headersWith(null))).toThrow(AccessDeniedError);
    try {
      requireAdminOrigin(headersWith(null));
    } catch (err) {
      expect(err).toBeInstanceOf(AccessDeniedError);
      expect((err as AccessDeniedError).reason).toBe("bad_origin");
    }
  });

  test("rejects an origin not on the allowlist", () => {
    expect(() => requireAdminOrigin(headersWith("https://evil.example.com"))).toThrow(AccessDeniedError);
  });
});
