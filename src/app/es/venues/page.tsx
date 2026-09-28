/**
 * /es/venues — Spanish twin of /venues (#689 PR 2).
 *
 * Thin wrapper: VenuesDirectoryContent is the SAME client component the EN
 * page mounts, already reading useLocale() (#289) — under this tree's
 * locked provider it renders Spanish body copy with no changes needed.
 * groupVenuesByCategory is imported from the EN page rather than
 * re-implemented — it's pure and framework-free (no locale dependency).
 */

import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/site";
import { venues } from "@/data/venues";
import VenuesDirectoryContent from "@/components/VenuesDirectoryContent";
import { groupVenuesByCategory } from "../../(site)/venues/page";

export const metadata: Metadata = buildPageMetadata({
  title: t("meta.venues.title", "es"),
  description: t("meta.venues.description", "es"),
  path: "/es/venues",
  locale: "es",
  mirrored: true,
});

export default function EsVenuesPage() {
  const groups = groupVenuesByCategory(venues);
  return <VenuesDirectoryContent groups={groups} />;
}
