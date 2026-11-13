// vite.config.ts — vinext (Next.js API on Vite) plus the Cloudflare plugin, which runs the RSC/SSR build in workerd.
import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  // The build's short commit, sent with every PostHog event as `site_version` (src/lib/analytics.ts, #919) so a
  // change in behaviour can be pinned to a release. ponytail: deploys only build in Actions, so GITHUB_SHA is
  // always set there; local builds say "dev".
  define: { __SITE_VERSION__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? "dev") },
  // WHY: the local preview (`npm run preview`) refuses unknown Host headers by default (localhost and IPs always
  // pass). The real hosts let a local run be asked as them, so the noindex rule in custom-worker.ts can be checked;
  // ".trycloudflare.com" (leading dot = any subdomain, Vite's only wildcard form) lets a quick Cloudflare tunnel put
  // the preview on a phone.
  // WHY 3000: localhost:3000 is the only local origin on the Mapbox token's URL allowlist, so on any other port the
  // map renders blank. strictPort fails loudly instead of drifting to the next free port.
  server: { port: 3000, strictPort: true },
  preview: {
    allowedHosts: ["pueblofoodmap.com", "dev.pueblofoodmap.com", ".trycloudflare.com"],
  },
  plugins: [
    vinext(),
    cloudflare({
      // WHY: the Workers AI binding (`ai` in wrangler.jsonc) has no local emulation, so by default `vite dev` /
      // `vite preview` open a remote proxy session to the Cloudflare account (and fail without an API token). Local
      // runs must never reach real Cloudflare resources. Affects dev/preview only, not the deployed Worker.
      remoteBindings: false,
      // WHY: scripts/admin-preview/start.sh serves a signed-in preview over a public link, so its local D1/R2
      // must be a store of its own, emptied every start, never the ordinary `.wrangler/state`. The plugin takes
      // its storage folder only from this option (no flag or env var), so the tool sets this one variable;
      // unset (every other run), the plugin's default `.wrangler/state` applies unchanged.
      persistState: process.env.PFM_ADMIN_PREVIEW_PERSIST ? { path: process.env.PFM_ADMIN_PREVIEW_PERSIST } : true,
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
