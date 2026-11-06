/**
 * Better Auth CLIENT (#315 Phase 2) — the browser-side counterpart to
 * auth-options.ts's server config. Used by AdminLoginForm.tsx (email code
 * + passkey sign-in).
 *
 * `baseURL` is left unset deliberately: better-auth's client defaults to
 * same-origin (`window.location.origin` + basePath `/api/auth`), which is
 * exactly right here since the login page and the `[...all]` route handler
 * always share a hostname — no cross-origin auth call exists in this app.
 */

import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  plugins: [emailOTPClient(), passkeyClient()],
});
