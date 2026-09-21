/**
 * POST /api/public/alerts/resubscribe — the "that was a mistake, turn it
 * back on" undo button on /alerts/stop (Blessing Boxes slice 6). Mirrors
 * ./stop/route.ts exactly, one function swapped
 * (resubscribeByToken/src/lib/boxAlerts.ts) — see that file's own header
 * for why re-subscribing skips re-confirming the email (they already
 * proved the address once).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
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
