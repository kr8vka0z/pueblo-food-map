/**
 * Cloudflare Turnstile server-side token verification.
 *
 * Verifies a client-side Turnstile token by calling the Cloudflare siteverify
 * API. Returns true only if the API confirms success.
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

    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
