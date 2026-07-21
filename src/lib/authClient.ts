/**
 * Better Auth CLIENT (#315 Phase 2) — the browser-side counterpart to
 * auth-options.ts's server config. Used only by the login page
 * (src/app/admin/login/page.tsx) so far; nothing else in the app calls this
 * yet (route gating is a later phase — see AGENTS.md's Better Auth
 * section).
 *
 * `baseURL` is left unset deliberately: better-auth's client defaults to
 * same-origin (`window.location.origin` + basePath `/api/auth`), which is
 * exactly right here since the login page and the `[...all]` route handler
 * always share a hostname — no cross-origin auth call exists in this app.
 */

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  plugins: [magicLinkClient(), passkeyClient()],
});
