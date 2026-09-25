/**
 * Web app manifest (#130) — served at /manifest.webmanifest and linked from
 * every page by Next's metadata file convention. Lets a phone "install" the
 * map to its home screen; public/sw.js provides the offline half.
 *
 * WHY English-only name/description: locale is client state (LocaleContext),
 * not a URL segment, so there is one manifest for everyone and start_url "/"
 * opens in whatever language the visitor last picked.
 *
 * Colours are the bone-50 literal layout.tsx's viewport.themeColor already
 * uses (a manifest can't read CSS custom properties either); manifest.test.ts
 * keeps the two equal. Icons are generated PNGs (public/icons/) of the OG
 * image's pin mark — the favicon is 32px pixel art that won't scale to 512.
 *
 * No CSP change needed: manifest-src falls back to default-src 'self'.
 */
import type { MetadataRoute } from "next";

const BONE_50 = "#FBFAF6";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Pueblo Food Map",
    short_name: "Food Map",
    description:
      "Free and low-cost food near you in Pueblo County, CO — pantries, gardens, grocery stores, and meal sites.",
    lang: "en",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: BONE_50,
    theme_color: BONE_50,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
