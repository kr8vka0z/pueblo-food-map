// @vitest-environment node
/**
 * Test for buildAuthOptions() — the Better Auth engine config (#314 Phase
 * 1). Ponytail-minimum: the one runnable check that fails if the config
 * itself is broken (bad plugin options, invalid baseURL shape, etc.).
 *
 * WHY `node` environment: better-sqlite3 is a native Node addon; jsdom's
 * vm-sandboxed realm has no compatible require() path for it (same class of
 * cross-realm issue documented in cfAccess.test.ts's own `node`-environment
 * WHY comment, different underlying cause).
 *
 * WHY better-sqlite3 in-memory rather than a real D1Database or a fetched
 * getAdminDb(): this test exercises buildAuthOptions() directly — the
 * function both the runtime (auth.ts) and the CLI (scripts/auth-cli.config.ts)
 * call — so it doesn't need Cloudflare's Worker request context at all.
 * better-sqlite3 is already a pinned devDependency for CLI schema
 * generation (see that script's file header); reusing it here avoids adding
 * a second in-memory-DB mechanism just for this test.
 *
 * Scope: Phase 1 provisions the auth ENGINE only — no login UI, no route
 * gating. This test proves the engine constructs without throwing and
 * exposes the plugins/endpoints Phase 1 requires (magicLink, passkey); it
 * does NOT exercise a live sign-in flow (no sendMagicLink or WebAuthn
 * ceremony is wired yet — see auth-options.ts's own `// Phase 2:` markers).
 */

import { describe, expect, test, vi } from "vitest";
import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
import { getCookies } from "better-auth/cookies";
import { buildAuthOptions } from "@/lib/auth-options";

describe("buildAuthOptions", () => {
  test("constructs a working Better Auth instance with the expected plugins wired", () => {
    const auth = betterAuth(buildAuthOptions(new Database(":memory:")));

    // The engine itself boots — this is what "provision the engine" means
    // for Phase 1: a real betterAuth() instance with a working request
    // handler, not a config object that merely type-checks.
    expect(typeof auth.handler).toBe("function");

    // magicLink and passkey are both registered at config level (schema
    // coverage for Phase 1), confirmed via the endpoints each plugin
    // contributes to auth.api.
    expect(typeof auth.api.signInMagicLink).toBe("function");
    expect(typeof auth.api.magicLinkVerify).toBe("function");
    expect(typeof auth.api.generatePasskeyRegistrationOptions).toBe(
      "function",
    );
  });

  test("baseURL allowedHosts covers every admin hostname cfAccess.ts defends", () => {
    const auth = betterAuth(buildAuthOptions(new Database(":memory:")));
    const baseURL = auth.options.baseURL;

    if (typeof baseURL === "string" || !baseURL) {
      throw new Error("expected a dynamic baseURL config, got: " + String(baseURL));
    }
    expect(baseURL.protocol).toBe("https");
    // ADMIN_ORIGINS (cfAccess.ts) includes https://pueblofoodmap.com — the
    // apex admin now serves /admin from — and its bare host must be in the
    // allow-list Better Auth uses to construct correct absolute URLs there.
    expect(baseURL.allowedHosts).toContain("pueblofoodmap.com");
  });
});

describe("rate limit — D1-backed, magic-link custom rule (#318 Phase 4 item 1)", () => {
  // Config introspection only — this doesn't need the `rateLimit` table to
  // exist (migrations/0004_rate_limit_table.sql), since `auth.options` is
  // read directly rather than exercised through a live request. See
  // auth-options.ts's own `rateLimit` WHY comment for the full source
  // trace behind every value asserted here.
  test("rateLimit is enabled in production, D1-backed, with the magic-link custom rule", () => {
    // WHY force NODE_ENV to "production" for this one assertion:
    // auth-options.ts's `enabled` mirrors better-auth's own
    // production-only default (create-context.mjs:171) — asserting
    // `enabled === true` under vitest's real "test" NODE_ENV would fail
    // for a reason unrelated to what this test checks. vi.stubEnv (not a
    // direct `process.env.NODE_ENV =`) both bypasses Next's read-only
    // NODE_ENV type AND is undone by vi.unstubAllEnvs() in `finally`, so
    // no other test in this file observes the override.
    vi.stubEnv("NODE_ENV", "production");

    try {
      const options = buildAuthOptions(new Database(":memory:"));

      expect(options.rateLimit?.enabled).toBe(true);
      expect(options.rateLimit?.storage).toBe("database");
      expect(options.rateLimit?.customRules?.["/sign-in/magic-link"]).toEqual(
        { window: 3600, max: 5 },
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  test("rateLimit stays disabled outside production (e.g. this test suite itself)", () => {
    const options = buildAuthOptions(new Database(":memory:"));
    expect(options.rateLimit?.enabled).toBe(false);
  });
});

describe("session lifetime — 12h rolling (#318 Phase 4 item 5)", () => {
  test("expiresIn is 12h and updateAge is 1h, not the 7-day/1-day library default", () => {
    const options = buildAuthOptions(new Database(":memory:"));

    expect(options.session?.expiresIn).toBe(60 * 60 * 12);
    expect(options.session?.updateAge).toBe(60 * 60);
  });
});

describe("session cookie — __Host- prefix (Phase 3 dual-auth)", () => {
  // Build-time guard for the exact trap this config exists to avoid: a
  // cookie whose name merely SAYS `__Host-` without also satisfying its
  // three invariants (Secure, Path=/, no Domain) is silently dropped by the
  // browser, turning login into an invisible retry loop. A real end-to-end
  // browser check still happens at Kyle's live preview — see this repo's
  // Phase 3 report — but this proves the resolved config is correct BEFORE
  // that, using better-auth's own getCookies() helper (the exact function
  // its runtime uses to compute the real Set-Cookie name/attributes; see
  // auth-options.ts's own WHY comment on the `advanced` block for the
  // source trace).
  test("session_token resolves to __Host-session_token: Secure, Path=/, no Domain", () => {
    const options = buildAuthOptions(new Database(":memory:"));
    const cookies = getCookies(options);

    expect(cookies.sessionToken.name).toBe("__Host-session_token");
    expect(cookies.sessionToken.attributes.secure).toBe(true);
    expect(cookies.sessionToken.attributes.path).toBe("/");
    expect(cookies.sessionToken.attributes.domain).toBeUndefined();
    // The manual `{secure:true}` merge must stay ADDITIVE over Better Auth's
    // defaults — HttpOnly (no JS access to the session token) and SameSite
    // (CSRF hardening) must survive the override, not get dropped by it.
    expect(cookies.sessionToken.attributes.httpOnly).toBe(true);
    expect(cookies.sessionToken.attributes.sameSite).toBe("lax");
  });
});
