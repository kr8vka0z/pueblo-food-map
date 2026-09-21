/**
 * alertOrigin.ts — picks a safe origin to build a link into an outbound
 * email (Blessing Boxes slice 6: adopt/alert confirm links, stop links,
 * approval/welcome emails).
 *
 * WHY not just reflect the request's own Host header: this app's Worker
 * answers on more hostnames than the two real ones (the bare
 * `*.workers.dev` fallback, every Workers version-preview URL — same set
 * AGENTS.md's admin-auth section already warns answers admin routes too).
 * A request can set an arbitrary Host header when hitting the Worker
 * directly by IP/preview URL, and this app builds these links into HTML
 * email that will be genuinely clicked — reflecting an attacker-chosen host
 * into a "confirm your email" or "stop these emails" link would let a
 * phishing page brand itself with a real pueblofoodmap.com-looking send.
 * Allowlisting the two real hostnames (plus localhost in non-production, for
 * local dev testing) closes that off structurally: anything else falls back
 * to the canonical production origin, never an attacker-supplied value.
 */

/** Exported for src/lib/emailSend.ts's htmlParagraph — the two real hostnames a generated email link is ever allowed to point at (plus localhost, below) — see that function's own header for why. */
export const ALLOWED_HOSTS = ["pueblofoodmap.com", "dev.pueblofoodmap.com"];
const DEFAULT_ORIGIN = "https://pueblofoodmap.com";

/** `req` needs only `.url` — satisfied by both NextRequest and a plain Request. */
export function resolveEmailOrigin(req: { url: string }): string {
  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    return DEFAULT_ORIGIN;
  }

  if (ALLOWED_HOSTS.includes(url.hostname)) {
    return `${url.protocol}//${url.hostname}`;
  }

  // Local dev only — never in a deployed Worker, where NODE_ENV is always
  // "production" (opennextjs-cloudflare's build sets it at build time).
  if (process.env.NODE_ENV !== "production" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
    return `${url.protocol}//${url.host}`; // keep the port for local dev
  }

  return DEFAULT_ORIGIN;
}
