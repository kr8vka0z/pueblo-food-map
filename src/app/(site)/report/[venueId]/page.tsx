/**
 * /report/[venueId] — venue issue report page.
 *
 * Server component: looks up the venue by ID from the static venue list,
 * then renders ReportPageContent — a client component that reads the
 * visitor's locale via useLocale() (#289) and renders the ReportForm with
 * venue context pre-filled. generateStaticParams + dynamicParams = false are
 * unchanged by this extraction: no cookies()/dynamic API is introduced, so
 * this route stays fully static (ARCHITECTURE.md "i18n model",
 * #287).
 *
 * If venueId doesn't match any venue, renders a graceful not-found message
 * rather than erroring out.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { venues } from "@/data/venues";
import { t } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/site";
import ReportPageContent from "@/components/ReportPageContent";

interface Props {
  params: Promise<{ venueId: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return venues.map((v) => ({ venueId: v.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { venueId } = await params;
  const venue = venues.find((v) => v.id === venueId);
  if (!venue) return { title: t("report.title", "en") };
  // buildPageMetadata, not a bare title (#894): without it the layout's
  // homepage canonical and og:url made a shared report link preview as "/".
  return buildPageMetadata({
    title: `${t("report.title", "en")} — ${venue.name}`,
    description: t("report.subtitle", "en"),
    path: `/report/${venue.id}`,
  });
}

export default async function ReportPage({ params }: Props) {
  const { venueId } = await params;

  const venue = venues.find((v) => v.id === venueId);
  if (!venue) {
    notFound();
  }

  return <ReportPageContent venue={venue} />;
}
