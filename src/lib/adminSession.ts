/**
 * adminSession.ts — Better Auth session gate, layered ON TOP OF Cloudflare
 * Access (Phase 3 dual-auth, #316-ish "Better Auth Phase 3"). Cloudflare
 * Access (cfAccess.ts) proves the request carries Cloudflare's own signed
 * edge assertion; this module additionally proves the caller holds a real
 * Better Auth session for an allowlisted admin. getAdminDb() (adminDb.ts)
 * requires BOTH — see that file's header — so reaching ADMIN_DB now needs a
 * valid CF Access JWT AND a valid Better Auth session, never either alone.
 * This is strictly additive to the Phase 2 CF-Access-only gate: nothing here
 * relaxes requireAccessIdentity()'s own checks.
 *
 * WHY re-check the allowlist here even though adminAuthAllowlistPlugin.ts
 * (auth-options.ts) already blocks a non-allowlisted email from ever signing
 * in or minting a session: defense-in-depth against a future Better Auth
 * config regression or a session-creating path this repo adds later that
 * doesn't route through that plugin's hooks — the same "belt and
 * suspenders" reasoning that plugin's own databaseHooks.user.create.before
 * already applies to persisted user rows (see that file's header).
 *
 * WHY `headers` is typed HeaderSource (matching cfAccess.ts), not the
 * stricter `Headers` `auth.api.getSession()` itself expects: every REAL
 * caller (a Server Component's `await headers()`, or a route handler's
 * `req.headers`) already is a genuine Headers-compatible object, but this
 * repo's existing auth tests (cfAccess.test.ts, adminDb.test.ts) inject a
 * minimal `{ get() }` mock that only satisfies HeaderSource — widening every
 * one of those call sites to a full Headers just to satisfy this one new
 * function would ripple well outside this slice. Verified in the installed
 * better-auth source (node_modules/better-auth/dist/cookies/cookie-utils.mjs)
 * that reading an existing session only ever calls `headers.get("cookie")` —
 * no other header is consulted on this path — so this builds a minimal real
 * Headers object carrying just that one value, satisfying getSession()'s
 * actual `HeadersInit` requirement without widening HeaderSource itself.
 */

import { getAuth } from "./auth";
import { isAllowlistedEmail } from "./adminAllowlist";
import {
  AccessDeniedError,
  type AdminIdentity,
  type HeaderSource,
} from "./cfAccess";

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
  const cookie = headers.get("cookie") ?? "";
  const result = await auth.api.getSession({
    headers: new Headers({ cookie }),
  });

  if (!result?.user?.email) {
    throw new AccessDeniedError("no_session");
  }
  if (!isAllowlistedEmail(result.user.email)) {
    throw new AccessDeniedError("not_allowlisted");
  }
  return { email: result.user.email };
}
