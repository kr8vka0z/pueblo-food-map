// vite.config.ts — vinext (Next.js API on Vite) plus the Cloudflare plugin, which runs the RSC/SSR build in workerd.
import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  // WHY: the local preview (`npm run preview`) refuses unknown Host headers by default (localhost and IPs always
  // pass). The real hosts let a local run be asked as them, so the noindex rule in custom-worker.ts can be checked;
  // ".trycloudflare.com" (leading dot = any subdomain, Vite's only wildcard form) lets a quick Cloudflare tunnel put
  // the preview on a phone.
  preview: {
    allowedHosts: ["pueblofoodmap.com", "dev.pueblofoodmap.com", ".trycloudflare.com"],
  },
  plugins: [
    vinext(),
    cloudflare({
      // WHY: the Workers AI binding (`ai` in wrangler.jsonc) has no local emulation, so by default `vite dev` /
      // `vite preview` open a remote proxy session to the Cloudflare account (and fail without an API token). Local
      // runs must never reach real Cloudflare resources; with this off, "Suggest Spanish" is unavailable locally.
      // Affects dev/preview only, not the deployed Worker.
      remoteBindings: false,
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
