/**
 * Admin allowlist (#315 Phase 2) — the single source of truth for "who is
 * allowed to hold an admin session at all," enforced at every Better Auth
 * hook that can mint or extend one (see auth-options.ts's allowlist plugin).
 *
 * WHY a standalone module, not inlined in auth-options.ts: both the plugin
 * hooks AND their unit tests need the same `isAllowlistedEmail()` check —
 * keeping it here, framework-free, lets the tests assert the comparison
 * logic directly without booting a full Better Auth instance for every case.
 */

/** Default allowlist when ADMIN_ALLOWLIST is unset — Kyle's own admin email. */
const DEFAULT_ALLOWLIST = ["kysboyd@gmail.com"];

/**
 * Reads ADMIN_ALLOWLIST from the environment (comma-separated emails) and
 * returns a normalized (trimmed, lowercased) list. Falls back to
 * DEFAULT_ALLOWLIST when the env var is unset or resolves to no entries —
 * this repo must never boot with an accidentally-empty allowlist that
 * silently locks everyone out (or, if the emptiness check were inverted,
 * silently allows everyone in).
 */
export function getAdminAllowlist(): string[] {
  const raw = process.env.ADMIN_ALLOWLIST;
  if (!raw) {
    return DEFAULT_ALLOWLIST;
  }

  const entries = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  return entries.length > 0 ? entries : DEFAULT_ALLOWLIST;
}

/** Case-insensitive, trimmed membership check against the admin allowlist. */
export function isAllowlistedEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return getAdminAllowlist().includes(normalized);
}
