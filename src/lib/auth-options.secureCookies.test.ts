// @vitest-environment node
/**
 * buildAuthOptions() — Secure attribute on the non-session cookies (#595).
 *
 * Separate file from auth-options.test.ts (existing, write-guarded on
 * fix/* branches): that file already covers session_token's Secure
 * restoration. This file covers the same restoration for the OTHER cookies
 * `useSecureCookies: false` also strips Secure from — session_data,
 * account_data, dont_remember (all via better-auth's own `getCookies()`)
 * and the passkey plugin's WebAuthn challenge cookie (`better-auth-passkey`,
 * not part of `getCookies()`'s fixed return shape, so read directly via the
 * same `createCookieGetter` the passkey plugin itself calls internally —
 * see auth-options.ts's WHY comment on the `advanced.cookies` block for the
 * source trace).
 */

import { describe, expect, test } from "vitest";
import Database from "better-sqlite3";
import { getCookies, createCookieGetter } from "better-auth/cookies";
import { buildAuthOptions } from "@/lib/auth-options";

describe("non-session cookies also get Secure restored (#595)", () => {
  test("session_data, account_data, and dont_remember all resolve secure:true", () => {
    const options = buildAuthOptions(new Database(":memory:"));
    const cookies = getCookies(options);

    expect(cookies.sessionData.attributes.secure).toBe(true);
    expect(cookies.accountData.attributes.secure).toBe(true);
    expect(cookies.dontRememberToken.attributes.secure).toBe(true);
  });

  test("the passkey WebAuthn challenge cookie (better-auth-passkey) resolves secure:true", () => {
    const options = buildAuthOptions(new Database(":memory:"));
    const createCookie = createCookieGetter(options);

    const challengeCookie = createCookie("better-auth-passkey");

    expect(challengeCookie.attributes.secure).toBe(true);
  });

  test("without the #595 override, useSecureCookies:false alone would strip Secure (regression guard)", () => {
    // Proves the underlying better-auth mechanism this fix defends against:
    // an `advanced` block with no per-cookie override at all leaves every
    // cookie non-Secure once useSecureCookies is false.
    const bareOptions = { advanced: { useSecureCookies: false } };
    const cookies = getCookies(bareOptions as Parameters<typeof getCookies>[0]);

    expect(cookies.dontRememberToken.attributes.secure).toBe(false);
  });
});
