/**
 * ingestTarget.ts — maps a same-origin `/ingest/*` request path to the real
 * PostHog host it proxies to (#485: "reverse proxy so ad-blockers don't hide
 * a large share of visits"), and builds the outgoing request with only the
 * headers PostHog needs (ingestRequest, #858).
 *
 * WHY a Worker-level proxy in custom-worker.ts instead of next.config.ts
 * rewrites() (the issue body's original plan): PostHog's "Discard client IP
 * data" project setting means PostHog itself can never filter by IP, so the
 * IP-exclusion check (src/lib/ipMatch.ts) has to run somewhere upstream of
 * PostHog — custom-worker.ts's fetch handler is that place, and it needs a
 * plain function (this one) to decide WHERE to forward a request it isn't
 * dropping. Kept out of custom-worker.ts because that file imports from
 * gitignored build output and can't be unit-tested (see its own header).
 *
 * WHY `/static/*` gets its own host: PostHog serves its own client-side JS
 * chunks from a separate assets subdomain (us-assets.i.posthog.com) from
 * its ingestion API (us.i.posthog.com) — this mirrors the two-rule rewrite
 * PostHog's own reverse-proxy docs specify for exactly that split.
 */

const ASSETS_HOST = "https://us-assets.i.posthog.com";
const API_HOST = "https://us.i.posthog.com";

/**
 * Returns the absolute PostHog URL `pathname` (+ optional `search`) should
 * be forwarded to, or null if `pathname` isn't under `/ingest`.
 */
export function ingestTarget(pathname: string, search = ""): string | null {
  if (pathname !== "/ingest" && !pathname.startsWith("/ingest/")) return null;

  const rest = pathname.slice("/ingest".length); // "" | "/" | "/e/" | "/static/array.js"
  const isStatic = rest.startsWith("/static/") || rest === "/static";
  const host = isStatic ? ASSETS_HOST : API_HOST;

  return `${host}${rest || "/"}${search}`;
}

/**
 * The only headers the relay passes on to PostHog (#858). PostHog needs the
 * body's type and compression, content negotiation, and the browser's
 * User-Agent; nothing else. Everything else is dropped, in particular the
 * site's sign-in cookie, Authorization, Referer and the client-IP headers
 * (X-Forwarded-For, CF-*).
 */
const FORWARDED_HEADERS = ["content-type", "content-encoding", "accept", "accept-encoding", "user-agent"];

/**
 * Builds the request sent to PostHog: same method and body as `request`, at
 * `target` (from ingestTarget), carrying only FORWARDED_HEADERS.
 *
 * WHY two `new Request` calls: copying `request` first keeps its method and
 * body stream as-is, and the second call swaps in the allowlisted headers.
 * Passing `body: request.body` in a fresh init instead needs the non-standard
 * `duplex: "half"` option, which neither lib.dom nor workers-types declares.
 */
export function ingestRequest(target: string, request: Request): Request {
  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  return new Request(new Request(target, request), { headers });
}
