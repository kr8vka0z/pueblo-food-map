/**
 * POST /api/admin/submissions/[id]/reject — dismiss a pending
 * `public_submissions` row (#259, AC3 + AC5).
 *
 * Sibling to the venue mutation routes (POST /api/admin/venues,
 * POST /api/admin/venues/[id]/archive) but deliberately its OWN standalone
 * write rather than another `submissionId` extension of an existing batch:
 * a reject touches no `venues` row and writes no `audit_log` entry — there
 * is no venue-side mutation for it to ride alongside. It's a single UPDATE
 * on `public_submissions` itself.
 *
 * Auth: identical two-check pattern to every other admin mutation —
 * getAdminDb() then requireAdminOrigin(), both throwing AccessDeniedError
 * into one 403 shape.
 *
 * `AND status = 'pending'` in the UPDATE means D1's own `meta.changes`
 * tells us whether there was anything to reject: 0 changed rows means the
 * id doesn't exist, or the row was already approved/rejected by someone
 * else (or a prior click) — surfaced to the caller as 404 rather than a
 * silent 200, so SubmissionsReviewView can tell a real reject apart from a
 * stale card.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb, type AdminDbAccess } from "@/lib/adminDb";
import { AccessDeniedError, requireAdminOrigin, type HeaderSource } from "@/lib/cfAccess";
import { logAdminAuthFailure } from "@/lib/logger";

async function authorizeRejectRequest(headers: HeaderSource): Promise<AdminDbAccess> {
  const access = await getAdminDb(headers);
  requireAdminOrigin(headers);
  return access;
}

const REJECT_SUBMISSION_SQL =
  "UPDATE public_submissions SET status = 'rejected', review_reason = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'";

// No shared FIELD_LIMITS entry fits: SUGGEST_NOTES/REPORT_DESCRIPTION/
// FEEDBACK_MESSAGE (src/lib/fieldLimits.ts) each already describe a specific
// PUBLIC-facing field's own length contract — this is a distinct, admin-only
// free-text reason with no natural existing owner. A local cap, not a new
// shared constant, since nothing else references this limit.
const REVIEW_REASON_MAX_LENGTH = 1000;

/** Optional `{ reason }` from the JSON body -> trimmed text capped at REVIEW_REASON_MAX_LENGTH, or null. Never throws on a missing/empty/non-JSON body. */
async function readOptionalReason(req: NextRequest): Promise<string | null> {
  try {
    const body: unknown = await req.json();
    const raw = (body as { reason?: unknown })?.reason;
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    if (trimmed.length === 0) return null;
    return trimmed.slice(0, REVIEW_REASON_MAX_LENGTH);
  } catch {
    return null; // no/empty/non-JSON body — reason is optional
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  let access: AdminDbAccess;
  try {
    access = await authorizeRejectRequest(req.headers);
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      logAdminAuthFailure(err.reason);
      return new Response("Forbidden", { status: 403 });
    }
    throw err;
  }
  const { db, identity } = access;

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const reason = await readOptionalReason(req);
  const timestamp = new Date().toISOString();

  const result = await db
    .prepare(REJECT_SUBMISSION_SQL)
    .bind(reason, identity.email, timestamp, id)
    .run();

  if (result.meta.changes === 0) {
    return NextResponse.json({ ok: false, error: "Not found or already reviewed" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
