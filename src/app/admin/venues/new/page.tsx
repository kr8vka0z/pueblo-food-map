/**
 * /admin/venues/new — Cloudflare Access-gated "Add a venue" page (#254).
 *
 * Same auth chain as /admin (src/app/admin/page.tsx, AGENTS.md "Admin
 * authentication"): getAdminDb() verifies the caller's Cloudflare Access
 * identity before this page renders anything, failing closed via Next's
 * forbidden() control-flow function on AccessDeniedError. This page has
 * nothing to SELECT (a fresh venue form has no existing row) — getAdminDb()
 * is still called purely for the auth gate and the signed-in email in the
 * header, matching the single-choke-point rule: every /admin/* page
 * re-verifies itself, never relying on a shared layout alone.
 *
 * The actual form is a Client Component (AddVenueForm) so it can hold input
 * state and POST to /api/admin/venues — this Server Component's only job is
 * the auth gate and page chrome.
 */

import { headers } from "next/headers";
import { forbidden } from "next/navigation";
import Link from "next/link";
import { getAdminDb } from "@/lib/adminDb";
import { AccessDeniedError } from "@/lib/cfAccess";
import { logAdminAuthFailure } from "@/lib/logger";
import AddVenueForm from "@/components/AddVenueForm";

export default async function NewVenuePage() {
  let email: string;

  try {
    const { identity } = await getAdminDb(await headers());
    email = identity.email;
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
        <div>
          <h1 className="wordmark text-2xl text-[var(--color-ink-900)]">Add a venue</h1>
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
        <AddVenueForm />
      </div>
    </main>
  );
}
