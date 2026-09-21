/**
 * /admin/box-adopters — the adopt-a-box moderation queue (Blessing Boxes
 * slice 6). Same Server-Component-auth-gate / Client-Component-interaction
 * split as /admin/box-photos (getAdminDb() -> handlePageAuthError() on
 * failure); this page only SELECTs (loadPendingAdopters()), so — like every
 * other read-only admin page — it carries no requireAdminOrigin() CSRF check
 * of its own; that guard lives on the approve/reject mutation routes.
 */

import { headers } from "next/headers";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import { loadAdminNavCounts, ZERO_ADMIN_NAV_COUNTS, type AdminNavCounts } from "@/lib/adminNavCounts";
import { loadPendingAdopters } from "@/lib/boxAdopters";
import AdminNav from "@/components/AdminNav";
import BoxAdoptersReviewView from "@/components/BoxAdoptersReviewView";

export default async function BoxAdoptersPage() {
  let email: string;
  let adopters: Awaited<ReturnType<typeof loadPendingAdopters>>;
  let navCounts: AdminNavCounts = ZERO_ADMIN_NAV_COUNTS;

  try {
    const { db, identity } = await getAdminDb(await headers());
    email = identity.email;
    adopters = await loadPendingAdopters(db);
    navCounts = await loadAdminNavCounts(db);
  } catch (err) {
    handlePageAuthError(err);
  }

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <AdminNav email={email} active="box-adopters" counts={navCounts} />
      <div className="px-4 py-6 sm:px-6">
        <h2 className="wordmark mb-4 text-xl text-[var(--color-ink-900)]">Adoption requests</h2>
        <BoxAdoptersReviewView adopters={adopters} />
      </div>
    </main>
  );
}
