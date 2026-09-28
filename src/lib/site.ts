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

import type { Metadata, Viewport } from "next";

export const SITE_URL = "https://pueblofoodmap.com";
export const SITE_NAME = "Pueblo Food Map";
export const OG_IMAGE = {
  url: `${SITE_URL}/og-image.png`,
  width: 1200,
  height: 630,
  type: "image/png",
  alt: "Pueblo Food Map — find food pantries, gardens, grocery & meal sites in Pueblo County, Colorado",
} as const;

export const ROOT_DESCRIPTION =
  "A community-built map of food resources in Pueblo County, Colorado — community gardens, edible landscapes, food pantries, and grocery stores — with walking and bus directions via Pueblo Transit.";

/**
 * The root layout's metadata object (src/app/(site)/layout.tsx), also
 * reused verbatim (title overridden) by app/global-not-found.tsx (#689 PR
 * 1). global-not-found.tsx bypasses the (site) layout entirely — Next
 * doesn't merge parent metadata into it the way it does for an in-tree
 * page — so without this shared constant its OG/twitter tags would
 * silently regress to nothing instead of inheriting the brand defaults a
 * visitor sees on every other page.
 */
export const ROOT_METADATA: Metadata = {
  // WHY: metadataBase is required so relative paths resolve to absolute URLs
  // for crawlers and social platforms. OG_IMAGE.url is now absolute, but
  // metadataBase is still needed for any other relative path Next.js resolves.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Pueblo Food Map — Food Resources in Pueblo County, CO",
    // Template lets child pages set short titles; root appends the brand name.
    template: "%s · Pueblo Food Map",
  },
  description: ROOT_DESCRIPTION,
  // WHY: No canonical set here. A root-level canonical propagates to every
  // child route via Next.js metadata inheritance, causing /suggest, /feedback,
  // and /privacy to all report "/" as their canonical — a de-indexing risk.
  // Each page that needs a canonical sets its own (see per-page metadata).
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "Pueblo Food Map — Food Resources in Pueblo County, CO",
    description: ROOT_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
    alternateLocale: ["es_US"],
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pueblo Food Map — Food Resources in Pueblo County, CO",
    description: ROOT_DESCRIPTION,
    images: [{ url: OG_IMAGE.url, alt: OG_IMAGE.alt }],
  },
};

/**
 * The root layout's viewport export, reused by app/global-not-found.tsx for
 * the same reason as ROOT_METADATA above — it has no parent layout to
 * inherit viewportFit/themeColor from.
 */
export const ROOT_VIEWPORT: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FBFAF6",
};

/**
 * Compose a client-side <title> matching the format layout.tsx's
 * `title.template` ("%s · Pueblo Food Map") produces server-side.
 *
 * WHY it exists: useDocumentTitle (src/lib/useDocumentTitle.ts) patches
 * <title> for the Spanish locale, which Next.js Metadata can't reach (the
 * locale is a client cookie/toggle, not a route — #589). Most localized
 * pages' SSR title is `${shortTitle} · Pueblo Food Map` via that template;
 * this keeps the client-side ES title in the same shape rather than each
 * "Content" component re-typing the separator. Keep in sync with
 * layout.tsx's `title.template` if that literal ever changes.
 */
export function pageDocumentTitle(shortTitle: string): string {
  return `${shortTitle} · ${SITE_NAME}`;
}

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
