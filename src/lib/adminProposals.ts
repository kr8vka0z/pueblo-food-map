/**
 * adminProposals.ts — pure parsing + lifecycle-correctness logic for the
 * `/admin/flags` change-proposal review queue (issue: build the screen that
 * consumes what scripts/refresh-ingest.ts + scripts/refresh/diffEngine.ts
 * write into `change_proposals` — migrations/0001_init_admin_schema.sql).
 *
 * Kept free of D1/fetch (same reasoning diffEngine.ts's own header gives):
 * the one thing that actually has to be right here — does this proposal's
 * assumption still hold against the CURRENT venue row — is exactly the kind
 * of logic a wrong answer either silently discards a real admin edit
 * (over-eager apply) or nags an admin forever with a proposal that can never
 * cleanly apply (over-eager staleness). Both failure modes are cheap to
 * catch with plain fixtures here; neither is cheap to catch by reading
 * production D1 after the fact.
 *
 * WHY this reuses diffEngine.ts's own currentFieldValue()/valuesEqual()
 * rather than re-deriving field equality: the stale-apply guard (§6.10c,
 * docs/admin/cloudflare-native-admin-spec.md) exists specifically to
 * re-check a proposal's `before` snapshot against a fresh D1 read using the
 * SAME comparison the diff engine used to produce that snapshot in the
 * first place. A second, independently-written comparison would risk
 * silently diverging from it — e.g. hours_weekly's day-key-sorted JSON
 * normalization — which could misclassify a genuinely-unchanged field as
 * "moved" (false staleness) or the reverse (a real change let through).
 */

import type { AdminVenueRow, AdminVenueSourceType, Venue } from "@/types/venue";
import { currentFieldValue, valuesEqual, type CurrentVenueRow } from "../../scripts/refresh/diffEngine";

// ─── Row + parsed-diff shapes ───────────────────────────────────────────────

/** Mirrors the `change_proposals` CHECK constraints (migrations/0001_init_admin_schema.sql). */
export type ProposalStatus = "pending" | "approved" | "rejected" | "superseded";
export type ProposalSourceValue = "osm" | "plentiful" | "gtfs" | "link_health";
export type ProposalChangeType = "add" | "update" | "remove";

/** One full row of the D1 `change_proposals` table. */
export interface ChangeProposalRow {
  id: number;
  source: string;
  target_venue_id: string;
  change_type: string;
  proposed_diff: string; // JSON text — see ProposedDiff below
  diff_hash: string;
  run_id: string;
  anomaly: number;
  status: string;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  applied_at: string | null;
}

/** Mirrors change_proposals.proposed_diff's one shape for every source (schema comment, migrations/0001; scripts/refresh/diffEngine.ts's own ProposedDiff). */
export interface ProposedDiff {
  before: Partial<Venue> | null;
  after: Partial<Venue> | null;
  fields_changed: string[];
  meta?: Record<string, unknown>;
}

export type ParsedProposal =
  | { row: ChangeProposalRow; parseError: false; diff: ProposedDiff }
  | { row: ChangeProposalRow; parseError: true; diff: null };

/**
 * Parses one D1 row's `proposed_diff` JSON, degrading to `parseError: true`
 * on any bad JSON rather than throwing — same per-row defensive pattern
 * src/app/admin/submissions/page.tsx's parseSubmissionRow already
 * established: one malformed row must degrade to that single card's own
 * error state, never blank the whole queue or 500 the page.
 */
export function parseProposalRow(row: ChangeProposalRow): ParsedProposal {
  try {
    const diff = JSON.parse(row.proposed_diff) as ProposedDiff;
    return { row, parseError: false, diff };
  } catch {
    return { row, parseError: true, diff: null };
  }
}

// ─── "Date-only update" predicate (issue: bulk-approve /admin/flags) ───────

/**
 * Sources whose freshness-only pings are trusted enough to blanket-approve.
 * `gtfs` is deliberately excluded (diffEngine.ts never emits a
 * freshness-only `gtfs` proposal today, and this predicate names an
 * allowlist rather than everything-but-link_health so a future new source
 * doesn't silently gain bulk-approval by omission). `link_health` can never
 * qualify regardless — it is a dead-link finding routed to the venue edit
 * screen, never approved directly (see applyApprovedProposal's own header).
 */
const DATE_ONLY_BULK_SOURCES: ReadonlySet<string> = new Set(["osm", "plentiful"]);

/**
 * True for exactly the shape the first production pipeline run mostly
 * produced (89 of 107 proposals): "still there, nothing else changed." Used
 * by BOTH the client (ProposalsReviewView, to compute which currently-
 * visible cards the bulk button would approve) and the server
 * (POST /api/admin/proposals/approve-date-only, to re-validate each
 * requested id from a fresh DB read) — a single predicate so the two can
 * never quietly diverge on what counts as "date-only."
 *
 * Deliberately narrower than "every update proposal touching only one
 * field": `fields_changed` must be EXACTLY `["last_verified"]`, not merely
 * contain it — a proposal that also moved, say, `phone` is a real change an
 * admin should eyeball, never something to wave through in bulk.
 */
export function isDateOnlyUpdateProposal(
  row: Pick<ChangeProposalRow, "change_type" | "source">,
  diff: ProposedDiff,
): boolean {
  if (row.change_type !== "update") return false;
  if (!DATE_ONLY_BULK_SOURCES.has(row.source)) return false;
  return diff.fields_changed.length === 1 && diff.fields_changed[0] === "last_verified";
}

// ─── Stale-apply guard (spec §6.10c) ────────────────────────────────────────

/**
 * The stale-apply guard's input shape: a real, freshly-read `venues` row, or
 * null when target_venue_id no longer exists at all. A full AdminVenueRow
 * structurally satisfies diffEngine's own CurrentVenueRow (every field that
 * type needs — id/name/category/lat/lng/address/hours_weekly/phone/url/
 * operator/last_verified — is present with a compatible type), so this is a
 * type alias, not a second shape to keep in sync.
 */
export type CurrentVenueLookup = AdminVenueRow & CurrentVenueRow;

export interface StaleApplyResult {
  stale: boolean;
  /** Human-readable, shown to the reviewing admin when stale — absent when stale is false. */
  reason?: string;
}

/**
 * §6.10c: "before executing the mutation, the handler re-reads the current
 * `venues` row for target_venue_id and re-checks it against
 * proposed_diff.before — but scoped to what that proposal actually
 * asserts, not the whole row." The narrow per-type scope is load-bearing,
 * not a simplification — see AGENTS.md's "#235 reconciliation" note (also
 * quoted in the spec) for the concrete case a whole-row check would
 * misfire on: two independent proposals from different sources can
 * legitimately target the same venue at once (a link_health url-clear and
 * an osm remove), and a coarse "does the whole row still match" check would
 * falsely stale-out the second one after the first is approved.
 */
export function checkStaleApply(
  changeType: ProposalChangeType,
  currentRow: CurrentVenueLookup | null,
  diff: ProposedDiff,
): StaleApplyResult {
  switch (changeType) {
    case "add":
      // Only re-checks: no CONFLICTING non-archived row now exists with
      // this id. An archived row is fine — that's a restore (§6.7), not a
      // conflict; a missing row is fine — that's the common fresh-add case.
      if (currentRow && currentRow.status !== "archived") {
        return { stale: true, reason: "A venue with this id already exists and isn't removed from the map." };
      }
      return { stale: false };

    case "remove":
      // Only re-checks: the row is still non-archived — a remove proposal
      // carries no field diff to re-verify (diffEngine's buildProposal for
      // change_type "remove" always writes fields_changed: []).
      if (!currentRow) {
        return { stale: true, reason: "This venue no longer exists." };
      }
      if (currentRow.status === "archived") {
        return { stale: true, reason: "This venue is already removed from the map." };
      }
      return { stale: false };

    case "update": {
      if (!currentRow || currentRow.status === "archived") {
        return { stale: true, reason: "This venue no longer exists or was already removed from the map." };
      }
      const before = (diff.before ?? {}) as Partial<Venue>;
      for (const field of diff.fields_changed) {
        const key = field as keyof Venue;
        const beforeValue = currentFieldValue(before as unknown as CurrentVenueRow, key);
        const nowValue = currentFieldValue(currentRow, key);
        if (!valuesEqual(beforeValue, nowValue)) {
          return {
            stale: true,
            reason: `This venue's "${field}" changed since the proposal was generated.`,
          };
        }
      }
      return { stale: false };
    }
  }
}

// ─── Applying an approved proposal's field diff (spec §6.7) ────────────────

/** D1 storage form of one Venue field's value — hours_weekly is JSON text in `venues`, a parsed object in `Venue`/ProposedDiff. */
export function toColumnValue(field: keyof Venue, value: unknown): unknown {
  if (field === "hours_weekly") {
    if (value === null || value === undefined) return null;
    return JSON.stringify(value);
  }
  return value === undefined ? null : value;
}

/** Venue.accepts_snap/accepts_wic (optional boolean) -> the venues table's tri-state INTEGER column (NULL=unknown, 0=no, 1=yes). */
export function toTriState(value: boolean | undefined): number | null {
  if (value === undefined) return null;
  return value ? 1 : 0;
}

// ─── Applying an approval end-to-end (spec §6.7) ───────────────────────────
//
// Extracted from the original single-proposal POST
// /api/admin/proposals/[id]/approve handler (issue: "Approve all date-only
// updates") so POST /api/admin/proposals/approve-date-only (bulk) runs the
// EXACT same add/update/remove branching, stale-apply guard, and atomic
// db.batch() shape per id, rather than a second hand-copied engine that
// could silently drift from the single-approve path's correctness
// guarantees. The single-proposal route's own behaviour/response shapes are
// unchanged by this move — it now delegates to applyApprovedProposal()
// instead of inlining this logic.

/** Actor identity recorded on the venue mutation + audit row — the reviewing admin from the caller's OWN Better Auth session, never the pipeline's bot identity that generated the proposal. Narrowed to just the field this module needs, not the full AdminIdentity shape (cfAccess.ts) — keeps this file's D1-adjacent code from importing an auth type it only uses for one string field. */
export interface ApprovingIdentity {
  email: string;
}

/**
 * `link_health` proposals are rejected here (400), never applied — a
 * dead-link finding is not a field edit to blindly apply (the issue's own
 * instruction); it is routed to the venue's edit screen instead (PATCH
 * /api/admin/venues/[id]'s optional `proposalId`). This also means
 * `isDateOnlyUpdateProposal` above is redundant defense-in-depth for the
 * bulk route specifically, not this function's only guard against it.
 */
export type ApplyApprovedProposalResult =
  | { ok: true; status: 200; targetVenueId: string; changeType: ProposalChangeType }
  | { ok: false; status: number; error: string; message?: string };

const AUDIT_INSERT_SQL =
  "INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)";

// `WHERE id = ? AND status = 'pending'` closes the supersede-race window —
// see applyApprovedProposal's own header, correctness requirement 1 in the
// original route's design (still true here: a later pipeline run may flip
// this row to 'superseded' between the caller's fresh SELECT and this
// batch running). D1Result.meta.changes on THIS statement is what the
// caller checks after the batch runs, below.
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

/**
 * Applies one PENDING `change_proposals` row. Callers are responsible for
 * the two checks that precede this in every route that uses it: validating
 * the id shape, and re-SELECTing the row fresh immediately beforehand to
 * confirm `status === 'pending'` (the supersede-race re-check, correctness
 * requirement 1) — this function trusts `proposalRow` is that fresh pending
 * row and does not re-fetch change_proposals itself.
 *
 * Correctness requirement 2 (stale-apply, §6.10c, checkStaleApply above):
 * re-verifies the proposal's assumption against a FRESH read of the current
 * `venues` row, scoped to exactly what that proposal asserts, and marks it
 * 'superseded' (not applied) when the data has moved on.
 *
 * (ponytail: the venue mutation inside the batch below is not itself
 * conditioned on the SAME WHERE clause as the change_proposals UPDATE — D1's
 * batch has no "roll back statement 1 if statement 3 affected 0 rows"
 * primitive — so a TRUE concurrent double-approve in the few-hundred-ms
 * window between the pre-check and the batch could still double-apply.
 * Single-admin internal tool, same residual-race tolerance already accepted
 * for public_submissions' submissionId idempotency ceiling. Upgrade path: a
 * D1 transaction with a real CAS, once D1 supports one.)
 */
export async function applyApprovedProposal(
  db: D1Database,
  proposalRow: ChangeProposalRow,
  identity: ApprovingIdentity,
): Promise<ApplyApprovedProposalResult> {
  if (proposalRow.source === "link_health") {
    return {
      ok: false,
      status: 400,
      error: "link_health_requires_edit",
      message: "Dead-link findings are resolved from the venue's edit screen, not approved directly.",
    };
  }

  const parsed = parseProposalRow(proposalRow);
  if (parsed.parseError) {
    return { ok: false, status: 422, error: "corrupted_proposal" };
  }
  const { diff } = parsed;
  const changeType = proposalRow.change_type as ProposalChangeType;

  const currentRow = await db
    .prepare("SELECT * FROM venues WHERE id = ?")
    .bind(proposalRow.target_venue_id)
    .first<AdminVenueRow>();

  const staleCheck = checkStaleApply(changeType, currentRow as CurrentVenueLookup | null, diff);
  if (staleCheck.stale) {
    const now = new Date().toISOString();
    await db.prepare(SUPERSEDE_PROPOSAL_SQL).bind(now, proposalRow.id).run();
    return { ok: false, status: 409, error: "stale", message: staleCheck.reason };
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
    const fields = diff.fields_changed.filter((f) => APPLIABLE_VENUE_FIELDS.has(f as keyof Venue));
    if (fields.length === 0) {
      return { ok: false, status: 422, error: "nothing_to_apply" };
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
  const approveProposal = db.prepare(APPROVE_PROPOSAL_SQL).bind(identity.email, timestamp, timestamp, proposalRow.id);

  const results = await db.batch([venueStmt, insertAudit, approveProposal]);
  const approveResult = results[2];
  if (approveResult.meta.changes === 0) {
    // Correctness requirement 1's belt: a true concurrent race (see this
    // function's own ponytail note above) — never silently report success
    // on a proposal that was actually resolved by someone/something else a
    // moment ago.
    return {
      ok: false,
      status: 409,
      error: "stale",
      message: "This proposal was already reviewed by the time this request completed.",
    };
  }

  return { ok: true, status: 200, targetVenueId: proposalRow.target_venue_id, changeType };
}
