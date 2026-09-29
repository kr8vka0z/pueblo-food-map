/**
 * Admin route-segment loading state. Every admin page does its session check
 * and D1 reads on the server, so without this a client-side navigation (e.g.
 * Dashboard -> Places) shows nothing until the whole next page has rendered.
 * The header stays put (AdminNavSkeleton) and a short "Loading…" line
 * replaces the body. DESIGN.md's loading rule is text, not a skeleton:
 * `ink-400`, motion-safe pulse, a real ellipsis. `aria-busy` plus a status
 * live region tell assistive tech what is happening; the global reduced-motion
 * block already stops the pulse.
 *
 * Trade-off: the shell is flushed before the page's session check runs, so a
 * first, full-page request to a guarded admin URL now answers 200 and moves
 * the visitor with a client-side redirect instead of a 307/403 status. The
 * shell holds no admin data, so nothing leaks. /admin/login opts out (see
 * login/loading.tsx).
 */

import { AdminNavSkeleton } from "@/components/AdminNav";

export default function AdminLoading() {
  return (
    <main aria-busy="true" className="min-h-screen bg-[var(--color-bone-50)]">
      <AdminNavSkeleton />
      <div className="px-4 py-6 sm:px-6">
        <p role="status" className="text-sm text-[var(--color-ink-400)] motion-safe:animate-pulse">
          Loading…
        </p>
      </div>
    </main>
  );
}
