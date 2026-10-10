/**
 * eventPageData.ts — the server-side read and the generateMetadata body for
 * /event/[id] and /es/event/[id] (#762, umbrella #156). Both route files are
 * thin wrappers over this and src/components/EventPage.tsx, so the two
 * languages cannot drift (same split as blessingBoxesHubData.ts).
 *
 * FAIL SOFT: every failure (draft, archived, unknown id, a D1 error, or the
 * `events` table / flyer columns missing because production got this code
 * before its migrations) resolves to `null`, which the page turns into the
 * site's real 404. That one answer for all of them is what keeps a draft
 * indistinguishable from an id that never existed. A D1 error is logged, never
 * thrown: a 500 here would also be cacheable by a CDN for longer than a 404.
 */

import { cache } from "react";
import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { loadPublicEventById, type PublicEventDetail } from "@/lib/events";
import { logEventsReadFailure } from "@/lib/logger";
import { buildPageMetadata } from "@/lib/site";
import type { Locale } from "@/lib/i18n";
import { eventIndexable, eventPageMetadataFields } from "@/lib/eventSeo";

/** One read per request: generateMetadata and the page both call this (React cache dedupes within a render). */
export const loadEventForPage = cache(async (id: string): Promise<PublicEventDetail | null> => {
  try {
    const { env } = getCloudflareContext();
    return await loadPublicEventById(env.ADMIN_DB, id);
  } catch (err) {
    logEventsReadFailure(err instanceof Error ? err.message : "unknown error");
    return null;
  }
});

/**
 * The request time the page judges "coming up / live / ended" by. A named
 * function because the page file is a per-request server component, where
 * reading the clock is correct, but lint's render-purity rule cannot tell it
 * from a client component and rejects an inline `Date.now()`.
 */
export const requestTimeMs = (): number => Date.now();

/** generateMetadata for either language tree. An event that cannot be shown gets none (its 404 page brings its own). */
export async function eventPageMetadata(id: string, locale: Locale, nowMs: number = Date.now()): Promise<Metadata> {
  const event = await loadEventForPage(id);
  if (!event) return {};
  const metadata = buildPageMetadata({ ...eventPageMetadataFields(event, locale), locale, mirrored: true });
  // An event that ended long ago has nothing left to find in search; "follow"
  // keeps its link to the map crawlable. Non-production hosts are noindexed
  // separately by custom-worker.ts and are unaffected by this.
  return eventIndexable(event, nowMs) ? metadata : { ...metadata, robots: { index: false, follow: true } };
}
