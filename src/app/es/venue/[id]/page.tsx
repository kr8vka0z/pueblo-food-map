/**
 * /es/venue/[id] — Spanish twin of /venue/[id] (#689 PR 2).
 *
 * Statically generated, same as the EN route: generateStaticParams +
 * dynamicParams = false prerender every known venue id at build time
 * (unknown ids 404 into src/app/es/not-found.tsx). Depends on
 * open-next.config.ts's staticAssetsIncrementalCache override — that
 * override is global, not path-scoped, so it already covers this route
 * (see that file's own comment; AGENTS.md "Discoverability / SEO traps").
 *
 * VenueContent is the SAME client component the EN page mounts, already
 * reading useLocale() (#289) — under this tree's locked provider it renders
 * Spanish body copy with no changes needed here. JSON-LD (venue +
 * breadcrumb) is built with locale: "es" so it matches (#689 supersedes
 * #386's "always English" rule).
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
  return buildPageMetadata({
    ...venuePageMetadataFields(v, "es"),
    locale: "es",
    mirrored: true,
  });
}

export default async function EsVenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const v = getVenueById(id);
  if (!v) notFound();

  return (
    <>
      {/* Venue-specific JSON-LD structured data — matches the URL's language (#689) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildVenueJsonLd(v, "es")) }}
      />
      {/* BreadcrumbList — mirrors VenueContent's visible breadcrumb */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildVenueBreadcrumbJsonLd(v, "es")),
        }}
      />
      <VenueContent venue={v} />
    </>
  );
}
