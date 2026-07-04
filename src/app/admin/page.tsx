/**
 * /admin — Cloudflare Access-gated admin shell (#237 checkpoint c; venue
 * list added #253).
 *
 * Proves the full auth chain end-to-end: Cloudflare Access (edge) → this
 * Server Component's own JWT re-verification (getAdminDb, src/lib/adminDb.ts)
 * → a real D1 binding handed back only on success — then renders a
 * read-only table of every venues row (draft + published + archived).
 * Still no mutations: add/edit/delete/archive is a later slice
 * (docs/admin/cloudflare-native-admin-spec.md §11), so there's no
 * requireAdminOrigin() CSRF check here — that guard exists only for
 * non-GET /api/admin/* mutations (src/lib/cfAccess.ts).
 *
 * On AccessDeniedError this calls Next's forbidden() control-flow function,
 * which renders src/app/forbidden.tsx and returns a real HTTP 403 — not a
 * 200 with an inline error message. See AGENTS.md "Admin authentication"
 * for why an in-app check is required here even though Cloudflare Access
 * already gates this route at the edge.
 *
 * Not unit-tested directly — RSC page tests (real D1 binding + headers()+
 * forbidden()) are hard in this stack; coverage concentrates on
 * VenueListView and src/lib/adminVenues.ts, both of which this page is a
 * thin, mostly-untested wrapper around (see their own test files).
 */

import { headers } from "next/headers";
import { forbidden } from "next/navigation";
import { getAdminDb } from "@/lib/adminDb";
import { AccessDeniedError } from "@/lib/cfAccess";
import { logAdminAuthFailure } from "@/lib/logger";
import VenueListView from "@/components/VenueListView";
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
    if (err instanceof AccessDeniedError) {
      logAdminAuthFailure(err.reason);
      forbidden();
    }
    throw err;
  }

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <header className="flex flex-col gap-2 border-b border-[var(--color-bone-200)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <h1 className="wordmark text-2xl text-[var(--color-ink-900)]">
          Pueblo Food Map Admin
        </h1>
        <p className="text-sm text-[var(--color-ink-500)]">
          Signed in as{" "}
          <span className="font-medium text-[var(--color-sage-700)]">
            {email}
          </span>
        </p>
      </header>
      <div className="px-4 py-6 sm:px-6">
        <VenueListView venues={venues} />
      </div>
    </main>
  );
}
