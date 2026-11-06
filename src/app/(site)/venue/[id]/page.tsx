/**
 * /venue/[id] — per-venue statically generated page with structured data.
 *
 * WHY: Gives each venue its own crawlable URL with a venue-specific title,
 * meta description, Open Graph tags, and LocalBusiness/FoodEstablishment
 * JSON-LD — enabling rich search results and accurate link previews for
 * shared venue links. Issue #164 item 6.4.
 *
 * generateStaticParams + dynamicParams = false: only known venue ids exist
 * (unknown ids 404). Under vinext the page renders in the Worker on its first
 * request and is then served from the in-memory cache; nothing is
 * prerendered at build time. On OpenNext (before vinext) this pairing
 * depended on the incremental cache serving prerendered HTML, and its
 * default "dummy" cache 404'd every venue — the 2026-08-24 to 2026-09-02
 * production outage. scripts/check-pages-serve.sh (ci.yml) requests real and
 * unknown ids from the built Worker so a regression goes red on the PR.
 *
 * The metadata and the body (two JSON-LD scripts + VenueContent, a client
 * component reading useLocale() — #289) live in src/lib/venuePageData.tsx,
 * shared with src/app/es/venue/[id]/page.tsx. This file still reads NO
 * dynamic API.
 *
 * params is a Promise in Next.js 16 App Router — must be awaited.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVenueById } from "@/lib/venueSchema";
import { venuePageMetadata, VenuePageBody } from "@/lib/venuePageData";
import { venues } from "@/data/venues";

export const dynamicParams = false;

export function generateStaticParams() {
  return venues.map((v) => ({ id: v.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  return venuePageMetadata((await params).id, "en");
}

export default async function VenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const v = getVenueById(id);
  if (!v) notFound();
  return <VenuePageBody venue={v} locale="en" />;
}
