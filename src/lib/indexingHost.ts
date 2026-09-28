/**
 * Keep every host except the canonical one out of search indexes.
 *
 * WHY: the same Worker code answers on pueblofoodmap.com, on
 * dev.pueblofoodmap.com (staging, with unpublished data), and on the
 * *.workers.dev URLs. All of them served `Allow: /` with no noindex
 * (SEO/AEO plan, docs/seo-aeo-plan.md §1 finding 6), so a crawler could index
 * staging's drafts or a workers.dev duplicate of every page.
 *
 * WHY a response header and NOT a robots.txt `Disallow: /` on those hosts: a
 * disallowed URL is never fetched, so a crawler that already indexed it never
 * sees the noindex and keeps it. The header lets it re-crawl and drop them.
 *
 * WHY hostname rather than isProductionWorker(): the production Worker also
 * answers on pueblo-food-map.kyle-boyd.workers.dev, which must be noindexed
 * too. Only the canonical hostname is indexable.
 *
 * Called from custom-worker.ts (which vitest can't import), so the rule lives
 * here where it's tested.
 */

import { SITE_URL } from "./site";

export const CANONICAL_HOSTNAME = new URL(SITE_URL).hostname;

export const NOINDEX_HEADER_VALUE = "noindex, nofollow";

export function isIndexableHostname(hostname: string): boolean {
  return hostname.toLowerCase() === CANONICAL_HOSTNAME;
}

/**
 * Returns the response unchanged on the canonical host; everywhere else, a
 * copy carrying `X-Robots-Tag: noindex, nofollow`. The copy is needed because
 * a Response from fetch() can have immutable headers.
 */
export function applyHostIndexingPolicy<R extends Response>(response: R, hostname: string): R {
  if (isIndexableHostname(hostname)) return response;
  const tagged = new Response(response.body, response);
  tagged.headers.set("X-Robots-Tag", NOINDEX_HEADER_VALUE);
  // Generic so custom-worker.ts gets back the same Response type it passed in
  // (the Workers runtime type, not lib.dom's; see that file's header). Both
  // are the same runtime object.
  return tagged as unknown as R;
}
