/**
 * publicRequest.ts — small request helpers shared by the public API routes
 * (/api/public/blessing-boxes/** and /api/csp-report).
 *
 * requestIp() is byte-for-byte the expression these routes used inline. It
 * is deliberately separate from authEvents.ts's clientIp(), which reads only
 * cf-connecting-ip and caps it at 64 chars for storage in auth_events; the
 * value here is never stored (Turnstile `remoteip`, or an HMAC'd rate-limit
 * key in csp-report).
 */

/** cf-connecting-ip, else the first x-forwarded-for entry (trimmed), else "unknown". */
export function requestIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  );
}
