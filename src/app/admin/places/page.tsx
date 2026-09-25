/**
 * /admin/places — the venue list + Publish panel (#237 checkpoint c; venue
 * list added #253; "Add place" link added #254; Publish panel added #256;
 * "Review queue" nav link added as a #259 follow-up).
 *
 * MOVED HERE from /admin (admin dashboard build): /admin is now the
 * Dashboard (src/app/admin/page.tsx), a to-do-list landing page — this is
 * the exact same list + Publish panel that page used to render, unchanged
 * in behavior, just at its own URL so the Dashboard can be a genuinely
 * different screen rather than this one with extra panels bolted on.
 * Anything that used to redirect/link to "/admin" meaning THIS list (save,
 * archive, publish, "Back to venue list") now points at /admin/places
 * instead — grepped and updated across the app in the same change (see
 * AddVenueForm.tsx, ArchiveVenueButton.tsx, and every other admin page's
 * header).
 *
 * Proves the full auth chain end-to-end: Better Auth session
 * (getAdminDb, src/lib/adminDb.ts) → a real D1 binding handed back only on
 * success — then renders AdminNav (the shared header/nav every admin page
 * now shares) above the Publish panel (PublishPanel, below) and a
 * read-only table of every venues row (draft + published + archived).
 * This page itself still performs no mutation and issues no non-GET
 * request, so it has no requireAdminOrigin() CSRF check here — that guard
 * exists only for non-GET /api/admin/* mutations (src/lib/adminOrigin.ts).
 *
 * summarizePublishChanges() (src/lib/adminVenues.ts) computes PublishPanel's
 * new/edited/archived counts from the SAME rows already SELECTed for
 * VenueListView below — no second query. loadAdminNavCounts()
 * (src/lib/adminNavCounts.ts) is the one extra read AdminNav needs for its
 * pending-count pills — every admin page now makes this same call.
 *
 * On AccessDeniedError this delegates to handlePageAuthError()
 * (src/lib/adminAuthErrors.ts): a missing Better Auth session redirects to
 * /admin/login; every other denial reason calls Next's forbidden()
 * control-flow function, which renders src/app/forbidden.tsx and returns a
 * real HTTP 403 — not a 200 with an inline error message.
 *
 * Not unit-tested directly — RSC page tests (real D1 binding + headers()+
 * forbidden()) are hard in this stack; coverage concentrates on
 * VenueListView and src/lib/adminVenues.ts, both of which this page is a
 * thin, mostly-untested wrapper around (see their own test files). The
 * auth-guard contract itself IS pinned here (page.test.tsx, moved from
 * /admin unchanged).
 */

import { headers } from "next/headers";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import { summarizePublishChanges } from "@/lib/adminVenues";
import { loadAdminNavCounts, ZERO_ADMIN_NAV_COUNTS, type AdminNavCounts } from "@/lib/adminNavCounts";
import VenueListView from "@/components/VenueListView";
import PublishPanel from "@/components/PublishPanel";
import AdminNav from "@/components/AdminNav";
import type { AdminVenueRow } from "@/types/venue";

export default async function PlacesPage() {
  let email: string;
  let venues: AdminVenueRow[];
  let navCounts: AdminNavCounts = ZERO_ADMIN_NAV_COUNTS;

  try {
    const { db, identity } = await getAdminDb(await headers());
    email = identity.email;
    const result = await db
      .prepare("SELECT * FROM venues ORDER BY name COLLATE NOCASE ASC")
      .all<AdminVenueRow>();
    venues = result.results;
    navCounts = await loadAdminNavCounts(db);
  } catch (err) {
    handlePageAuthError(err);
  }

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <AdminNav email={email} active="places" counts={navCounts} />
      <div className="px-4 py-6 sm:px-6">
        <PublishPanel summary={summarizePublishChanges(venues)} />
        <VenueListView venues={venues} />
      </div>
    </main>
  );
}
