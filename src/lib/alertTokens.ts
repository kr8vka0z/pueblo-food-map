/**
 * alertTokens.ts — shared random-token generator for the adopt-a-box and
 * email-alert confirm/unsubscribe links (Blessing Boxes slice 6).
 *
 * WHY 32 random bytes, hex-encoded (256 bits): a confirm/stop token is
 * looked up directly by value (no accompanying id, no login) — the routes
 * that consume it (POST /api/public/alerts/confirm|stop|resubscribe) have no
 * other guard against a guessed token besides the value being infeasible to
 * guess. This is the same entropy budget migrations/0007's rate-limit HMAC
 * keys already rely on, just generated client-independent (crypto.
 * getRandomValues, available in both the Workers runtime and Node/vitest).
 *
 * WHY one shared helper rather than each caller rolling its own: box_adopters
 * (confirm_token) and alert_subscriptions (confirm_token, unsubscribe_token)
 * all need the exact same "unguessable opaque string" property — a single
 * function means that property can't quietly drift (e.g. someone reaching
 * for Math.random() on a future call site).
 */
export function randomHexToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Shared 7-day confirm-link validity window — both box_adopters.confirm_token
 * (boxAdopters.ts) and alert_subscriptions.confirm_token (boxAlerts.ts) use
 * the SAME rule ("Confirm tokens older than 7 days are invalid," per the
 * task's own spec), so this lives in one place rather than two independently
 * chosen constants that could drift.
 */
export const CONFIRM_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** True when `createdAt` (an ISO timestamp — the row's own creation time, rotated on every confirm-email resend, see boxAlerts.ts's upsertGiverSubscription) is still within the confirm window. */
export function isWithinConfirmWindow(createdAt: string, now: Date = new Date()): boolean {
  const ageMs = now.getTime() - new Date(createdAt).getTime();
  return ageMs <= CONFIRM_TOKEN_MAX_AGE_MS;
}
