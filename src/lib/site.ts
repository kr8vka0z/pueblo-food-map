/**
 * Shared site constants and metadata helpers.
 *
 * WHY: Single source of truth for the canonical origin and the OG preview
 * asset so metadata, sitemap, robots, and future structured-data files all
 * stay in sync when either value changes.
 *
 * buildPageMetadata is co-located here because it directly depends on these
 * constants — keeping them together avoids circular imports.
 */

import type { Metadata } from "next";

export const SITE_URL = "https://pueblofoodmap.com";
export const SITE_NAME = "Pueblo Food Map";
export const OG_IMAGE = {
  url: `${SITE_URL}/og-image.png`,
  width: 1200,
  height: 630,
  type: "image/png",
  alt: "Pueblo Food Map — find food pantries, gardens, grocery & meal sites in Pueblo County, Colorado",
} as const;

/**
 * Build complete per-page metadata for a static content page.
 *
 * WHY: Next.js shallow-merges metadata — a child `openGraph`/`twitter` object
 * REPLACES the parent's entirely (it does not deep-merge; see Next docs
 * "Merging"). A subpage that set only {title,url} would drop the inherited OG
 * image. This returns the FULL openGraph/twitter (brand image included) with
 * per-page title/url + a self-canonical, so subpage previews keep the image.
 */
export function buildPageMetadata(opts: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const url = `${SITE_URL}${opts.path}`;
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: opts.title,
      description: opts.description,
      url,
      locale: "en_US",
      alternateLocale: ["es_US"],
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: [{ url: OG_IMAGE.url, alt: OG_IMAGE.alt }],
    },
  };
}
