/**
 * Shared site constants.
 *
 * WHY: Single source of truth for the canonical origin and the OG preview
 * asset so metadata, sitemap, robots, and future structured-data files all
 * stay in sync when either value changes.
 */

export const SITE_URL = "https://pueblofoodmap.com";
export const SITE_NAME = "Pueblo Food Map";
export const OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "Pueblo Food Map — find food pantries, gardens, grocery & meal sites in Pueblo County, Colorado",
} as const;
