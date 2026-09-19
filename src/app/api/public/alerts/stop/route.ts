/**
 * POST /api/public/alerts/stop — the mutation half of /alerts/stop
 * (Blessing Boxes slice 6). Split from the page for the same reason
 * /api/public/alerts/confirm is split from /alerts/confirm: a GET on the
 * page must never mutate (mail scanners prefetch links), so the page
 * renders a plain button that POSTs here.
 *
 * Thin wrapper over src/lib/boxAlerts.ts's stopSubscriptionByToken(), which
 * already owns the rate limit (scope "alert-token", via the existing
 * CHECKIN_RATE_LIMIT_SECRET — no new secret) and the actual
 * unsubscribed_at write. "not_found"/an unknown token both collapse to the
 * same neutral response as /alerts/confirm's own token lookup, for the
 * same reason: there is no safe way to distinguish "never existed" from
 * "already used" from the outside.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { stopSubscriptionByToken } from "@/lib/boxAlerts";

export const dynamic = "force-dynamic";

interface StopPayload {
  token?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  let body: StopPayload;
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

  const result = await stopSubscriptionByToken(db, token, rateLimitSecret);
  // "rate_limited" folds into the same neutral outcome as "not_found" —
  // stopSubscriptionByToken's own header: a brute-force attempt against the
  // token space learns nothing either way from the response.
  if (result === "not_found" || result === "rate_limited") {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 200 });
  }
  return NextResponse.json({ ok: true });
}
