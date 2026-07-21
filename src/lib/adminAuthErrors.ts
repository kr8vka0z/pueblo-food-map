/**
 * adminAuthErrors.ts — shared AccessDeniedError catch-block handling for
 * every /admin/** page and /api/admin/** route handler (Phase 3 dual-auth
 * redirect-vs-403 split).
 *
 * WHY split by reason instead of one blanket denial: `"no_session"` means
 * the caller's Cloudflare Access JWT is fine but no Better Auth session
 * exists yet (src/lib/adminSession.ts) — the caller CAN fix this by signing
 * in at /admin/login, so a page redirects there instead of dead-ending on a
 * 403 with no obvious next step, and a route handler returns 401
 * (Unauthorized — "log in and retry") rather than 403 (Forbidden — "you
 * will never be let in"). Every OTHER AccessDeniedError reason (a real CF
 * Access denial, or the Phase 3 `"not_allowlisted"` defense-in-depth check)
 * still fails closed exactly as it did before Phase 3: forbidden()/403 on
 * pages, 403 on route handlers.
 *
 * WHY one shared function per surface instead of duplicating this branch
 * into every call site: five admin pages and seven /api/admin/* route
 * handlers each had the pre-Phase-3 version of this exact if/else copied
 * into their own catch block — a single change point means the
 * redirect-vs-403 rule can never drift between call sites (the same reason
 * getAdminDb() itself is a single choke point — see that file's header).
 */

import { redirect, forbidden } from "next/navigation";
import { NextResponse } from "next/server";
import { AccessDeniedError } from "./cfAccess";
import { logAdminAuthFailure } from "./logger";

/**
 * Server Component page catch-block handler. Always throws — redirect() and
 * forbidden() are both Next.js control-flow signals that throw internally
 * to unwind to the nearest boundary — or re-throws the original error when
 * it isn't an AccessDeniedError, so an unexpected error is never swallowed.
 */
export function handlePageAuthError(err: unknown): never {
  if (err instanceof AccessDeniedError) {
    logAdminAuthFailure(err.reason);
    if (err.reason === "no_session") {
      redirect("/admin/login");
    }
    forbidden();
  }
  throw err;
}

/**
 * Route handler catch-block handler. Returns the Response to send for an
 * AccessDeniedError; re-throws anything else so an unexpected error still
 * surfaces as Next's own 500 rather than being mapped to a misleading auth
 * response.
 */
export function adminAuthErrorResponse(err: unknown): Response {
  if (err instanceof AccessDeniedError) {
    logAdminAuthFailure(err.reason);
    if (err.reason === "no_session") {
      return NextResponse.json({ error: "no_session" }, { status: 401 });
    }
    return new Response("Forbidden", { status: 403 });
  }
  throw err;
}
