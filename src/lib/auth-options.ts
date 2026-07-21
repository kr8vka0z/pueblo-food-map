/**
 * auth-options.ts — Better Auth config, shared by the runtime handler
 * (auth.ts) and the CLI schema generator (scripts/auth-cli.config.ts).
 * Phase 1 of the Better Auth build (#314): provisions the auth ENGINE only.
 *
 * WHY a pure function taking `db` instead of a module-scope `betterAuth(...)`
 * instance: the runtime needs a D1Database obtained lazily from
 * getCloudflareContext() (see auth.ts's WHY, same pattern as adminDb.ts's
 * getAdminDb()) — env bindings aren't available at module-import time on
 * Workers. The CLI, in turn, runs in plain Node outside any Workers request
 * context and has no real D1 binding to hand over at all (see
 * scripts/auth-cli.config.ts's WHY for how it supplies a synchronous stub).
 * Factoring the shared config into a function both callers invoke with their
 * own `db` keeps the config itself — plugins, baseURL, secret — defined once.
 *
 * WHY no Workers KV anywhere: task scope requires ALL auth state (users,
 * sessions, magic-link/verification tokens, passkey challenges) to live in
 * D1 alongside the rest of this app's admin data — one store, one backup
 * surface, no second binding to provision or reason about. Better Auth's
 * `secondaryStorage` option (which would route sessions/rate-limit data to a
 * KV-like store) is deliberately left unset.
 *
 * WHY core `better-auth` directly, not the third-party `better-auth-cloudflare`
 * package: traced better-auth's own source (@better-auth/core's
 * BetterAuthOptions `database` union includes `D1Database` from
 * `@cloudflare/workers-types` directly) and confirmed the bundled
 * `@better-auth/kysely-adapter` structurally auto-detects a raw D1Database
 * and dispatches to its own `D1SqliteDialect`
 * (packages/kysely-adapter/src/d1-sqlite-dialect.ts on the better-auth repo),
 * which uses D1's `batch()` API — never raw `BEGIN`/`COMMIT` (D1 doesn't
 * support interactive transactions; the dialect's own comment says so
 * explicitly). No community/third-party adapter is needed for D1 support.
 */

import type { BetterAuthOptions } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";

/**
 * Every hostname this Worker answers admin traffic on (mirrors
 * cfAccess.ts's ADMIN_ORIGIN + the hostname list documented in that file's
 * header comment: the Access-gated admin subdomain, the staging subdomain,
 * the public apex admin path, and the bare workers.dev fallback). Better
 * Auth needs this to construct correct absolute callback/redirect URLs
 * regardless of which hostname a request arrives on — the same
 * multi-hostname reality cfAccess.ts's in-app JWT re-verification exists to
 * cover, for the same underlying reason (Cloudflare Workers answer on more
 * hostnames than a single custom domain).
 *
 * NOT included: Workers version-preview URLs (`<version-prefix>-pueblo-food-
 * map.kyle-boyd.workers.dev`) — those are dynamic per-deploy and can't be
 * exact-matched, and this option supports only exact/wildcard hostnames,
 * not a fully dynamic predicate. Phase 2/3 (real login UI + route gating)
 * is the right place to decide whether a wildcard pattern is worth adding;
 * Phase 1 only needs the engine to construct URLs correctly on the
 * hostnames real login traffic will actually use.
 */
const ADMIN_ALLOWED_HOSTS = [
  "admin.pueblofoodmap.com",
  "dev.pueblofoodmap.com",
  "pueblofoodmap.com",
  "pueblo-food-map.kyle-boyd.workers.dev",
];

/**
 * Builds the shared Better Auth config. `database` is injected rather than
 * read from `env` internally — see file header WHY. Typed as the full
 * `BetterAuthOptions["database"]` union (not narrowed to D1Database) so the
 * CLI-only config (scripts/auth-cli.config.ts) can pass a plain
 * better-sqlite3 instance for schema generation while the runtime
 * (auth.ts) passes the real D1Database binding — see that script's file
 * header WHY for why generation can't use D1 directly.
 *
 * WHY `satisfies BetterAuthOptions` on the return, not a `: BetterAuthOptions`
 * annotation: an explicit return-type annotation widens the returned object
 * to the general `BetterAuthOptions` interface, erasing the literal
 * `plugins` tuple type. `betterAuth()`'s own generic inference needs that
 * literal tuple to add each plugin's endpoints (e.g. `auth.api.signInMagicLink`)
 * to the resulting instance's type — `satisfies` checks the same structural
 * assignability without erasing it (verified: auth-options.test.ts's
 * `auth.api.signInMagicLink` etc. only type-checks with `satisfies`).
 */
export function buildAuthOptions(
  database: NonNullable<BetterAuthOptions["database"]>,
) {
  return {
    database,
    // Falls back to the `better-auth-secret-123456789` dev default only in
    // non-production; Better Auth itself throws in production if `secret`
    // resolves empty, so an unset prod secret fails closed rather than
    // silently signing tokens with a public default.
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: {
      allowedHosts: ADMIN_ALLOWED_HOSTS,
      protocol: "https",
    },
    plugins: [
      magicLink({
        // Phase 2: wire a real sendMagicLink implementation (Resend, matching
        // this repo's existing email integration — see AGENTS.md "Resend
        // Email Key Management"). Phase 1 only needs the plugin registered so
        // its schema (the `verification` table shape it relies on) is part of
        // the generated migration; no login UI calls this path yet.
        sendMagicLink: async () => {
          throw new Error(
            "sendMagicLink not implemented — Phase 2 wires the real email send.",
          );
        },
      }),
      passkey({
        rpID: "pueblofoodmap.com",
        rpName: "Pueblo Food Map Admin",
        // Phase 2/3 (real login UI): passkey's `origin` accepts a single
        // string, a string array, or null — a static array of every admin
        // hostname above (matching ADMIN_ALLOWED_HOSTS) is enough for
        // registration/authentication ceremonies to validate correctly on
        // any of them. No dynamic-per-request origin resolution exists in
        // this plugin's options today.
        origin: ADMIN_ALLOWED_HOSTS.map((host) => `https://${host}`),
      }),
    ],
  } satisfies BetterAuthOptions;
}
