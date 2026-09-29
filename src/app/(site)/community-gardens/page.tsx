/**
 * /community-gardens — community gardens and edible landscapes (SEO/AEO plan Phase 3, #709).
 *
 * Thin wrapper: the body is CommunityGardensHub (src/components/HubPages.tsx), a server
 * component the EN page mounts with a fixed locale, so the route stays
 * statically prerendered — no cookies()/headers() read, no client JS added.
 * `mirrored: true` on BOTH trees or the hreflang pair doesn't emit.
 */

import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/site";
import { venues } from "@/data/venues";
import { CommunityGardensHub } from "@/components/HubPages";

export const metadata: Metadata = buildPageMetadata({
  title: t("meta.gardens.title", "en"),
  description: t("meta.gardens.description", "en"),
  path: "/community-gardens",
  mirrored: true,
});

export default function CommunityGardensPage() {
  return <CommunityGardensHub locale="en" venues={venues} />;
}
