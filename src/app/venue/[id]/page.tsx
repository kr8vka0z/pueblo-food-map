/**
 * /venue/[id] — per-venue dynamically rendered page with structured data.
 *
 * WHY: Gives each venue its own crawlable URL with a venue-specific title,
 * meta description, Open Graph tags, and LocalBusiness/FoodEstablishment
 * JSON-LD — enabling rich search results and accurate link previews for
 * shared venue links. Issue #164 item 6.4.
 *
 * This route is statically generated: generateStaticParams + dynamicParams
 * = false prerender every known venue id at build time (unknown ids 404).
 * The prior `cookies()`-based locale read that forced dynamic rendering was
 * removed in PR #351 (2026-08-24) — this comment previously described that
 * removed behavior, which is what let this route regress: on Cloudflare via
 * OpenNext, a static + dynamicParams=false route depends on the configured
 * incremental cache actually serving the prerendered HTML (open-next.config.ts).
 * With the default "dummy" cache, every request 404s (NoFallbackError on a
 * cache miss) — the 2026-08-24 to 2026-09-02 production outage. Do not
 * reintroduce cookies()/dynamic APIs here without re-checking that pairing.
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
  venuePath,
  buildVenueJsonLd,
  serializeJsonLd,
} from "@/lib/venueSchema";
import { venues, categoryLabels } from "@/data/venues";
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
    title: v.name,
    // WHY name + address (not just category): the prior description was
    // byte-identical for every venue sharing a category — a duplicate-content
    // SEO problem search engines can penalize. Issue #164 quick win (S4).
    // Metadata stays English always (#287) — categoryLabels, not t(), is
    // deliberate here even though the visible page (VenueContent) now shows
    // this same category in the visitor's locale.
    description: `${v.name} — ${categoryLabels[v.category]} in Pueblo, CO. ${v.address}.`,
    path: venuePath(v.id),
  });
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
      {/* Venue-specific JSON-LD structured data — English always (#386) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildVenueJsonLd(v)) }}
      />
      <VenueContent venue={v} />
    </>
  );
}
