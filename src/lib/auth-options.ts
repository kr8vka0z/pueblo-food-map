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
import { adminAuthAllowlistPlugin } from "@/lib/adminAuthAllowlistPlugin";
import { sendAdminMagicLinkEmail } from "@/lib/adminMagicLinkEmail";
import { logAdminAuthEvent } from "@/lib/logger";

/**
 * Every hostname this Worker answers admin traffic on (mirrors
 * cfAccess.ts's ADMIN_ORIGINS + the hostname list documented in that file's
 * header comment: the public apex — where admin now serves at the `/admin`
 * path, gated by a PATH-scoped Cloudflare Access application — the staging
 * apex, and the bare workers.dev fallback). Better Auth needs this to
 * construct correct absolute callback/redirect URLs regardless of which
 * hostname a request arrives on — the same multi-hostname reality
 * cfAccess.ts's in-app JWT re-verification exists to cover, for the same
 * underlying reason (Cloudflare Workers answer on more hostnames than a
 * single custom domain). The admin.pueblofoodmap.com /
 * dev.admin.pueblofoodmap.com subdomains are retired — admin is a path on
 * these same apex hosts, not a separate hostname.
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
      // WHY a fallback (fixed post-cutover — live 403 bug,
      // admin/session-dynamic-baseurl-host): a dynamic baseURL with no
      // fallback throws when a caller can't be resolved to one of
      // ADMIN_ALLOWED_HOSTS via a host/x-forwarded-host header (verified in
      // the installed better-auth source, dist/context/helpers.mjs's
      // `pickSource`/`resolveDynamicContext`). adminSession.ts's
      // requireAdminSession() now forwards `host` on every direct
      // auth.api.getSession() call (see that file's header), so this
      // fallback should rarely be hit in practice — it exists as the second
      // half of a belt-and-suspenders fix so a header-stripped caller can
      // never throw instead of cleanly resolving to "no session". Points at
      // the public apex (first entry in ADMIN_ALLOWED_HOSTS above), not a
      // staging/workers.dev host, since a fallback is inherently a single
      // choice and prod is the canonical default.
      fallback: "https://pueblofoodmap.com",
    },
    // #315 Phase 2 — CRITICAL: this admin has exactly one legitimate account-
    // creation path (an allowlisted email's first magic-link sign-in;
    // passkey registration only ever attaches to an EXISTING allowlisted
    // session, never mints a new user on its own). Email/password is never
    // enabled at all — Better Auth defaults `emailAndPassword` to disabled
    // when the option is omitted entirely, but this repo states it
    // explicitly rather than relying on that default staying true across a
    // future Better Auth upgrade (see auth-options.test.ts's regression
    // test asserting `auth.api.signUpEmail` doesn't exist on this config).
    emailAndPassword: {
      enabled: false,
    },
    // #318 Phase 4 item 1 — D1-backed rate limit on the magic-link REQUEST
    // endpoint. REUSES Better Auth's own native `rateLimit` engine rather
    // than hand-rolling a limiter — src/lib/rateLimit.ts's in-process Map
    // limiter is untouched (it covers the three PUBLIC forms only, a
    // separate unauthenticated attack surface with no session/D1 concept).
    //
    // WHY `enabled` is explicit rather than left to the library default:
    // verified in the installed source
    // (node_modules/better-auth/dist/context/create-context.mjs:171) that
    // better-auth's own default is `options.rateLimit?.enabled ?? isProduction`
    // — rate limiting is OFF by default outside `NODE_ENV=production`
    // (node_modules/@better-auth/core/dist/env/env-impl.mjs:30-32, a
    // module-load-time const, not a lazy check). Writing the identical
    // condition here makes "genuinely active in production" a visible,
    // intentional statement in this file instead of an invisible inherited
    // default — behavior is unchanged either way, including in this repo's
    // test suite (vitest's NODE_ENV is "test", so this still resolves
    // false there, same as before this change).
    //
    // WHY `storage: "database"` (never the library's default "memory" or
    // "secondary-storage"): this file's own header WHY forbids Workers
    // KV/secondaryStorage entirely — rate-limit counters must live in D1
    // alongside every other auth table. Verified in
    // node_modules/better-auth/dist/api/rate-limiter/index.mjs's
    // `getRateLimitStorage()`: any storage value other than "memory" or
    // "secondary-storage" falls through to `createDatabaseStorageWrapper(ctx)`,
    // which reads/writes a `rateLimit` model via `ctx.adapter` (D1, same
    // adapter as every other table here). That model's exact shape
    // (`key`/`count`/`lastRequest` fields) is verified in
    // node_modules/@better-auth/core/dist/db/get-tables.mjs's
    // `rateLimitTable` literal — migrations/0004_rate_limit_table.sql adds
    // it (see that file's own header for how its column types/constraints
    // were hand-derived from the same installed source, since the
    // `@better-auth/cli generate` workflow that produced 0003 could not be
    // run this session — no working shell — and needs parent
    // confirmation/regeneration before this lands on remote D1).
    //
    // WHY `customRules["/sign-in/magic-link"]` at 1h/5 (not the magicLink
    // plugin's own baked-in 60s/5 default): verified in
    // node_modules/better-auth/dist/plugins/magic-link/index.mjs:41 that
    // `/sign-in/magic-link` is the exact literal path `signInMagicLink`'s
    // endpoint registers — the same string this file's own
    // `adminAuthAllowlistPlugin` gate already path-matches. That plugin
    // ships its own default rate-limit rule at that identical path (window
    // 60s/max 5 — magic-link/index.mjs:157-163), but
    // node_modules/better-auth/dist/api/rate-limiter/index.mjs's
    // `resolveRateLimitConfig()` resolves top-level `customRules` LAST —
    // after the library's built-in `/sign-in*` special rule and after any
    // plugin-contributed rule — so this exact-string entry reliably
    // overrides the plugin's shorter window rather than racing it. 3600s/5
    // mirrors src/lib/rateLimit.ts's own public-form threshold
    // (`RATE_LIMIT_MAX = 5`, 1h window) for a consistent posture across
    // every request-a-link surface this app exposes.
    //
    // NOT a landmine for adminAuthAllowlistPlugin.test.ts's real
    // magic-link integration tests: verified in
    // node_modules/better-auth/dist/api/index.mjs's `router()` that rate
    // limiting is wired into the ROUTER's `onRequest` hook only (invoked
    // by `auth.handler(request)`, the real HTTP entry point) — every call
    // in that test file is a direct `auth.api.signInMagicLink(...)` call,
    // which invokes the endpoint function directly and never passes
    // through the router's `onRequest` at all. Real traffic through
    // src/app/api/auth/[...all]/route.ts's `toNextJsHandler()` DOES go
    // through `auth.handler`, so production requests are genuinely gated —
    // but this repo's existing test suite needs no `rateLimit` table
    // either way and is unaffected by this change.
    rateLimit: {
      enabled: process.env.NODE_ENV === "production",
      storage: "database",
      customRules: {
        "/sign-in/magic-link": { window: 3600, max: 5 },
      },
    },
    // #318 Phase 4 item 5 — short-lived session for this single
    // high-privilege admin account, replacing Better Auth's 7-day default
    // (node_modules/@better-auth/core/dist/types/init-options.d.mts:801,
    // `@default 7 days`).
    //
    // WHY 12h `expiresIn` + 1h `updateAge`, ROLLING (not absolute):
    // verified in node_modules/better-auth/dist/api/routes/session.mjs:203-238
    // that a session refreshes — `expiresAt` is recomputed as
    // `now + expiresIn` — once less than `updateAge` remains before it
    // would expire (`shouldBeUpdated = expiresAt - expiresIn*1000 +
    // updateAge*1000 <= now`), and that this refresh is a real DB write
    // (`internalAdapter.updateSession`) gated by that check specifically
    // so an active session doesn't rewrite its row on every single
    // request — only roughly once per `updateAge` window. 12h/1h means an
    // idle admin session dies within 12h of its last activity, and a
    // continuously active one is re-checked/extended at most once an hour.
    //
    // WHY no separate hard-absolute-cap on top of this: the only
    // mechanism 1.6.23 exposes that touches this is
    // `disableSessionRefresh` (same init-options.d.mts, lines ~811-817;
    // behavior confirmed in the session.mjs refresh check above via its
    // `disableRefresh` short-circuit) — but that option does not ADD an
    // absolute ceiling alongside the rolling window above; it REPLACES the
    // rolling behavior outright, since disabling refresh means
    // `expiresAt` (set once at sign-in) is never recomputed, silently
    // turning `expiresIn` itself into a fixed lifetime from creation with
    // no idle-based extension at all. That's not "compose simply" with
    // the rolling/idle design this task also asks for (an `updateAge` that
    // meaningfully avoids rewriting on every request) — it's a binary
    // trade-off between the two, not an additive second cap. No other
    // absolute-cap option exists in this version (confirmed by reading the
    // full `session` block of init-options.d.mts, lines 797-924 — only
    // `expiresIn`, `updateAge`, `disableSessionRefresh`, the unrelated
    // cookie-cache block, and `freshAge` — a distinct "is this session
    // fresh enough for a sensitive re-auth-gated action" check, not a
    // session lifetime control). Per this task's own explicit fallback:
    // the 12h rolling window above is the accepted floor, not a
    // deliberately incomplete implementation.
    session: {
      expiresIn: 60 * 60 * 12, // 12h, rolling
      updateAge: 60 * 60, // 1h — refresh cadence, not a rewrite-every-request
    },
    // Phase 3 dual-auth — the session cookie MUST carry the `__Host-`
    // prefix: browsers silently DROP a cookie whose name claims that
    // prefix without also satisfying its invariants (Secure, Path=/, no
    // Domain attribute), turning a config typo into an invisible "login
    // never sticks" loop rather than a visible error. Verified against the
    // installed better-auth source
    // (node_modules/better-auth/dist/cookies/index.mjs, createCookieGetter):
    // the final cookie name is `${secureCookiePrefix}${customName ||
    // prefix + "." + cookieName}` — so leaving `useSecureCookies` at its
    // default (true in production) would prepend better-auth's OWN
    // `__Secure-` prefix ahead of our `__Host-` name below, producing the
    // malformed `__Secure-__Host-session_token` and silently breaking
    // login. Setting `useSecureCookies: false` here suppresses that
    // auto-prefixing; `attributes.secure: true` (merged in LAST by that
    // same function, after every other default) restores the Secure flag
    // by hand so the `__Host-` invariant still holds. `path` defaults to
    // "/" and no `crossSubDomainCookies` is configured anywhere in this
    // file, so no `Domain` attribute is ever attached — the third
    // `__Host-` invariant is satisfied by simply never opting in.
    // auth-options.test.ts asserts the exact resolved name/attributes via
    // better-auth's own `getCookies()` helper; a true end-to-end browser
    // check still happens at Kyle's live preview (Phase 3 report).
    advanced: {
      useSecureCookies: false,
      cookies: {
        session_token: {
          name: "__Host-session_token",
          attributes: { secure: true },
        },
      },
    },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await sendAdminMagicLinkEmail({ email, url });
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
        // Require user-verification (PIN/biometric on the authenticator,
        // not just its mere presence) on every passkey ceremony — #315
        // explicitly asks for this; Better Auth's default is `"preferred"`,
        // which would let an authenticator skip it.
        authenticatorSelection: {
          userVerification: "required",
        },
      }),
      // #315 CRITICAL — must be the LAST plugin in this array. Better
      // Auth's plugin hooks all run in registration order (dispatch.mjs's
      // `getHooks()` flatMaps each plugin's `hooks.before` in array order),
      // and this plugin's magic-link gate must run before magicLink's own
      // endpoint executes regardless of where magicLink itself sits in this
      // list — but placing it last keeps the ordering trivially correct by
      // inspection: every other plugin's endpoints exist by the time this
      // one's path-matched hooks are added, so there's no risk of this
      // plugin matching a path a not-yet-registered plugin would also claim.
      adminAuthAllowlistPlugin(),
    ],
    // Phase 3 dual-auth observability — the sibling of adminAuthAllowlistPlugin's
    // own databaseHooks.user.create.before (that plugin's own file header):
    // BOTH a plugin's databaseHooks AND this top-level databaseHooks are
    // collected and run for the same lifecycle point (verified in the
    // installed better-auth source, node_modules/better-auth/dist/context/
    // create-context.mjs + context/helpers.mjs, which push() each of them
    // into one shared `dbHooks` array), so this doesn't conflict with or
    // replace that plugin's own hook — it's an independent addition at a
    // different lifecycle point (session creation, not user creation).
    // logAdminAuthEvent("login") (src/lib/logger.ts) is PII-free by design
    // (a fixed event label, never the session's email/token/id) — durable
    // per-login detail (timestamp, IP, user-agent) already lives in Better
    // Auth's own `session` table; this line only makes a login ALSO visible
    // in Cloudflare Workers Logs search, mirroring admin_auth_failure.
    databaseHooks: {
      session: {
        create: {
          after: async () => {
            logAdminAuthEvent("login");
          },
        },
      },
    },
  } satisfies BetterAuthOptions;
}
