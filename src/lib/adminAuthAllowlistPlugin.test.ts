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
 * WHY apply migrations/0003_better_auth_schema.sql AND
 * migrations/0004_rate_limit_table.sql directly: both files are the actual
 * schema this app ships (see each file's own header for how it's
 * generated/reviewed) — plain CREATE TABLE/INDEX statements, D1-compatible
 * and equally valid SQLite DDL for better-sqlite3. Running the real
 * migrations (rather than hand-rolling a test schema) means a schema drift
 * between the migrations and what Better Auth actually needs would fail
 * these tests, not just auth-options.test.ts's construction-only check —
 * exactly the mechanism that caught this file's own tests when better-auth
 * 1.7.4 added a boot-time schema-validation check and every test here that
 * dispatches a real request (sendVerificationOTP, signInEmailOTP,
 * generatePasskeyRegistrationOptions) started failing on a missing
 * `rateLimit` table until 0004 was added below.
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
import { adminAuthAllowlistPlugin, REFUSED_EMAIL_OTP_PATHS } from "@/lib/adminAuthAllowlistPlugin";
import { cookieHeaderFrom, lastEmailedCode, signInWithEmailCode } from "@/__tests__/helpers/authTestHelpers";

const MIGRATION_SQL = [
  readFileSync(
    join(process.cwd(), "migrations", "0003_better_auth_schema.sql"),
    "utf-8",
  ),
  readFileSync(
    join(process.cwd(), "migrations", "0004_rate_limit_table.sql"),
    "utf-8",
  ),
].join("\n");

const ALLOWLISTED_EMAIL = "kysboyd@gmail.com"; // matches adminAllowlist.ts's default

function buildTestAuthWithDb() {
  const db = new Database(":memory:");
  db.exec(MIGRATION_SQL);
  return { auth: betterAuth(buildAuthOptions(db)), db };
}

function buildTestAuth() {
  return buildTestAuthWithDb().auth;
}

/** Minimum headers every direct auth.api call in this file needs — see file header WHY. */
function requestHeaders(extra?: Record<string, string>): Headers {
  return new Headers({ host: "pueblofoodmap.com", ...extra });
}

describe("email-code allowlist gate (#684)", () => {
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

  function verificationRows(db: Database.Database): number {
    return (db.prepare('SELECT COUNT(*) AS n FROM "verification"').get() as { n: number }).n;
  }

  test("a non-allowlisted email gets the identical response, no code row and no email", async () => {
    const { auth, db } = buildTestAuthWithDb();

    const result = await auth.api.sendVerificationOTP({
      body: { email: "attacker@evil.com", type: "sign-in" },
      headers: requestHeaders(),
    });

    // Anti-enumeration: identical success shape to a real send.
    expect(result).toEqual({ success: true });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(verificationRows(db)).toBe(0);
  });

  test("an allowlisted email gets a 6-digit code email (code in the subject, no link) and a hashed code row", async () => {
    const { auth, db } = buildTestAuthWithDb();

    const result = await auth.api.sendVerificationOTP({
      body: { email: ALLOWLISTED_EMAIL, type: "sign-in" },
      headers: requestHeaders(),
    });

    expect(result).toEqual({ success: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(init.body as string);
    expect(body.to).toEqual([ALLOWLISTED_EMAIL]);
    const code = lastEmailedCode();
    expect(body.subject).toBe(`Your sign-in code: ${code}`);
    expect(body.html).toContain(code);
    expect(body.html).not.toMatch(/href=|https?:\/\//);
    expect(body.text).toContain("expires in 10 minutes");
    // Stored hashed: the plain code is nowhere in the database.
    expect(verificationRows(db)).toBe(1);
    const stored = db.prepare('SELECT value FROM "verification"').get() as { value: string };
    expect(stored.value).not.toContain(code);
  });

  test("comparison is case-insensitive, matching the allowlist helper", async () => {
    const { auth } = buildTestAuthWithDb();
    await auth.api.sendVerificationOTP({
      body: { email: "KysBoyd@Gmail.COM", type: "sign-in" },
      headers: requestHeaders(),
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test("honors a custom ADMIN_ALLOWLIST", async () => {
    process.env.ADMIN_ALLOWLIST = "someone-else@example.com";
    const { auth } = buildTestAuthWithDb();

    await auth.api.sendVerificationOTP({ body: { email: ALLOWLISTED_EMAIL, type: "sign-in" }, headers: requestHeaders() });
    expect(fetchSpy).not.toHaveBeenCalled();

    await auth.api.sendVerificationOTP({ body: { email: "someone-else@example.com", type: "sign-in" }, headers: requestHeaders() });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test.each(["email-verification", "forget-password"] as const)(
    "a %s code is never created or sent, even for an allowlisted email",
    async (type) => {
      const { auth, db } = buildTestAuthWithDb();
      const result = await auth.api.sendVerificationOTP({ body: { email: ALLOWLISTED_EMAIL, type }, headers: requestHeaders() });
      expect(result).toEqual({ success: true });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(verificationRows(db)).toBe(0);
    },
  );

  test("the emailed code signs in, once only", async () => {
    const { auth, db } = buildTestAuthWithDb();
    await auth.api.sendVerificationOTP({ body: { email: ALLOWLISTED_EMAIL, type: "sign-in" }, headers: requestHeaders() });
    const otp = lastEmailedCode();

    const res = await auth.api.signInEmailOTP({ body: { email: ALLOWLISTED_EMAIL, otp }, headers: requestHeaders(), asResponse: true });
    expect(res.status).toBe(200);
    expect(cookieHeaderFrom(res)).toContain("__Host-session_token=");
    expect((db.prepare('SELECT COUNT(*) AS n FROM "session"').get() as { n: number }).n).toBe(1);

    await expect(
      auth.api.signInEmailOTP({ body: { email: ALLOWLISTED_EMAIL, otp }, headers: requestHeaders() }),
    ).rejects.toMatchObject({ body: { code: "INVALID_OTP" } });
  });

  test("three wrong codes → too many tries, and then even the right code is refused", async () => {
    const { auth } = buildTestAuthWithDb();
    await auth.api.sendVerificationOTP({ body: { email: ALLOWLISTED_EMAIL, type: "sign-in" }, headers: requestHeaders() });
    const otp = lastEmailedCode();
    const wrong = otp === "000000" ? "111111" : "000000";

    for (let i = 0; i < 3; i++) {
      await expect(
        auth.api.signInEmailOTP({ body: { email: ALLOWLISTED_EMAIL, otp: wrong }, headers: requestHeaders() }),
      ).rejects.toMatchObject({ body: { code: "INVALID_OTP" } });
    }
    await expect(
      auth.api.signInEmailOTP({ body: { email: ALLOWLISTED_EMAIL, otp }, headers: requestHeaders() }),
    ).rejects.toMatchObject({ body: { code: "TOO_MANY_ATTEMPTS" } });
  });

  test("an expired code is refused", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const { auth } = buildTestAuthWithDb();
      await auth.api.sendVerificationOTP({ body: { email: ALLOWLISTED_EMAIL, type: "sign-in" }, headers: requestHeaders() });
      const otp = lastEmailedCode();
      vi.setSystemTime(Date.now() + 11 * 60 * 1000);

      await expect(
        auth.api.signInEmailOTP({ body: { email: ALLOWLISTED_EMAIL, otp }, headers: requestHeaders() }),
      ).rejects.toMatchObject({ body: { code: "OTP_EXPIRED" } });
    } finally {
      vi.useRealTimers();
    }
  });

  test("signing in with a code is refused for a non-allowlisted email with the same error as a wrong code", async () => {
    const { auth, db } = buildTestAuthWithDb();

    await expect(
      auth.api.signInEmailOTP({ body: { email: "attacker@evil.com", otp: "123456" }, headers: requestHeaders() }),
    ).rejects.toMatchObject({ body: { code: "INVALID_OTP" } });
    expect((db.prepare('SELECT COUNT(*) AS n FROM "user"').get() as { n: number }).n).toBe(0);
  });

  test("even holding a VALID code, a non-allowlisted email is refused at the gate (defense in depth)", async () => {
    const { auth, db } = buildTestAuthWithDb();
    // Server-only endpoint: plants a real code, as if gate 1 had been bypassed.
    const otp = await auth.api.createVerificationOTP({ body: { email: "attacker@evil.com", type: "sign-in" } });

    await expect(
      auth.api.signInEmailOTP({ body: { email: "attacker@evil.com", otp }, headers: requestHeaders() }),
    ).rejects.toMatchObject({ body: { code: "INVALID_OTP" } });
    expect((db.prepare('SELECT COUNT(*) AS n FROM "session"').get() as { n: number }).n).toBe(0);
    // Refused before the code was even checked: it's still unused.
    expect(verificationRows(db)).toBe(1);
  });

  test("the old /sign-in/magic-link endpoint no longer exists", async () => {
    const { auth } = buildTestAuthWithDb();
    const res = await auth.handler(
      new Request("https://pueblofoodmap.com/api/auth/sign-in/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://pueblofoodmap.com" },
        body: JSON.stringify({ email: ALLOWLISTED_EMAIL }),
      }),
    );
    expect(res.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test.each([...REFUSED_EMAIL_OTP_PATHS])("the unused emailOTP endpoint %s is refused", async (path) => {
    const { auth } = buildTestAuthWithDb();
    const res = await auth.handler(
      new Request(`https://pueblofoodmap.com/api/auth${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://pueblofoodmap.com" },
        body: JSON.stringify({ email: ALLOWLISTED_EMAIL, otp: "123456", type: "sign-in", password: "x".repeat(12), newEmail: "x@example.com" }),
      }),
    );
    expect(res.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
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

    // Real bootstrap: sign in with the emailed code — the only legitimate
    // way to obtain an authenticated session in this system (see
    // auth-options.ts's emailAndPassword.enabled = false). The code comes
    // from the mocked Resend email itself (authTestHelpers.ts).
    const cookieHeader = await signInWithEmailCode(auth, ALLOWLISTED_EMAIL);

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
