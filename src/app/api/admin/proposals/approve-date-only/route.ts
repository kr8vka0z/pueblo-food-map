/**
 * POST /api/admin/proposals/approve-date-only — bulk-approve the
 * "confirmed still present, nothing else changed" shape of `update`
 * proposal in one click, instead of one Approve click per card
 * (/admin/flags — see src/components/ProposalsReviewView.tsx's own header
 * for the button this route serves). The first real venue-refresh pipeline
 * run wrote 107 proposals; 89 were exactly this shape.
 *
 * Body: `{ ids: number[] }` — the client sends the EXACT ids it is showing
 * as date-only (ProposalsReviewView's own filtered-list computation, via
 * src/lib/adminProposals.ts's isDateOnlyUpdateProposal). Nothing about that
 * client-side list is trusted, though: every id is re-validated fresh
 * against D1 below before anything is applied — a stale page, a crafted id,
 * or a proposal that changed shape between page load and this click all
 * fail the same way, quietly skipped with a reason rather than applied.
 *
 * Auth: identical two-check pattern to every other admin mutation —
 * getAdminDb() then requireAdminOrigin() (src/lib/adminAuthErrors.ts's
 * shared 401-vs-403 mapping), same as
 * POST /api/admin/proposals/[id]/approve.
 *
 * **Never partial-fails the whole request.** Each id is independent: a bad
 * id is recorded in `skipped` and every other valid id still gets a chance
 * to apply. There is no scenario where one malformed id in a batch of 50
 * blocks the other 49 — that would make the "select-all" convenience worse
 * than clicking Approve 50 times individually, the exact problem this route
 * exists to remove. This includes an unexpected D1 throw mid-loop: the
 * per-id `applyApprovedProposal()` call is wrapped in its own try/catch, so
 * ids already applied before a later id's throw stay applied and are
 * correctly counted in the response's `approved` total — a 500 here would
 * otherwise tell the client "nothing was applied" while some ids already had.
 *
 * **Validation re-runs the FULL predicate against a fresh DB row, not the
 * client's claim.** status must be 'pending', change_type must be 'update',
 * fields_changed must be EXACTLY `["last_verified"]`, and source must be
 * 'osm' or 'plentiful' — `link_health` (routed to the venue edit screen
 * instead — see applyApprovedProposal's own header) and 'gtfs' can never
 * qualify, and neither can an 'add'/'remove' proposal, which is why
 * isDateOnlyUpdateProposal's own change_type check exists at all even
 * though the pipeline never emits a freshness-only add/remove today. Every
 * approved id still goes through applyApprovedProposal() — the SAME engine
 * a single Approve click uses, including its own stale-apply re-check
 * (§6.10c) against the current `venues` row — so a venue an admin hand-
 * edited moments ago is never blindly overwritten just because it arrived
 * via the bulk button.
 *
 * **D1's 100-bound-parameter ceiling (#397)** means the pre-validation
 * `SELECT * FROM change_proposals WHERE id IN (...)` can't bind more than
 * 100 ids in one statement — src/lib/d1.ts's chunkArray()/D1_MAX_BOUND_PARAMS
 * (extracted from src/app/admin/flags/page.tsx's own venue-lookup batching)
 * split the request's id list into ≤100-id chunks the same way that lookup
 * already does. The per-request cap below (200) is comfortably above what a
 * single admin's filtered "date-only" queue is ever likely to hold in one
 * sitting, but still finite — an unbounded `ids` array would otherwise let
 * one request bind an arbitrarily large batch of small per-proposal
 * db.batch() calls sequentially.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb, type AdminDbAccess } from "@/lib/adminDb";
import { requireAdminOrigin, type HeaderSource } from "@/lib/cfAccess";
import { adminAuthErrorResponse } from "@/lib/adminAuthErrors";
import { applyApprovedProposal, isDateOnlyUpdateProposal, parseProposalRow, type ChangeProposalRow } from "@/lib/adminProposals";
import { D1_MAX_BOUND_PARAMS, chunkArray } from "@/lib/d1";

async function authorizeBulkApproveRequest(headers: HeaderSource): Promise<AdminDbAccess> {
  const access = await getAdminDb(headers);
  requireAdminOrigin(headers);
  return access;
}

/** Cap chosen well above any real /admin/flags queue's date-only subset (the first production run's whole queue was 107 proposals total) while still bounding one request's worth of sequential db.batch() calls. */
const MAX_IDS_PER_REQUEST = 200;

/** `null` on any shape the client should never legitimately send — missing/non-array `ids`, an empty array, or a non-positive-integer entry — collapsed to one 400, distinct from a request that's shaped correctly but simply too long (checked separately by the caller so that case gets its own, more specific handling). */
function extractRequestedIds(body: unknown): number[] | null {
  if (typeof body !== "object" || body === null) return null;
  const ids = (body as Record<string, unknown>).ids;
  if (!Array.isArray(ids) || ids.length === 0) return null;
  const parsed: number[] = [];
  for (const raw of ids) {
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw <= 0) return null;
    parsed.push(raw);
  }
  return parsed;
}

/** One `SELECT ... WHERE id IN (...)` per chunk of ≤100 ids (see file header) — never a per-id lookup. */
async function loadProposalsByIds(db: D1Database, ids: number[]): Promise<Map<number, ChangeProposalRow>> {
  const map = new Map<number, ChangeProposalRow>();
  for (const batch of chunkArray(ids, D1_MAX_BOUND_PARAMS)) {
    const placeholders = batch.map(() => "?").join(", ");
    const result = await db
      .prepare(`SELECT * FROM change_proposals WHERE id IN (${placeholders})`)
      .bind(...batch)
      .all<ChangeProposalRow>();
    for (const row of result.results) {
      map.set(row.id, row);
    }
  }
  return map;
}

export async function POST(req: NextRequest): Promise<Response> {
  let access: AdminDbAccess;
  try {
    access = await authorizeBulkApproveRequest(req.headers);
  } catch (err) {
    return adminAuthErrorResponse(err);
  }
  const { db, identity } = access;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const requestedIds = extractRequestedIds(body);
  if (requestedIds === null) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  if (requestedIds.length > MAX_IDS_PER_REQUEST) {
    return NextResponse.json({ ok: false, error: "too_many_ids" }, { status: 400 });
  }

  // Dedupe — a repeated id in the client's list should apply once, not twice.
  const uniqueIds = [...new Set(requestedIds)];
  const proposalsById = await loadProposalsByIds(db, uniqueIds);

  let approved = 0;
  const skipped: { id: number; reason: string }[] = [];

  for (const id of uniqueIds) {
    const row = proposalsById.get(id);
    if (!row) {
      skipped.push({ id, reason: "Proposal not found." });
      continue;
    }
    // Re-validated fresh against THIS row, never the client's claim that it
    // was date-only at page-load time (file header).
    if (row.status !== "pending") {
      skipped.push({ id, reason: "No longer pending — it was already reviewed or superseded." });
      continue;
    }
    const parsed = parseProposalRow(row);
    if (parsed.parseError) {
      skipped.push({ id, reason: "Could not read this proposal's stored data." });
      continue;
    }
    if (!isDateOnlyUpdateProposal(row, parsed.diff)) {
      skipped.push({ id, reason: "Not a date-only update — this proposal changes more than the verification date." });
      continue;
    }

    // Same engine a single Approve click uses, own stale-apply re-check
    // included (applyApprovedProposal's own header). Wrapped in its own
    // try/catch (Reviewer finding, PR #417) — an uncaught D1 throw on id N
    // would otherwise 500 the whole request AFTER ids before N already
    // committed their own db.batch(), so the client's "nothing was applied"
    // fallback message would be a lie. Recording it as a skip instead keeps
    // the response's `approved` count always truthful, whatever happens to
    // any single id.
    try {
      const outcome = await applyApprovedProposal(db, row, identity);
      if (outcome.ok) {
        approved += 1;
      } else {
        skipped.push({ id, reason: outcome.message ?? outcome.error });
      }
    } catch {
      skipped.push({ id, reason: "internal error" });
    }
  }

  return NextResponse.json({ approved, skipped });
}
