/**
 * PATCH /api/admin/venues/[id] — edit an existing venue (#255 "[Admin P2]
 * Edit or remove a venue" — slice 2 of the admin Phase 2 build; #254's
 * POST /api/admin/venues is slice 1, the create path this route mirrors
 * closely).
 *
 * Auth: identical two-check pattern to POST /api/admin/venues (create) and
 * POST /api/admin/publish — getAdminDb() first (JWT identity), then
 * requireAdminOrigin() (CSRF), both throwing the shared AccessDeniedError so
 * one catch block produces one 403 shape.
 *
 * Validation reuses validateCreateVenuePayload() verbatim
 * (src/lib/adminVenueValidation.ts) rather than a separate edit/partial
 * variant — an edit submits the identical full field set a create does
 * (AddVenueForm.tsx is one component in both modes; see its own header), so
 * there is nothing a dedicated edit validator would check differently. That
 * module's own header comment anticipated exactly this reuse.
 *
 * WHY `status` never appears in the UPDATE column list below: this is the
 * mechanism that satisfies #255's AC3 ("editing a published venue keeps it
 * published") — not a runtime check, a structural guarantee. There is no
 * `status = ?` placeholder anywhere in this file, so no code path here can
 * change a row's status regardless of what it was before the edit.
 * Archiving is a deliberately separate action
 * (POST /api/admin/venues/[id]/archive, sibling route.ts) precisely so this
 * file never has to reason about status transitions at all.
 *
 * Every write is one atomic db.batch(): the UPDATE and its own audit_log
 * row (action='update', before_json = the row as it was, after_json = the
 * row after the edit) land together or not at all — same shape as create's
 * INSERT + audit_log batch. Unlike create (where created_at/updated_at are
 * DB-assigned defaults never echoed exactly), an UPDATE has no such default
 * — SQLite only applies a column DEFAULT on INSERT — so `updated_at` is
 * computed once here in JS and used identically for the SQL bind, the
 * audit row's timestamp, and after_json, guaranteeing all three agree.
 *
 * Optional `proposalId` body field (#390, /admin/flags's link_health
 * hand-off): mirrors the `submissionId` convention POST /api/admin/venues
 * (create) and POST /api/admin/venues/[id]/archive already established for
 * public_submissions — an OPTIONAL 3rd statement riding this same
 * db.batch() flips the originating change_proposals row to 'approved' when
 * the edit that resolves it saves. This is deliberately the loose,
 * "route to edit, let the admin fix whatever they see fit" convenience
 * path for link_health proposals specifically (the /admin/flags queue's
 * own POST /api/admin/proposals/[id]/approve route is the strict one, with
 * the full stale-apply guard — see that route's header). A link_health
 * proposal's `before`/`after` diff is only ever a candidate dead-URL
 * observation, not a field this route could safely auto-apply — the admin
 * is expected to actually look at the page and decide what changed, so
 * there is no equivalent stale-apply check here. The extra WHERE guards
 * (source='link_health', target_venue_id=id) keep a stray/crafted
 * proposalId from marking an unrelated proposal approved even though the
 * edit itself still always succeeds — same accepted idempotency-ceiling
 * shape as public_submissions' own `AND status = 'pending'` clause
 * (ponytail: below).
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, type AdminDbAccess } from "@/lib/adminDb";
import { requireAdminOrigin, type HeaderSource } from "@/lib/cfAccess";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";
import { validateCreateVenuePayload, type ValidatedVenueFields } from "@/lib/adminVenueValidation";
import type { AdminVenueRow } from "@/types/venue";

/**
 * getAdminDb() FIRST (identity/JWT), THEN the CSRF/Origin check — same order
 * and reasoning as venues/route.ts's authorizeCreateRequest.
 */
async function authorizeEditRequest(headers: HeaderSource): Promise<AdminDbAccess> {
  const access = await getAdminDb(headers);
  requireAdminOrigin(headers);
  return access;
}

// Every editable column except `status` (see file header for why status is
// permanently excluded) and the workflow columns an edit never touches:
// source_type, created_at, created_by, published_at, published_by.
const VENUE_UPDATE_SQL = `UPDATE venues SET
  name = ?, category = ?, lat = ?, lng = ?, address = ?, hours_weekly = ?,
  accepts_snap = ?, accepts_wic = ?, phone = ?, email = ?, url = ?, notes = ?,
  operator = ?, source = ?, last_verified = ?, outside_county = ?,
  updated_by = ?, updated_at = ?
  WHERE id = ?`;

const AUDIT_INSERT_SQL =
  "INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)";

// ponytail: AND status = 'pending' is a deliberate idempotency ceiling, not
// an oversight — same shape as public_submissions' own approve statements
// (see this file's header + AGENTS.md "Public submissions queue"). A
// double-approve affects 0 rows here and is silently a no-op on the
// proposal side, while the venue edit itself still always succeeds. If
// that ever needs to be surfaced instead of swallowed, the upgrade path is
// reading D1Result.meta.changes back to the client, same as
// POST /api/admin/proposals/[id]/approve already does for its own strict
// check.
const APPROVE_PROPOSAL_SQL =
  "UPDATE change_proposals SET status = 'approved', reviewed_by = ?, reviewed_at = ?, applied_at = ? WHERE id = ? AND status = 'pending' AND source = 'link_health' AND target_venue_id = ?";

/** Mirrors readOptionalSubmissionId's convention in the sibling create/archive routes. */
function readOptionalProposalId(body: unknown): number | null {
  const raw = (body as { proposalId?: unknown })?.proposalId;
  return typeof raw === "number" && Number.isInteger(raw) && raw > 0 ? raw : null;
}

function buildVenueUpdateValues(
  id: string,
  fields: ValidatedVenueFields,
  actorEmail: string,
  updatedAt: string,
): unknown[] {
  return [
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
    fields.outsideCounty,
    actorEmail,
    updatedAt,
    id,
  ];
}

/**
 * The exact post-edit row, for the audit trail's after_json. Every column
 * NOT touched by an edit (status, source_type, created_at/by,
 * published_at/by) is carried over unchanged from `existing` — spreading it
 * first and only overwriting the columns this route actually updates is
 * what makes that guarantee automatic rather than something to remember to
 * copy field-by-field.
 */
function buildAfterRow(
  existing: AdminVenueRow,
  fields: ValidatedVenueFields,
  actorEmail: string,
  updatedAt: string,
): AdminVenueRow {
  return {
    ...existing,
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
    outside_county: fields.outsideCounty,
    updated_by: actorEmail,
    updated_at: updatedAt,
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  let access: AdminDbAccess;
  try {
    access = await authorizeEditRequest(req.headers);
  } catch (err) {
    return adminAuthErrorResponse(err);
  }
  const { db, identity } = access;
  const { id } = await params;

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
  const proposalId = readOptionalProposalId(body);

  const existing = await db.prepare("SELECT * FROM venues WHERE id = ?").bind(id).first<AdminVenueRow>();
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const updatedAt = new Date().toISOString();
  const afterRow = buildAfterRow(existing, fields, identity.email, updatedAt);

  const updateVenue = db
    .prepare(VENUE_UPDATE_SQL)
    .bind(...buildVenueUpdateValues(id, fields, identity.email, updatedAt));
  const insertAudit = db
    .prepare(AUDIT_INSERT_SQL)
    .bind(identity.email, "venue", id, "update", JSON.stringify(existing), JSON.stringify(afterRow), updatedAt);
  const approveProposal =
    proposalId !== null
      ? db.prepare(APPROVE_PROPOSAL_SQL).bind(identity.email, updatedAt, updatedAt, proposalId, id)
      : null;

  // Atomic: the update, its own audit trail, and (when present) the
  // originating link_health proposal's approval either all land or none do.
  await db.batch([updateVenue, insertAudit, ...(approveProposal !== null ? [approveProposal] : [])]);

  return NextResponse.json({ ok: true, id });
}
