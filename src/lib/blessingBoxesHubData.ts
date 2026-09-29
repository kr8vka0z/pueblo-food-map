/**
 * blessingBoxesHubData.ts — the one D1 read behind /blessing-boxes and /es/blessing-boxes (#709 PR B).
 *
 * WHY React cache(): generateMetadata and the page component both need the
 * list (metadata for noindex-on-failure, the page for the body). cache()
 * dedupes them to ONE D1 query per request; it is per-request memoization,
 * not a cross-request cache, so admin edits still show on the next view.
 *
 * WHY `degraded` instead of throwing/empty: a D1 failure must never look like
 * "0 boxes" — the page shows an honest message and goes noindex, so a crawler
 * never indexes an empty list. Same best-effort posture as /box/[id].
 *
 * ponytail: 2 D1 reads per page view (~30 box rows, then their check-ins for
 * status; loadLiveBoxesForHub skips the photo/adopter/needs reads), no page
 * caching (OpenNext's staticAssetsIncrementalCache can't revalidate).
 * Ceiling: traffic. Upgrade path: an edge-cached read like src/lib/edgeCache.ts
 * does for the public API route.
 */

import { cache } from "react";
import type { Metadata } from "next";
import { t, type Locale } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/site";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { loadLiveBoxesForHub, type PublicBlessingBox } from "@/lib/blessingBoxes";
import { logBlessingBoxesReadFailure } from "@/lib/logger";

export interface BoxesHubData {
  boxes: PublicBlessingBox[];
  degraded: boolean;
}

/**
 * Metadata for either tree. `mirrored: true` on BOTH or the hreflang pair
 * doesn't emit. A degraded read adds noindex,follow so a crawler that hits
 * the failure page never indexes an empty list (it can still follow the map link).
 */
export async function boxesHubMetadata(locale: Locale): Promise<Metadata> {
  const { degraded } = await loadBoxesHubData();
  return {
    ...buildPageMetadata({
      title: t("meta.boxes.title", locale),
      description: t("meta.boxes.description", locale),
      path: locale === "es" ? "/es/blessing-boxes" : "/blessing-boxes",
      ...(locale === "es" ? { locale: "es" as const } : {}),
      mirrored: true,
    }),
    ...(degraded ? { robots: { index: false, follow: true } } : {}),
  };
}

export const loadBoxesHubData =cache(async (): Promise<BoxesHubData> => {
  try {
    const { env } = getCloudflareContext();
    return { boxes: await loadLiveBoxesForHub(env.ADMIN_DB), degraded: false };
  } catch (err) {
    logBlessingBoxesReadFailure(err instanceof Error ? err.message : "unknown error");
    return { boxes: [], degraded: true };
  }
});
