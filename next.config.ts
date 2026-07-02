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
// Full CSP is deferred — see issue #160 item 1.5 comment.

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
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
    ];
  },
};

export default nextConfig;
