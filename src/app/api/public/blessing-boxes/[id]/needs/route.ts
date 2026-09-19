/**
 * POST /api/public/blessing-boxes/[id]/needs — the "What would help you
 * next time?" follow-up write path (migration 0012). Owner-approved mockup
 * v3, Part 2: a visitor taps "I used this box" (unchanged, one tap, saved
 * immediately by the checkins route), and ONLY after that succeeds is this
 * second, optional request offered — attaching a set of need keys (and/or a
 * short typed note) to that exact check-in row.
 *
 * Guard ORDER (reviewer fix pass, 2026-09-19): Content-Type check ->
 * Turnstile (shared box/fallback key logic, src/lib/boxTurnstile.ts —
 * reused, not copied, same "Turnstile via the same box/fallback key logic
 * already in the check-in route" instruction slice 5's photo route already
 * followed) -> honeypot -> field validation -> ownership proof (HMAC) ->
 * rate limit -> write. Field validation and the HMAC check moved AHEAD of
 * rate limiting (they used to sit after it, matching the checkins/photos
 * routes' own order) because both are pure in-memory compute with no D1
 * write of their own — checking them first means a malformed or
 * ownership-failing request can never burn a box's shared 300/hr needs
 * budget (or cost the D1 read+write `checkAndIncrement` itself does) before
 * being rejected. Turnstile/honeypot keep their original position ahead of
 * everything else, same as every sibling public route in this app.
 *
 * Rate limiting mirrors the checkins route's own two-scope, visitor-first
 * shape (src/lib/checkinRateLimit.ts's shared D1 counter, new scope names
 * so this budget is independent of check-ins/photos) — needs is 1:1 with a
 * 'took' check-in (replace-on-repeat, not a new action per tap), so it uses
 * the SAME caps as a check-in itself (6/hr per visitor-per-box, 300/hr per
 * box), not the tighter photo-upload caps.
 *
 * Ownership proof — NOT a stored client-token hash (see
 * src/lib/boxNeedsToken.ts's own header for why): the checkins route mints
 * `needsToken`, an HMAC over (checkinId, clientToken), into its OWN success
 * response; this route recomputes the same HMAC from the client-submitted
 * checkinId + clientToken and compares in constant time. A mismatch is a
 * 403 (wrong device, or a tampered/guessed checkinId), not a 422 — this is
 * an auth failure, not a malformed request.
 *
 * The write is ONE guarded UPDATE, not a SELECT-then-UPDATE: `WHERE id = ?
 * AND venue_id = ? AND kind = 'took' AND created_at >= ?` encodes every
 * constraint the task asks for in a single atomic statement — box-scoping
 * (a checkinId can't be reused across boxes), kind (only 'took' ever gets
 * asked), and the 15-minute attach window (NEEDS_ATTACH_WINDOW_MS) — and
 * `meta.changes === 1` is the one check that tells the caller whether it
 * matched. `SET needs = ?, note = ?` (not `note = COALESCE(?, note)`) is
 * deliberate replace-on-repeat: re-sending the ask for the same checkinId
 * (e.g. a retried request) always overwrites rather than accumulates.
 *
 * `note` reuses 0007's existing box_checkins.note column, its existing
 * length cap (FIELD_LIMITS.BOX_CHECKIN_NOTE), and its existing admin-only
 * visibility (every public read names its columns explicitly and never
 * selects `note` — see migrations/0012's own header for why this widens,
 * not breaks, 0007's original "note is filled/problem only" claim: that
 * claim is about the CHECKINS route's own initial POST, unchanged here).
 *
 * Cache freshness: a successful attach busts GET /api/public/blessing-boxes'
 * edge cache for the current colo, same helper/reasoning the checkins route
 * already uses (bustEdgeCache, src/lib/edgeCache.ts) — the list response
 * embeds `neededFromVisitors`, which this write can change.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { resolveBoxTurnstileKey, verifyBoxTurnstile } from "@/lib/boxTurnstile";
import { checkAndIncrement } from "@/lib/checkinRateLimit";
import { computeNeedsToken, timingSafeEqualHex } from "@/lib/boxNeedsToken";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { logFormFailure } from "@/lib/logger";
import { bustEdgeCache } from "@/lib/edgeCache";
import { parseNeedsField } from "@/lib/blessingBoxes";

export const dynamic = "force-dynamic";

/** Same caps as a check-in itself (checkins/route.ts) — the needs ask is 1:1 with a 'took' check-in (replace-on-repeat), not a distinct per-tap action, so it shares that route's own order-of-magnitude reasoning rather than photos' tighter per-upload caps. */
export const MAX_PER_BOX_PER_HOUR = 300;
export const MAX_PER_VISITOR_PER_BOX_PER_HOUR = 6;

/** How long after a 'took' check-in its needs ask can still be attached — the task's own fallback ("reuse whatever window photo-attach uses, else 15 minutes"); photo-attach (src/app/api/public/blessing-boxes/[id]/photos/route.ts) turned out to have NO time window at all (only a box-match check), so this is a genuinely new constraint, not a mirrored one. */
export const NEEDS_ATTACH_WINDOW_MS = 15 * 60 * 1000;

interface NeedsPayload {
  checkinId?: number;
  needsToken?: string;
  needs?: unknown;
  note?: string;
  /** Honeypot — must be empty string or absent, same convention as every other public form route. */
  website?: string;
  turnstileToken?: string;
  turnstileKey?: string;
  /** Same opaque, non-identifying per-browser token the checkins route reads — used both for the per-visitor rate cap AND, via boxNeedsToken.ts, to recompute/verify needsToken. */
  clientToken?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: boxId } = await params;

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  let body: NeedsPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const ip =
    req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const turnstileKey = resolveBoxTurnstileKey(body.turnstileKey);
  const checkinRateLimitSecret = process.env.CHECKIN_RATE_LIMIT_SECRET;
  if (!checkinRateLimitSecret) {
    throw new Error("CHECKIN_RATE_LIMIT_SECRET not configured");
  }
  const turnstileValid = await verifyBoxTurnstile(body.turnstileToken, turnstileKey, ip);
  if (!turnstileValid) {
    logFormFailure("checkin_needs", "turnstile_failed");
    return NextResponse.json({ ok: false, error: "turnstile_failed" }, { status: 400 });
  }

  if (body.website && body.website.trim() !== "") {
    return NextResponse.json({ ok: true }); // bots think it worked
  }

  // Field validation (reviewer fix pass, 2026-09-19: moved ahead of rate
  // limiting — see this file's own header for why) — shape only, no D1
  // involved yet.
  const checkinId = body.checkinId;
  if (typeof checkinId !== "number" || !Number.isInteger(checkinId) || checkinId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid checkinId" }, { status: 422 });
  }

  if (typeof body.needsToken !== "string" || body.needsToken === "") {
    return NextResponse.json({ ok: false, error: "Invalid needsToken" }, { status: 422 });
  }

  const parsedNeeds = parseNeedsField(body.needs);
  if (!parsedNeeds.ok) {
    return NextResponse.json({ ok: false, error: "invalid_need_key" }, { status: 400 });
  }

  let note: string | null = null;
  if (typeof body.note === "string" && body.note.trim() !== "") {
    const trimmed = body.note.trim();
    if (trimmed.length > FIELD_LIMITS.BOX_CHECKIN_NOTE) {
      return NextResponse.json(
        { ok: false, error: `Note must be ${FIELD_LIMITS.BOX_CHECKIN_NOTE} characters or fewer` },
        { status: 422 },
      );
    }
    note = trimmed;
  }

  // Ownership proof — recompute the SAME HMAC the checkins route minted and
  // compare in constant time. See boxNeedsToken.ts's own header for why
  // this is a stateless capability rather than a stored correlator. Pure
  // compute, no D1 — runs before rate limiting/the write for the same
  // reason field validation above does.
  const clientToken = typeof body.clientToken === "string" ? body.clientToken.slice(0, 200) : null;
  const expectedToken = await computeNeedsToken(checkinRateLimitSecret, checkinId, clientToken);
  if (!timingSafeEqualHex(expectedToken, body.needsToken)) {
    return NextResponse.json({ ok: false, error: "invalid_needs_token" }, { status: 403 });
  }

  let db: D1Database;
  try {
    ({ env: { ADMIN_DB: db } } = getCloudflareContext());
  } catch {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }

  // Visitor cap first, box cap second — same reasoning as the checkins
  // route's own header ("WHY the visitor cap is checked BEFORE the box
  // cap"): an over-tapping visitor must never burn the shared box-wide
  // budget on their own rejected attempts.
  if (clientToken) {
    const visitorCap = await checkAndIncrement(
      db,
      checkinRateLimitSecret,
      { scope: "needs-visitor-box", id: `${clientToken}:${boxId}` },
      MAX_PER_VISITOR_PER_BOX_PER_HOUR,
    );
    if (!visitorCap) {
      return NextResponse.json({ ok: false, error: "rate_limit_visitor" }, { status: 429 });
    }
  }
  const boxCap = await checkAndIncrement(
    db,
    checkinRateLimitSecret,
    { scope: "needs-box", id: boxId },
    MAX_PER_BOX_PER_HOUR,
  );
  if (!boxCap) {
    return NextResponse.json({ ok: false, error: "rate_limit_box" }, { status: 429 });
  }

  const cutoff = new Date(Date.now() - NEEDS_ATTACH_WINDOW_MS).toISOString();
  const needsJson = parsedNeeds.keys.length > 0 ? JSON.stringify(parsedNeeds.keys) : null;

  try {
    const result = await db
      .prepare(
        // Reviewer fix pass (2026-09-19) — `visibility = 'visible'` closes a
        // gap: an admin can hide a 'took' row (BoxCheckinsAdminPanel) for
        // any reason, and without this guard the SAME device could still
        // rewrite that hidden row's needs/note within the 15-minute window
        // — an admin moderation action the visitor's own follow-up request
        // would silently undo. Once hidden, a checkin is done accepting a
        // needs answer, same as if the window had already expired.
        "UPDATE box_checkins SET needs = ?, note = ? WHERE id = ? AND venue_id = ? AND kind = 'took' AND visibility = 'visible' AND created_at >= ?",
      )
      .bind(needsJson, note, checkinId, boxId, cutoff)
      .run();
    if (result.meta?.changes !== 1) {
      // Not found, wrong box, wrong kind, hidden by an admin, or the
      // 15-minute window has passed — every one of those reads identically
      // to the client (this check-in can no longer accept a needs answer).
      return NextResponse.json({ ok: false, error: "not_found_or_expired" }, { status: 404 });
    }
  } catch (err) {
    logFormFailure("checkin_needs", "db_write_failed", {
      message: err instanceof Error ? err.message : "unknown error",
    });
    return NextResponse.json({ ok: false, error: "db_write_failed" }, { status: 502 });
  }

  await bustEdgeCache(req, ["/api/public/blessing-boxes"]);

  return NextResponse.json({ ok: true });
}
