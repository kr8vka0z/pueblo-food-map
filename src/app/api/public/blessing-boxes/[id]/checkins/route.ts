/**
 * POST /api/public/blessing-boxes/[id]/checkins — the public check-in write
 * path (Blessing Boxes slice 2, Discovery stories C1-C4).
 *
 * Same anti-abuse ORDER as every other public form in this app (report/
 * submit, suggest/submit, feedback/submit): Content-Type/JSON parse ->
 * Turnstile -> honeypot -> rate limit -> field validation -> write. See
 * AGENTS.md's public-submissions section and src/lib/turnstile.ts /
 * src/lib/rateLimit.ts for the established shape this route reuses.
 *
 * WHY a stronger rate limit than the other three forms' 5/hr in-process
 * limiter: check-ins are a feature people are expected to use DAILY
 * (Discovery §1), unlike an occasional closure report — see
 * src/lib/checkinRateLimit.ts's own header for the full D1-shared-counter
 * reasoning. Two independent caps, both keyed off non-identifying values
 * (never an IP — see that file's header): MAX_PER_BOX_PER_HOUR guards the
 * whole box against an automated flood from anywhere, deliberately set well
 * above any plausible honest-use ceiling (see that constant's own comment);
 * MAX_PER_VISITOR_PER_BOX_PER_HOUR is the Build Plan's "a handful of
 * check-ins per box per hour from one visitor," keyed off a random
 * client-generated token (src/lib/checkinClientToken.ts) rather than an IP.
 *
 * WHY the visitor cap is checked BEFORE the box cap (2026-09-17 review
 * correction — this used to run box-then-visitor): checking and
 * incrementing the box counter FIRST meant a single over-tapping visitor —
 * hammering the button past their own per-visitor limit — burned the
 * SHARED box-wide budget on every one of their own rejected attempts, which
 * could starve every OTHER visitor at that box (including the host trying
 * to log "filled") even though the box itself never saw genuine high
 * traffic. Checking the visitor cap first means a visitor who's over their
 * own limit is rejected before touching the box's shared counter at all —
 * the box counter only ever advances on an attempt that was going to be
 * genuinely counted against the box either way.
 *
 * WHY two distinct rate-limit error codes ("rate_limit_visitor" vs.
 * "rate_limit_box"), not one shared "rate_limit" (2026-09-17 review
 * correction): a single generic message misdirected blame — a visitor over
 * THEIR OWN cap was being told the box was busy (wrong scope, sounds like a
 * problem with the box, not them), and vice versa. BoxCheckinPanel.tsx maps
 * each to its own copy: "too many check-ins from this device" vs. "this box
 * is getting an unusual number of check-ins right now."
 *
 * WHY 'problem' reports never touch the public read path: the INSERT below
 * is identical for every kind, but every public SELECT elsewhere in this
 * app (src/lib/blessingBoxes.ts) filters `kind != 'problem'` at the query —
 * this route's only 'problem'-specific behavior is emailing the admin
 * (mirrors report/submit's sendReportEmail shape) and never recomputing the
 * response's status/lastFilled from a 'problem' row (it cannot,
 * structurally — computeBoxStatus/computeLastFilledAt both exclude that
 * kind by construction).
 *
 * Cache freshness: GET /api/public/blessing-boxes holds its response at the
 * Cloudflare edge for 60s via the Workers Cache API (that route's own
 * header). After a successful insert, this route deletes that route's
 * cache entry for the CURRENT colo only (`caches.default` is per-colo, not
 * global — there is no zone-wide purge API available to a Worker without an
 * Account-scoped token this app doesn't use elsewhere, see AGENTS.md's
 * Cloudflare notes) — so the visitor who just checked in sees the change on
 * their own next fetch, and every colo is bounded at 60s regardless. The
 * response body ALSO carries the box's fresh status/lastFilledAt directly
 * (2026-09-17 review correction — this comment previously claimed a
 * `recentCheckins` field that the response never actually returns), so
 * BoxContent's panel can update immediately without waiting on any fetch at
 * all — see BoxContent.tsx's own header.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { checkAndIncrement } from "@/lib/checkinRateLimit";
import { FIELD_LIMITS } from "@/lib/fieldLimits";
import { logFormFailure } from "@/lib/logger";
import {
  computeBoxStatus,
  computeLastFilledAt,
  loadVisibleCheckins,
  type CheckinKind,
  type CheckinStatusInput,
} from "@/lib/blessingBoxes";

export const dynamic = "force-dynamic";

const CHECKIN_KINDS: readonly CheckinKind[] = ["filled", "took", "low", "empty", "problem"];
/** Only these two kinds may carry a note — matches the panel's own UI (BoxContent.tsx: "optional short note on filled and problem"). A note sent alongside any other kind is silently dropped, not rejected — harmless either way, and rejecting it would punish a client that sent extra data by mistake. */
const KINDS_ALLOWING_NOTE: ReadonlySet<CheckinKind> = new Set(["filled", "problem"]);

/**
 * WHY 300, not 60 (2026-09-17 review correction — this was 60): 60/hour
 * shared across every visitor at a box meant one Turnstile-passing person
 * tapping repeatedly, or a real crowd at a distribution event, could lock
 * out everyone else at that box for the rest of the hour — including the
 * host trying to log "filled." This cap exists to catch an automated flood
 * (an actual bot script fires dozens of requests in seconds, not spread
 * over an hour), not to throttle a busy but honest day. At
 * MAX_PER_VISITOR_PER_BOX_PER_HOUR below, 300/hour still only allows 50
 * distinct visitors each going full-tilt on their own per-visitor cap, or
 * 300 distinct single taps — comfortably past what a real neighborhood box
 * plausibly sees from honest use in an hour, while a scripted flood still
 * blows past 300 in well under a minute and gets caught.
 */
export const MAX_PER_BOX_PER_HOUR = 300;
export const MAX_PER_VISITOR_PER_BOX_PER_HOUR = 6;

interface CheckinPayload {
  kind?: string;
  note?: string;
  /** Honeypot — must be empty string or absent, same convention as every other public form route. */
  website?: string;
  /** Cloudflare Turnstile response token from the client widget. */
  turnstileToken?: string;
  /** Opaque, non-identifying per-browser token from src/lib/checkinClientToken.ts — used ONLY as a rate-limit key, never persisted to box_checkins (see migrations/0007's own header). */
  clientToken?: string;
}

interface BoxLookupRow {
  id: string;
  removed_on: string | null;
}

async function sendProblemReportEmail(boxId: string, boxName: string, note: string | null): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const lines = [`Box: ${boxName}`, `Box ID: ${boxId}`, ``, `Problem reported:`, note || "(no note provided)"];

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: "Pueblo Food Map <noreply@pueblofoodmap.com>",
      to: ["issues@pueblofoodmap.com"],
      subject: `[PFM Blessing Box] Problem reported — ${boxName}`,
      text: lines.join("\n"),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)");
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

/** Deletes GET /api/public/blessing-boxes' cache entry for the CURRENT colo — see this file's header for why this is a partial, not zone-wide, purge, and why that's still enough. Best-effort: a cache-delete failure must never fail the check-in itself. */
async function bustListCache(req: NextRequest): Promise<void> {
  const cache: Cache | undefined = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  if (!cache) return;
  try {
    const listUrl = new URL("/api/public/blessing-boxes", req.url);
    await cache.delete(new Request(listUrl));
  } catch {
    // best-effort only — the 60s TTL is the real freshness bound either way
  }
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

  let body: CheckinPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  // IP is used ONLY for Turnstile's optional remoteip validation — never
  // stored, never used as a rate-limit key (see checkinRateLimit.ts header).
  const ip =
    req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // Dedicated invisible-mode Turnstile secret, check-ins only — never
  // TURNSTILE_SECRET_KEY, the managed-mode key the other three public forms
  // verify against (2026-09-18: a managed-mode widget still popped its
  // checkbox on a real phone even under `appearance: "interaction-only"`,
  // so check-ins moved to a second site key provisioned in Cloudflare's
  // invisible widget mode — see BoxCheckinPanel.tsx's own header and
  // AGENTS.md's "Blessing boxes — card polish" section).
  const turnstileSecret = process.env.TURNSTILE_BOX_SECRET_KEY;
  if (!turnstileSecret) {
    throw new Error("TURNSTILE_BOX_SECRET_KEY not configured");
  }
  // Dedicated secret for rate-limit key derivation — deliberately NOT
  // turnstileSecret (2026-09-17 review correction; see checkinRateLimit.ts's
  // header for why sharing the two would let a Turnstile-only rotation
  // silently reset every open rate-limit bucket).
  const checkinRateLimitSecret = process.env.CHECKIN_RATE_LIMIT_SECRET;
  if (!checkinRateLimitSecret) {
    throw new Error("CHECKIN_RATE_LIMIT_SECRET not configured");
  }
  const turnstileValid = await verifyTurnstileToken(body.turnstileToken, turnstileSecret, ip);
  if (!turnstileValid) {
    logFormFailure("checkin", "turnstile_failed");
    return NextResponse.json({ ok: false, error: "turnstile_failed" }, { status: 400 });
  }

  if (body.website && body.website.trim() !== "") {
    return NextResponse.json({ ok: true }); // bots think it worked
  }

  let db: D1Database;
  try {
    ({ env: { ADMIN_DB: db } } = getCloudflareContext());
  } catch {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }

  // Visitor cap FIRST, box cap second (2026-09-17 review correction — this
  // used to run box-then-visitor). See this file's header "WHY the visitor
  // cap is checked BEFORE the box cap" for the full reasoning: checking the
  // box first let one over-tapping visitor burn the shared box-wide budget
  // on their own rejected attempts. A missing/blocked clientToken (see
  // checkinClientToken.ts) means no per-visitor cap can apply to this
  // request — the box cap below still bounds total abuse either way. This
  // is a deliberate, stated trade, not an oversight (see
  // checkinRateLimit.ts's header and this slice's PR body).
  const clientToken = typeof body.clientToken === "string" ? body.clientToken.slice(0, 200) : null;
  if (clientToken) {
    const visitorCap = await checkAndIncrement(
      db,
      checkinRateLimitSecret,
      { scope: "visitor-box", id: `${clientToken}:${boxId}` },
      MAX_PER_VISITOR_PER_BOX_PER_HOUR,
    );
    if (!visitorCap) {
      return NextResponse.json({ ok: false, error: "rate_limit_visitor" }, { status: 429 });
    }
  }

  const boxCap = await checkAndIncrement(
    db,
    checkinRateLimitSecret,
    { scope: "box", id: boxId },
    MAX_PER_BOX_PER_HOUR,
  );
  if (!boxCap) {
    return NextResponse.json({ ok: false, error: "rate_limit_box" }, { status: 429 });
  }

  const kind = body.kind;
  if (typeof kind !== "string" || !CHECKIN_KINDS.includes(kind as CheckinKind)) {
    return NextResponse.json({ ok: false, error: "Invalid kind" }, { status: 422 });
  }
  const checkinKind = kind as CheckinKind;

  let note: string | null = null;
  if (KINDS_ALLOWING_NOTE.has(checkinKind) && typeof body.note === "string" && body.note.trim() !== "") {
    const trimmed = body.note.trim();
    if (trimmed.length > FIELD_LIMITS.BOX_CHECKIN_NOTE) {
      return NextResponse.json(
        { ok: false, error: `Note must be ${FIELD_LIMITS.BOX_CHECKIN_NOTE} characters or fewer` },
        { status: 422 },
      );
    }
    note = trimmed;
  }

  const box = await db
    .prepare("SELECT v.id, b.removed_on FROM venues v JOIN blessing_boxes b ON b.venue_id = v.id WHERE v.id = ? AND v.category = 'blessing_box' AND v.status != 'archived'")
    .bind(boxId)
    .first<BoxLookupRow>();
  if (!box) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  try {
    await db
      .prepare("INSERT INTO box_checkins (venue_id, kind, note) VALUES (?, ?, ?)")
      .bind(boxId, checkinKind, note)
      .run();
  } catch (err) {
    logFormFailure("checkin", "db_write_failed", {
      message: err instanceof Error ? err.message : "unknown error",
    });
    return NextResponse.json({ ok: false, error: "db_write_failed" }, { status: 502 });
  }

  if (checkinKind === "problem") {
    try {
      const boxName = (await db.prepare("SELECT name FROM venues WHERE id = ?").bind(boxId).first<{ name: string }>())
        ?.name ?? boxId;
      await sendProblemReportEmail(boxId, boxName, note);
    } catch (err) {
      // The check-in itself already succeeded (it's recorded, an admin can
      // still see it in the review panel) — a failed alert email must not
      // fail the whole request, same "email is best-effort on top of an
      // already-durable write" posture publicSubmissions.ts established.
      logFormFailure("checkin", "send_failed", {
        message: err instanceof Error ? err.message : "unknown error",
      });
    }
  }

  await bustListCache(req);

  // Recompute this box's own status/lastFilled/recentCheckins from the
  // check-ins table (including the row just inserted) so the response — and
  // therefore BoxContent's panel — reflects the write immediately, with no
  // second fetch and no dependency on the 60s list cache at all.
  const checkins: CheckinStatusInput[] = await loadVisibleCheckins(db, boxId);
  const outOfService = box.removed_on !== null && box.removed_on !== "";
  const now = new Date();

  // Returning status/lastFilledAt here regardless of `checkinKind` is safe
  // even for a 'problem' report: both are computed only from filled/low/
  // empty check-ins (computeBoxStatus/computeLastFilledAt exclude
  // 'problem' by construction — see blessingBoxes.ts) and are already
  // public information anyone can read from the box's own page.
  return NextResponse.json({
    ok: true,
    status: computeBoxStatus(checkins, now, outOfService),
    lastFilledAt: computeLastFilledAt(checkins),
  });
}
