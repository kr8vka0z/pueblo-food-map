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

import { describe, expect, test } from "vitest";
import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
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
    // ADMIN_ORIGIN (cfAccess.ts) is https://admin.pueblofoodmap.com — its
    // bare host must be in the allow-list Better Auth uses to construct
    // correct absolute URLs on that hostname.
    expect(baseURL.allowedHosts).toContain("admin.pueblofoodmap.com");
  });
});
