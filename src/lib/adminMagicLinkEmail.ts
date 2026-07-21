/**
 * Sends the admin sign-in magic-link email via Resend (#315 Phase 2).
 * Replaces the Phase 1 `sendMagicLink` stub in auth-options.ts, reusing the
 * same Resend sending-key convention every other form on this site already
 * uses (see src/app/feedback/submit/route.ts's `sendFeedbackEmail` — same
 * `RESEND_API_KEY` runtime secret, same `api.resend.com/emails` call shape).
 *
 * WHY this is called from a `hooks.before`-gated endpoint, not directly:
 * by the time Better Auth invokes `sendMagicLink`, the allowlist gate in
 * adminAuthAllowlistPlugin.ts has already run and short-circuited any
 * non-allowlisted request — this function only ever runs for an
 * allowlisted email, so it does not re-check the allowlist itself.
 */

const FROM_ADDRESS = "Pueblo Food Map Admin <noreply@pueblofoodmap.com>";

export async function sendAdminMagicLinkEmail(data: {
  email: string;
  url: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const text = [
    "Sign in to the Pueblo Food Map admin",
    "",
    "Click the link below to sign in. This link is single-use and expires shortly.",
    "",
    data.url,
    "",
    "If you didn't request this, you can ignore this email.",
  ].join("\n");

  // Colors are inlined DESIGN.md token values (sage500/ink700/ink500/bone50)
  // — email clients don't load external stylesheets or CSS custom
  // properties, so this is the one place brand tokens must be hardcoded
  // hex rather than referenced via Tailwind/globals.css.
  const html = `
    <div style="font-family: 'Public Sans', Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #2D2A26; background-color: #FBFAF6; padding: 24px;">
      <h1 style="font-family: 'Fraunces', Georgia, serif; font-size: 22px; margin-bottom: 8px; color: #1A1817;">
        Sign in to the admin
      </h1>
      <p style="font-size: 15px; line-height: 1.5;">
        Click the button below to sign in to the Pueblo Food Map admin. This
        link is single-use and expires shortly.
      </p>
      <p style="margin: 24px 0;">
        <a
          href="${data.url}"
          style="background-color: #4A8466; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;"
        >
          Sign in
        </a>
      </p>
      <p style="font-size: 13px; color: #5F5A52;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [data.email],
      subject: "Sign in to the Pueblo Food Map admin",
      text,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)");
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}
