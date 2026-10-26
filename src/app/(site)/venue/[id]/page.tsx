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
 * The visible body now lives in VenueContent (a client component reading
 * useLocale() — #289) so the on-screen copy is bilingual; this file still
 * reads NO dynamic API — generateStaticParams, dynamicParams, and
 * generateMetadata are untouched by that extraction.
 *
 * params is a Promise in Next.js 16 App Router — must be awaited.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/site";
import {
  getVenueById,
  buildVenueJsonLd,
  buildVenueBreadcrumbJsonLd,
  venuePageMetadataFields,
  serializeJsonLd,
} from "@/lib/venueSchema";
import { nearbyVenues, buildVenueSummaries } from "@/lib/venueSummary";
import { venues } from "@/data/venues";
import VenueContent from "@/components/VenueContent";

export const dynamicParams = false;

export function generateStaticParams() {
  return venues.map((v) => ({ id: v.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const v = getVenueById(id);
  if (!v) return {};
  // WHY name + address (not just category): the prior description was
  // byte-identical for every venue sharing a category — a duplicate-content
  // SEO problem search engines can penalize. Issue #164 quick win (S4).
  // mirrored: true (#689 PR 2) — this route has an /es counterpart, so it
  // now carries hreflang; venuePageMetadataFields is the SAME helper
  // src/app/es/venue/[id]/page.tsx calls, just with locale defaulted to en.
  return buildPageMetadata({ ...venuePageMetadataFields(v), mirrored: true });
}

export default async function VenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const v = getVenueById(id);
  if (!v) notFound();

  return (
    <>
      {/* Venue-specific JSON-LD structured data — English (this EN-tree
          page; /es/venue/[id]'s page.tsx passes locale: "es" — #689
          supersedes #386's old "always English" rule) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildVenueJsonLd(v)) }}
      />
      {/* BreadcrumbList — mirrors VenueContent's visible breadcrumb (SEO/AEO plan Phase 0) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildVenueBreadcrumbJsonLd(v)) }}
      />
      <VenueContent venue={v} nearby={nearbyVenues(v, venues)} summary={buildVenueSummaries(v)} />
    </>
  );
}
