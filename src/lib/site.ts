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
import { t, type Locale } from "@/lib/i18n";

export const SITE_URL = "https://pueblofoodmap.com";
export const SITE_NAME = "Pueblo Food Map";
// Public contact address (forwards to the site owner; no personal name on the site).
// Shown on /about and in the Organization JSON-LD.
export const SITE_CONTACT_EMAIL = "hello@pueblofoodmap.com";
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
 * src/app/es/layout.tsx's metadata export — the ES tree's own root layout
 * (#689 PR 2, design decision 2: a second root layout is the only way to
 * get `<html lang="es">` into the server HTML on this Next version). Same
 * shape as ROOT_METADATA, Spanish content and es_US OG locale. Every /es
 * page sets its own metadata via buildPageMetadata anyway, so this mostly
 * matters as the title.template default — same reason ROOT_METADATA's
 * title/description duplicate the homepage's own.
 */
export const ES_ROOT_METADATA: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: t("meta.home.title", "es"),
    template: "%s · Pueblo Food Map",
  },
  description: t("meta.home.description", "es"),
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: t("meta.home.title", "es"),
    description: t("meta.home.description", "es"),
    url: `${SITE_URL}/es`,
    locale: "es_US",
    alternateLocale: ["en_US"],
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: t("meta.home.title", "es"),
    description: t("meta.home.description", "es"),
    images: [{ url: OG_IMAGE.url, alt: OG_IMAGE.alt }],
  },
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

const OG_LOCALE: Record<Locale, string> = { en: "en_US", es: "es_US" };

/**
 * Given a page's OWN path (as it exists in its own tree — `/about` for the
 * EN tree, `/es/about` for the ES tree), return the counterpart path in the
 * other tree. Slugs are identical under /es (#689 decision 1: English
 * slugs), so this is a plain prefix add/strip, not a translation table.
 */
function counterpartPath(path: string, locale: Locale): { en: string; es: string } {
  if (locale === "es") {
    const en = path === "/es" ? "" : path.replace(/^\/es/, "");
    return { en, es: path };
  }
  const es = path === "/" ? "/es" : `/es${path}`;
  return { en: path, es };
}

/**
 * Build complete per-page metadata for a static content page.
 *
 * WHY: Next.js shallow-merges metadata — a child `openGraph`/`twitter` object
 * REPLACES the parent's entirely (it does not deep-merge; see Next docs
 * "Merging"). A subpage that set only {title,url} would drop the inherited OG
 * image. This returns the FULL openGraph/twitter (brand image included) with
 * per-page title/url + a self-canonical, so subpage previews keep the image.
 *
 * `locale`/`mirrored` (#689 PR 2) default to "en"/false, so every pre-existing
 * call site is byte-identical: no `alternates.languages`, `openGraph.locale`
 * stays "en_US". A page opts into hreflang by passing `mirrored: true` (its
 * EN counterpart) or `locale: "es", mirrored: true` (its /es wrapper) — the
 * counterpart URL is derived from `path`, never hand-typed, so the pair can't
 * drift. Non-mirrored pages (`/suggest`, `/privacy`, etc.) get no hreflang at
 * all, per #689's scope table.
 */
export function buildPageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  locale?: Locale;
  mirrored?: boolean;
  /**
   * The share-preview image, absolute URL. Defaults to the brand image; an
   * event page passes its flyer so a shared link previews the flyer (#762).
   */
  image?: { url: string; width: number; height: number; alt: string };
}): Metadata {
  const locale = opts.locale ?? "en";
  const image = opts.image ?? OG_IMAGE;
  const mirrored = opts.mirrored ?? false;
  const url = `${SITE_URL}${opts.path}`;
  const ogLocale = OG_LOCALE[locale];
  const ogAlternateLocale = locale === "es" ? OG_LOCALE.en : OG_LOCALE.es;

  const alternates: Metadata["alternates"] = { canonical: url };
  if (mirrored) {
    const { en, es } = counterpartPath(opts.path, locale);
    // x-default → EN (#689 design decision 5): EN is the fallback for
    // locales/crawlers that don't match either explicit alternate.
    alternates.languages = {
      en: `${SITE_URL}${en}`,
      es: `${SITE_URL}${es}`,
      "x-default": `${SITE_URL}${en}`,
    };
  }

  return {
    title: opts.title,
    description: opts.description,
    alternates,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: opts.title,
      description: opts.description,
      url,
      locale: ogLocale,
      alternateLocale: [ogAlternateLocale],
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: [{ url: image.url, alt: image.alt }],
    },
  };
}
