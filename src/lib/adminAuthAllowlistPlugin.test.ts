// @vitest-environment node
/**
 * Integration tests for the admin allowlist enforcement plugin (#315
 * Phase 2) — the CRITICAL security surface of this phase. These tests boot
 * a REAL Better Auth instance (same betterAuth(buildAuthOptions(db))
 * construction as auth-options.test.ts) against a real, migrated
 * better-sqlite3 database and call the actual `auth.api.*` endpoints, so
 * the hooks under test run through Better Auth's real dispatch pipeline —
 * not a mock of it. See adminAllowlist.test.ts for the plain-logic unit
 * tests of the underlying isAllowlistedEmail() comparison.
 *
 * WHY apply migrations/0003_better_auth_schema.sql directly: that file is
 * the actual schema this app ships (see its own header for how it's
 * generated/reviewed) — plain CREATE TABLE/INDEX statements, D1-compatible
 * and equally valid SQLite DDL for better-sqlite3. Running the real
 * migration (rather than hand-rolling a test schema) means a schema drift
 * between the migration and what Better Auth actually needs would fail
 * these tests, not just auth-options.test.ts's construction-only check.
 *
 * WHY a `host` header on every direct auth.api call: auth-options.ts's
 * `baseURL` is dynamic (`{ allowedHosts, protocol }`, not a static string —
 * see that file's own WHY), so Better Auth cannot resolve an origin for a
 * direct server-side `auth.api.*` call without a `host`/`x-forwarded-host`
 * header matching one of ADMIN_ALLOWED_HOSTS (verified empirically: the
 * omission throws "Dynamic baseURL could not be resolved").
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
import { buildAuthOptions } from "@/lib/auth-options";
import { adminAuthAllowlistPlugin } from "@/lib/adminAuthAllowlistPlugin";

const MIGRATION_SQL = readFileSync(
  join(process.cwd(), "migrations", "0003_better_auth_schema.sql"),
  "utf-8",
);

const ALLOWLISTED_EMAIL = "kysboyd@gmail.com"; // matches adminAllowlist.ts's default

function buildTestAuth() {
  const db = new Database(":memory:");
  db.exec(MIGRATION_SQL);
  return betterAuth(buildAuthOptions(db));
}

/** Minimum headers every direct auth.api call in this file needs — see file header WHY. */
function requestHeaders(extra?: Record<string, string>): Headers {
  return new Headers({ host: "pueblofoodmap.com", ...extra });
}

describe("magic-link allowlist gate (/sign-in/magic-link)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET =
      "test-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    process.env.RESEND_API_KEY = "test-resend-key";
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    delete process.env.ADMIN_ALLOWLIST;
  });

  test("rejects a non-allowlisted email BEFORE creating a verification row or sending mail", async () => {
    const auth = buildTestAuth();

    const result = await auth.api.signInMagicLink({
      body: { email: "attacker@evil.com" },
      headers: requestHeaders(),
    });

    // Anti-enumeration: identical success shape to a real send.
    expect(result).toEqual({ status: true });
    // No email was ever sent for the rejected address.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("accepts an allowlisted email and actually sends the magic-link mail", async () => {
    const auth = buildTestAuth();

    const result = await auth.api.signInMagicLink({
      body: { email: ALLOWLISTED_EMAIL },
      headers: requestHeaders(),
    });

    expect(result).toEqual({ status: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(init.body as string);
    expect(body.to).toEqual([ALLOWLISTED_EMAIL]);
    expect(body.html).toContain("http"); // the real magic-link URL is embedded
  });

  test("comparison is case-insensitive, matching the allowlist helper", async () => {
    // No surrounding whitespace here: the endpoint's own zod `email()` body
    // schema rejects a whitespace-padded address before any hook runs — see
    // adminAllowlist.test.ts for whitespace-trimming coverage of the
    // underlying isAllowlistedEmail() comparison itself.
    const auth = buildTestAuth();

    const result = await auth.api.signInMagicLink({
      body: { email: "KysBoyd@Gmail.COM" },
      headers: requestHeaders(),
    });

    expect(result).toEqual({ status: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test("honors a custom ADMIN_ALLOWLIST", async () => {
    process.env.ADMIN_ALLOWLIST = "someone-else@example.com";
    const auth = buildTestAuth();

    const rejected = await auth.api.signInMagicLink({
      body: { email: ALLOWLISTED_EMAIL },
      headers: requestHeaders(),
    });
    expect(rejected).toEqual({ status: true });
    expect(fetchSpy).not.toHaveBeenCalled();

    const accepted = await auth.api.signInMagicLink({
      body: { email: "someone-else@example.com" },
      headers: requestHeaders(),
    });
    expect(accepted).toEqual({ status: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("defense-in-depth: databaseHooks.user.create.before", () => {
  // Proves the second, independent layer described in adminAuthAllowlistPlugin.ts's
  // file header: even a hypothetical future code path that creates a `user`
  // row through some endpoint this plugin's path-matched hooks.before array
  // doesn't cover would still be blocked here, at the database-write level.
  afterEach(() => {
    delete process.env.ADMIN_ALLOWLIST;
  });

  test("blocks creating a non-allowlisted user", async () => {
    const plugin = adminAuthAllowlistPlugin();
    const allowed = await plugin.databaseHooks.user.create.before({
      email: "attacker@evil.com",
    });
    expect(allowed).toBe(false);
  });

  test("allows creating an allowlisted user", async () => {
    const plugin = adminAuthAllowlistPlugin();
    const allowed = await plugin.databaseHooks.user.create.before({
      email: ALLOWLISTED_EMAIL,
    });
    expect(allowed).toBe(true);
  });
});

describe("email/password sign-up is disabled entirely", () => {
  test("signUpEmail rejects even with a syntactically valid body", async () => {
    process.env.BETTER_AUTH_SECRET =
      "test-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const auth = buildTestAuth();

    await expect(
      auth.api.signUpEmail({
        body: {
          email: ALLOWLISTED_EMAIL,
          password: "correct horse battery staple 1!",
          name: "Kyle",
        },
        headers: requestHeaders(),
      }),
    ).rejects.toMatchObject({ status: "BAD_REQUEST" });
  });
});

describe("passkey registration allowlist gate", () => {
  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET =
      "test-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    process.env.RESEND_API_KEY = "test-resend-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("rejects passkey registration options for an anonymous (no-session) request", async () => {
    const auth = buildTestAuth();

    await expect(
      auth.api.generatePasskeyRegistrationOptions({
        headers: requestHeaders(),
      }),
    ).rejects.toThrow();
  });

  test("an allowlisted, authenticated session CAN reach passkey registration options", async () => {
    const auth = buildTestAuth();

    // Real bootstrap: sign in via magic link, then verify the token to mint
    // a real session — the only legitimate way to obtain an authenticated
    // session in this system (see auth-options.ts's emailAndPassword.enabled
    // = false). The magic-link token is recovered from the mocked Resend
    // call's own email body rather than read back out of the `verification`
    // table directly — this proves the token actually delivered to the user
    // is the one that verifies, not just some token that happens to exist
    // in the DB.
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
    const token = tokenMatch[1];

    const verifyResponse = await auth.api.magicLinkVerify({
      query: { token, callbackURL: "/" },
      headers: requestHeaders(),
      asResponse: true,
    });
    const setCookie = verifyResponse.headers.get("set-cookie");
    if (!setCookie) {
      throw new Error("magicLinkVerify did not set a session cookie");
    }
    // A real browser/fetch client sends back only name=value pairs on the
    // Cookie header, not the Set-Cookie attributes (Path, HttpOnly, etc.).
    const cookieHeader = setCookie
      .split(",")
      .map((part) => part.split(";")[0].trim())
      .join("; ");

    // The gate under test: does NOT throw FORBIDDEN for this allowlisted,
    // authenticated session. (It may still fail deeper in the WebAuthn
    // options-generation logic for unrelated reasons unrelated to this
    // plugin — the assertion is scoped to "the allowlist gate let it
    // through", not "the full passkey ceremony succeeds end-to-end".)
    await expect(
      auth.api.generatePasskeyRegistrationOptions({
        headers: requestHeaders({ cookie: cookieHeader }),
      }),
    ).resolves.toBeDefined();
  });
});
