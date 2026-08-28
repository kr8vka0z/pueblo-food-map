/**
 * /admin/login — Better Auth login page (#315 Phase 2).
 *
 * Pre-auth entry point: unlike every other page under /admin/**, this one
 * does NOT call getAdminDb() / verify Cloudflare Access — an unauthenticated
 * visitor must be able to reach it at all. No metadata export, matching
 * every other admin page's convention (robots.ts already disallows /admin/
 * entirely — see AGENTS.md's Discoverability section — so no page under
 * this route sets its own noindex).
 *
 * Renders AdminLoginForm (src/components/AdminLoginForm.tsx), a fully
 * self-contained Client Component that owns the whole flow: email magic
 * link, "use a passkey" for returning admins, and the post-verification
 * "set up a passkey" prompt. This Server Component is just the page shell
 * (matches /admin's own <main>/<header> structure) — no auth logic lives
 * here.
 */

import AdminLoginForm from "@/components/AdminLoginForm";

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bone-50)] px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="wordmark mb-6 text-center text-2xl text-[var(--color-ink-900)]">
          Pueblo Food Map Admin
        </h1>
        <AdminLoginForm />
      </div>
    </main>
  );
}
