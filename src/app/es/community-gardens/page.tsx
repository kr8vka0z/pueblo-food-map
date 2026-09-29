/**
 * /es/community-gardens — community gardens and edible landscapes (SEO/AEO plan Phase 3, #709).
 *
 * Thin wrapper: the body is CommunityGardensHub (src/components/HubPages.tsx), a server
 * component the /es page mounts with a fixed locale, so the route stays
 * statically prerendered — no cookies()/headers() read, no client JS added.
 * `mirrored: true` on BOTH trees or the hreflang pair doesn't emit.
 */

import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/site";
import { venues } from "@/data/venues";
import { CommunityGardensHub } from "@/components/HubPages";

export const metadata: Metadata = buildPageMetadata({
  title: t("meta.gardens.title", "es"),
  description: t("meta.gardens.description", "es"),
  path: "/es/community-gardens",
  locale: "es",
  mirrored: true,
});

export default function EsCommunityGardensPage() {
  return <CommunityGardensHub locale="es" venues={venues} />;
}
