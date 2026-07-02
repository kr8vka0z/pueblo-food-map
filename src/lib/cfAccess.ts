/**
 * cfAccess.ts — Cloudflare Access JWT verifier for the admin surface
 * (#237 checkpoint c).
 *
 * WHY in-app verification is required even though Cloudflare Access already
 * gates admin.pueblofoodmap.com at the edge: this Worker also answers on
 * hostnames an Access policy scoped to that one subdomain does NOT cover —
 * the bare `*.workers.dev` fallback URL, every Workers version-preview URL,
 * and (since the admin routes ship in the SAME Worker as the public app,
 * spec §3.4) the public apex pueblofoodmap.com/admin itself. Access is
 * scoped by hostname; none of those three are automatically protected.
 * requireAccessIdentity() re-verifies the `Cf-Access-Jwt-Assertion` header's
 * signature/issuer/audience/expiry against Cloudflare's own JWKS on every
 * request, so a request to any of those three hostnames still fails unless
 * it carries a real, current Access token — signing one requires
 * Cloudflare's private key, which an attacker hitting a bypass hostname
 * does not have. See docs/admin/cloudflare-native-admin-spec.md §3.1, §8.
 */

import { jwtVerify, createRemoteJWKSet, type JWTVerifyGetKey } from "jose";

export type AccessDeniedReason =
  | "missing_assertion"
  | "invalid_token"
  | "no_email_claim"
  | "misconfigured";

/**
 * Thrown by requireAccessIdentity() (and, transitively, getAdminDb()) on any
 * auth failure. `reason` is a coarse, machine-readable, PII-free
 * classification — safe to pass to logAdminAuthFailure() (src/lib/logger.ts)
 * for Cloudflare Workers Logs filtering. Never carries token contents or
 * claim values.
 */
export class AccessDeniedError extends Error {
  readonly reason: AccessDeniedReason;

  constructor(reason: AccessDeniedReason, message?: string) {
    super(message ?? `Cloudflare Access denied: ${reason}`);
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
 * /api/admin/* route handlers (spec §3.1).
 */
export interface HeaderSource {
  get(name: string): string | null;
}

const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";
const JWKS_PATH = "/cdn-cgi/access/certs";

// Resolves a team domain to a JWTVerifyGetKey. Swappable for tests — see
// _setJwksGetterForTest below.
type JwksGetter = (teamDomain: string) => JWTVerifyGetKey;

// Builds the default resolver: a lazily-created, memoized remote JWKS.
//
// WHY lazy, never built at module scope: the spec's own illustrative
// skeleton (docs/admin/cloudflare-native-admin-spec.md §3.1) constructs
// `createRemoteJWKSet(new URL(...))` at import time. But CF_ACCESS_TEAM_DOMAIN
// is unset in dev, in tests, in CI, and in this very checkpoint's own deploy
// (Kyle sets it only after creating the live Access application in the CF
// dashboard — a step deliberately out of scope here). `new URL(undefined +
// "/cdn-cgi/access/certs")` would throw the instant this module is
// imported — before any caller reaches the fail-closed branch below, and
// before any test file could even load it. Building the JWKS lazily, inside
// the function that already checks for a configured team domain, turns that
// import-time crash into an ordinary call-time AccessDeniedError, and gives
// cfAccess.test.ts a seam to inject a fully offline JWKS (see
// _setJwksGetterForTest) instead of hitting Cloudflare's real endpoint.
function defaultJwksGetter(): JwksGetter {
  let cached: { domain: string; keySet: JWTVerifyGetKey } | null = null;
  return (teamDomain: string) => {
    if (cached?.domain !== teamDomain) {
      cached = {
        domain: teamDomain,
        keySet: createRemoteJWKSet(new URL(`${teamDomain}${JWKS_PATH}`)),
      };
    }
    return cached.keySet;
  };
}

let jwksGetter: JwksGetter = defaultJwksGetter();

/**
 * Test-only seam: replace the JWKS resolver with a fake — e.g.
 * `jose.createLocalJWKSet()` built from an in-memory RSA keypair — so
 * cfAccess.test.ts can sign and verify a real JWT with zero network calls to
 * Cloudflare's real certs endpoint. Pass `null` to restore the default lazy
 * remote resolver. Not used by any production code path.
 */
export function _setJwksGetterForTest(getter: JwksGetter | null): void {
  jwksGetter = getter ?? defaultJwksGetter();
}

/**
 * Verifies the `Cf-Access-Jwt-Assertion` header against Cloudflare Access's
 * JWKS (signature, issuer, audience, expiry) and returns the caller's
 * verified email. Throws AccessDeniedError — and never returns a "denied but
 * still an identity" value — on every failure path, including
 * misconfiguration, so callers cannot accidentally fall through to treating
 * a denial as success.
 */
export async function requireAccessIdentity(
  headers: HeaderSource,
): Promise<AdminIdentity> {
  const token = headers.get(ACCESS_JWT_HEADER);
  if (!token) throw new AccessDeniedError("missing_assertion");

  const teamDomain = process.env.CF_ACCESS_TEAM_DOMAIN;
  const audience = process.env.CF_ACCESS_AUD;
  // Fail closed: an unset env var must never be treated as "trust any
  // issuer" / "no audience restriction". Kyle populates these only after
  // creating the live CF Access application — until then, every request
  // (including a technically well-formed but unrelated JWT) is denied.
  if (!teamDomain || !audience) {
    throw new AccessDeniedError("misconfigured");
  }

  let email: unknown;
  try {
    const keySet = jwksGetter(teamDomain);
    const { payload } = await jwtVerify(token, keySet, {
      issuer: teamDomain,
      audience,
    });
    email = payload.email;
  } catch (err) {
    if (err instanceof AccessDeniedError) throw err;
    // Bad signature, wrong issuer, wrong audience, expired token, or a
    // malformed JWT all land here as a jose verification error — collapsed
    // to one reason because none of these should leak claim contents into
    // logs, and the distinction has no operational value to an admin
    // reading Workers Logs (every one of them means "reject this request").
    throw new AccessDeniedError("invalid_token");
  }

  if (typeof email !== "string" || email.length === 0) {
    throw new AccessDeniedError("no_email_claim");
  }
  return { email };
}
