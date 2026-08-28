/**
 * GET|POST|... /api/auth/* — Better Auth's own route handler (#314 Phase
 * 1). Mounts the engine so it boots on the Worker runtime; does NOT gate
 * anything yet.
 *
 * WHY no auth check here, unlike every other route under src/app/api/admin/**:
 * this endpoint IS the auth system itself (sign-in, session, passkey
 * ceremonies, etc. — endpoints an unauthenticated visitor must be able to
 * reach to sign in at all). It is intentionally NOT gated by
 * requireAccessIdentity()/getAdminDb() — those exist to protect this app's
 * OWN admin data behind Cloudflare Access, a separate concern from Better
 * Auth's own endpoints. Cloudflare Access still gates the real admin UI
 * (/admin/**, /api/admin/**) completely unmodified through this phase —
 * this route exists alongside it, unused by anything yet. Wiring Better
 * Auth into the actual sign-in flow / replacing Access is Phase 3+ (see
 * AGENTS.md's Better Auth section for the phase breakdown).
 *
 * toNextJsHandler() accepts either a static `{ handler }` object or a plain
 * async function — used here as a function so getAuth()'s lazy
 * getCloudflareContext() call happens per-request, matching auth.ts's own
 * WHY (env bindings aren't available at module-import time on Workers).
 */

import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

// WHY force-dynamic: same reasoning as every other route in this app that
// reads live request state (see e.g. src/app/api/admin/geocode/route.ts) —
// Better Auth's handler inspects headers/cookies per request, so this route
// must never be statically optimized/cached.
export const dynamic = "force-dynamic";

export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(
  async (request: Request) => (await getAuth()).handler(request),
);
