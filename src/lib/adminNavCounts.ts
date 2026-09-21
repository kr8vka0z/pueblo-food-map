/**
 * adminNavCounts.ts — the four pending-review counts shown as nav badges on
 * every admin page's shared header (AdminNav): review-queue submissions,
 * data-refresh proposals, box photos, box adopters. Two of the four counts
 * (countPendingReview / countPendingAdopters) already existed in
 * boxPhotos.ts / boxAdopters.ts; this file adds the other two and bundles
 * all four into one Promise.all so every admin page fetches its header
 * badges the exact same way.
 *
 * Each count degrades to 0 INDEPENDENTLY on any read failure (missing
 * table, D1 hiccup) — same "one missing table must never break the whole
 * admin shell" posture src/app/admin/page.tsx originally established for
 * pendingPhotoCount/pendingAdopterCount. A broken box_photos table must not
 * also blank the submissions badge, so this is four small try/catches, not
 * one around the whole Promise.all.
 */

import { countPendingReview } from "@/lib/boxPhotos";
import { countPendingAdopters } from "@/lib/boxAdopters";

export async function countPendingSubmissions(db: D1Database): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM public_submissions WHERE status = 'pending'")
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function countPendingProposals(db: D1Database): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM change_proposals WHERE status = 'pending'")
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export interface AdminNavCounts {
  submissions: number;
  proposals: number;
  photos: number;
  adopters: number;
}

async function countOrZero(fn: () => Promise<number>): Promise<number> {
  try {
    return await fn();
  } catch {
    return 0;
  }
}

/** The zero-count shape every admin page can fall back to synchronously — AdminNav renders fine with no pills at all. */
export const ZERO_ADMIN_NAV_COUNTS: AdminNavCounts = { submissions: 0, proposals: 0, photos: 0, adopters: 0 };

/** One Promise.all for every admin page's header badges. Never throws — a failing count is simply 0, same degrade-don't-500 posture every other best-effort admin read in this app follows. */
export async function loadAdminNavCounts(db: D1Database): Promise<AdminNavCounts> {
  const [submissions, proposals, photos, adopters] = await Promise.all([
    countOrZero(() => countPendingSubmissions(db)),
    countOrZero(() => countPendingProposals(db)),
    countOrZero(() => countPendingReview(db)),
    countOrZero(() => countPendingAdopters(db)),
  ]);
  return { submissions, proposals, photos, adopters };
}
