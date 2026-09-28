/**
 * Sends the admin sign-in CODE email via Resend (#684). Replaces the old
 * magic-link email: a link always opened a second tab (mail apps open links
 * in a new tab), so the admin now types a 6-digit code into the tab they're
 * already on. Same Resend sending-key convention as every other email on
 * this site (`RESEND_API_KEY`, `api.resend.com/emails`).
 *
 * Only ever called for an allowlisted email and `type === "sign-in"`:
 * adminAuthAllowlistPlugin.ts short-circuits every other
 * /email-otp/send-verification-otp request before the emailOTP plugin runs,
 * so this function does not re-check the allowlist itself.
 *
 * The code is in the subject too, so a phone's lock-screen preview (and iOS
 * / Android one-time-code autofill, which reads the message) can supply it.
 * No link of any kind — nothing to click.
 */

const FROM_ADDRESS = "Pueblo Food Map Admin <noreply@pueblofoodmap.com>";

/** Minutes the code stays valid — must match emailOTP's `expiresIn` in auth-options.ts. */
export const SIGN_IN_CODE_MINUTES = 10;

export async function sendAdminSignInCodeEmail(data: { email: string; otp: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }
  // Defensive: the plugin only ever generates digits, but this string lands
  // in HTML — never interpolate anything else.
  const code = data.otp.replace(/\D/g, "");

  const text = [
    `Your Pueblo Food Map admin sign-in code is: ${code}`,
    "",
    `Type it on the sign-in page. It expires in ${SIGN_IN_CODE_MINUTES} minutes and works once.`,
    "",
    "Didn't ask for this? You can ignore it.",
  ].join("\n");

  // Colors are inlined DESIGN.md token values (ink700/ink900/ink500/bone50/
  // bone200) — email clients don't load stylesheets or CSS custom properties.
  const html = `
    <div style="font-family: 'Public Sans', Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #2D2A26; background-color: #FBFAF6; padding: 24px;">
      <h1 style="font-family: 'Fraunces', Georgia, serif; font-size: 22px; margin-bottom: 8px; color: #1A1817;">
        Your sign-in code
      </h1>
      <p style="font-size: 15px; line-height: 1.5;">
        Type this code on the Pueblo Food Map admin sign-in page.
      </p>
      <p style="margin: 24px 0; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1A1817; background-color: #ffffff; border: 1px solid #E8E3D6; border-radius: 8px; padding: 16px; text-align: center; font-family: 'Courier New', monospace;">
        ${code}
      </p>
      <p style="font-size: 15px; line-height: 1.5;">
        It expires in ${SIGN_IN_CODE_MINUTES} minutes and works once.
      </p>
      <p style="font-size: 13px; color: #5F5A52;">
        Didn't ask for this? You can ignore it.
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
      subject: `Your sign-in code: ${code}`,
      text,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)");
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}
