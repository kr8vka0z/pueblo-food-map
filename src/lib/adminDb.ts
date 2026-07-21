/**
 * adminDb.ts — the ONLY sanctioned way any server-side code reaches the
 * ADMIN_DB D1 binding (#237 checkpoint c; Better Auth sole-gate cutover,
 * auth/betterauth-sole-gate).
 *
 * WHY this exists instead of relying on a shared layout auth check: Next.js
 * App Router layouts execute once per layout mount, not on every
 * client-side navigation between sibling routes under that layout — a guard
 * placed only in /admin/layout.tsx would authenticate the FIRST /admin/*
 * page view but not a subsequent client-side navigation to another
 * /admin/* page (spec §3.1, "I2"; docs/admin/cloudflare-native-admin-spec.md).
 * Routing every D1 access through this single function closes that gap
 * structurally: getAdminDb() calls requireAdminSession() BEFORE it will
 * hand back the D1 binding at all, so there is no code path — page or route
 * handler, first load or client nav — that can reach ADMIN_DB without a live
 * Better Auth session for an allowlisted admin. A future page that imports
 * getAdminDb() and forgets an explicit auth check still cannot read admin
 * data unauthenticated, because the binding itself is never handed back
 * otherwise.
 *
 * WHY Better Auth alone, not the former CF-Access-then-Better-Auth dual
 * gate: Kyle cut the admin surface over to Better Auth as the sole identity
 * gate (Better Auth Phase 5) — the Cloudflare Access application is removed
 * from infrastructure in the same change, so a request no longer carries a
 * `Cf-Access-Jwt-Assertion` header at all; requiring one here would fail
 * closed on every single admin request. The identity `getAdminDb()` returns
 * now comes entirely from the Better Auth session requireAdminSession()
 * verifies — see AGENTS.md "Admin authentication" for the full picture.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { AdminIdentity, HeaderSource } from "./cfAccess";
import { requireAdminSession } from "./adminSession";

export interface AdminDbAccess {
  db: D1Database;
  identity: AdminIdentity;
}

/**
 * Verifies the caller holds a live, allowlisted Better Auth session, then
 * returns the ADMIN_DB binding alongside that session's identity. Throws
 * AccessDeniedError (from cfAccess.ts) on failure — callers must catch it
 * and produce a real denial response (see src/lib/adminAuthErrors.ts for the
 * shared redirect-vs-403 / 401-vs-403 handling used by every page and route
 * handler).
 */
export async function getAdminDb(
  headers: HeaderSource,
): Promise<AdminDbAccess> {
  const identity = await requireAdminSession(headers); // Better Auth session + allowlist — throws AccessDeniedError
  const { env } = await getCloudflareContext({ async: true });
  return { db: env.ADMIN_DB, identity };
}
