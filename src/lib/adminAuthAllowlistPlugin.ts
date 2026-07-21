/**
 * Admin allowlist enforcement plugin (#315 Phase 2) — the CRITICAL security
 * gate for this phase. Better Auth's own plugin system has no single
 * "reject a sign-in" hook point that fires early enough on its own, so this
 * ships as a small plugin object with a `hooks.before` array (the exact
 * shape Better Auth's own built-in `nextCookies()` plugin uses — see
 * node_modules/better-auth/dist/integrations/next-js.mjs), matched by path
 * and consumed identically to every other plugin's hooks by the dispatch
 * pipeline (node_modules/better-auth/dist/api/dispatch.mjs: `getHooks()`
 * flatMaps every plugin's `hooks.before` and runs them all BEFORE the
 * endpoint handler ever executes).
 *
 * Two gates, matching the two ways this phase allows a session to exist:
 *
 * 1. `/sign-in/magic-link` — reject a non-allowlisted email BEFORE
 *    magicLink's own handler runs. This has to be a `hooks.before`
 *    intercept, not a check inside `sendMagicLink` (auth-options.ts) or
 *    `databaseHooks.verification.create.before`: magicLink's own handler
 *    (node_modules/better-auth/dist/plugins/magic-link/index.mjs)
 *    calls `internalAdapter.createVerificationValue(...)` — which persists
 *    the token row — BEFORE it calls `sendMagicLink`. A before-hook is the
 *    only point that runs ahead of that write.
 *
 * 2. `/passkey/generate-register-options` + `/passkey/verify-registration`
 *    — reject passkey registration for any session whose user isn't
 *    allowlisted. `@better-auth/passkey`'s own endpoints already require a
 *    fresh session by default (`freshSessionMiddleware`, see that plugin's
 *    source) — this hook is the additional allowlist layer requested by
 *    #315, not a replacement for that auth check.
 *
 * Anti-enumeration: the magic-link gate returns the SAME `{ status: true }`
 * shape signInMagicLink itself returns on success (see its `d.mts`
 * response type) via `ctx.json(...)`, which Better Auth's dispatch treats
 * as a full short-circuit response (any truthy non-`{context}` return value
 * from a before-hook fully replaces the endpoint's response — dispatch.mjs
 * `runBeforeHooks`). A non-allowlisted email therefore gets a byte-identical
 * response to an allowlisted one, with no verification row ever created and
 * no email ever sent — nothing distinguishes "not allowlisted" from "email
 * sent" from the outside.
 */

import { createAuthMiddleware, APIError, getSessionFromCtx } from "better-auth/api";
import { isAllowlistedEmail } from "@/lib/adminAllowlist";

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
            return ctx.path === "/sign-in/magic-link";
          },
          handler: createAuthMiddleware(async (ctx) => {
            const email = (ctx.body as { email?: unknown } | undefined)
              ?.email;
            if (typeof email !== "string" || !isAllowlistedEmail(email)) {
              // Identical shape to signInMagicLink's own success response
              // (see magic-link/index.d.mts: `{ status: boolean }`) — no
              // verification row is created, no email is sent, and the
              // caller cannot distinguish this from a real send.
              return ctx.json({ status: true });
            }
            return undefined;
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
