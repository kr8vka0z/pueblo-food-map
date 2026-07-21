/**
 * cfAccess.ts — CSRF defense + shared admin-auth types, post-Cloudflare-Access
 * cutover (auth/betterauth-sole-gate).
 *
 * WHY this file keeps its name despite no longer verifying a Cloudflare
 * Access JWT: `requireAdminOrigin()` (the CSRF check below), `AccessDeniedError`,
 * `AccessDeniedReason`, `AdminIdentity`, and `HeaderSource` are imported
 * project-wide (adminDb.ts, adminSession.ts, adminAuthErrors.ts, every
 * /api/admin/* route, every /admin/** page). Renaming the module is a bigger,
 * unrelated diff than this cutover's scope — the name is now a historical
 * label, not a description of what runs here.
 *
 * WHAT USED TO LIVE HERE: `requireAccessIdentity()` verified the
 * `Cf-Access-Jwt-Assertion` header against Cloudflare's JWKS (jose's
 * `jwtVerify`, signature/issuer/audience/expiry) as a second, in-app layer on
 * top of the edge-level Access application gating `/admin*` +
 * `/api/admin*`. Kyle cut the admin surface over to Better Auth as the SOLE
 * identity gate (the Cloudflare Access application itself is removed from
 * infrastructure in the same change) — `getAdminDb()` (adminDb.ts) now calls
 * only `requireAdminSession()` (adminSession.ts). Grep git history for
 * `requireAccessIdentity` if the JWKS-verification code is ever needed again
 * (e.g. bench a hostname without Better Auth's own baseURL coverage) — it is
 * NOT restored here; the removed helper's fail-closed reasons
 * (`missing_assertion` / `invalid_token` / `no_email_claim` / `misconfigured`)
 * are gone from `AccessDeniedReason` below along with it, since nothing in
 * this codebase throws them anymore.
 */

export type AccessDeniedReason =
  | "bad_origin"
  // No live Better Auth session exists for this caller (adminSession.ts) —
  // the one case that gets a different HTTP treatment than every other
  // denial: a page redirects to /admin/login, a route handler returns 401
  // instead of 403 (see adminAuthErrors.ts).
  | "no_session"
  // A live Better Auth session exists, but its email isn't on the admin
  // allowlist (defense-in-depth — see adminSession.ts and
  // adminAuthAllowlistPlugin.ts, which already blocks this at sign-in time).
  | "not_allowlisted";

/**
 * Thrown by requireAdminOrigin() below and by requireAdminSession()
 * (adminSession.ts) — the two checks getAdminDb() (adminDb.ts) composes into
 * one fail-closed gate. `reason` is a coarse, machine-readable, PII-free
 * classification — safe to pass to logAdminAuthFailure() (src/lib/logger.ts)
 * for Cloudflare Workers Logs filtering. Never carries token or session
 * contents.
 */
export class AccessDeniedError extends Error {
  readonly reason: AccessDeniedReason;

  constructor(reason: AccessDeniedReason, message?: string) {
    super(message ?? `Admin access denied: ${reason}`);
    this.name = "AccessDeniedError";
    this.reason = reason;
  }
}

export interface AdminIdentity {
  email: string;
}

/**
 * Anything with a Headers-like `.get()`. Both a route handler's
 * `Request.headers` and a Server Component's `next/headers` `headers()`
 * result satisfy this, so one function covers both /admin/* pages and
 * /api/admin/* route handlers.
 */
export interface HeaderSource {
  get(name: string): string | null;
}

/**
 * The admin UI's own origins — the only origins a legitimate, browser-issued
 * /api/admin/* mutation can arrive from. Admin serves at the apex `/admin`
 * path (prod pueblofoodmap.com, staging dev.pueblofoodmap.com). Used by
 * requireAdminOrigin() below.
 */
export const ADMIN_ORIGINS = [
  "https://pueblofoodmap.com", // prod apex — admin served at /admin
  "https://dev.pueblofoodmap.com", // staging apex — admin served at /admin
] as const;

/**
 * CSRF defense for non-GET /api/admin/* mutations (spec §8, "I7") —
 * independent of, and unaffected by, the Cloudflare Access cutover above.
 *
 * WHY needed on top of the Better Auth session check: the session cookie is
 * ambient — a browser attaches it automatically to same-site requests, so an
 * authenticated admin's browser could be tricked into firing a cross-site
 * mutating request without their intent. requireAdminSession() proves the
 * CALLER holds a valid session; it says nothing about WHERE the request
 * originated. This is a second, independent layer: every non-GET
 * /api/admin/* handler EXCEPT /api/admin/refresh/ingest must additionally
 * call this before mutating. (refresh/ingest does not exist in this repo yet
 * — the spec reserves it for a future GitHub-Actions-triggered ingest route
 * authenticated by its own bearer token, never a browser, so CSRF wouldn't
 * apply there either way.)
 *
 * Throws the SAME AccessDeniedError used by requireAdminSession() (new
 * reason: "bad_origin") so every /api/admin/* route handler can share one
 * catch block and one 403 response shape regardless of which check failed.
 */
export function requireAdminOrigin(headers: HeaderSource): void {
  const origin = headers.get("Origin");
  if (!origin || !(ADMIN_ORIGINS as readonly string[]).includes(origin)) {
    throw new AccessDeniedError("bad_origin");
  }
}
