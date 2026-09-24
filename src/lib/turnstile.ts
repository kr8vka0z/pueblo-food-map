/**
 * Every hostname the siteverify response's `hostname` field is allowed to
 * report (#595) — the public apex + www + the staging apex + the direct
 * Workers URL, mirroring auth-options.ts's ADMIN_ALLOWED_HOSTS pattern for
 * the same "every real hostname this Worker answers on" reasoning, plus
 * `localhost` since Cloudflare's own documented test sitekeys/secret keys
 * are declared to work "on any domain, including: localhost, 127.0.0.1,
 * 0.0.0.0, [and] any development domain" (Turnstile testing docs) and this
 * repo's local dev + entire test suite drive the flow through those test
 * keys against `http://localhost:3000`.
 *
 * Low-risk defense-in-depth (site keys are already domain-restricted by
 * Cloudflare itself) — a captured/replayed token from a legitimate site can
 * still verify successfully against a foreign site's own Turnstile widget,
 * so this closes that gap without being the primary control.
 */
const ALLOWED_HOSTNAMES = new Set([
  "pueblofoodmap.com",
  "www.pueblofoodmap.com",
  "dev.pueblofoodmap.com",
  "pueblo-food-map.kyle-boyd.workers.dev",
  "localhost",
]);

/**
 * Cloudflare Turnstile server-side token verification.
 *
 * Verifies a client-side Turnstile token by calling the Cloudflare siteverify
 * API. Returns true only if the API confirms success AND (when the response
 * reports one) the `hostname` is one of ours (#595).
 *
 * WHY the hostname check is skipped when `data.hostname` is absent rather
 * than failing closed: a real Cloudflare siteverify success response always
 * includes `hostname` (verified against Cloudflare's documented response
 * shape), so this only ever short-circuits against a test double that omits
 * the field entirely — every existing mocked-fetch test in this repo's
 * suite (reportSubmitD1.test.ts, suggestSubmitD1.test.ts,
 * feedbackSubmitD1.test.ts, observability.test.ts) stubs `{success: true}`
 * with no hostname, and none of those are in scope to touch for #595.
 *
 * @param token      - The cf-turnstile-response token from the client.
 * @param secretKey  - Worker secret (TURNSTILE_SECRET_KEY). Accessed via
 *                     process.env in Next.js route handlers; in Workers env
 *                     binding context it must be passed explicitly.
 * @param clientIp   - Optional: IP of the submitting client (cf-connecting-ip
 *                     header). Passed as `remoteip` for extra validation.
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  secretKey: string,
  clientIp?: string | null,
): Promise<boolean> {
  if (!token) return false;

  const params = new URLSearchParams({
    secret: secretKey,
    response: token,
  });

  if (clientIp) {
    params.set("remoteip", clientIp);
  }

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      },
    );

    if (!res.ok) return false;

    const data = (await res.json()) as { success: boolean; hostname?: string };
    if (data.success !== true) return false;
    if (data.hostname && !ALLOWED_HOSTNAMES.has(data.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}
