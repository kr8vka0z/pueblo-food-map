/**
 * /es/events/share — Spanish twin of /events/share (#883). Thin wrapper:
 * ShareEventPageContent reads useLocale(), which this tree locks to Spanish.
 */

import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/site";
import ShareEventPageContent from "@/components/ShareEventPageContent";

export const metadata: Metadata = buildPageMetadata({
  title: t("meta.shareEvent.title", "es"),
  description: t("meta.shareEvent.description", "es"),
  path: "/es/events/share",
  locale: "es",
  mirrored: true,
});

export default function EsShareEventPage() {
  return <ShareEventPageContent />;
}
