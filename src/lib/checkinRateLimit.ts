/**
 * checkinRateLimit.ts — D1-backed shared-counter rate limit for the public
 * blessing-box check-in write path (Blessing Boxes slice 2).
 *
 * WHY not src/lib/rateLimit.ts's in-process limiter: that file's own header
 * says its store "resets when the Worker cold-starts" and is "good enough
 * for v1 spam deterrence" on the three low-frequency contact forms —
 * explicitly not strong enough for a feature people are expected to use
 * daily (Discovery §1's own finding: "Fine for forms; too weak for a
 * feature people use daily"). Cloudflare runs many Worker isolates
 * concurrently; an in-process Map is per-isolate, so a flood spread across
 * isolates sails past a cap that only ever sees a fraction of the real
 * traffic. D1 is one shared store every isolate reads and writes, so the
 * count is real regardless of which isolate handles which request — same
 * reasoning Better Auth's own `rateLimit` table (migrations/0004) uses for
 * the admin sign-in path.
 *
 * WHY a NEW table (migrations/0007's box_checkin_rate_limit) rather than
 * reusing that `rateLimit` table: its shape (`id`/`key`/`count`/
 * `lastRequest`) and its cleanup logic are owned by the installed
 * better-auth library (node_modules/@better-auth/core's get-tables.mjs) and
 * can change on a routine dependency bump — coupling this app's own write
 * path to a third-party plugin's private schema would leave a check-in bug
 * hiding in a future `bun update`. A small table with this file's own shape
 * costs nothing extra and can't drift out from under it.
 *
 * WHY no IP is ever written here: the Build Plan's PII rule for check-ins
 * ("no IP address — ever") extends to the write PATH that protects
 * check-ins, not only the check-in row itself. The per-box cap keys off the
 * box id (already public). The per-visitor cap instead keys off a random,
 * non-identifying token the BROWSER generates once and keeps in
 * localStorage (src/lib/checkinClientToken.ts) — an opaque anti-abuse
 * counter, not a real-world identifier, the same anonymity class this app's
 * planned F7 phone-local tally already uses (Build Plan). Losing or
 * clearing it just resets a rate-limit window, nothing more — there is
 * nothing here an attacker or a data export could ever tie to a person.
 *
 * WHY the key is HMAC'd rather than storing the box id / client token
 * directly: composing the row's key from TURNSTILE_SECRET_KEY means a
 * leaked D1 export shows only opaque hashes, never a raw client token or
 * box id an attacker could correlate across rows. Reuses the Turnstile
 * secret (already a runtime-only Worker secret this route requires anyway
 * for its own Turnstile check) rather than provisioning a brand-new secret
 * for one small hash.
 *
 * Atomicity: one `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` statement
 * per check — this is the load-bearing part. A read-then-write ("SELECT the
 * count, then UPDATE if under max") is racy the instant two requests land
 * on different isolates between the read and the write, which defeats the
 * entire reason this file exists over the in-process limiter above.
 */

const MS_PER_HOUR = 60 * 60 * 1000;

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface RateLimitScope {
  /** A short label distinguishing this cap from any other sharing the same table, e.g. "box" or "visitor-box". */
  scope: string;
  /** The thing being capped — a box id, or a client-token+box-id pair. Never a raw IP (see file header). */
  id: string;
}

/**
 * Returns true if `id` is still under `max` for `scope` this hour,
 * incrementing the shared D1 counter as part of the same check. `now` is
 * injectable so tests can pin the hour bucket. Fails CLOSED on any D1 error
 * (returns false, blocking the write) — the check-in insert this guards
 * already requires D1 to succeed, so a D1 outage blocks the write either
 * way; failing this check open would only matter during a PARTIAL D1
 * outage (this table failing while box_checkins itself still works), rare
 * enough that "no check-ins during a database blip" is the safer trade
 * against "abuse gets through during a database blip."
 */
export async function checkAndIncrement(
  db: D1Database,
  secret: string,
  { scope, id }: RateLimitScope,
  max: number,
  now: Date = new Date(),
): Promise<boolean> {
  const bucket = Math.floor(now.getTime() / MS_PER_HOUR);
  const key = await hmacHex(secret, `${scope}:${id}:${bucket}`);

  try {
    const row = await db
      .prepare(
        `INSERT INTO box_checkin_rate_limit (key, bucket, count) VALUES (?, ?, 1)
         ON CONFLICT(key) DO UPDATE SET count = count + 1
         RETURNING count`,
      )
      .bind(key, bucket)
      .first<{ count: number }>();

    // Opportunistic sweep of buckets more than 2 hours stale — cheap (one
    // indexed DELETE), never blocks the result above (already computed),
    // and its own failure must never fail the rate-limit check itself.
    try {
      await db.prepare("DELETE FROM box_checkin_rate_limit WHERE bucket < ?").bind(bucket - 2).run();
    } catch {
      // best-effort only
    }

    const count = row?.count ?? Number.POSITIVE_INFINITY;
    return count <= max;
  } catch {
    return false; // fail closed — see this function's own header
  }
}
