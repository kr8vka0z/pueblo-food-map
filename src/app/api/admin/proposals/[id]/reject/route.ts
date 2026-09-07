/**
 * POST /api/admin/proposals/[id]/reject — dismiss a pending
 * `change_proposals` row (mirrors POST /api/admin/submissions/[id]/reject's
 * shape almost exactly — see that route's header for the fuller rationale
 * this one shares).
 *
 * A standalone write, not a batch: rejecting touches no `venues` row and
 * writes no `audit_log` entry. §6.7 (docs/admin/cloudflare-native-admin-spec.md):
 * "Rejecting OR superseding a proposal does not write a separate audit_log
 * row — change_proposals itself already carries reviewed_by/reviewed_at/
 * status... that IS the audit trail for an outcome that, by definition,
 * never touched venues."
 *
 * Correctness requirement 3 from the issue — rejection memory must actually
 * work: scripts/refresh/diffEngine.ts's rejectionKey() suppression reads
 * `SELECT source, target_venue_id, diff_hash FROM change_proposals WHERE
 * status = 'rejected'`. This UPDATE only ever flips `status` on the EXACT
 * row diffEngine already wrote `source`/`target_venue_id`/`diff_hash` onto
 * — none of those three columns are touched here — so a rejected proposal
 * is guaranteed to be found by that lookup on the next refresh run. See
 * src/lib/adminProposals.test.ts / this route's own test file for the
 * regression guard proving the row's dedup-key columns survive a reject
 * byte-for-byte.
 *
 * `D1Result.meta.changes === 0` (unknown id, or already reviewed —
 * correctness requirement 1, the supersede race) returns 404, never a
 * silent 200 — identical convention to the submissions reject route.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb, type AdminDbAccess } from "@/lib/adminDb";
import { requireAdminOrigin, type HeaderSource } from "@/lib/cfAccess";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";

async function authorizeRejectRequest(headers: HeaderSource): Promise<AdminDbAccess> {
  const access = await getAdminDb(headers);
  requireAdminOrigin(headers);
  return access;
}

const REJECT_PROPOSAL_SQL =
  "UPDATE change_proposals SET status = 'rejected', reviewed_by = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  let access: AdminDbAccess;
  try {
    access = await authorizeRejectRequest(req.headers);
  } catch (err) {
    return adminAuthErrorResponse(err);
  }
  const { db, identity } = access;

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const timestamp = new Date().toISOString();
  const result = await db.prepare(REJECT_PROPOSAL_SQL).bind(identity.email, timestamp, id).run();

  if (result.meta.changes === 0) {
    return NextResponse.json(
      { ok: false, error: "stale", message: "This proposal is no longer current — it was already reviewed or superseded." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
