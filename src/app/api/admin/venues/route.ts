/**
 * POST /api/admin/venues — create a new venue as a DRAFT (#254; spec
 * docs/admin/cloudflare-native-admin-spec.md §5 step 1 "Create").
 *
 * Auth: same two-check pattern as POST /api/admin/publish
 * (src/app/api/admin/publish/route.ts) — getAdminDb() first (JWT identity),
 * then requireAdminOrigin() (CSRF), both throwing the shared
 * AccessDeniedError so one catch block produces one 403 shape.
 *
 * Every write is DRAFT-only: status='draft', source_type='manual'
 * (identical convention to §5's "manually-created venue gets
 * source_type='manual'"). Nothing here touches the public map — that only
 * happens via a later, explicit POST /api/admin/publish (AGENTS.md
 * "Publish -> static").
 *
 * #259 review-queue extension: an optional `submissionId` in the request
 * body (present only when this create was reached by approving a
 * `public_submissions` "new_venue" card at /admin/submissions) appends a
 * THIRD statement to the same atomic `db.batch()` below, flipping that
 * submission row to `status='approved'`. Riding the existing batch (rather
 * than a second, separate write) is what guarantees the new venue and its
 * originating submission's approval commit together — see AGENTS.md
 * "Public submissions review queue (#259)".
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, type AdminDbAccess } from "@/lib/adminDb";
import { AccessDeniedError, requireAdminOrigin, type HeaderSource } from "@/lib/cfAccess";
import { logAdminAuthFailure } from "@/lib/logger";
import { validateCreateVenuePayload, type ValidatedVenueFields } from "@/lib/adminVenueValidation";

/**
 * getAdminDb() FIRST (identity/JWT), THEN the CSRF/Origin check — same
 * order and reasoning as publish/route.ts's authorizePublishRequest. Both
 * throw AccessDeniedError so POST's catch block handles either with one
 * 403 response shape.
 */
async function authorizeCreateRequest(headers: HeaderSource): Promise<AdminDbAccess> {
  const access = await getAdminDb(headers);
  requireAdminOrigin(headers);
  return access;
}

// Deliberately mirrors scripts/seed-admin-db.ts's INSERT_COLUMNS list:
// created_at/updated_at are omitted so the schema's own
// DEFAULT (strftime(...)) fills them, matching that script's established
// convention (migrations/0001_init_admin_schema.sql).
const VENUES_INSERT_COLUMNS = [
  "id", "name", "category", "lat", "lng", "address", "hours_weekly",
  "accepts_snap", "accepts_wic", "phone", "email", "url", "notes", "operator",
  "source", "last_verified", "status", "source_type", "outside_county",
  "created_by", "updated_by", "published_at", "published_by",
] as const;

const VENUES_INSERT_SQL = `INSERT INTO venues (${VENUES_INSERT_COLUMNS.join(", ")}) VALUES (${VENUES_INSERT_COLUMNS.map(() => "?").join(", ")})`;

const AUDIT_INSERT_SQL =
  "INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)";

function buildVenueInsertValues(id: string, fields: ValidatedVenueFields, actorEmail: string): unknown[] {
  return [
    id,
    fields.name,
    fields.category,
    fields.lat,
    fields.lng,
    fields.address,
    fields.hoursWeeklyJson,
    fields.acceptsSnap,
    fields.acceptsWic,
    fields.phone,
    fields.email,
    fields.url,
    fields.notes,
    fields.operator,
    fields.source,
    fields.lastVerified,
    "draft",
    "manual",
    fields.outsideCounty,
    actorEmail,
    actorEmail,
    null, // published_at
    null, // published_by
  ];
}

/**
 * Optional, review-queue-only field (#259): reads `body.submissionId`
 * directly rather than through validateCreateVenuePayload() (that
 * validator's ValidatedVenueFields describes only the venues table's own
 * columns — a submission id isn't one of them, and mixing it in there would
 * make that type lie about what a plain, non-review-queue create submits).
 * Accepted only as a genuine positive integer; anything else (a string, 0,
 * negative, a float, absent) is treated as "no submission to approve" rather
 * than an error — an admin's ordinary "Add place" flow must never fail
 * because of a stray/malformed field it never sends.
 */
function readOptionalSubmissionId(body: unknown): number | null {
  const rawSid = (body as { submissionId?: unknown })?.submissionId;
  return typeof rawSid === "number" && Number.isInteger(rawSid) && rawSid > 0 ? rawSid : null;
}

// The `AND kind = 'new_venue'` guard (mirrors the archive route's own
// `kind = 'closure' AND target_venue_id = ?` guard) closes a cross-kind
// approval gap: a create only ever legitimately approves a 'new_venue'
// submission, so a submissionId pointing at a 'closure' row (or any other
// mismatch) now affects 0 rows here — the venue still creates, but the
// wrong submission is never silently marked approved.
const APPROVE_SUBMISSION_SQL =
  "UPDATE public_submissions SET status = 'approved', reviewed_by = ?, reviewed_at = ? WHERE id = ? AND status = 'pending' AND kind = 'new_venue'";

export async function POST(req: NextRequest): Promise<Response> {
  let access: AdminDbAccess;
  try {
    access = await authorizeCreateRequest(req.headers);
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      logAdminAuthFailure(err.reason);
      return new Response("Forbidden", { status: 403 });
    }
    throw err;
  }
  const { db, identity } = access;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const validation = validateCreateVenuePayload(body);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, errors: validation.errors }, { status: 422 });
  }
  const { fields } = validation;
  const submissionId = readOptionalSubmissionId(body);

  const id = `manual-${crypto.randomUUID()}`;
  // Hoisted so the venue insert's audit row and the (#259) submission
  // approval below share one exact timestamp value.
  const timestamp = new Date().toISOString();

  // The audit row's after_json omits created_at/updated_at: D1's own
  // DEFAULT (strftime(...)) assigns those two columns (see
  // VENUES_INSERT_COLUMNS above), so this process never observes their
  // exact stored value within this same request — echoing a JS-computed
  // approximation here would risk the audit trail silently disagreeing
  // with the real row. Every other column is exactly what gets inserted.
  const venueRowForAudit = {
    id,
    name: fields.name,
    category: fields.category,
    lat: fields.lat,
    lng: fields.lng,
    address: fields.address,
    hours_weekly: fields.hoursWeeklyJson,
    accepts_snap: fields.acceptsSnap,
    accepts_wic: fields.acceptsWic,
    phone: fields.phone,
    email: fields.email,
    url: fields.url,
    notes: fields.notes,
    operator: fields.operator,
    source: fields.source,
    last_verified: fields.lastVerified,
    status: "draft",
    source_type: "manual",
    outside_county: fields.outsideCounty,
    created_by: identity.email,
    updated_by: identity.email,
    published_at: null,
    published_by: null,
  };

  const insertVenue = db.prepare(VENUES_INSERT_SQL).bind(...buildVenueInsertValues(id, fields, identity.email));
  const insertAudit = db
    .prepare(AUDIT_INSERT_SQL)
    .bind(
      identity.email,
      "venue",
      id,
      "create",
      null,
      JSON.stringify(venueRowForAudit),
      timestamp,
    );

  // ponytail: the `AND status = 'pending'` clause makes a double-approve (or
  // approving an already-rejected row) a silent no-op on the submission
  // row — 0 rows affected — while the venue still creates either way. This
  // is a single-admin internal tool, so that race is acceptable today; the
  // upgrade path if it ever isn't is surfacing D1Result.meta.changes back to
  // the client so a stale/already-actioned card can be flagged instead of
  // just silently succeeding again.
  const approveSubmission =
    submissionId !== null
      ? db.prepare(APPROVE_SUBMISSION_SQL).bind(identity.email, timestamp, submissionId)
      : null;

  // Atomic: the venue row, its audit trail, and (#259) the originating
  // submission's approval either all land together or none does.
  await db.batch([insertVenue, insertAudit, ...(approveSubmission !== null ? [approveSubmission] : [])]);

  return NextResponse.json({ id }, { status: 201 });
}
