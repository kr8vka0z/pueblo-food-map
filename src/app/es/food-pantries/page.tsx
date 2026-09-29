/**
 * /es/food-pantries — every pantry with its address and hours, plus a short FAQ (SEO/AEO plan Phase 3, #709).
 *
 * Thin wrapper: the body is FoodPantriesHub (src/components/HubPages.tsx), a server
 * component the /es page mounts with a fixed locale, so the route stays
 * statically prerendered — no cookies()/headers() read, no client JS added.
 * `mirrored: true` on BOTH trees or the hreflang pair doesn't emit.
 */

import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/site";
import { venues } from "@/data/venues";
import { FoodPantriesHub } from "@/components/HubPages";

export const metadata: Metadata = buildPageMetadata({
  title: t("meta.foodPantries.title", "es"),
  description: t("meta.foodPantries.description", "es"),
  path: "/es/food-pantries",
  locale: "es",
  mirrored: true,
});

export default function EsFoodPantriesPage() {
  return <FoodPantriesHub locale="es" venues={venues} />;
}
