/**
 * GET /api/admin/whoami — probe route proving the Cloudflare Access +
 * getAdminDb() auth chain at the route-handler layer (#237 checkpoint c).
 *
 * A route handler gets a fresh Request on every call, so — unlike a Server
 * Component page under a layout — there's no client-navigation gap to worry
 * about here (see src/lib/adminDb.ts "I2" for that gap). This route
 * demonstrates the OTHER standard 403 shape: route handlers have no
 * forbidden()/forbidden.tsx equivalent, so on AccessDeniedError this returns
 * an explicit 403 Response directly instead of the page's forbidden()
 * control-flow call.
 *
 * WHY force-dynamic: without it, Next may statically optimize a GET handler
 * that reads no dynamic Next API (this route reads req.headers directly,
 * not next/headers' headers()) — caching either a 200 with someone's email
 * or a 403 would both be wrong on every subsequent request regardless of
 * caller. This must evaluate fresh every time.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/adminDb";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";
import { getAuth } from "@/lib/auth";
import { getAdminAllowlist } from "@/lib/adminAllowlist";

export const dynamic = "force-dynamic";

// TEMP DIAGNOSTIC (fix/admin-session-dynamic-baseurl-host) — REVERT after use.
// Returns the raw auth.api.getSession() shape for a request, so we can see on
// LIVE staging what a cookieless call actually resolves to (phantom session?
// throw? null?). Gated behind a token + the staging host so it is inert for
// any normal caller; touches no D1, mutates nothing.
async function whoamiDiagnostic(req: NextRequest): Promise<Response> {
  const forwarded = new Headers();
  const cookie = req.headers.get("cookie");
  if (cookie) forwarded.set("cookie", cookie);
  const host = req.headers.get("host");
  if (host) forwarded.set("host", host);
  const xfh = req.headers.get("x-forwarded-host");
  if (xfh) forwarded.set("x-forwarded-host", xfh);

  const diag: Record<string, unknown> = {
    forwardedHeaderKeys: [...forwarded.keys()],
    incomingHost: host ?? null,
    incomingXForwardedHost: xfh ?? null,
    hasCookieHeader: cookie != null,
    betterAuthSecretPresent: !!process.env.BETTER_AUTH_SECRET,
    adminAllowlistEnv: process.env.ADMIN_ALLOWLIST ?? null,
    resolvedAllowlist: getAdminAllowlist(),
  };

  try {
    const auth = await getAuth();
    const result = await auth.api.getSession({ headers: forwarded });
    diag.getSession = {
      resultIsNull: result == null,
      resultType: typeof result,
      resultKeys: result ? Object.keys(result as object) : null,
      userPresent: !!(result as { user?: unknown } | null)?.user,
      userEmail:
        (result as { user?: { email?: string } } | null)?.user?.email ?? null,
      sessionKeys: (result as { session?: object } | null)?.session
        ? Object.keys(
            (result as { session: object }).session as Record<string, unknown>,
          )
        : null,
    };
  } catch (err) {
    diag.getSession = {
      threw: true,
      errorName: err instanceof Error ? err.name : typeof err,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }

  return NextResponse.json(diag, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(req: NextRequest): Promise<Response> {
  // TEMP DIAGNOSTIC branch — REVERT. Token-only gate (staging is single-user,
  // token-gated, reads no D1) — the observed host is echoed in the payload.
  if (new URL(req.url).searchParams.get("diag") === "pfmdiag2026") {
    return whoamiDiagnostic(req);
  }

  try {
    const { identity } = await getAdminDb(req.headers);
    return NextResponse.json({ email: identity.email });
  } catch (err) {
    return adminAuthErrorResponse(err);
  }
}
