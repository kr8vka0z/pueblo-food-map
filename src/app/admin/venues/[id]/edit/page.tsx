/**
 * /admin/venues/[id]/edit — Cloudflare Access-gated "Edit a venue" page,
 * plus the "Remove from map" (archive) action (#255).
 *
 * Same auth chain as /admin and /admin/venues/new (AGENTS.md "Admin
 * authentication"): getAdminDb() verifies the caller's Cloudflare Access
 * identity before this page renders anything, failing closed via Next's
 * forbidden() control-flow function on AccessDeniedError. Unlike the create
 * page, this one DOES have something to SELECT — the existing venue row —
 * so getAdminDb() here serves both the auth gate AND the read, same shape
 * as /admin's own list query. A missing/unknown id calls Next's notFound()
 * (a real 404), same control-flow convention as /venue/[id]/page.tsx.
 *
 * Renders AddVenueForm in edit mode (venueId + the row mapped to
 * initialValues via src/lib/adminVenueForm.ts's mapVenueRowToFormValues) and
 * ArchiveVenueButton underneath in a "Danger zone" section — two independent
 * Client Components, each owning its own mutation (PATCH vs. archive POST)
 * and its own success/error/redirect handling; this Server Component's only
 * job is the auth gate, the row fetch, and page chrome.
 *
 * params is a Promise in Next.js 16 App Router — must be awaited (same
 * convention as /venue/[id]/page.tsx).
 */

import { headers } from "next/headers";
import { forbidden, notFound } from "next/navigation";
import Link from "next/link";
import { getAdminDb } from "@/lib/adminDb";
import { AccessDeniedError } from "@/lib/cfAccess";
import { logAdminAuthFailure } from "@/lib/logger";
import AddVenueForm from "@/components/AddVenueForm";
import ArchiveVenueButton from "@/components/ArchiveVenueButton";
import { mapVenueRowToFormValues } from "@/lib/adminVenueForm";
import type { AdminVenueRow } from "@/types/venue";

export default async function EditVenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let email: string;
  let venue: AdminVenueRow | null;

  try {
    const { db, identity } = await getAdminDb(await headers());
    email = identity.email;
    venue = await db.prepare("SELECT * FROM venues WHERE id = ?").bind(id).first<AdminVenueRow>();
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      logAdminAuthFailure(err.reason);
      forbidden();
    }
    throw err;
  }

  if (!venue) notFound();

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <header className="flex flex-col gap-2 border-b border-[var(--color-bone-200)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="wordmark text-2xl text-[var(--color-ink-900)]">Edit {venue.name}</h1>
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
      <div className="px-4 py-6 sm:px-6 space-y-6">
        <AddVenueForm venueId={venue.id} initialValues={mapVenueRowToFormValues(venue)} />

        <div className="max-w-2xl border-t border-[var(--color-bone-200)] pt-5">
          <h2 className="text-sm font-semibold text-[var(--color-ink-700)] mb-2">Danger zone</h2>
          <ArchiveVenueButton
            venueId={venue.id}
            venueName={venue.name}
            alreadyArchived={venue.status === "archived"}
          />
        </div>
      </div>
    </main>
  );
}
