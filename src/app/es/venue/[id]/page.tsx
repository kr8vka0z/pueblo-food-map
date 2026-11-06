/**
 * /es/venue/[id] — Spanish twin of /venue/[id] (#689 PR 2).
 *
 * Same pairing as the EN route: generateStaticParams + dynamicParams = false
 * (rendered on first request under vinext, not at build time). An
 * unknown id 404s at Next's ROUTING level, before this page's own
 * `if (!v) notFound()` below ever runs (Next treats a dynamicParams=false
 * id outside generateStaticParams as "no route matched", not as an
 * in-tree notFound() call) — it falls through to app/global-not-found.tsx
 * (English), same as any other unmatched /es/* URL; see es/layout.tsx's
 * own comment for why that tradeoff is accepted. scripts/check-pages-serve.sh
 * checks this route too (AGENTS.md "Discoverability / SEO traps").
 *
 * The metadata and body come from src/lib/venuePageData.tsx, shared with
 * the EN page: VenueContent is the SAME client component, already reading
 * useLocale() (#289) — under this tree's locked provider it renders Spanish
 * body copy. JSON-LD (venue + breadcrumb) is built with locale: "es" so it
 * matches (#689 supersedes #386's "always English" rule).
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
  return venuePageMetadata((await params).id, "es");
}

export default async function EsVenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const v = getVenueById(id);
  if (!v) notFound();
  return <VenuePageBody venue={v} locale="es" />;
}
