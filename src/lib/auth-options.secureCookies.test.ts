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

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
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

  test("config sanity: the better-auth-passkey key resolves secure:true via createCookieGetter", () => {
    // Quick declarative check that the config VALUE is right. Does NOT by
    // itself prove the passkey plugin requests a cookie by this exact name —
    // see the real end-to-end ceremony test below for that (PR #614 review).
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

describe("passkey WebAuthn challenge cookie — real ceremony (#595, PR #614 review)", () => {
  // WHY the full magic-link -> session -> generatePasskeyRegistrationOptions
  // round trip instead of only the declarative check above: the config-value
  // test proves "a cookie literally named better-auth-passkey gets
  // secure:true" but not that the passkey PLUGIN actually requests a cookie
  // by that name — that mapping was confirmed by reading @better-auth/
  // passkey's installed source (auth-options.ts's WHY comment), not by a
  // live ceremony. This test instead reads the REAL `Set-Cookie` header the
  // endpoint emits, the same technique auth-options.test.ts's rpID-isolation
  // block already uses (there for `rp.id`, here for the cookie's Secure
  // attribute) — it would catch a future @better-auth/passkey version
  // renaming its challenge cookie or overriding webAuthnChallengeCookie
  // elsewhere, which the config-only test cannot.
  const MIGRATION_SQL = [
    readFileSync(join(process.cwd(), "migrations", "0003_better_auth_schema.sql"), "utf-8"),
    readFileSync(join(process.cwd(), "migrations", "0004_rate_limit_table.sql"), "utf-8"),
  ].join("\n");
  const ALLOWLISTED_EMAIL = "kysboyd@gmail.com"; // matches adminAllowlist.ts's default

  function requestHeaders(extra?: Record<string, string>): Headers {
    return new Headers({ host: "pueblofoodmap.com", ...extra });
  }

  async function signInAndGetSessionCookie(
    auth: ReturnType<typeof betterAuth<ReturnType<typeof buildAuthOptions>>>,
  ): Promise<string> {
    await auth.api.signInMagicLink({
      body: { email: ALLOWLISTED_EMAIL },
      headers: requestHeaders(),
    });
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const [, sendInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(sendInit.body as string);
    const tokenMatch = /token=([^&\s"]+)/.exec(sentBody.text as string);
    if (!tokenMatch) {
      throw new Error("magic-link email did not contain a token URL");
    }
    const verifyResponse = await auth.api.magicLinkVerify({
      query: { token: tokenMatch[1], callbackURL: "/" },
      headers: requestHeaders(),
      asResponse: true,
    });
    const setCookie = verifyResponse.headers.get("set-cookie");
    if (!setCookie) {
      throw new Error("magicLinkVerify did not set a session cookie");
    }
    return setCookie
      .split(",")
      .map((part) => part.split(";")[0].trim())
      .join("; ");
  }

  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = "test-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    process.env.RESEND_API_KEY = "test-resend-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("generatePasskeyRegistrationOptions sets a Set-Cookie: better-auth-passkey=...; Secure", async () => {
    const db = new Database(":memory:");
    db.exec(MIGRATION_SQL);
    const auth = betterAuth(buildAuthOptions(db));
    const cookieHeader = await signInAndGetSessionCookie(auth);

    const response = await auth.api.generatePasskeyRegistrationOptions({
      headers: requestHeaders({ cookie: cookieHeader }),
      asResponse: true,
    });

    const setCookieEntries =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [response.headers.get("set-cookie") ?? ""];
    // Resolved name is "better-auth.better-auth-passkey" — no `name`
    // override was set for this cookie (only `attributes`), so it falls
    // back to createCookie()'s default `${cookiePrefix}.${cookieName}`
    // (cookiePrefix defaults to "better-auth"). The `better-auth-passkey`
    // string is the createCookie() KEY the passkey plugin looks up in
    // `advanced.cookies` (see auth-options.ts's WHY), not the wire name.
    const challengeCookie = setCookieEntries.find((entry) =>
      entry.startsWith("better-auth.better-auth-passkey="),
    );

    expect(challengeCookie).toBeDefined();
    expect(challengeCookie?.toLowerCase()).toContain("secure");
  });
});
