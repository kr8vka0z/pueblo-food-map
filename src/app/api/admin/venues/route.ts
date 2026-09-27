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
 * happens via a later, explicit POST /api/admin/publish (ARCHITECTURE.md
 * "Admin panel").
 *
 * #259 review-queue extension: an optional `submissionId` in the request
 * body (present only when this create was reached by approving a
 * `public_submissions` "new_venue" card — #675: now a "Suggested new place"
 * row on the Places tab, not a standalone /admin/submissions queue)
 * appends a THIRD statement to the same atomic `db.batch()` below, flipping that
 * submission row to `status='approved'`. Riding the existing batch (rather
 * than a second, separate write) is what guarantees the new venue and its
 * originating submission's approval commit together — see ARCHITECTURE.md
 * "Admin panel".
 *
 * #674 review-queue extension: an optional `proposalId` in the request body
 * (present only when this create was reached by opening a genuinely-new
 * `change_proposals` "add" row at /admin/venues/new?proposal=<id> — see
 * that page's own header and src/lib/adminVenueForm.ts's
 * mapAddProposalToFormValues) is a DIFFERENT shape from `submissionId`
 * above, not a copy of it: `id`/`source_type` here are NOT
 * `manual-<uuid>`/`'manual'` but `proposalRow.target_venue_id`/
 * `proposalRow.source` — the scraper's own id and source type, preserved so
 * the next refresh run recognises this venue already exists (it loads
 * current rows `WHERE source_type = '<sourceType>'`, scripts/refresh-ingest.ts)
 * instead of proposing the same add again forever. This mirrors
 * applyApprovedProposal()'s own non-restore `add` branch
 * (src/lib/adminProposals.ts) exactly — the one existing precedent for
 * turning a change_proposals "add" row into a venues row — except the
 * INSERTed fields come from THIS request's validated, admin-edited payload,
 * not the stale `proposed_diff.after` snapshot; that's the entire point of
 * routing through the real form instead of a one-click Approve. Resolved
 * BEFORE the batch (two extra SELECTs: the pending proposal row, then a
 * plain existence check on `target_venue_id`) because there is no other way
 * to learn the id/source_type to insert with — an unresolvable or
 * already-claimed proposal id 409s outright rather than silently falling
 * back to a fresh `manual-<uuid>` id (see resolveAddProposalTarget below).
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, type AdminDbAccess } from "@/lib/adminDb";
import { requireAdminOrigin, type HeaderSource } from "@/lib/adminOrigin";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";
import { validateCreateVenuePayload, type ValidatedVenueFields } from "@/lib/adminVenueValidation";
import type { AdminVenueSourceType } from "@/types/venue";
import { boxEventsForCreate, BOX_EVENT_INSERT_SQL } from "@/lib/boxEvents";

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
  "id", "name", "category", "lat", "lng", "address", "hours_weekly", "hours_irregular",
  "accepts_snap", "accepts_wic", "phone", "email", "url", "notes", "operator",
  "source", "last_verified", "status", "source_type", "outside_county",
  "created_by", "updated_by", "published_at", "published_by",
] as const;

const VENUES_INSERT_SQL = `INSERT INTO venues (${VENUES_INSERT_COLUMNS.join(", ")}) VALUES (${VENUES_INSERT_COLUMNS.map(() => "?").join(", ")})`;

const AUDIT_INSERT_SQL =
  "INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)";

// Blessing Boxes slice 1: a fresh blessing_box create always inserts its
// blessing_boxes row too (never an upsert here — the venue row is brand
// new, so there is no existing box row to conflict with). created_at/
// updated_at omitted so the schema's own DEFAULT fills them, same
// convention as VENUES_INSERT_COLUMNS above.
const BOX_INSERT_SQL =
  "INSERT INTO blessing_boxes (venue_id, host_name, host_note, host_contact, most_needed, installed_on, removed_on) VALUES (?, ?, ?, ?, ?, ?, ?)";

// #674: sourceType defaults to "manual" for every ordinary create, but a
// proposal-approving create (see resolveAddProposalTarget below) passes the
// scraper's own AdminVenueSourceType instead — see this file's own header
// for why that distinction is load-bearing, not cosmetic.
function buildVenueInsertValues(
  id: string,
  fields: ValidatedVenueFields,
  actorEmail: string,
  sourceType: AdminVenueSourceType,
): unknown[] {
  return [
    id,
    fields.name,
    fields.category,
    fields.lat,
    fields.lng,
    fields.address,
    fields.hoursWeeklyJson,
    fields.hoursIrregularJson,
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
    sourceType,
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

/**
 * Optional, review-queue-only field (#674): mirrors readOptionalSubmissionId's
 * convention exactly, for a `change_proposals` id instead of a
 * `public_submissions` one.
 */
function readOptionalProposalId(body: unknown): number | null {
  const raw = (body as { proposalId?: unknown })?.proposalId;
  return typeof raw === "number" && Number.isInteger(raw) && raw > 0 ? raw : null;
}

// `AND change_type = 'add'` closes the same cross-kind gap
// APPROVE_SUBMISSION_SQL's `AND kind = 'new_venue'` does above — a
// proposalId pointing at an `update`/`remove`/`link_health` row can never
// legitimately reach this create route (there is no matching UI flow that
// sends one), but if it somehow did, this WHERE affects 0 rows rather than
// approving the wrong kind of proposal.
const APPROVE_ADD_PROPOSAL_SQL =
  "UPDATE change_proposals SET status = 'approved', reviewed_by = ?, reviewed_at = ?, applied_at = ? WHERE id = ? AND status = 'pending' AND change_type = 'add'";

interface PendingAddProposalRow {
  target_venue_id: string;
  source: string;
}

type ResolveAddProposalResult =
  | { ok: true; targetVenueId: string; sourceType: AdminVenueSourceType }
  | { ok: false };

/**
 * Resolves a `proposalId` to the venue id/source_type this create should
 * use (see this file's own header for why those come from the proposal,
 * not `manual-<uuid>`/`'manual'`). Two SELECTs, not one:
 *   1. the proposal itself must still be a PENDING `add` row — a stale page,
 *      a double-submit, or a crafted id all fail the same way here.
 *   2. `target_venue_id` must not already exist in `venues` in ANY status —
 *      a non-archived match is a genuine duplicate (defense-in-depth: the
 *      Places tab should never link to this flow for one), and an archived
 *      match is a RESTORE, which belongs on that venue's own edit-page card
 *      (ProposalCard.tsx's `isRestore` branch, still a direct POST
 *      .../approve), never this create route — inserting a second venues
 *      row with the same id would violate its PRIMARY KEY anyway, but
 *      failing this check with a clear 409 is far better than a raw D1
 *      constraint error surfacing to the admin.
 * Both failure modes 409 with `error: "stale"` — same code AddVenueForm's
 * existing 409 branch already renders `message` for (see that component's
 * own header); Reload only shows for `error === "conflict"` (#265), so this
 * reads as message-only, which is correct here — there is nothing to
 * reload, the suggestion is simply gone or already claimed.
 */
async function resolveAddProposalTarget(db: D1Database, proposalId: number): Promise<ResolveAddProposalResult> {
  const proposal = await db
    .prepare("SELECT target_venue_id, source FROM change_proposals WHERE id = ? AND change_type = 'add' AND status = 'pending'")
    .bind(proposalId)
    .first<PendingAddProposalRow>();
  if (!proposal) return { ok: false };

  const existing = await db.prepare("SELECT id FROM venues WHERE id = ?").bind(proposal.target_venue_id).first<{ id: string }>();
  if (existing) return { ok: false };

  return { ok: true, targetVenueId: proposal.target_venue_id, sourceType: proposal.source as AdminVenueSourceType };
}

export async function POST(req: NextRequest): Promise<Response> {
  let access: AdminDbAccess;
  try {
    access = await authorizeCreateRequest(req.headers);
  } catch (err) {
    return adminAuthErrorResponse(err);
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
  const proposalId = readOptionalProposalId(body);

  // #674: a proposalId claims a specific id/source_type (the scraper's own
  // — see this file's header) instead of minting a fresh manual-<uuid>. An
  // unresolvable proposal 409s outright rather than silently falling back
  // to a plain manual create — see resolveAddProposalTarget's own header.
  let addProposalTarget: { targetVenueId: string; sourceType: AdminVenueSourceType } | null = null;
  if (proposalId !== null) {
    const resolved = await resolveAddProposalTarget(db, proposalId);
    if (!resolved.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "stale",
          message: "This suggestion was already reviewed, or a place with this id already exists. Refresh Places and try again.",
        },
        { status: 409 },
      );
    }
    addProposalTarget = { targetVenueId: resolved.targetVenueId, sourceType: resolved.sourceType };
  }

  const id = addProposalTarget?.targetVenueId ?? `manual-${crypto.randomUUID()}`;
  const sourceType: AdminVenueSourceType = addProposalTarget?.sourceType ?? "manual";
  // Hoisted so the venue insert's audit row and the (#259) submission /
  // (#674) proposal approval below share one exact timestamp value.
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
    hours_irregular: fields.hoursIrregularJson,
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
    source_type: sourceType,
    outside_county: fields.outsideCounty,
    created_by: identity.email,
    updated_by: identity.email,
    published_at: null,
    published_by: null,
  };

  const insertVenue = db.prepare(VENUES_INSERT_SQL).bind(...buildVenueInsertValues(id, fields, identity.email, sourceType));
  const insertBox =
    fields.box !== null
      ? db
          .prepare(BOX_INSERT_SQL)
          .bind(id, fields.box.hostName, fields.box.hostNote, fields.box.hostContact, fields.box.mostNeeded, fields.box.installedOn, fields.box.removedOn)
      : null;
  // Blessing Boxes slice 3: a fresh blessing_box create always gets exactly
  // one 'added' box_events row (boxEventsForCreate returns [] for every
  // other category) — see src/lib/boxEvents.ts's own header for why this
  // rides the SAME batch as the venue/audit writes below.
  const insertBoxEvents = boxEventsForCreate(fields).map((e) =>
    db.prepare(BOX_EVENT_INSERT_SQL).bind(id, e.kind, e.detail, timestamp),
  );
  const insertAudit = db
    .prepare(AUDIT_INSERT_SQL)
    .bind(
      identity.email,
      "venue",
      id,
      "create",
      null,
      // host_contact included here even though it's never in a public
      // response — audit_log is admin-internal (AGENTS.md's own note on
      // this table), so the full box payload belongs in the create record.
      JSON.stringify(fields.box !== null ? { ...venueRowForAudit, box: fields.box } : venueRowForAudit),
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
  // #674: no WHERE-EXISTS guard on the venue INSERT itself (unlike PATCH's
  // proposal approval, adminVenueEditSql.ts's APPROVE_PROPOSAL_SQL) — the
  // pre-batch resolveAddProposalTarget() SELECT above is this route's own
  // equivalent check, and the INSERT has no `updated_at` precondition to
  // key an EXISTS guard off in the first place. Same accepted residual-race
  // ceiling applyApprovedProposal's own ponytail note documents (a TRUE
  // concurrent double-approve in the few-hundred-ms window between the
  // pre-check and this batch could still double-apply) — single-admin
  // internal tool, unchanged risk profile from every other proposalId/
  // submissionId flow in this file.
  const approveProposal =
    addProposalTarget !== null
      ? db.prepare(APPROVE_ADD_PROPOSAL_SQL).bind(identity.email, timestamp, timestamp, proposalId)
      : null;

  // Atomic: the venue row, its blessing_boxes row (if any), its box_events
  // lifecycle row(s) (if any), its audit trail, and (#259/#674) the
  // originating submission's or proposal's approval either all land
  // together or none does.
  await db.batch([
    insertVenue,
    ...(insertBox !== null ? [insertBox] : []),
    ...insertBoxEvents,
    insertAudit,
    ...(approveSubmission !== null ? [approveSubmission] : []),
    ...(approveProposal !== null ? [approveProposal] : []),
  ]);

  return NextResponse.json({ id }, { status: 201 });
}
