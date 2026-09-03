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
 * bound-parameter ceiling; see loadVenueLookup's own header.
 */

import { headers } from "next/headers";
import Link from "next/link";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import { parseProposalRow, type ChangeProposalRow, type ParsedProposal } from "@/lib/adminProposals";
import ProposalsReviewView from "@/components/ProposalsReviewView";
import type { WeeklyHours } from "@/types/venue";

interface VenueLookupRow {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string;
  phone: string | null;
  url: string | null;
  hours_weekly: string | null;
  accepts_snap: number | null;
  accepts_wic: number | null;
  source: string;
  last_verified: string;
  status: string;
}

/**
 * Widened from {name, status} (#390 review — Kyle: "How am I supposed to
 * tell what the change is? There's no detail."). A reviewer needs enough of
 * the CURRENT venue to recognise the place and sanity-check a proposed
 * change against it — name and status alone answer "does this id exist,"
 * not "is this the place I think it is."
 *
 * Widened AGAIN (right-hand preview, staging review — Kyle: "it would be
 * nice if there was a full preview... easier to catch errors that way").
 * The preview reuses the real public VenueCard component, which needs
 * lat/lng/hours_weekly/accepts_snap/accepts_wic/source to render a genuine
 * card — the previous {name, category, address, phone, url, last_verified,
 * status} shape had enough for a text summary but not enough for a real
 * render. Still deliberately NOT every AdminVenueRow column (no notes,
 * operator, email, audit fields) — VenueCard doesn't render any of those,
 * so pulling them would just be an unused read.
 */
export interface VenueLookup {
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string;
  phone: string | null;
  url: string | null;
  hours_weekly: WeeklyHours | null;
  accepts_snap?: boolean;
  accepts_wic?: boolean;
  source: string;
  last_verified: string;
  status: string;
}

/**
 * D1's hard ceiling on bound parameters in a single statement. Measured
 * against the real API on 2026-09-02, not taken from docs: 100 placeholders
 * succeed, 101 fail with `too many SQL variables … SQLITE_ERROR` (D1 error
 * code 7500).
 */
const D1_MAX_BOUND_PARAMS = 100;

/**
 * One `SELECT ... WHERE id IN (...)` per batch of target_venue_ids — never a
 * per-row lookup. Returns an empty map for an empty input rather than issuing
 * a query with no placeholders (invalid SQL). Carries `status` alongside the
 * rest so ProposalsReviewView can label an `add` proposal targeting an
 * already-archived id "Restore" instead of "New" — spec §6.6's "Restore"
 * labeling — without a second query.
 *
 * BATCHING (fix, 2026-09-02): this used to bind every unique id into ONE
 * statement, which threw above 100 ids and 500'd the whole page. That was
 * invisible during development — a hand-seeded queue of a handful of rows
 * never reaches the limit — but the FIRST real pipeline run wrote 107
 * proposals against 107 distinct venues, so the ceiling is not an edge case
 * here, it is the normal monthly shape. The per-run proposal cap
 * (PER_RUN_PROPOSAL_CAP = 150, scripts/refresh/diffEngine.ts) is itself well
 * above 100, and pending rows accumulate across runs until an admin acts, so
 * the queue has no upper bound at all.
 *
 * Batching rather than paginating the page deliberately: a reviewer needs to
 * see the whole queue to filter it, and splitting one wide read into a few
 * narrower ones keeps that true without changing what the screen shows.
 */
async function loadVenueLookup(db: D1Database, ids: string[]): Promise<Record<string, VenueLookup>> {
  const uniqueIds = [...new Set(ids)];
  const map: Record<string, VenueLookup> = {};

  for (let i = 0; i < uniqueIds.length; i += D1_MAX_BOUND_PARAMS) {
    const batch = uniqueIds.slice(i, i + D1_MAX_BOUND_PARAMS);
    const placeholders = batch.map(() => "?").join(", ");
    const result = await db
      .prepare(
        `SELECT id, name, category, lat, lng, address, phone, url, hours_weekly, accepts_snap, accepts_wic, source, last_verified, status FROM venues WHERE id IN (${placeholders})`,
      )
      .bind(...batch)
      .all<VenueLookupRow>();
    for (const row of result.results) {
      // hours_weekly is JSON text in D1 (migrations/0001) — same shape
      // src/lib/adminVenueForm.ts's hoursWeeklyJsonToDraft() unpacks, but
      // parsed straight to the object VenueCard/Venue expects here rather
      // than that file's per-day-comma-string draft shape (that's a form
      // editing convenience, not what a read-only preview needs). A bad
      // JSON blob degrades to null (no hours row) rather than throwing —
      // same fail-soft posture as parseProposalRow above.
      let hours: WeeklyHours | null = null;
      if (row.hours_weekly) {
        try {
          hours = JSON.parse(row.hours_weekly) as WeeklyHours;
        } catch {
          hours = null;
        }
      }
      map[row.id] = {
        name: row.name,
        category: row.category,
        lat: row.lat,
        lng: row.lng,
        address: row.address,
        phone: row.phone,
        url: row.url,
        hours_weekly: hours,
        // Tri-state INTEGER -> optional boolean, same NULL=unknown mapping
        // publishVenues.ts's serializer already uses for the exact same
        // column (src/lib/publishVenues.ts, "key omitted" comment).
        accepts_snap: row.accepts_snap === null ? undefined : row.accepts_snap === 1,
        accepts_wic: row.accepts_wic === null ? undefined : row.accepts_wic === 1,
        source: row.source,
        last_verified: row.last_verified,
        status: row.status,
      };
    }
  }

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
