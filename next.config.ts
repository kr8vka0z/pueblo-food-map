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
  images: {
    // Cloudflare Workers does not support the Node.js APIs that Next.js image
    // optimization relies on. `unoptimized: true` disables the optimizer so
    // images pass through as-is, which is fine for a map app that serves no
    // dynamic <Image> components today.
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        // Legacy venue share links used /?venue=<id>; canonical is now /venue/<id>.
        // Done via next.config (routes manifest) NOT proxy/middleware: Next 16 proxy
        // is Node-runtime-only and OpenNext/Cloudflare Workers can't run Node middleware.
        // The `runtime` option throws in proxy files, so Edge is not an escape hatch.
        source: "/",
        has: [{ type: "query", key: "venue", value: "(?<id>.*)" }],
        destination: "/venue/:id",
        permanent: true,
      },
    ];
  },
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
