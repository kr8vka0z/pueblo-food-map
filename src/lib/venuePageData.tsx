/**
 * venuePageData.tsx — the generateMetadata body and the server-rendered page
 * body for /venue/[id] and /es/venue/[id]. Both route files are thin wrappers
 * over this (same split as eventPageData.ts + EventPage.tsx), so the two
 * languages cannot drift. generateStaticParams and dynamicParams stay in each
 * page file: Next reads them off the page module.
 */

import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
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
import type { Venue } from "@/types/venue";
import VenueContent from "@/components/VenueContent";

/** generateMetadata for either language tree. An unknown id gets none (its 404 page brings its own). */
export function venuePageMetadata(id: string, locale: Locale): Metadata {
  const v = getVenueById(id);
  if (!v) return {};
  // WHY name + address (not just category): the prior description was
  // byte-identical for every venue sharing a category — a duplicate-content
  // SEO problem search engines can penalize. Issue #164 quick win (S4).
  // mirrored: true (#689 PR 2) — both routes have a counterpart, so both
  // carry hreflang.
  return buildPageMetadata({ ...venuePageMetadataFields(v, locale), locale, mirrored: true });
}

export function VenuePageBody({ venue, locale }: { venue: Venue; locale: Locale }) {
  return (
    <>
      {/* Venue-specific JSON-LD structured data — matches the URL's language
          (#689 supersedes #386's old "always English" rule) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildVenueJsonLd(venue, locale)) }}
      />
      {/* BreadcrumbList — mirrors VenueContent's visible breadcrumb (SEO/AEO plan Phase 0) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildVenueBreadcrumbJsonLd(venue, locale)),
        }}
      />
      <VenueContent venue={venue} nearby={nearbyVenues(venue, venues)} summary={buildVenueSummaries(venue)} />
    </>
  );
}
