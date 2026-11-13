/**
 * GET|POST|... /api/auth/* — Better Auth's own route handler (added #314
 * Phase 1). Serves sign-in, session, and passkey endpoints for the admin
 * login; the admin gate itself is getAdminDb() (src/lib/adminDb.ts).
 *
 * WHY no auth check here, unlike every other route under src/app/api/admin/**:
 * this endpoint IS the auth system itself (sign-in, session, passkey
 * ceremonies, etc. — endpoints an unauthenticated visitor must be able to
 * reach to sign in at all). It is intentionally NOT gated by
 * getAdminDb() — that protects this app's OWN admin data (/admin/**,
 * /api/admin/**) and requires the very session these endpoints create.
 * Cloudflare Access, which gated the admin UI when this route was added,
 * is gone (AGENTS.md "Admin authentication").
 *
 * toNextJsHandler() accepts either a static `{ handler }` object or a plain
 * async function — used here as a function so getAuth()'s lazy
 * getCloudflareContext() call happens per-request, matching auth.ts's own
 * WHY (env bindings aren't available at module-import time on Workers).
 */

import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

// WHY force-dynamic: vinext still reads it to force no-store fetches and keep per-session auth responses private.
export const dynamic = "force-dynamic";

export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(
  async (request: Request) => (await getAuth()).handler(request),
);
