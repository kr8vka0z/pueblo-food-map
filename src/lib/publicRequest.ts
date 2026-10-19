/**
 * publicRequest.ts — small request helpers shared by the public API routes
 * (/api/public/blessing-boxes/** and /api/csp-report).
 *
 * Deliberately NOT authEvents.ts's clientIp(): that one reads only
 * cf-connecting-ip and caps it at 64 chars for storage in auth_events. The
 * value here is never stored — it is passed to Turnstile as `remoteip` or
 * used as an HMAC'd rate-limit key — so it keeps the x-forwarded-for
 * fallback (local dev and tests have no cf-connecting-ip).
 */

/** cf-connecting-ip, else the first x-forwarded-for entry (trimmed), else "unknown". */
export function requestIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  );
}
