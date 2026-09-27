import type { NextConfig } from "next";

// Security headers applied to every response.
//
// X-Frame-Options: DENY — prevents other sites from embedding the map inside
//   an <iframe>, which is the primary phishing vector for this audience
//   (an attacker iframe-embeds the map on a fake benefits page to harvest
//   address or credential data from confused users).
//
// X-Content-Type-Options: nosniff — prevents browsers from MIME-sniffing
//   script/style responses away from the declared Content-Type.
//
// Referrer-Policy: strict-origin-when-cross-origin — sends the full referrer
//   within pueblofoodmap.com (so server logs retain path context) but only
//   the origin to external sites, reducing leakage of URL parameters.
//
// poweredByHeader: false (below) drops the `X-Powered-By: Next.js` response
// header for the same reason as the headers above — one less signal telling
// an attacker which framework/version this app runs, in case a future
// framework CVE targets Next.js specifically. Issue #164 quick win (S7a).
//
// Strict-Transport-Security is deliberately NOT set here (#593) — the
// pueblofoodmap.com Cloudflare zone already sends its own
// `strict-transport-security: max-age=15552000` (verified 2026-09-24,
// `curl -sI https://pueblofoodmap.com/`). Adding a second, differently-valued
// HSTS header from the app risks two conflicting headers reaching the
// browser rather than one authoritative value; the zone's is edge-level and
// applies before this Worker is even invoked, so it's the right layer to own
// this. If the zone's max-age/includeSubDomains value ever needs to change,
// that's a Cloudflare dashboard edit, not a code change here.
//
// Permissions-Policy (#593): geolocation=(self) backs the existing "find
// food near me" flow (src/components/MapWrapper.tsx's geolocation button);
// camera=(self) is future-proofing for the box-photo upload
// (src/components/BoxCheckinPanel.tsx's PhotoPickerField) — that input is a
// plain `<input type="file" accept="image/*">` with NO `capture` attribute
// (deliberately, so a visitor can pick from their library, not just the
// camera — see that component's own header), so it never actually triggers
// a getUserMedia() camera-permission prompt today, but nothing here should
// block it from working if that ever changes. Everything else this app has
// no use for is denied outright: microphone, payment, usb.
//
// Content-Security-Policy (#593): shipped report-only first, ran clean on
// dev (zero violations across /, venue card, filters, /resources, /suggest
// with Turnstile, /venues, /admin/login), then flipped to enforcing.
// Violations still post to /api/csp-report via report-uri. No nonce: this app's static
// rendering depends on NOT using proxy.ts (Next 16 proxy.ts fails the build
// on this OpenNext/Cloudflare stack — see the "Footgun" note on `/` above),
// and Next's own CSP guide requires proxy-generated nonces to force every
// page into dynamic rendering — incompatible with this app's static +
// dynamicParams=false pages (the 10-day outage footgun this file already
// documents). So this follows Next's documented "Without Nonces" approach
// (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md)
// instead: a static header, `'unsafe-inline'` on script-src/style-src.
// `'unsafe-inline'` on script-src is for Next's own inline RSC-hydration
// payloads (`self.__next_f.push(...)`), not the app's `<script
// type="application/ld+json">` JSON-LD blocks — those aren't parsed as JS
// and aren't governed by script-src at all. style-src needs it for the
// ~40 components using a React `style={{...}}` prop (renders as an inline
// HTML `style=""` attribute, which CSP style-src does govern) plus
// mapbox-gl's own inline-styled DOM nodes.
const CSP = [
  "default-src 'self'",
  // static.cloudflareinsights.com: the Web Analytics beacon, injected at
  // Cloudflare's edge (auto_install, #647) — this app no longer loads it
  // itself (the old app-side loader double-counted page views alongside
  // edge injection; see #592/#615's now-superseded investigation and #647).
  // The CSP still needs to allow it: edge injection rewrites the HTML
  // response, but the browser still executes this app's own CSP header.
  // challenges.cloudflare.com: Turnstile's widget script (6 public forms —
  // SuggestForm, ReportForm, FeedbackForm, AdoptBoxForm, BoxAlertSignupForm,
  // BoxCheckinPanel).
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  // data:/blob: — mapbox-gl draws tiles/sprites through canvas & blob URLs.
  "img-src 'self' data: blob: https://api.mapbox.com https://*.tiles.mapbox.com",
  "font-src 'self'",
  // api.mapbox.com: styles/directions API (MapWrapper.tsx's walking directions).
  // *.tiles.mapbox.com: vector tile fetches. events.mapbox.com: mapbox-gl's
  // own telemetry pings — blocking it doesn't break the map, but it would
  // spam this report with noise otherwise. cloudflareinsights.com: the
  // edge-injected beacon's own reporting endpoint (script host above is
  // static.cloudflareinsights.com — a different subdomain).
  "connect-src 'self' https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com https://cloudflareinsights.com",
  // mapbox-gl runs its tile/data processing in a Web Worker built from a blob: URL.
  "worker-src 'self' blob:",
  "child-src blob:",
  // Turnstile renders its challenge widget in an iframe.
  "frame-src https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Without this, a real violation only ever shows up in that one visitor's
  // own devtools console — Workers Logs never sees it, and "dev ran clean
  // for a while" (the plan for flipping to enforcing) would be unverifiable.
  // `report-uri` (not the newer `report-to`) because it needs no companion
  // `Report-To` header and every browser this CSP already targets supports
  // it — see src/app/api/csp-report/route.ts for the sink.
  "report-uri /api/csp-report",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(self), microphone=(), payment=(), usb=()",
  },
  { key: "Content-Security-Policy", value: CSP },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Dev-only: lets `next dev` accept hot-reload requests from Kyle's Mac's
  // private tailnet address, so a local change can be checked on his iPhone
  // over https (`tailscale serve --bg 3000`) — https is what lets "find food
  // near me" ask for location. Next blocks dev resources from unlisted hosts;
  // this setting does nothing in production builds.
  allowedDevOrigins: ["kyles-macbook-air.tail433d07.ts.net"],
  // Required for next/navigation's forbidden() (used by src/app/admin/page.tsx,
  // #237 checkpoint c) — still an experimental API on this Next version; the
  // flag opts in per next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/authInterrupts.md.
  // Renders src/app/forbidden.tsx and returns a real HTTP 403 instead of a
  // generic error page.
  experimental: {
    authInterrupts: true,
  },
  images: {
    // Cloudflare Workers does not support the Node.js APIs that Next.js image
    // optimization relies on. `unoptimized: true` disables the optimizer so
    // images pass through as-is, which is fine for a map app that serves no
    // dynamic <Image> components today.
    unoptimized: true,
  },
  // NOTE (2026-06-20 hotfix): a next.config redirect for legacy
  // /?venue=<id> → /venue/<id> was REMOVED here. On OpenNext/Cloudflare
  // Workers, a redirect with a `has` query rule on `source: "/"` returned
  // HTTP 500 on EVERY homepage request at runtime — it built clean, so only
  // the live homepage failed (not the build/tests). Legacy ?venue= links
  // still work: the homepage reads the query param client-side and opens that
  // pin. Do NOT re-add a `source: "/"` redirect without verifying the LIVE
  // homepage (a green build is not enough). A proper OpenNext-compatible
  // legacy redirect is a deferred follow-up.
  async headers() {
    return [
      {
        // Apply security headers to all routes.
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // /alerts/confirm and /alerts/stop carry a live subscription token in
        // their `?t=` query string (Blessing Boxes slice 6). The blanket
        // strict-origin-when-cross-origin policy above still sends the full
        // URL — token included — as the Referer header on any outbound link
        // click from these two pages; this later, more specific match
        // overrides it to no-referrer for just these paths (Next.js applies
        // header sets in definition order, last match wins on a key
        // conflict).
        source: "/alerts/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
  // Blessing Boxes slice 1: the one real box (216 W Routt) is being
  // converted from a plain pantry to category='blessing_box' and dropped
  // from published-venues.ts, so /venue/<its-id> would otherwise 404
  // (that page is dynamicParams=false — see its own header on why a
  // redirect inside the page component runs too late to help: the static
  // layer 404s before any page code executes). A PLAIN path redirect (no
  // `has` query-string matcher) — unlike the /?venue=<id> redirect removed
  // 2026-06-20 above, which broke because of a `has` rule on `source: "/"`
  // — is the ordinary, well-supported Next.js/OpenNext case, so this one is
  // safe to add. permanent: true -> 308, matching "its old address must
  // keep working" (a real, indefinite redirect, not a temporary one).
  //
  // Destination updated for the map-first rework (2026-09-18): /box/<id>
  // itself now just client-redirects to /?venue=<id> (BoxRedirectClient.tsx)
  // to keep its own generateMetadata for link previews — pointing THIS
  // redirect straight at /?venue=<id> skips that extra hop for a visitor
  // following the old /venue/<id> link. A plain query string on the
  // DESTINATION is fine here — only a `has` MATCHER on the SOURCE broke on
  // OpenNext/Cloudflare (the 2026-06-20 incident this comment already
  // documents), and this redirect's source is still a plain path.
  async redirects() {
    return [
      {
        source: "/venue/plentiful-blessing-box-216-w-routt-plentiful-1454",
        destination: "/?venue=plentiful-blessing-box-216-w-routt-plentiful-1454",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
