/**
 * /events/share — the public "Share an event" page (#883): a form whose
 * event card fills in as the visitor types, sent for admin review (nothing
 * reaches the map until an admin publishes it). Indexable and mirrored at
 * /es/events/share. Static Server Component; the body is
 * ShareEventPageContent.
 */

import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/site";
import ShareEventPageContent from "@/components/ShareEventPageContent";

export const metadata: Metadata = buildPageMetadata({
  title: t("meta.shareEvent.title", "en"),
  description: t("meta.shareEvent.description", "en"),
  path: "/events/share",
  mirrored: true,
});

export default function ShareEventPage() {
  return <ShareEventPageContent />;
}
