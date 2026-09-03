/**
 * /admin/flags — the change-proposal review queue: the screen that consumes
 * what scripts/refresh-ingest.ts + scripts/refresh/diffEngine.ts (#388) have
 * been writing into `change_proposals` since the pipeline shipped, with
 * nothing to read them until this page. Named `/admin/flags` to match
 * docs/admin/cloudflare-native-admin-spec.md §6.6's own name for this
 * screen (already referenced from AGENTS.md's "Automated venue-refresh
 * pipeline" section and the refresh-proposals.yml workflow header) rather
 * than inventing a second name for the same thing.
 *
 * Same Better Auth chain and page shape as every other admin surface
 * (AGENTS.md "Admin authentication"; src/app/admin/submissions/page.tsx,
 * whose pattern this mirrors closely): getAdminDb() verifies identity
 * before this page renders anything, failing closed via handlePageAuthError.
 * This page only SELECTs, so — like /admin/submissions — it has no
 * requireAdminOrigin() CSRF check of its own (that guard is for non-GET
 * /api/admin/* mutations).
 *
 * Query: `WHERE status = 'pending' ORDER BY created_at DESC` — only what
 * still needs a decision; approved/rejected/superseded rows simply stop
 * appearing once their status flips (no separate "history" view here, same
 * scope boundary /admin/submissions draws).
 *
 * `proposed_diff` is parsed PER ROW (parseProposalRow, src/lib/adminProposals.ts)
 * so one malformed row degrades to that single card's own "couldn't read
 * details" state (ProposalsReviewView's parseError branch) rather than
 * blanking the whole queue or 500ing the page — identical defensive shape to
 * /admin/submissions' own parseSubmissionRow.
 *
 * Venue names for the card headers: `update`/`remove` proposals only carry
 * a field diff in `proposed_diff` (not necessarily the venue's `name`,
 * unless name itself is one of the changed fields), so this page runs ONE
 * extra `SELECT id, name FROM venues WHERE id IN (...)` across every
 * target_venue_id in the current page of proposals, rather than a per-row
 * lookup — the same "one query, not N" discipline
 * src/lib/adminVenues.ts's summarizePublishChanges already follows.
 */

import { headers } from "next/headers";
import Link from "next/link";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import { parseProposalRow, type ChangeProposalRow, type ParsedProposal } from "@/lib/adminProposals";
import ProposalsReviewView from "@/components/ProposalsReviewView";

interface VenueLookupRow {
  id: string;
  name: string;
  status: string;
}

export interface VenueLookup {
  name: string;
  status: string;
}

/**
 * One `SELECT ... WHERE id IN (...)` for every target_venue_id on this
 * page — never a per-row lookup. Returns an empty map for an empty input
 * rather than issuing a query with no placeholders (invalid SQL). Carries
 * `status` alongside `name` so ProposalsReviewView can label an `add`
 * proposal targeting an already-archived id "Restore" instead of "New" —
 * spec §6.6's "Restore" labeling — without a second query.
 */
async function loadVenueLookup(db: D1Database, ids: string[]): Promise<Record<string, VenueLookup>> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return {};
  const placeholders = uniqueIds.map(() => "?").join(", ");
  const result = await db
    .prepare(`SELECT id, name, status FROM venues WHERE id IN (${placeholders})`)
    .bind(...uniqueIds)
    .all<VenueLookupRow>();
  const map: Record<string, VenueLookup> = {};
  for (const row of result.results) map[row.id] = { name: row.name, status: row.status };
  return map;
}

export default async function FlagsPage() {
  let email: string;
  let proposals: ParsedProposal[];
  let venueLookup: Record<string, VenueLookup>;

  try {
    const { db, identity } = await getAdminDb(await headers());
    email = identity.email;
    const result = await db
      .prepare("SELECT * FROM change_proposals WHERE status = 'pending' ORDER BY created_at DESC")
      .all<ChangeProposalRow>();
    proposals = result.results.map(parseProposalRow);
    venueLookup = await loadVenueLookup(
      db,
      proposals.map((p) => p.row.target_venue_id),
    );
  } catch (err) {
    handlePageAuthError(err);
  }

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <header className="flex flex-col gap-2 border-b border-[var(--color-bone-200)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="wordmark text-2xl text-[var(--color-ink-900)]">Data refresh queue</h1>
          <Link
            href="/admin"
            className="text-sm font-medium text-[var(--color-sage-700)] underline underline-offset-2"
          >
            Back to venue list
          </Link>
        </div>
        <p className="text-sm text-[var(--color-ink-500)]">
          Signed in as{" "}
          <span className="font-medium text-[var(--color-sage-700)]">{email}</span>
        </p>
      </header>
      <div className="px-4 py-6 sm:px-6">
        <ProposalsReviewView proposals={proposals} venueLookup={venueLookup} />
      </div>
    </main>
  );
}
