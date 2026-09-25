/**
 * adminSession.ts — the admin identity gate: proves the caller holds a live
 * Better Auth session for an allowlisted admin. Since the Better Auth
 * sole-gate cutover (on production since promotion #551), this is the ONLY
 * identity check — Cloudflare Access and its JWT verifier
 * (requireAccessIdentity(), formerly in cfAccess.ts, now adminOrigin.ts) are
 * gone. getAdminDb() (adminDb.ts) calls requireAdminSession() before handing
 * back ADMIN_DB; see that file's header and AGENTS.md "Admin
 * authentication". (This module began as "Better Auth Phase 3", layered
 * on top of Cloudflare Access; that dual gate no longer exists.)
 *
 * WHY re-check the allowlist here even though adminAuthAllowlistPlugin.ts
 * (auth-options.ts) already blocks a non-allowlisted email from ever signing
 * in or minting a session: defense-in-depth against a future Better Auth
 * config regression or a session-creating path this repo adds later that
 * doesn't route through that plugin's hooks — the same "belt and
 * suspenders" reasoning that plugin's own databaseHooks.user.create.before
 * already applies to persisted user rows (see that file's header).
 *
 * WHY `headers` is typed HeaderSource (matching adminOrigin.ts), not the
 * stricter `Headers` `auth.api.getSession()` itself expects: every REAL
 * caller (a Server Component's `await headers()`, or a route handler's
 * `req.headers`) already is a genuine Headers-compatible object, but this
 * repo's existing auth tests (adminOrigin.test.ts, adminDb.test.ts) inject a
 * minimal `{ get() }` mock that only satisfies HeaderSource — widening every
 * one of those call sites to a full Headers just to satisfy this one new
 * function would ripple well outside this slice. This builds a minimal real
 * Headers object out of the specific fields below, satisfying getSession()'s
 * actual `HeadersInit` requirement without widening HeaderSource itself.
 *
 * WHY `host` / `x-forwarded-host` are ALSO forwarded, not just `cookie`
 * (fixed post-cutover — live 403 bug, admin/session-dynamic-baseurl-host):
 * `auth-options.ts`'s `baseURL` is a DYNAMIC object (`{ allowedHosts,
 * protocol }`, no static string), a legitimate Better Auth multi-host
 * config. Verified in the installed better-auth source
 * (node_modules/better-auth/dist/api/to-auth-endpoints.mjs's
 * `resolveDynamicContext` -> node_modules/better-auth/dist/context/
 * helpers.mjs's `pickSource`): with a dynamic baseURL, EVERY direct
 * `auth.api.*` call (not just this one) must resolve a per-request base URL
 * from a `host`/`x-forwarded-host` header on the `Headers` it's given, or
 * from `baseURL.fallback` if the config sets one. This function previously
 * forwarded only `cookie` — correct for STATIC baseURL configs, wrong for
 * this dynamic one, and the gap was invisible in tests because Better
 * Auth's real HTTP dispatch (the `/api/auth/*` route) carries the actual
 * `Host` header through automatically; only this DIRECT `auth.api.getSession`
 * call path lacked it. A cookieless caller with no `host` header still
 * resolves fine via `auth-options.ts`'s new `baseURL.fallback` — this fix
 * and that one are belt-and-suspenders, not alternatives.
 */

import { getAuth } from "./auth";
import { isAllowlistedEmail } from "./adminAllowlist";
import {
  AccessDeniedError,
  type AdminIdentity,
  type HeaderSource,
} from "./adminOrigin";

/**
 * Verifies the caller holds a live, allowlisted Better Auth session. Throws
 * AccessDeniedError("no_session") when no session exists (the caller should
 * be sent to /admin/login — see src/lib/adminAuthErrors.ts), or
 * AccessDeniedError("not_allowlisted") when a session exists for an email
 * that isn't on the allowlist (defense-in-depth, see file header).
 */
export async function requireAdminSession(
  headers: HeaderSource,
): Promise<AdminIdentity> {
  const auth = await getAuth();
  const forwarded = new Headers();
  const cookie = headers.get("cookie");
  if (cookie) forwarded.set("cookie", cookie);
  const host = headers.get("host");
  if (host) forwarded.set("host", host);
  const forwardedHost = headers.get("x-forwarded-host");
  if (forwardedHost) forwarded.set("x-forwarded-host", forwardedHost);

  const result = await auth.api.getSession({ headers: forwarded });

  if (!result?.user?.email) {
    throw new AccessDeniedError("no_session");
  }
  if (!isAllowlistedEmail(result.user.email)) {
    throw new AccessDeniedError("not_allowlisted");
  }
  return { email: result.user.email };
}
