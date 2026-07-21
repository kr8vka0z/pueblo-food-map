/**
 * /admin — Cloudflare Access-gated admin shell (#237 checkpoint c; venue
 * list added #253; "Add place" link added #254; Publish panel added #256;
 * "Review queue" nav link added as a #259 follow-up).
 *
 * Proves the full auth chain end-to-end: Cloudflare Access (edge) → this
 * Server Component's own JWT re-verification (getAdminDb, src/lib/adminDb.ts)
 * → a real D1 binding handed back only on success — then renders the
 * Publish panel (PublishPanel, below) above a read-only table of every
 * venues row (draft + published + archived), plus an "Add place" link to
 * /admin/venues/new (src/app/admin/venues/new/page.tsx), the only OTHER
 * mutation entry point besides Publish, and a "Review queue" link to
 * /admin/submissions (src/app/admin/submissions/page.tsx) — a plain
 * navigation link, not a mutation entry point, styled as the same
 * secondary sage-underline link this admin shell already uses elsewhere
 * (e.g. "Back to venue list") so "Add place" stays the header's one
 * primary action. This page itself still performs no mutation and issues
 * no non-GET request, so it has no requireAdminOrigin() CSRF check here —
 * that guard exists only for non-GET /api/admin/* mutations
 * (src/lib/cfAccess.ts).
 *
 * summarizePublishChanges() (src/lib/adminVenues.ts) computes PublishPanel's
 * new/edited/archived counts from the SAME rows already SELECTed for
 * VenueListView below — no second query.
 *
 * On AccessDeniedError this delegates to handlePageAuthError()
 * (src/lib/adminAuthErrors.ts): a missing Better Auth session (Phase 3
 * dual-auth) redirects to /admin/login; every other denial reason calls
 * Next's forbidden() control-flow function, which renders
 * src/app/forbidden.tsx and returns a real HTTP 403 — not a 200 with an
 * inline error message. See AGENTS.md "Admin authentication" for why an
 * in-app check is required here even though Cloudflare Access already
 * gates this route at the edge.
 *
 * Not unit-tested directly — RSC page tests (real D1 binding + headers()+
 * forbidden()) are hard in this stack; coverage concentrates on
 * VenueListView and src/lib/adminVenues.ts, both of which this page is a
 * thin, mostly-untested wrapper around (see their own test files).
 */

import { headers } from "next/headers";
import Link from "next/link";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import { summarizePublishChanges } from "@/lib/adminVenues";
import VenueListView from "@/components/VenueListView";
import PublishPanel from "@/components/PublishPanel";
import type { AdminVenueRow } from "@/types/venue";

export default async function AdminPage() {
  let email: string;
  let venues: AdminVenueRow[];

  try {
    const { db, identity } = await getAdminDb(await headers());
    email = identity.email;
    const result = await db
      .prepare("SELECT * FROM venues ORDER BY name COLLATE NOCASE ASC")
      .all<AdminVenueRow>();
    venues = result.results;
  } catch (err) {
    handlePageAuthError(err);
  }

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <header className="flex flex-col gap-2 border-b border-[var(--color-bone-200)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <h1 className="wordmark text-2xl text-[var(--color-ink-900)]">
          Pueblo Food Map Admin
        </h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Link
            href="/admin/venues/new"
            className={
              "inline-flex items-center justify-center rounded-[var(--radius-md)] " +
              "bg-[var(--color-sage-500)] px-4 py-2 text-sm font-semibold text-[var(--color-bone-50)] " +
              "transition-colors duration-150 hover:bg-[var(--color-sage-600)] " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
              "focus-visible:ring-offset-2"
            }
          >
            Add place
          </Link>
          <Link
            href="/admin/submissions"
            className="text-sm font-medium text-[var(--color-sage-700)] underline underline-offset-2"
          >
            Review queue
          </Link>
          <p className="text-sm text-[var(--color-ink-500)]">
            Signed in as{" "}
            <span className="font-medium text-[var(--color-sage-700)]">
              {email}
            </span>
          </p>
        </div>
      </header>
      <div className="px-4 py-6 sm:px-6">
        <PublishPanel summary={summarizePublishChanges(venues)} />
        <VenueListView venues={venues} />
      </div>
    </main>
  );
}
