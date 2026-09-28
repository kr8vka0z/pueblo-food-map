/**
 * Admin allowlist enforcement plugin (#315 Phase 2; email-code gate #684) —
 * the CRITICAL security gate for admin sign-in. Better Auth's plugin system
 * has no single "reject a sign-in" hook point that fires early enough on its
 * own, so this ships as a small plugin object with a `hooks.before` array
 * (the shape Better Auth's own `nextCookies()` plugin uses), matched by path
 * and run by the dispatch pipeline (node_modules/better-auth/dist/api/
 * dispatch.mjs: every plugin's `hooks.before` runs BEFORE the endpoint).
 *
 * Gates, matching the ways a session can come to exist:
 *
 * 1. `/email-otp/send-verification-otp` — sending a sign-in code. A
 *    non-allowlisted email, or any `type` other than "sign-in", gets
 *    `{ success: true }` — byte-identical to a real send — BEFORE the
 *    emailOTP handler runs. It has to be a before-hook: that handler writes
 *    the code's `verification` row before it calls `sendVerificationOTP`.
 *    So a non-admin address gets no code row, no email, and a response that
 *    can't be told apart from a real send (anti-enumeration).
 *
 * 2. `/sign-in/email-otp` — signing in with a code. A non-allowlisted email
 *    is refused with emailOTP's own "Invalid OTP" error (the same thing a
 *    wrong code returns) before any code is checked. Defense in depth: gate
 *    1 means such an email never has a code to begin with.
 *
 * 3. Every other emailOTP endpoint (verify-email, check-verification-otp,
 *    password reset, change email) — this admin uses none of them, so they
 *    are refused outright (404), shrinking the surface to exactly the two
 *    paths above.
 *
 * 4. `/passkey/generate-register-options` + `/passkey/verify-registration`
 *    — reject passkey registration for any session whose user isn't
 *    allowlisted. `@better-auth/passkey` already requires a fresh session;
 *    this is the additional allowlist layer (#315).
 *
 * Plus `databaseHooks.user.create.before` (defense in depth): no
 * non-allowlisted `user` row can ever be persisted, whatever the path.
 */

import { createAuthMiddleware, APIError, getSessionFromCtx } from "better-auth/api";
import { isAllowlistedEmail } from "@/lib/adminAllowlist";

export const SEND_CODE_PATH = "/email-otp/send-verification-otp";
export const SIGN_IN_WITH_CODE_PATH = "/sign-in/email-otp";

// emailOTP endpoints this admin never uses — refused outright (gate 3).
export const REFUSED_EMAIL_OTP_PATHS = new Set([
  "/email-otp/check-verification-otp",
  "/email-otp/verify-email",
  "/email-otp/request-password-reset",
  "/forget-password/email-otp",
  "/email-otp/reset-password",
  "/email-otp/request-email-change",
  "/email-otp/change-email",
]);

// emailOTP's own wrong-code error (better-auth/dist/plugins/email-otp/
// error-codes.mjs; not exported by the package), reproduced so a refused
// non-admin email is indistinguishable from a wrong code.
const INVALID_OTP = { code: "INVALID_OTP", message: "Invalid OTP" };

const PASSKEY_REGISTRATION_PATHS = new Set([
  "/passkey/generate-register-options",
  "/passkey/verify-registration",
]);

export function adminAuthAllowlistPlugin() {
  return {
    id: "admin-allowlist",
    hooks: {
      before: [
        {
          matcher(ctx: { path?: string }) {
            return ctx.path === SEND_CODE_PATH;
          },
          handler: createAuthMiddleware(async (ctx) => {
            const body = ctx.body as { email?: unknown; type?: unknown } | undefined;
            const email = body?.email;
            if (typeof email !== "string" || !isAllowlistedEmail(email) || body?.type !== "sign-in") {
              // Identical shape to sendVerificationOTP's own success response
              // (`{ success: true }`) — no code row, no email, and the caller
              // can't tell this apart from a real send.
              return ctx.json({ success: true });
            }
            return undefined;
          }),
        },
        {
          matcher(ctx: { path?: string }) {
            return ctx.path === SIGN_IN_WITH_CODE_PATH;
          },
          handler: createAuthMiddleware(async (ctx) => {
            const email = (ctx.body as { email?: unknown } | undefined)?.email;
            if (typeof email !== "string" || !isAllowlistedEmail(email)) {
              // Same error a wrong code gets — never reveals the allowlist.
              throw APIError.from("BAD_REQUEST", INVALID_OTP);
            }
            return undefined;
          }),
        },
        {
          matcher(ctx: { path?: string }) {
            return ctx.path !== undefined && REFUSED_EMAIL_OTP_PATHS.has(ctx.path);
          },
          handler: createAuthMiddleware(async () => {
            throw new APIError("NOT_FOUND");
          }),
        },
        {
          matcher(ctx: { path?: string }) {
            return ctx.path !== undefined && PASSKEY_REGISTRATION_PATHS.has(ctx.path);
          },
          handler: createAuthMiddleware(async (ctx) => {
            const session = await getSessionFromCtx(ctx);
            const email = session?.user?.email;
            if (!email || !isAllowlistedEmail(email)) {
              throw new APIError("FORBIDDEN", {
                message: "Passkey registration is restricted to allowlisted admins.",
              });
            }
            return undefined;
          }),
        },
      ],
    },
    // Defense-in-depth (#315): even if a future endpoint or plugin ever
    // creates a `user` row through a path this plugin's `hooks.before`
    // doesn't match, no non-allowlisted user can ever be persisted.
    databaseHooks: {
      user: {
        create: {
          before: async (user: { email?: unknown }) => {
            if (
              typeof user.email !== "string" ||
              !isAllowlistedEmail(user.email)
            ) {
              return false;
            }
            return true;
          },
        },
      },
    },
  };
}
