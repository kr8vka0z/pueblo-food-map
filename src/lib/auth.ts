/**
 * auth.ts — runtime entry point for the Better Auth engine (#314 Phase 1).
 *
 * WHY a lazy async getAuth() instead of a module-scope `export const auth =
 * betterAuth(...)`: the ADMIN_DB D1 binding is only reachable via
 * getCloudflareContext(), which requires the active Worker request context —
 * unavailable at module-import time. This mirrors adminDb.ts's getAdminDb()
 * pattern exactly (see that file's header WHY) rather than inventing a new
 * one. Cached per-isolate so a warm Worker instance reuses one betterAuth()
 * instance across requests instead of rebuilding it every call.
 *
 * Phase 1 scope: this module only needs to construct and expose a working
 * betterAuth instance/handler. It is NOT mounted behind route gating yet —
 * Cloudflare Access continues to gate /admin/** unmodified (see AGENTS.md
 * "Admin authentication (Cloudflare Access)"). Route gating is Phase 3.
 */

import { betterAuth } from "better-auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { buildAuthOptions } from "./auth-options";

// WHY a named function instead of inlining `betterAuth(buildAuthOptions(db))`
// at each call site: buildAuthOptions() returns a `satisfies`-checked
// literal type (see its own file header WHY), not the widened
// `BetterAuthOptions` interface — that literal type is what lets
// `betterAuth()`'s generic inference produce a fully-typed instance (with
// plugin endpoints on `.api`). `ReturnType<typeof betterAuth>` alone would
// resolve to the generic default instantiation and reject this function's
// actual (more specific) return value as a type mismatch. Capturing the
// concrete instantiation via `ReturnType<typeof createAuthInstance>`
// preserves it.
function createAuthInstance(database: D1Database, rpID?: string) {
  return betterAuth(buildAuthOptions(database, rpID));
}

type Auth = ReturnType<typeof createAuthInstance>;

let cached: Auth | undefined;

/**
 * Returns the (per-isolate-cached) Better Auth instance, constructed against
 * the live ADMIN_DB binding. Never call at module scope — see file header.
 */
export async function getAuth(): Promise<Auth> {
  if (cached) return cached;
  const { env } = await getCloudflareContext({ async: true });
  // #318 passkey isolation — read from the Cloudflare env BINDING, not
  // process.env: a wrangler `var` isn't guaranteed to surface in
  // process.env under OpenNext, and a silently-undefined override here
  // would break staging passkey isolation without erroring. env.BETTER_AUTH_RP_ID
  // is undefined on prod (buildAuthOptions defaults to "pueblofoodmap.com")
  // and set to "dev.pueblofoodmap.com" only via wrangler.jsonc's
  // env.staging.vars.
  cached = createAuthInstance(env.ADMIN_DB, env.BETTER_AUTH_RP_ID);
  return cached;
}
