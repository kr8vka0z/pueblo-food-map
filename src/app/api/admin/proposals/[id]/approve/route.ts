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
 * This route only owns the two checks that must happen ONCE per id before
 * any apply logic runs: validating the id shape, and the supersede-race
 * re-check below. Everything after that — the link_health carve-out, the
 * stale-apply guard, and the atomic db.batch() — lives in
 * src/lib/adminProposals.ts's applyApprovedProposal(), shared with
 * POST /api/admin/proposals/approve-date-only (the bulk route added
 * alongside it) so both routes apply a proposal through the exact same
 * engine rather than two copies that could drift.
 *
 * Correctness requirement 1 (supersede race) — a later pipeline run may
 * flip this row to 'superseded' between page load and this click.
 * Re-SELECTs the proposal fresh at request time (never trusts client-cached
 * state) and checks `status === 'pending'` before calling
 * applyApprovedProposal() at all; that function's own APPROVE_PROPOSAL_SQL
 * ALSO carries `AND status = 'pending'` and checks `meta.changes` after its
 * batch runs — never a silent 200 on a stale proposal.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb, type AdminDbAccess } from "@/lib/adminDb";
import { requireAdminOrigin, type HeaderSource } from "@/lib/cfAccess";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";
import { applyApprovedProposal, type ChangeProposalRow } from "@/lib/adminProposals";

async function authorizeApproveRequest(headers: HeaderSource): Promise<AdminDbAccess> {
  const access = await getAdminDb(headers);
  requireAdminOrigin(headers);
  return access;
}

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

  const outcome = await applyApprovedProposal(db, proposalRow, identity);
  if (!outcome.ok) {
    return NextResponse.json(
      { ok: false, error: outcome.error, ...(outcome.message !== undefined ? { message: outcome.message } : {}) },
      { status: outcome.status },
    );
  }
  return NextResponse.json({ ok: true, id, targetVenueId: outcome.targetVenueId, changeType: outcome.changeType });
}
