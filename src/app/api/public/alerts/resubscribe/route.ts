/**
 * POST /api/public/alerts/resubscribe — the "that was a mistake, turn it
 * back on" undo button on /alerts/stop (Blessing Boxes slice 6). Shares
 * ./stop/route.ts's neutral folding of not_found/rate_limited into one
 * "invalid_token" answer, but is JSON-only (a non-JSON Content-Type is a
 * 400, the token is read only from the body's `token`, no HTML response),
 * because its only caller is AlertsStopContent's undo button; stop also
 * serves mail-client one-click POSTs and the <noscript> form. See
 * resubscribeByToken in src/lib/boxAlerts.ts for why re-subscribing skips
 * re-confirming the email (they already proved the address once).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@/lib/cloudflareContext";
import { resubscribeByToken } from "@/lib/boxAlerts";

export const dynamic = "force-dynamic";

interface ResubscribePayload {
  token?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  let body: ResubscribePayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 200 });
  }

  const rateLimitSecret = process.env.CHECKIN_RATE_LIMIT_SECRET;
  if (!rateLimitSecret) {
    throw new Error("CHECKIN_RATE_LIMIT_SECRET not configured");
  }

  let db: D1Database;
  try {
    ({ env: { ADMIN_DB: db } } = getCloudflareContext());
  } catch {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }

  const result = await resubscribeByToken(db, token, rateLimitSecret);
  // Same neutral folding as ./stop/route.ts — see stopSubscriptionByToken's
  // header in boxAlerts.ts for why "rate_limited" must read identically to
  // "not_found" from the outside.
  if (result === "not_found" || result === "rate_limited") {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 200 });
  }
  return NextResponse.json({ ok: true });
}
