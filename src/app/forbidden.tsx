/**
 * app/forbidden.tsx — Next.js special file rendered when next/navigation's
 * forbidden() is called (#237 checkpoint c). Next returns a real HTTP 403
 * for this response — see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/forbidden.md.
 * Currently only src/app/admin/page.tsx triggers this, on an
 * AccessDeniedError from getAdminDb().
 */

import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="wordmark text-2xl text-[var(--color-ink-900)]">
        Forbidden
      </h1>
      <p className="text-[var(--color-ink-500)]">
        You do not have access to this page.
      </p>
      <Link
        href="/"
        className="text-sm font-medium text-[var(--color-sage-700)] underline underline-offset-2"
      >
        Return to the map
      </Link>
    </main>
  );
}
