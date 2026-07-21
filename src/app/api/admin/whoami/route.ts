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
  try {
    const { identity } = await getAdminDb(req.headers);
    return NextResponse.json({ email: identity.email });
  } catch (err) {
    return adminAuthErrorResponse(err);
  }
}
