/**
 * /admin/box-adopters — the adopt-a-box moderation queue (Blessing Boxes
 * slice 6). Same Server-Component-auth-gate / Client-Component-interaction
 * split as /admin/box-photos (getAdminDb() -> handlePageAuthError() on
 * failure); this page only SELECTs (loadPendingAdopters()), so — like every
 * other read-only admin page — it carries no requireAdminOrigin() CSRF check
 * of its own; that guard lives on the approve/reject mutation routes.
 */

import { headers } from "next/headers";
import Link from "next/link";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import { loadPendingAdopters } from "@/lib/boxAdopters";
import BoxAdoptersReviewView from "@/components/BoxAdoptersReviewView";

export default async function BoxAdoptersPage() {
  let email: string;
  let adopters: Awaited<ReturnType<typeof loadPendingAdopters>>;

  try {
    const { db, identity } = await getAdminDb(await headers());
    email = identity.email;
    adopters = await loadPendingAdopters(db);
  } catch (err) {
    handlePageAuthError(err);
  }

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <header className="flex flex-col gap-2 border-b border-[var(--color-bone-200)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="wordmark text-2xl text-[var(--color-ink-900)]">Adoption requests</h1>
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
        <BoxAdoptersReviewView adopters={adopters} />
      </div>
    </main>
  );
}
