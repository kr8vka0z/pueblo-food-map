/**
 * /admin — Cloudflare Access-gated admin shell (#237 checkpoint c).
 *
 * Proves the full auth chain end-to-end: Cloudflare Access (edge) → this
 * Server Component's own JWT re-verification (getAdminDb, src/lib/adminDb.ts)
 * → a real D1 binding handed back only on success. No CRUD, no venue data —
 * that's Phase 2 (docs/admin/cloudflare-native-admin-spec.md §11).
 *
 * On AccessDeniedError this calls Next's forbidden() control-flow function,
 * which renders src/app/forbidden.tsx and returns a real HTTP 403 — not a
 * 200 with an inline error message. See AGENTS.md "Admin authentication"
 * for why an in-app check is required here even though Cloudflare Access
 * already gates this route at the edge.
 */

import { headers } from "next/headers";
import { forbidden } from "next/navigation";
import { getAdminDb } from "@/lib/adminDb";
import { AccessDeniedError } from "@/lib/cfAccess";
import { logAdminAuthFailure } from "@/lib/logger";

export default async function AdminPage() {
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
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-2 px-4 text-center">
      <div className="elevation-1 rounded-[var(--radius-lg)] bg-white px-6 py-5">
        <h1 className="wordmark text-2xl text-[var(--color-ink-900)]">
          Pueblo Food Map Admin
        </h1>
        <p className="mt-2 text-[var(--color-ink-500)]">
          Signed in as{" "}
          <span className="font-medium text-[var(--color-sage-700)]">
            {email}
          </span>
        </p>
      </div>
    </main>
  );
}
