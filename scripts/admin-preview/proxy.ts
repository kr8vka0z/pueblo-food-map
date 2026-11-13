// scripts/admin-preview/proxy.ts — Bun reverse proxy in front of the LOCAL preview Worker, so the admin can be
// clicked through, signed in, on made-up data, from http://127.0.0.1:<port> or a Cloudflare quick tunnel.
// Started by start.sh (run with `bun`, never imported by the app). See README.md beside it.
//
// WHY it rewrites Host and Origin: admin sign-in only works on the site's three real hostnames, every non-GET
// admin write must carry Origin https://dev.pueblofoodmap.com (requireAdminOrigin), and the session cookie is
// __Host-/Secure. Instead of loosening any of that inside the app, this proxy makes each request LOOK like it
// arrives at https://dev.pueblofoodmap.com and translates the answers back for the browser. Only the browser's
// own address is translated; any other Origin passes through, so the app still refuses it (selfcheck.sh proves
// it). Never loosen the app's sign-in host list or Origin check to make this easier.
//
// Sign-in is seed data, not a sign-in flow: /__preview/signin hands the browser a cookie for a session row that
// seed-session.sh put in the LOCAL database for the made-up admin. This proxy never requests, reads or works out
// an emailed sign-in code. The cookie is signed the way better-auth (better-call's signCookieValue) signs it:
// encodeURIComponent(token + "." + base64(HMAC-SHA256(BETTER_AUTH_SECRET, token))), with the LOCAL secret that
// start.sh generates fresh on every start (.wrangler/admin-preview/worker.dev.vars, the same file the Worker
// loads). The app checks it exactly as it checks a real one.
//
// Env: UPSTREAM (default http://127.0.0.1:8791), PORT (8792), DEV_VARS (path to that file), STATE_DIR (the
// folder holding session.token, .wrangler/admin-preview/).
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// WHY a local declaration: Bun's type package isn't installed (the repo adds no dependency for this tool), and
// tsconfig type-checks every .ts file. Bun.serve is the only Bun API used here; Request/Response are the DOM's.
declare const Bun: {
  serve(options: { port: number; hostname: string; idleTimeout: number; fetch(req: Request): Promise<Response> }): unknown;
};

const UPSTREAM = process.env.UPSTREAM ?? "http://127.0.0.1:8791";
const PORT = Number(process.env.PORT ?? 8792);
const APP_HOST = "dev.pueblofoodmap.com";
const APP_ORIGIN = `https://${APP_HOST}`;
const ADMIN_EMAIL = "dana@example.org";
const STATE_DIR = process.env.STATE_DIR ?? ".";
const TOKEN_FILE = join(STATE_DIR, "session.token");
const COOKIE = "__Host-session_token";
// On plain http the browser refuses a __Host-/Secure cookie, so the proxy hands it out under this name and
// renames it back on the way in. Over the https tunnel the real name and flags pass through unchanged.
const HTTP_COOKIE = "pfm_preview_session_token";

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

// ── browser-facing address ────────────────────────────────────────────────────
function browserOrigin(req: Request): { origin: string; plainHttp: boolean } {
  const host = req.headers.get("host") ?? `127.0.0.1:${PORT}`;
  const fwd = (req.headers.get("x-forwarded-proto") ?? "").toLowerCase();
  const visitor = req.headers.get("cf-visitor") ?? "";
  const https = fwd === "https" || visitor.includes("https") || host.endsWith(".trycloudflare.com");
  return { origin: `${https ? "https" : "http"}://${host}`, plainHttp: !https };
}

function getCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

// ── talking to the Worker as https://dev.pueblofoodmap.com ───────────────────
function appHeaders(extra: Record<string, string> = {}): Headers {
  const h = new Headers({ host: APP_HOST, "x-forwarded-host": APP_HOST, "x-forwarded-proto": "https", origin: APP_ORIGIN, "accept-encoding": "identity" });
  for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return h;
}

const validCache = new Map<string, number>(); // token -> checked-at ms
async function sessionIsValid(token: string): Promise<boolean> {
  const at = validCache.get(token);
  if (at && Date.now() - at < 30_000) return true;
  const r = await fetch(`${UPSTREAM}/api/auth/get-session`, { headers: appHeaders({ cookie: `${COOKIE}=${token}` }), redirect: "manual" });
  const body = (await r.json().catch(() => null)) as { user?: { email?: string } } | null;
  const ok = r.status === 200 && body?.user?.email === ADMIN_EMAIL;
  if (ok) validCache.set(token, Date.now());
  else validCache.delete(token);
  return ok;
}

// The seeded session's cookie value, computed once at start. Fails loudly if either file is missing.
const SECRET = readFileSync(process.env.DEV_VARS ?? "", "utf8").match(/^BETTER_AUTH_SECRET=(.+)$/m)?.[1].trim();
if (!SECRET) throw new Error("BETTER_AUTH_SECRET not found in DEV_VARS");
const SEEDED_TOKEN = readFileSync(TOKEN_FILE, "utf8").trim();
const SESSION_COOKIE = encodeURIComponent(`${SEEDED_TOKEN}.${createHmac("sha256", SECRET).update(SEEDED_TOKEN).digest("base64")}`);

async function getSession(): Promise<string> {
  if (await sessionIsValid(SESSION_COOKIE)) return SESSION_COOKIE;
  throw new Error("the seeded preview session is missing from local D1; run seed-session.sh (or start.sh)");
}

// ── translating cookies and redirects back for the browser ───────────────────
function browserCookie(token: string, plainHttp: boolean): string {
  return plainHttp
    ? `${HTTP_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`
    : `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`;
}
function clearCookies(plainHttp: boolean): string[] {
  return plainHttp ? [`${HTTP_COOKIE}=; Path=/; Max-Age=0`] : [`${COOKIE}=; Path=/; Secure; Max-Age=0`];
}
function rewriteSetCookie(c: string, plainHttp: boolean): string {
  let out = c.replace(/;\s*Domain=[^;]*/gi, "");
  if (plainHttp) out = out.replace(/;\s*Secure/gi, "").replace(new RegExp(`^${COOKIE}=`), `${HTTP_COOKIE}=`);
  return out;
}
function rewriteLocation(loc: string, origin: string): string {
  return loc.replace(/^https?:\/\/dev\.pueblofoodmap\.com/i, origin);
}

function redirect(to: string, cookies: string[] = []): Response {
  const h = new Headers({ location: to, "cache-control": "no-store" });
  for (const c of cookies) h.append("set-cookie", c);
  return new Response(null, { status: 302, headers: h });
}

// WHY the proxy checks the session itself before an admin page: signed out, the app answers an admin page with
// status 200 and a redirect to /admin/login buried in the streamed page (NEXT_REDIRECT), not a 302 the proxy
// could see. So the proxy asks /api/auth/get-session first and, with no valid session, sends the browser to
// /__preview/signin instead. This only adds a sign-in step in front; the app's own check still runs after it.
function isGatedAdminPage(req: Request, path: string): boolean {
  if (req.method !== "GET") return false;
  if (path !== "/admin" && !path.startsWith("/admin/")) return false;
  if (path === "/admin/login" || path.startsWith("/admin/login/")) return false;
  // Only top-level page loads; the app's own client navigations (RSC) handle themselves.
  if (req.headers.get("rsc") || req.headers.get("next-router-state-tree")) return false;
  return (req.headers.get("accept") ?? "").includes("text/html");
}

// Browser-only headers that must not reach the app: the visitor's real IP from the tunnel (the app must never
// see or log a visitor IP), and hop-by-hop headers.
const DROP_REQUEST = ["cf-connecting-ip", "x-forwarded-for", "x-real-ip", "cf-ray", "cf-visitor", "cf-ipcountry", "cdn-loop", "cf-warp-tag-id", "connection", "keep-alive", "te", "upgrade"];

Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  idleTimeout: 120,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const { origin, plainHttp } = browserOrigin(req);

    // WHY /ingest is answered here: the Worker relays /ingest to the real PostHog project, so preview clicks
    // would land in the live site's analytics. A sandbox must never send anything there.
    if (path === "/ingest" || path.startsWith("/ingest/")) return new Response(null, { status: 204 });

    if (path === "/__preview/signin") {
      try {
        const token = await getSession();
        const next = url.searchParams.get("next");
        const to = next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/__preview") ? next : "/admin";
        return redirect(to, [browserCookie(token, plainHttp)]);
      } catch (e) {
        log("sign-in failed:", (e as Error).message);
        return new Response(`Preview sign-in failed: ${(e as Error).message}\n`, { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
      }
    }
    if (path === "/__preview/signout") return redirect("/admin/login", clearCookies(plainHttp));
    // Every browser shares one seeded session, so a real sign-out would delete that row and sign everyone out
    // until the next seed. Sign-out only clears this browser's cookie.
    if (path === "/api/auth/sign-out") {
      const h = new Headers({ "content-type": "application/json" });
      for (const c of clearCookies(plainHttp)) h.append("set-cookie", c);
      return new Response('{"success":true}', { headers: h });
    }
    // "Suggest Spanish" calls the Workers AI binding, which wrangler warns always reaches Cloudflare; the
    // sandbox refuses it here so nothing is ever sent there.
    if (path === "/api/admin/events/translate") {
      return new Response('{"ok":false,"error":"preview_ai_disabled"}', { status: 503, headers: { "content-type": "application/json" } });
    }

    const browserToken = getCookie(req.headers.get("cookie"), plainHttp ? HTTP_COOKIE : COOKIE);
    if (isGatedAdminPage(req, path) && (!browserToken || !(await sessionIsValid(browserToken).catch(() => false)))) {
      return redirect(`/__preview/signin?next=${encodeURIComponent(path + url.search)}`);
    }

    const headers = new Headers(req.headers);
    for (const k of DROP_REQUEST) headers.delete(k);
    headers.set("host", APP_HOST);
    headers.set("x-forwarded-host", APP_HOST);
    headers.set("x-forwarded-proto", "https");
    headers.set("accept-encoding", "identity");
    // Only the browser's own address is translated; any other Origin passes through so the app still refuses it.
    const o = headers.get("origin");
    if (o && o === origin) headers.set("origin", APP_ORIGIN);
    const ref = headers.get("referer");
    if (ref && ref.startsWith(origin + "/")) headers.set("referer", APP_ORIGIN + ref.slice(origin.length));
    if (plainHttp) {
      const cookie = headers.get("cookie");
      if (cookie) headers.set("cookie", cookie.split(/;\s*/).map((p) => (p.startsWith(`${HTTP_COOKIE}=`) ? COOKIE + p.slice(HTTP_COOKIE.length) : p)).join("; "));
    }

    const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();
    let upstream: Response;
    try {
      upstream = await fetch(UPSTREAM + path + url.search, { method: req.method, headers, body, redirect: "manual" });
    } catch (e) {
      return new Response(`Preview Worker is not answering (${(e as Error).message}). Is it still starting?\n`, { status: 502 });
    }

    const out = new Headers(upstream.headers);
    out.delete("content-encoding");
    out.delete("content-length");
    out.delete("set-cookie");
    for (const c of upstream.headers.getSetCookie()) out.append("set-cookie", rewriteSetCookie(c, plainHttp));
    const loc = out.get("location");
    if (loc) out.set("location", rewriteLocation(loc, origin));
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: out });
  },
});
log(`preview proxy on http://127.0.0.1:${PORT} -> ${UPSTREAM} (as ${APP_ORIGIN})`);
