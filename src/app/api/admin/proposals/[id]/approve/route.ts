/**
 * POST /api/admin/proposals/[id]/approve — apply one pending
 * `change_proposals` row to `venues` (the review UI the automated
 * venue-refresh pipeline — scripts/refresh-ingest.ts, scripts/refresh/
 * diffEngine.ts, #388 — has been writing into with nothing to read it).
 *
 * Auth: identical two-check pattern to every other admin mutation —
 * getAdminDb() then requireAdminOrigin(), both throwing AccessDeniedError
 * into one 403 shape (src/lib/adminAuthErrors.ts).
 *
 * §6.7's core design decision (docs/admin/cloudflare-native-admin-spec.md):
 * approving a proposal performs exactly the same D1 mutation and audit_log
 * write a manual create/edit/archive already makes — nothing new to
 * venues.status semantics, nothing new to audit_log.action's enum. The only
 * difference is where the field values came from (proposed_diff instead of
 * a human typing into a form) and who's recorded as the actor (the
 * REVIEWING admin, not a bot identity).
 *
 * `link_health` proposals are explicitly rejected here (400) rather than
 * applied — per the issue's own instruction, a dead-link finding is not a
 * field edit to blindly apply; it's routed to the venue's edit screen
 * instead (PATCH /api/admin/venues/[id]'s new optional `proposalId`, see
 * that route's header) so the admin decides what the corrected URL (or its
 * removal) should actually be.
 *
 * Two correctness requirements from the issue, both load-bearing:
 *
 * 1. Supersede race — a later pipeline run may flip this row to
 *    'superseded' between page load and this click. Re-SELECTs the
 *    proposal fresh at request time (never trusts client-cached state) and
 *    checks `status === 'pending'` before doing anything; the
 *    change_proposals UPDATE inside the batch below ALSO carries
 *    `AND status = 'pending'` and its own `meta.changes` is checked after
 *    the batch runs — never a silent 200 on a stale proposal. (ponytail:
 *    the batch's venue mutation is not itself conditioned on that same
 *    WHERE clause — D1's batch has no "roll back statement 1 if statement
 *    3 affected 0 rows" primitive — so a TRUE concurrent double-approve in
 *    the few-hundred-ms window between the pre-check and the batch could
 *    still double-apply. Single-admin internal tool, same residual-race
 *    tolerance already accepted for public_submissions' submissionId
 *    idempotency ceiling — AGENTS.md "Public submissions review queue".
 *    Upgrade path: a D1 transaction with a real CAS, once D1 supports one.)
 * 2. Stale-apply — §6.10c (src/lib/adminProposals.ts's checkStaleApply):
 *    re-verifies the proposal's assumption against a FRESH read of the
 *    current venue row, scoped to exactly what that proposal asserts, and
 *    marks it 'superseded' (not applied) when the data has moved on.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb, type AdminDbAccess } from "@/lib/adminDb";
import { requireAdminOrigin, type HeaderSource } from "@/lib/cfAccess";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";
import {
  checkStaleApply,
  parseProposalRow,
  toColumnValue,
  toTriState,
  type ChangeProposalRow,
  type CurrentVenueLookup,
} from "@/lib/adminProposals";
import type { AdminVenueRow, AdminVenueSourceType, Venue } from "@/types/venue";

async function authorizeApproveRequest(headers: HeaderSource): Promise<AdminDbAccess> {
  const access = await getAdminDb(headers);
  requireAdminOrigin(headers);
  return access;
}

const AUDIT_INSERT_SQL =
  "INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)";

// `WHERE id = ? AND status = 'pending'` closes the supersede-race window
// (see file header, correctness requirement 1) — D1Result.meta.changes on
// THIS statement is what the route checks after the batch runs.
const APPROVE_PROPOSAL_SQL =
  "UPDATE change_proposals SET status = 'approved', reviewed_by = ?, reviewed_at = ?, applied_at = ? WHERE id = ? AND status = 'pending'";

const SUPERSEDE_PROPOSAL_SQL =
  "UPDATE change_proposals SET status = 'superseded', reviewed_at = ? WHERE id = ? AND status = 'pending'";

// Only these Venue fields ever appear in a proposal's fields_changed
// (scripts/refresh/diffEngine.ts's SOURCE_OWNED_FIELDS ∪ link_health's own
// ["url"] ∪ "last_verified", which every update/add proposal always
// carries) — an allowlist here is defense-in-depth against ever
// string-interpolating an unrecognized column name into SQL from a JSON
// blob this app itself wrote, not a defense against an external attacker
// (proposed_diff is never attacker-controlled input).
const APPLIABLE_VENUE_FIELDS = new Set<keyof Venue>([
  "name",
  "category",
  "lat",
  "lng",
  "address",
  "phone",
  "url",
  "hours_weekly",
  "operator",
  "last_verified",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  let access: AdminDbAccess;
  try {
    access = await authorizeApproveRequest(req.headers);
  } catch (err) {
    return adminAuthErrorResponse(err);
  }
  const { db, identity } = access;

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const proposalRow = await db.prepare("SELECT * FROM change_proposals WHERE id = ?").bind(id).first<ChangeProposalRow>();
  if (!proposalRow) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  // Correctness requirement 1 (supersede race): re-checked fresh at request
  // time, not from whatever the reviewer's page happened to show when it
  // loaded — a later pipeline run's auto-supersede (§6.10a) may have flipped
  // this row in the meantime.
  if (proposalRow.status !== "pending") {
    return NextResponse.json(
      { ok: false, error: "stale", message: "This proposal is no longer current — it was already reviewed or superseded." },
      { status: 409 },
    );
  }

  if (proposalRow.source === "link_health") {
    return NextResponse.json(
      { ok: false, error: "link_health_requires_edit", message: "Dead-link findings are resolved from the venue's edit screen, not approved directly." },
      { status: 400 },
    );
  }

  const parsed = parseProposalRow(proposalRow);
  if (parsed.parseError) {
    return NextResponse.json({ ok: false, error: "corrupted_proposal" }, { status: 422 });
  }
  const { diff } = parsed;
  const changeType = proposalRow.change_type as "add" | "update" | "remove";

  const currentRow = await db
    .prepare("SELECT * FROM venues WHERE id = ?")
    .bind(proposalRow.target_venue_id)
    .first<AdminVenueRow>();

  // Correctness requirement 2 (stale-apply, §6.10c): scoped per proposal
  // type — see src/lib/adminProposals.ts's own header for why a whole-row
  // check would misfire.
  const staleCheck = checkStaleApply(changeType, currentRow as CurrentVenueLookup | null, diff);
  if (staleCheck.stale) {
    const now = new Date().toISOString();
    await db.prepare(SUPERSEDE_PROPOSAL_SQL).bind(now, id).run();
    return NextResponse.json({ ok: false, error: "stale", message: staleCheck.reason }, { status: 409 });
  }

  const timestamp = new Date().toISOString();
  const after = diff.after ?? {};

  // D1PreparedStatement isn't among cloudflare-env.d.ts's narrow runtime
  // imports (see that file's own header for why this project avoids a bare
  // `wrangler types` include) — derived from D1Database's own method
  // signature instead of adding a second ambient import for one local type.
  let venueStmt: ReturnType<D1Database["prepare"]>;
  let auditAction: "create" | "update" | "archive";
  let beforeJson: string | null;
  let afterRowForAudit: unknown;

  if (changeType === "remove") {
    const existing = currentRow!;
    const afterRow: AdminVenueRow = { ...existing, status: "archived", updated_by: identity.email, updated_at: timestamp };
    venueStmt = db
      .prepare("UPDATE venues SET status = 'archived', updated_by = ?, updated_at = ? WHERE id = ?")
      .bind(identity.email, timestamp, proposalRow.target_venue_id);
    auditAction = "archive";
    beforeJson = JSON.stringify(existing);
    afterRowForAudit = afterRow;
  } else if (changeType === "update") {
    const existing = currentRow!;
    const fields = proposalRow.change_type === "update" ? diff.fields_changed.filter((f) => APPLIABLE_VENUE_FIELDS.has(f as keyof Venue)) : [];
    if (fields.length === 0) {
      return NextResponse.json({ ok: false, error: "nothing_to_apply" }, { status: 422 });
    }
    const setClauses = fields.map((f) => `${f} = ?`);
    const values = fields.map((f) => toColumnValue(f as keyof Venue, (after as Record<string, unknown>)[f]));
    venueStmt = db
      .prepare(`UPDATE venues SET ${setClauses.join(", ")}, updated_by = ?, updated_at = ? WHERE id = ?`)
      .bind(...values, identity.email, timestamp, proposalRow.target_venue_id);
    const afterRow: AdminVenueRow = { ...existing, updated_by: identity.email, updated_at: timestamp };
    for (const f of fields) {
      (afterRow as unknown as Record<string, unknown>)[f] = toColumnValue(f as keyof Venue, (after as Record<string, unknown>)[f]);
    }
    auditAction = "update";
    beforeJson = JSON.stringify(existing);
    afterRowForAudit = afterRow;
  } else {
    // 'add' — a fresh id (plain INSERT) or a restore of an archived row
    // (UPDATE, §6.7's upsert semantics — every field overwritten from
    // `after`, forced status='draft').
    const isRestore = currentRow !== null; // stale-apply already proved: if present, it's archived
    const sourceType = proposalRow.source as AdminVenueSourceType;
    const afterVenue = after as Partial<Venue>;

    if (isRestore) {
      const existing = currentRow!;
      const afterRow: AdminVenueRow = {
        ...existing,
        name: afterVenue.name ?? existing.name,
        category: (afterVenue.category as AdminVenueRow["category"]) ?? existing.category,
        lat: afterVenue.lat ?? existing.lat,
        lng: afterVenue.lng ?? existing.lng,
        address: afterVenue.address ?? existing.address,
        hours_weekly: toColumnValue("hours_weekly", afterVenue.hours_weekly) as string | null,
        accepts_snap: toTriState(afterVenue.accepts_snap),
        accepts_wic: toTriState(afterVenue.accepts_wic),
        phone: (afterVenue.phone ?? null) as string | null,
        email: (afterVenue.email ?? null) as string | null,
        url: (afterVenue.url ?? null) as string | null,
        notes: (afterVenue.notes ?? null) as string | null,
        operator: (afterVenue.operator ?? null) as string | null,
        source: afterVenue.source ?? existing.source,
        last_verified: afterVenue.last_verified ?? existing.last_verified,
        status: "draft",
        source_type: sourceType,
        updated_by: identity.email,
        updated_at: timestamp,
      };
      venueStmt = db
        .prepare(
          `UPDATE venues SET name = ?, category = ?, lat = ?, lng = ?, address = ?, hours_weekly = ?,
           accepts_snap = ?, accepts_wic = ?, phone = ?, email = ?, url = ?, notes = ?, operator = ?,
           source = ?, last_verified = ?, status = 'draft', source_type = ?, updated_by = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(
          afterRow.name,
          afterRow.category,
          afterRow.lat,
          afterRow.lng,
          afterRow.address,
          afterRow.hours_weekly,
          afterRow.accepts_snap,
          afterRow.accepts_wic,
          afterRow.phone,
          afterRow.email,
          afterRow.url,
          afterRow.notes,
          afterRow.operator,
          afterRow.source,
          afterRow.last_verified,
          sourceType,
          identity.email,
          timestamp,
          proposalRow.target_venue_id,
        );
      auditAction = "update";
      beforeJson = JSON.stringify(existing);
      afterRowForAudit = afterRow;
    } else {
      const newRow: AdminVenueRow = {
        id: proposalRow.target_venue_id,
        name: afterVenue.name ?? "",
        category: (afterVenue.category as AdminVenueRow["category"]) ?? "pantry",
        lat: afterVenue.lat ?? 0,
        lng: afterVenue.lng ?? 0,
        address: afterVenue.address ?? "",
        hours_weekly: toColumnValue("hours_weekly", afterVenue.hours_weekly) as string | null,
        accepts_snap: toTriState(afterVenue.accepts_snap),
        accepts_wic: toTriState(afterVenue.accepts_wic),
        phone: (afterVenue.phone ?? null) as string | null,
        email: (afterVenue.email ?? null) as string | null,
        url: (afterVenue.url ?? null) as string | null,
        notes: (afterVenue.notes ?? null) as string | null,
        operator: (afterVenue.operator ?? null) as string | null,
        source: afterVenue.source ?? "",
        last_verified: afterVenue.last_verified ?? timestamp.slice(0, 10),
        status: "draft",
        source_type: sourceType,
        outside_county: 0,
        created_at: timestamp,
        created_by: identity.email,
        updated_at: timestamp,
        updated_by: identity.email,
        published_at: null,
        published_by: null,
      };
      venueStmt = db
        .prepare(
          `INSERT INTO venues (id, name, category, lat, lng, address, hours_weekly, accepts_snap, accepts_wic,
           phone, email, url, notes, operator, source, last_verified, status, source_type, outside_county,
           created_by, updated_by, published_at, published_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          newRow.id,
          newRow.name,
          newRow.category,
          newRow.lat,
          newRow.lng,
          newRow.address,
          newRow.hours_weekly,
          newRow.accepts_snap,
          newRow.accepts_wic,
          newRow.phone,
          newRow.email,
          newRow.url,
          newRow.notes,
          newRow.operator,
          newRow.source,
          newRow.last_verified,
          "draft", // bound, not a SQL literal — matches POST /api/admin/venues's own VENUES_INSERT_COLUMNS convention
          sourceType,
          newRow.outside_county,
          identity.email,
          identity.email,
          null,
          null,
        );
      auditAction = "create";
      beforeJson = null;
      afterRowForAudit = newRow;
    }
  }

  const insertAudit = db
    .prepare(AUDIT_INSERT_SQL)
    .bind(identity.email, "venue", proposalRow.target_venue_id, auditAction, beforeJson, JSON.stringify(afterRowForAudit), timestamp);
  const approveProposal = db.prepare(APPROVE_PROPOSAL_SQL).bind(identity.email, timestamp, timestamp, id);

  const results = await db.batch([venueStmt, insertAudit, approveProposal]);
  const approveResult = results[2];
  if (approveResult.meta.changes === 0) {
    // Correctness requirement 1's belt: a true concurrent race (see file
    // header ponytail note) — never silently report success on a proposal
    // that was actually resolved by someone/something else a moment ago.
    return NextResponse.json(
      { ok: false, error: "stale", message: "This proposal was already reviewed by the time this request completed." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, id, targetVenueId: proposalRow.target_venue_id, changeType });
}
