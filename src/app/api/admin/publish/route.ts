/**
 * POST /api/admin/publish — regenerate published-venues.ts from D1 and ship
 * it to production (#237 checkpoint d; docs/admin/cloudflare-native-admin-spec.md
 * §3.5 "PUBLISH PATH", §5 step 5).
 *
 * Sequence (spec's own numbering):
 *   1. snapshot every draft+published venues row (fetchPublishSnapshot)
 *   2/3. validate every row against the Venue shape; strip admin-only
 *        columns — never write a malformed file (validateSnapshot)
 *   4. serialize to published-venues.ts source text (serializePublishedVenuesFile)
 *   5. commit it via the GitHub Contents API -> branch -> PR -> auto-merge
 *      (commitPublishedVenues)
 *   6. ONLY once step 5 succeeds: promote the exact draft ids captured in
 *      step 1 to 'published' and write the audit_log row, in one
 *      db.batch() (promotePublishedDrafts)
 *
 * NB1 (spec §8): the GitHub commit/PR/auto-merge call is attempted BEFORE
 * any D1 write, and promotePublishedDrafts is only called if it resolved —
 * see the try/catch below. If it fails, this handler returns without
 * touching D1 at all: every draft stays a draft, nothing is falsely marked
 * published. src/app/api/admin/publish/route.test.ts proves this ordering
 * (D1 untouched on a mocked GitHub failure).
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, type AdminDbAccess } from "@/lib/adminDb";
import { AccessDeniedError, requireAdminOrigin, type HeaderSource } from "@/lib/cfAccess";
import { logAdminAuthFailure, logPublishResult } from "@/lib/logger";
import {
  fetchPublishSnapshot,
  validateSnapshot,
  serializePublishedVenuesFile,
  commitPublishedVenues,
  promotePublishedDrafts,
} from "@/lib/publishVenues";

/**
 * getAdminDb() FIRST (identity/JWT), THEN the CSRF/Origin check (spec §8
 * "I7") — same order the issue spec describes. Both throw AccessDeniedError
 * so POST's catch block handles either with one 403 response shape.
 */
async function authorizePublishRequest(headers: HeaderSource): Promise<AdminDbAccess> {
  const access = await getAdminDb(headers);
  requireAdminOrigin(headers);
  return access;
}

export async function POST(req: NextRequest): Promise<Response> {
  let access: AdminDbAccess;
  try {
    access = await authorizePublishRequest(req.headers);
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      logAdminAuthFailure(err.reason);
      return new Response("Forbidden", { status: 403 });
    }
    throw err;
  }
  const { db, identity } = access;

  const token = process.env.GITHUB_PUBLISH_TOKEN;
  if (!token) {
    // #256 AC5: a thrown Error here surfaces to the client as a bare 500 with
    // no readable body, indistinguishable from a real crash — the admin's
    // Publish button (src/components/PublishPanel.tsx) needs a catchable,
    // machine-readable signal instead so it can show a calm "not set up yet"
    // message rather than a scary generic error. Expected/normal until Kyle
    // provisions the PAT (#260) — not a fail-loud case like the
    // RESEND_API_KEY/TURNSTILE_SECRET_KEY convention this used to match
    // (src/app/feedback/submit/route.ts), because those routes have no UI
    // surface distinguishing "not configured" from "broken."
    return NextResponse.json({ ok: false, error: "publish_not_configured" }, { status: 503 });
  }

  // 1. snapshot
  const snapshot = await fetchPublishSnapshot(db);

  // 2/3. validate + strip admin-only columns
  const validation = validateSnapshot(snapshot.rows);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 422 });
  }

  // 4. serialize
  const publishedAt = new Date().toISOString();
  const fileText = serializePublishedVenuesFile(validation.venues, { publishedAt });

  // 5. commit — MUST succeed before any D1 write (NB1)
  let commitResult;
  try {
    commitResult = await commitPublishedVenues(fileText, validation.venues.length, token);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    logPublishResult("failure", { message });
    return NextResponse.json({ ok: false, error: "github_commit_failed" }, { status: 502 });
  }

  // 6. ONLY now: promote drafts + write the audit row, atomically
  await promotePublishedDrafts(db, snapshot.draftIds, {
    actorEmail: identity.email,
    publishedAt,
    prUrl: commitResult.prUrl,
    snapshotCount: validation.venues.length,
  });

  logPublishResult("success", { prUrl: commitResult.prUrl });
  return NextResponse.json({
    ok: true,
    prUrl: commitResult.prUrl,
    prNumber: commitResult.prNumber,
    reused: commitResult.reused,
    publishedCount: snapshot.draftIds.length,
    snapshotCount: validation.venues.length,
  });
}
