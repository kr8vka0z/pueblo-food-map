/**
 * adminDb.ts — the ONLY sanctioned way any server-side code reaches the
 * ADMIN_DB D1 binding (#237 checkpoint c; Phase 3 dual-auth added below).
 *
 * WHY this exists instead of relying on a shared layout auth check: Next.js
 * App Router layouts execute once per layout mount, not on every
 * client-side navigation between sibling routes under that layout — a guard
 * placed only in /admin/layout.tsx would authenticate the FIRST /admin/*
 * page view but not a subsequent client-side navigation to another
 * /admin/* page (spec §3.1, "I2"; docs/admin/cloudflare-native-admin-spec.md).
 * Routing every D1 access through this single function closes that gap
 * structurally: getAdminDb() calls requireAccessIdentity() (and, since
 * Phase 3, requireAdminSession()) BEFORE it will hand back the D1 binding
 * at all, so there is no code path — page or route handler, first load or
 * client nav — that can reach ADMIN_DB without passing both checks. A
 * future page that imports getAdminDb() and forgets an explicit auth check
 * still cannot read admin data unauthenticated, because the binding itself
 * is never handed back otherwise.
 *
 * Phase 3 dual-auth: CF Access alone used to be sufficient. It no longer
 * is — requireAdminSession() (src/lib/adminSession.ts) additionally
 * requires a live Better Auth session for an allowlisted admin, checked
 * SECOND (after CF Access) so a request to a hostname CF Access doesn't
 * even cover still fails on the cheaper, existing check first. This is
 * strictly more restrictive than Phase 2, never less — see
 * AGENTS.md "Admin authentication" for the full picture.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  requireAccessIdentity,
  type AdminIdentity,
  type HeaderSource,
} from "./cfAccess";
import { requireAdminSession } from "./adminSession";

export interface AdminDbAccess {
  db: D1Database;
  identity: AdminIdentity;
}

/**
 * Verifies the caller's Cloudflare Access identity AND a live Better Auth
 * session (Phase 3), then returns the ADMIN_DB binding alongside the CF
 * Access identity. Throws AccessDeniedError (from cfAccess.ts) on either
 * failure — callers must catch it and produce a real denial response (see
 * src/lib/adminAuthErrors.ts for the shared redirect-vs-403 /
 * 401-vs-403 handling used by every page and route handler).
 */
export async function getAdminDb(
  headers: HeaderSource,
): Promise<AdminDbAccess> {
  const identity = await requireAccessIdentity(headers); // CF Access — throws AccessDeniedError
  await requireAdminSession(headers); // Better Auth session + allowlist — throws AccessDeniedError
  const { env } = await getCloudflareContext({ async: true });
  return { db: env.ADMIN_DB, identity };
}
