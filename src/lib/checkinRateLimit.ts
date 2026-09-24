/**
 * checkinRateLimit.ts — D1-backed shared-counter rate limit for the public
 * blessing-box check-in write path (Blessing Boxes slice 2).
 *
 * WHY not an in-process limiter (a plain module-level Map, which is what
 * this file originally replaced for the check-in path, and what the three
 * public submit forms used until #587): Cloudflare runs many Worker
 * isolates concurrently; an in-process Map is per-isolate, so a flood
 * spread across isolates sails past a cap that only ever sees a fraction of
 * the real traffic. D1 is one shared store every isolate reads and writes,
 * so the count is real regardless of which isolate handles which request —
 * same reasoning Better Auth's own `rateLimit` table (migrations/0004) uses
 * for the admin sign-in path. As of #587 this file backs FOUR callers: the
 * check-in path below, and the three public submit forms via
 * src/lib/formRateLimit.ts's thin wrapper (report/suggest/feedback) — see
 * that file's own header for the form-specific scopes/caps.
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
 * WHY no raw box id, client token, OR IP is ever written here: the Build
 * Plan's PII rule for check-ins ("no IP address — ever") extends to the
 * write PATH that protects check-ins, not only the check-in row itself. The
 * per-box cap keys off the box id (already public). The per-visitor cap
 * instead keys off a random, non-identifying token the BROWSER generates
 * once and keeps in localStorage (src/lib/checkinClientToken.ts) — an
 * opaque anti-abuse counter, not a real-world identifier, the same
 * anonymity class this app's planned F7 phone-local tally already uses
 * (Build Plan). Losing or clearing it just resets a rate-limit window,
 * nothing more — there is nothing here an attacker or a data export could
 * ever tie to a person. The three public submit forms' per-IP cap (#587,
 * src/lib/formRateLimit.ts) is the one caller that DOES pass something
 * identifying as `id` (the submitter's IP) — see "WHY the key is HMAC'd"
 * immediately below for why that never becomes a stored raw value either.
 *
 * WHY the key is HMAC'd rather than storing the box id / client token /
 * form-submitter IP directly: composing the row's key from a server secret
 * means a leaked D1 export shows only opaque hashes, never a raw client
 * token, box id, or IP an attacker could correlate across rows — the IP (or
 * box id, or client token) enters the HMAC and nothing else; it is never
 * itself a column value.
 *
 * WHY a DEDICATED `CHECKIN_RATE_LIMIT_SECRET` rather than reusing
 * `TURNSTILE_SECRET_KEY` (2026-09-17 review correction — the original
 * version of this file reused the Turnstile secret): rotating Turnstile
 * for an unrelated reason (e.g. a routine credential rotation, or a
 * Turnstile-specific incident) would silently reset every open rate-limit
 * bucket the instant the new secret took effect — every HMAC key this
 * table has ever written would stop matching, so every visitor's counter
 * effectively zeroes out, defeating the cap for up to an hour with no
 * error, no log line, nothing to notice. The two are independent security
 * concerns (bot verification vs. write-frequency capping) with no reason
 * to share a rotation lifecycle. Set as its own runtime secret the same
 * way as RESEND_API_KEY/TURNSTILE_SECRET_KEY (see .env.example and
 * AGENTS.md's Blessing Boxes slice 2 section).
 *
 * Atomicity: one `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` statement
 * per check — this is the load-bearing part. A read-then-write ("SELECT the
 * count, then UPDATE if under max") is racy the instant two requests land
 * on different isolates between the read and the write, which defeats the
 * entire reason this file exists over the in-process limiter above.
 */

const MS_PER_HOUR = 60 * 60 * 1000;

/** Exported for src/lib/boxNeedsToken.ts (needs-ask ownership capability, migration 0012) — same HMAC-SHA256-hex primitive, a different message shape, no reason to duplicate the Web Crypto boilerplate. */
export async function hmacHex(secret: string, message: string): Promise<string> {
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
  /** The thing being capped — a box id, a client-token+box-id pair, or (form-report/-suggest/-feedback scopes only) a submitter IP. Whatever is passed here only ever enters the HMAC below (see file header, "WHY the key is HMAC'd") — this table never stores it raw. */
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
