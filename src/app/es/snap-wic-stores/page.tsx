/**
 * /es/snap-wic-stores — places confirmed to accept SNAP/EBT and/or WIC (SEO/AEO plan Phase 3, #709).
 *
 * Thin wrapper: the body is SnapWicHub (src/components/HubPages.tsx), a server
 * component the /es page mounts with a fixed locale, so the route stays
 * statically prerendered — no cookies()/headers() read, no client JS added.
 * `mirrored: true` on BOTH trees or the hreflang pair doesn't emit.
 */

import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/site";
import { venues } from "@/data/venues";
import { SnapWicHub } from "@/components/HubPages";

export const metadata: Metadata = buildPageMetadata({
  title: t("meta.snapWic.title", "es"),
  description: t("meta.snapWic.description", "es"),
  path: "/es/snap-wic-stores",
  locale: "es",
  mirrored: true,
});

export default function EsSnapWicStoresPage() {
  return <SnapWicHub locale="es" venues={venues} />;
}
