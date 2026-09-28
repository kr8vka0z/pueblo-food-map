/**
 * adminOwner.ts — the owner gate for the admin Activity log (#679).
 *
 * The allowlist (adminAllowlist.ts) decides who is an admin; this decides
 * the ONE admin who may see every sign-in and action. Enforced server-side
 * on /admin/activity (a 404 for anyone else) and on AdminNav's Activity
 * item, which is never rendered into a non-owner's HTML at all.
 *
 * `ADMIN_OWNER_EMAIL` is a wrangler var (both prod and env.staging), read
 * from the Cloudflare env binding by getAdminDb(). Like ADMIN_ALLOWLIST, it
 * must always fail toward "only Kyle": unset or blank falls back to the same
 * default as adminAllowlist.ts, never to "every admin". The owner must also
 * be allowlisted — isOwner() is only ever asked about an identity that
 * already passed requireAdminSession().
 */

const DEFAULT_OWNER_EMAIL = "kysboyd@gmail.com";

export function getAdminOwnerEmail(configured: string | undefined | null): string {
  const trimmed = configured?.trim().toLowerCase();
  return trimmed ? trimmed : DEFAULT_OWNER_EMAIL;
}

export function isOwnerEmail(email: string | undefined | null, configured: string | undefined | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === getAdminOwnerEmail(configured);
}
