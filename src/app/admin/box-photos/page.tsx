/**
 * /admin/box-photos — the photo moderation queue (Blessing Boxes slice 5).
 * Same Server-Component-auth-gate / Client-Component-interaction split as
 * /admin/submissions (getAdminDb() -> handlePageAuthError() on failure);
 * this page only SELECTs (loadReviewQueue()), so — like every other
 * read-only admin page — it carries no requireAdminOrigin() CSRF check of
 * its own; that guard lives on the approve/reject mutation routes instead.
 */

import { headers } from "next/headers";
import { getAdminDb } from "@/lib/adminDb";
import { handlePageAuthError } from "@/lib/adminAuthErrors";
import { loadAdminNavCounts, ZERO_ADMIN_NAV_COUNTS, type AdminNavCounts } from "@/lib/adminNavCounts";
import { loadReviewQueue } from "@/lib/boxPhotos";
import AdminNav from "@/components/AdminNav";
import BoxPhotosReviewView from "@/components/BoxPhotosReviewView";

export default async function BoxPhotosPage() {
  let email: string;
  let photos: Awaited<ReturnType<typeof loadReviewQueue>>;
  let navCounts: AdminNavCounts = ZERO_ADMIN_NAV_COUNTS;

  try {
    const { db, identity } = await getAdminDb(await headers());
    email = identity.email;
    photos = await loadReviewQueue(db);
    navCounts = await loadAdminNavCounts(db);
  } catch (err) {
    handlePageAuthError(err);
  }

  return (
    <main className="min-h-screen bg-[var(--color-bone-50)]">
      <AdminNav email={email} active="box-photos" counts={navCounts} />
      <div className="px-4 py-6 sm:px-6">
        <h2 className="wordmark mb-4 text-xl text-[var(--color-ink-900)]">Photo review</h2>
        <BoxPhotosReviewView photos={photos} />
      </div>
    </main>
  );
}
