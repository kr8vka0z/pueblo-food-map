/**
 * Admin route-segment loading state. Every admin page does its session check
 * and D1 reads on the server, so without this a client-side navigation (e.g.
 * Dashboard -> Places) shows nothing until the whole next page has rendered.
 * The header stays put (AdminNavSkeleton) and bone-tinted shimmer blocks
 * shaped like an admin screen replace the body so transitions answer the tap
 * within 400ms without layout jump (DESIGN.md "Waiting and loading").
 * `aria-busy` plus a hidden status live region announce loading to assistive
 * tech; reduced motion swaps the sweep for still bone blocks.
 *
 * Trade-off: the shell is flushed before the page's session check runs, so a
 * first, full-page request to a guarded admin URL now answers 200 and moves
 * the visitor with a client-side redirect instead of a 307/403 status. The
 * shell holds no admin data, so nothing leaks. This boundary also wraps
 * /admin/login, so a non-prefetched navigation there (e.g. after sign-out)
 * can briefly show this header before the sign-in form.
 */

import { AdminNavSkeleton } from "@/components/AdminNav";
import { cardClass, pageBodyClass, tileCardClass } from "@/lib/adminCardStyles";

export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-[var(--color-bone-50)]">
      <AdminNavSkeleton />
      <main id="admin-main" tabIndex={-1} aria-busy="true" className={pageBodyClass}>
        <p role="status" className="sr-only">
          Loading…
        </p>
        {/* Title row */}
        <div className="flex flex-wrap items-center justify-between gap-3" aria-hidden="true">
          <div className="pfm-skeleton h-7 w-40" />
          <div className="pfm-skeleton h-12 w-full rounded-full sm:w-64" />
        </div>
        {/* 4-card strip matching DashboardNeedsStrip / summary area */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={`${tileCardClass} flex flex-col gap-2`}>
              <div className="pfm-skeleton h-3.5 w-28" />
              <div className="pfm-skeleton h-8 w-14" />
              <div className="pfm-skeleton h-3 w-36" />
            </div>
          ))}
        </div>
        {/* Content card matching Dashboard section / list table */}
        <div className={`${cardClass} space-y-4`} aria-hidden="true">
          <div className="pfm-skeleton h-6 w-32" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="rounded-[var(--radius-lg)] bg-[var(--color-bone-50)] p-4">
                <div className="pfm-skeleton h-3 w-20" />
                <div className="pfm-skeleton mt-3 h-7 w-16" />
              </div>
            ))}
          </div>
          <div className="space-y-2.5 pt-2">
            <div className="pfm-skeleton h-10 w-full" />
            <div className="pfm-skeleton h-10 w-full" />
            <div className="pfm-skeleton h-10 w-full" />
          </div>
        </div>
      </main>
    </div>
  );
}
