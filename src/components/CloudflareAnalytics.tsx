"use client";

/**
 * CloudflareAnalytics — loads the Cloudflare Web Analytics beacon (#592).
 *
 * WHY a hand-rolled beacon instead of the CF dashboard's `auto_install`:
 * `auto_install: true` is already set for pueblofoodmap.com's Web Analytics
 * site, but auto-injection rewrites HTML as it passes through Cloudflare's
 * edge — it never reaches responses this OpenNext Worker serves directly
 * (confirmed 2026-09-23: no beacon in the live HTML). Injecting it ourselves
 * is the only path that actually ships on this stack.
 *
 * WHY gated by `location.hostname`, not `NEXT_PUBLIC_*`/`SITE_URL`: this is
 * a per-request, client-side decision — dev.pueblofoodmap.com, the direct
 * `*.workers.dev` URL, a PR's CF preview, and every local/test run all serve
 * the exact same build. A build-time env var can't tell those apart; only
 * the browser's own `location.hostname` at load time can. `isProductionHostname`
 * is an exact match (never `.endsWith`) so a hostname that merely contains
 * the production domain can't smuggle itself onto the allowlist.
 *
 * WHY `strategy="lazyOnload"` (next/script), no `defer` prop: the audience
 * is low-end phones on slow connections — lazyOnload defers the beacon
 * fetch to browser idle time, after everything the visitor actually came
 * for has loaded. See node_modules/next/dist/docs/01-app/03-api-reference/
 * 02-components/script.md ("lazyOnload" section). No `defer` attribute:
 * lazyOnload scripts are inserted into the DOM programmatically (not
 * present in the parsed HTML), and per the HTML spec `defer` only affects
 * scripts the parser encounters directly — it's a no-op on a
 * dynamically-inserted one, so adding it here would just be dead weight.
 *
 * WHY a client component rendering null until an effect confirms the
 * hostname, rather than deciding at render time: `layout.tsx` (its mount
 * point) is a Server Component and has no access to `window.location`.
 * Rendering nothing on both the server pass and the client's first pass,
 * then deciding in `useEffect`, avoids a hydration mismatch — the same
 * effect-gated pattern this repo already needs anywhere a browser-only
 * value drives what's rendered (see src/lib/useMediaQuery.ts).
 *
 * WHY the setTimeout(…, 0) around the initial setEnabled: calling setState
 * synchronously in the effect body trips react-hooks/set-state-in-effect
 * (cascading render) — same workaround useMediaQuery.ts already uses for
 * the identical "sync one browser-only value into state on mount" shape.
 */

import { useEffect, useState } from "react";
import Script from "next/script";

// Public by design — a Cloudflare Web Analytics site token identifies which
// dashboard the beacon reports to, not a secret credential (same class of
// value as the Mapbox `pk.*` public token; see AGENTS.md "Mapbox Token
// Management" for how this repo distinguishes public vs. secret tokens).
const BEACON_TOKEN = "fc93862d1dc14974aee3dddf357e2884";

const PRODUCTION_HOSTNAMES = new Set(["pueblofoodmap.com", "www.pueblofoodmap.com"]);

export function isProductionHostname(hostname: string): boolean {
  return PRODUCTION_HOSTNAMES.has(hostname);
}

export default function CloudflareAnalytics() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const syncId = setTimeout(() => setEnabled(isProductionHostname(window.location.hostname)), 0);
    return () => clearTimeout(syncId);
  }, []);

  if (!enabled) return null;

  return (
    <Script
      src="https://static.cloudflareinsights.com/beacon.min.js"
      strategy="lazyOnload"
      data-cf-beacon={JSON.stringify({ token: BEACON_TOKEN })}
    />
  );
}
