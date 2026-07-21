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

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  // TEMP DIAGNOSTIC (token-gated; REMOVE before merge to main) — dumps the raw
  // shape of what server-side auth.api.getSession() returns for the CALLER, to
  // find why a cookieless request hits the not_allowlisted branch instead of
  // no_session. Token-gated so it never leaks internal shape to public traffic.
  if (req.nextUrl.searchParams.get("diag") === "pfm-probe-9f3a") {
    const { getAuth } = await import("@/lib/auth");
    const { getAdminAllowlist } = await import("@/lib/adminAllowlist");
    const out: Record<string, unknown> = {};
    try {
      const auth = await getAuth();
      const cookie = req.headers.get("cookie") ?? "";
      out.cookieLen = cookie.length;
      const result = await auth.api.getSession({
        headers: new Headers({ cookie }),
      });
      out.sessionNull = result === null;
      const email = (result as { user?: { email?: string } } | null)?.user
        ?.email;
      out.hasEmail = Boolean(email);
      out.emailDomain =
        typeof email === "string" ? (email.split("@")[1] ?? null) : null;
      const allow = getAdminAllowlist();
      out.allowlistLen = allow.length;
      out.isAllowlisted =
        typeof email === "string"
          ? allow
              .map((a) => a.toLowerCase())
              .includes(email.trim().toLowerCase())
          : null;
      out.resultKeys = result ? Object.keys(result as object) : null;
      out.userKeys = (result as { user?: object } | null)?.user
        ? Object.keys((result as { user: object }).user)
        : null;
    } catch (e) {
      out.threw = true;
      out.errName = (e as Error)?.name ?? "unknown";
      out.errMsg = String((e as Error)?.message).slice(0, 300);
    }
    return NextResponse.json(out);
  }
  try {
    const { identity } = await getAdminDb(req.headers);
    return NextResponse.json({ email: identity.email });
  } catch (err) {
    return adminAuthErrorResponse(err);
  }
}
