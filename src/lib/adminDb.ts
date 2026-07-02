/**
 * adminDb.ts — the ONLY sanctioned way any server-side code reaches the
 * ADMIN_DB D1 binding (#237 checkpoint c).
 *
 * WHY this exists instead of relying on a shared layout auth check: Next.js
 * App Router layouts execute once per layout mount, not on every
 * client-side navigation between sibling routes under that layout — a guard
 * placed only in /admin/layout.tsx would authenticate the FIRST /admin/*
 * page view but not a subsequent client-side navigation to another
 * /admin/* page (spec §3.1, "I2"; docs/admin/cloudflare-native-admin-spec.md).
 * Routing every D1 access through this single function closes that gap
 * structurally: getAdminDb() calls requireAccessIdentity() BEFORE it will
 * hand back the D1 binding at all, so there is no code path — page or route
 * handler, first load or client nav — that can reach ADMIN_DB without
 * passing the check. A future page that imports getAdminDb() and forgets an
 * explicit auth check still cannot read admin data unauthenticated, because
 * the binding itself is never handed back otherwise.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  requireAccessIdentity,
  type AdminIdentity,
  type HeaderSource,
} from "./cfAccess";

export interface AdminDbAccess {
  db: D1Database;
  identity: AdminIdentity;
}

/**
 * Verifies the caller's Cloudflare Access identity, then returns the
 * ADMIN_DB binding alongside it. Throws AccessDeniedError (from cfAccess.ts)
 * if the caller is not a verified admin — callers must catch it and produce
 * a real 403 (see src/app/admin/page.tsx and
 * src/app/api/admin/whoami/route.ts for the two enforcement shapes: a
 * Next.js `forbidden()` boundary for pages, an explicit 403 Response for
 * route handlers).
 */
export async function getAdminDb(
  headers: HeaderSource,
): Promise<AdminDbAccess> {
  const identity = await requireAccessIdentity(headers); // throws AccessDeniedError
  const { env } = await getCloudflareContext({ async: true });
  return { db: env.ADMIN_DB, identity };
}
