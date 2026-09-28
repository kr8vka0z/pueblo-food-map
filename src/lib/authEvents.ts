/**
 * authEvents.ts — the permanent admin sign-in record behind the owner-only
 * Activity page (#679). Writes one `auth_events` row (migrations/
 * 0017_auth_events.sql) for every sign-in, sign-out, failed sign-in and
 * passkey change.
 *
 * WHY not Better Auth's own `session` table: session rows are deleted on
 * sign-out/expiry, and they record neither the sign-in method nor failed
 * attempts. This table is append-only and kept permanently.
 *
 * Two entry points, both wired in auth-options.ts:
 * - authEventsDatabaseHooks(): `session.create.after` — every successful
 *   sign-in, whichever endpoint minted the session.
 * - authEventsPlugin(): path-matched before/after hooks for the events a
 *   database hook can't see — sign-out (the session is gone by the time any
 *   `after` runs, so it's captured `before`), a sign-in link requested for a
 *   non-allowlisted email, an invalid/expired link, a failed passkey, and a
 *   passkey added/removed.
 *
 * A recording failure must NEVER block or change a sign-in: every write goes
 * through recordAuthEvent(), which catches and logs to the console. And
 * nothing secret is stored — never a sign-in-link token, session token or
 * passkey credential data (detail_json holds a short reason code only).
 */

import { createAuthMiddleware, getSessionFromCtx, isAPIError } from "better-auth/api";
import { isAllowlistedEmail } from "@/lib/adminAllowlist";

export type AuthEventKind =
  | "sign_in"
  | "sign_out"
  | "sign_in_failed"
  | "passkey_added"
  | "passkey_removed";

export type SignInMethod = "passkey" | "email_link" | "email_code";

/** Cloudflare's per-request geo (the `request.cf` object), narrowed to the fields this table keeps. */
export interface RequestGeo {
  city?: unknown;
  region?: unknown;
  country?: unknown;
}

export interface AuthEventDeps {
  /** The ADMIN_DB binding. Undefined (the schema-generation CLI, unit tests of unrelated config) turns recording off. */
  db: D1Database | undefined;
  /** Reads Cloudflare's `request.cf` for the current request. Optional — geo is simply left empty without it. */
  getGeo?: () => Promise<RequestGeo | undefined>;
}

export interface AuthEventInput {
  event: AuthEventKind;
  email?: string | null;
  userId?: string | null;
  sessionId?: string | null;
  method?: SignInMethod | null;
  ip?: string | null;
  userAgent?: string | null;
  detail?: Record<string, string> | null;
}

export const INSERT_AUTH_EVENT_SQL = `INSERT INTO auth_events
  (event, email, user_id, session_id, method, ip, user_agent, city, region, country, detail_json, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

// Sign-in-with-session: the email comes from Better Auth's own `user` row,
// looked up in the same statement so the hook needs no extra round trip.
export const INSERT_SIGN_IN_EVENT_SQL = `INSERT INTO auth_events
  (event, email, user_id, session_id, method, ip, user_agent, city, region, country, detail_json, created_at)
  VALUES ('sign_in', (SELECT email FROM "user" WHERE id = ?), ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`;

/** Maps the Better Auth endpoint that created a session to how the admin signed in. */
export function signInMethodForPath(path: string | undefined): SignInMethod | null {
  if (!path) return null;
  if (path.startsWith("/passkey/")) return "passkey";
  if (path.startsWith("/magic-link/") || path === "/sign-in/magic-link") return "email_link";
  // #684 (6-digit email code) — forward-compatible so the method is right the day it lands.
  if (path.includes("email-otp")) return "email_code";
  return null;
}

function text(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/** Client IP from Cloudflare's header — the same one Better Auth is configured to read (auth-options.ts `advanced.ipAddress`). */
export function clientIp(headers: Headers | undefined | null): string | null {
  return text(headers?.get("cf-connecting-ip"), 64);
}

export function userAgent(headers: Headers | undefined | null): string | null {
  return text(headers?.get("user-agent"), 400);
}

async function readGeo(deps: AuthEventDeps): Promise<{ city: string | null; region: string | null; country: string | null }> {
  try {
    const geo = deps.getGeo ? await deps.getGeo() : undefined;
    return { city: text(geo?.city, 80), region: text(geo?.region, 80), country: text(geo?.country, 8) };
  } catch {
    return { city: null, region: null, country: null };
  }
}

/** Writes one auth_events row. Never throws — see file header. */
export async function recordAuthEvent(deps: AuthEventDeps, input: AuthEventInput): Promise<void> {
  if (!deps.db) return;
  try {
    const geo = await readGeo(deps);
    await deps.db
      .prepare(INSERT_AUTH_EVENT_SQL)
      .bind(
        input.event,
        input.email ? input.email.trim().toLowerCase() : null,
        input.userId ?? null,
        input.sessionId ?? null,
        input.method ?? null,
        input.ip ?? null,
        input.userAgent ?? null,
        geo.city,
        geo.region,
        geo.country,
        input.detail ? JSON.stringify(input.detail) : null,
        new Date().toISOString(),
      )
      .run();
  } catch (error) {
    console.error("auth_events write failed", { event: input.event, error: String(error) });
  }
}

interface CreatedSession {
  id: string;
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

interface HookEndpointContext {
  path?: string;
  headers?: Headers;
  request?: Request;
}

function requestHeaders(ctx: HookEndpointContext | null | undefined): Headers | undefined {
  return ctx?.headers ?? ctx?.request?.headers;
}

/** `databaseHooks` fragment: one `sign_in` row per session Better Auth creates. */
export function authEventsDatabaseHooks(deps: AuthEventDeps) {
  return {
    session: {
      create: {
        after: async (session: CreatedSession, ctx?: HookEndpointContext | null) => {
          if (!deps.db) return;
          try {
            const headers = requestHeaders(ctx);
            const geo = await readGeo(deps);
            await deps.db
              .prepare(INSERT_SIGN_IN_EVENT_SQL)
              .bind(
                session.userId,
                session.userId,
                session.id,
                signInMethodForPath(ctx?.path),
                text(session.ipAddress, 64) ?? clientIp(headers),
                text(session.userAgent, 400) ?? userAgent(headers),
                geo.city,
                geo.region,
                geo.country,
                new Date().toISOString(),
              )
              .run();
          } catch (error) {
            console.error("auth_events write failed", { event: "sign_in", error: String(error) });
          }
        },
      },
    },
  };
}

/** The `error` code a failed magic-link verify redirects with (`?error=INVALID_TOKEN`), if any. */
function redirectErrorCode(returned: unknown): string | null {
  if (!isAPIError(returned)) return null;
  const location = (returned.headers as Headers | undefined)?.get?.("location");
  if (!location) return "unknown";
  try {
    return new URL(location, "https://pueblofoodmap.com").searchParams.get("error") ?? null;
  } catch {
    return "unknown";
  }
}

const PASSKEY_SIGN_IN_PATH = "/passkey/verify-authentication";
const MAGIC_LINK_VERIFY_PATH = "/magic-link/verify";
const MAGIC_LINK_REQUEST_PATH = "/sign-in/magic-link";
const PASSKEY_ADDED_PATH = "/passkey/verify-registration";
const PASSKEY_REMOVED_PATH = "/passkey/delete-passkey";
const SIGN_OUT_PATH = "/sign-out";

/**
 * Better Auth plugin for the non-session-create events. Must be registered
 * BEFORE adminAuthAllowlistPlugin (auth-options.ts): that plugin's
 * magic-link gate short-circuits a non-allowlisted request, and a
 * short-circuited request runs no later hooks, so the rejection is recorded
 * here first. This hook only observes — it never changes the response, so
 * the anti-enumeration guarantee is untouched.
 */
export function authEventsPlugin(deps: AuthEventDeps) {
  return {
    id: "admin-auth-events",
    hooks: {
      before: [
        {
          matcher(ctx: { path?: string }) {
            return ctx.path === MAGIC_LINK_REQUEST_PATH;
          },
          handler: createAuthMiddleware(async (ctx) => {
            const email = (ctx.body as { email?: unknown } | undefined)?.email;
            if (typeof email !== "string" || !isAllowlistedEmail(email)) {
              await recordAuthEvent(deps, {
                event: "sign_in_failed",
                email: typeof email === "string" ? email.slice(0, 254) : null,
                method: "email_link",
                ip: clientIp(ctx.headers),
                userAgent: userAgent(ctx.headers),
                detail: { reason: "not_allowlisted" },
              });
            }
            return undefined;
          }),
        },
        {
          matcher(ctx: { path?: string }) {
            return ctx.path === SIGN_OUT_PATH;
          },
          handler: createAuthMiddleware(async (ctx) => {
            const current = await getSessionFromCtx(ctx).catch(() => null);
            if (current?.session) {
              await recordAuthEvent(deps, {
                event: "sign_out",
                email: current.user?.email,
                userId: current.user?.id,
                sessionId: current.session.id,
                ip: clientIp(ctx.headers),
                userAgent: userAgent(ctx.headers),
              });
            }
            return undefined;
          }),
        },
      ],
      after: [
        {
          matcher(ctx: { path?: string }) {
            return ctx.path === MAGIC_LINK_VERIFY_PATH || ctx.path === PASSKEY_SIGN_IN_PATH;
          },
          handler: createAuthMiddleware(async (ctx) => {
            // Success is already recorded by the session.create hook; only a
            // verify that minted no session is a failure.
            if (ctx.context.newSession) return;
            const isPasskey = ctx.path === PASSKEY_SIGN_IN_PATH;
            const reason = isPasskey
              ? isAPIError(ctx.context.returned)
                ? String(ctx.context.returned.body?.code ?? ctx.context.returned.status ?? "passkey_failed")
                : "passkey_failed"
              : (redirectErrorCode(ctx.context.returned) ?? "no_session");
            await recordAuthEvent(deps, {
              event: "sign_in_failed",
              method: isPasskey ? "passkey" : "email_link",
              ip: clientIp(ctx.headers),
              userAgent: userAgent(ctx.headers),
              detail: { reason: reason.slice(0, 80) },
            });
          }),
        },
        {
          matcher(ctx: { path?: string }) {
            return ctx.path === PASSKEY_ADDED_PATH || ctx.path === PASSKEY_REMOVED_PATH;
          },
          handler: createAuthMiddleware(async (ctx) => {
            if (isAPIError(ctx.context.returned)) return;
            const current = ctx.context.session ?? (await getSessionFromCtx(ctx).catch(() => null));
            await recordAuthEvent(deps, {
              event: ctx.path === PASSKEY_ADDED_PATH ? "passkey_added" : "passkey_removed",
              email: current?.user?.email,
              userId: current?.user?.id,
              sessionId: current?.session?.id,
              ip: clientIp(ctx.headers),
              userAgent: userAgent(ctx.headers),
            });
          }),
        },
      ],
    },
  };
}
