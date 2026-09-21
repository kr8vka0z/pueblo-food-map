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
 * Venue context for the card headers: `update`/`remove` proposals only
 * carry a field diff in `proposed_diff` (not necessarily the venue's
 * `name`, unless name itself is one of the changed fields), and a bare name
 * alone can't tell an admin which place a change targets or whether a
 * proposed value looks right — so this page runs an extra
 * `SELECT id, name, category, address, phone, url, last_verified, status
 * FROM venues WHERE id IN (...)` across every target_venue_id in the
 * current page of proposals, rather than a per-row lookup — the same "one
 * query, not N" discipline src/lib/adminVenues.ts's summarizePublishChanges
 * already follows. Batched at 100 ids per statement because that is D1's
 * bound-parameter ceiling.
 *
 * loadVenueLookup/VenueLookup MOVED to src/lib/adminVenueLookup.ts (admin
 * dashboard build): the new /admin Dashboard's "Needs a decision" panel
 * shows a capped preview of these same pending proposals and needs the same
 * venue context — re-exporting `VenueLookup` here keeps every existing
 * importer (ProposalsReviewView, both pages' tests) working unchanged.
 */

import { headers } from "next/headers";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import { loadAdminNavCounts, ZERO_ADMIN_NAV_COUNTS, type AdminNavCounts } from "@/lib/adminNavCounts";
import { parseProposalRow, type ChangeProposalRow, type ParsedProposal } from "@/lib/adminProposals";
import { loadVenueLookup, type VenueLookup } from "@/lib/adminVenueLookup";
import AdminNav from "@/components/AdminNav";
import ProposalsReviewView from "@/components/ProposalsReviewView";

export type { VenueLookup };

export default async function FlagsPage() {
  let email: string;
  let proposals: ParsedProposal[];
  let venueLookup: Record<string, VenueLookup>;
  let navCounts: AdminNavCounts = ZERO_ADMIN_NAV_COUNTS;

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
    navCounts = await loadAdminNavCounts(db);
  } catch (err) {
    handlePageAuthError(err);
  }

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <AdminNav email={email} active="flags" counts={navCounts} />
      <div className="px-4 py-6 sm:px-6">
        <h2 className="wordmark mb-4 text-xl text-[var(--color-ink-900)]">Data refresh queue</h2>
        <ProposalsReviewView proposals={proposals} venueLookup={venueLookup} />
      </div>
    </main>
  );
}
