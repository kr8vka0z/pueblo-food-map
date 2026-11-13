"use client";

/**
 * Admin route-segment error page (#926): what an admin sees when a page under
 * /admin fails to load (a D1 read that throws, for example), in the admin's
 * look, instead of the framework's default error screen. DESIGN.md Patterns
 * "Errors": say what did not happen, then the way out.
 *
 * Never shows the error's own text: a server error's message can carry
 * internal details, and it means nothing to the reader.
 *
 * WHY this boundary is safe for the auth redirects (checked in the installed
 * vinext 1.4.4, by reading, not by running): redirect(), notFound() and
 * forbidden() reach the page as digest-tagged signals. On the server they are
 * turned into their own responses before any error page is considered
 * (vinext dist/server/app-page-request.js buildAppPageElement,
 * app-page-stream.js renderAppPageHtmlStreamWithRecovery). In the browser the
 * redirect, not-found and forbidden boundaries sit inside this one
 * (app-page-route-wiring.js), and this boundary re-throws every such signal
 * anyway (shims/error-boundary.js getDerivedStateFromError ->
 * utils/navigation-signal.js isNavigationSignalError). So signed-out people
 * are still sent to /admin/login (src/lib/adminAuthErrors.ts).
 *
 * WHY Try again reloads the page instead of calling reset: vinext's reset
 * only clears the boundary and re-renders the payload that already failed,
 * and the boundary keeps its error when a refreshed payload arrives on the
 * same address (shims/error-boundary.js clears it only on a new pathname or
 * reset key). A page rendered straight to this error on the server gets no
 * reset at all. A full reload is the one path that asks the server again.
 */

import Link from "next/link";
import { pageTitleClass, primaryButtonClass, tapLinkClass } from "@/lib/adminCardStyles";

export default function AdminError() {
  return (
    <main className="min-h-screen bg-[var(--color-bone-50)] px-4 py-6 sm:px-6">
      {/* An h1 here: this page replaces the whole admin page, menu included,
          so it carries the page's one h1 itself. */}
      <h1 className={pageTitleClass}>This page didn&apos;t load</h1>
      <p className="mt-2 text-sm text-[var(--color-ink-700)]">Nothing was changed. Try again, or go back to the Dashboard.</p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => window.location.reload()} className={primaryButtonClass}>
          Try again
        </button>
        <Link href="/admin" className={`${tapLinkClass} text-sm`}>
          Go to the Dashboard
        </Link>
      </div>
    </main>
  );
}
