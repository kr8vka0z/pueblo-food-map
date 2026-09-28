/**
 * /es/resources — Spanish twin of /resources (#689 PR 2).
 *
 * Thin wrapper: ResourcesContent is the SAME client component the EN page
 * mounts, already reading useLocale() (#289) — under this tree's locked
 * provider it renders Spanish body copy with no changes needed here.
 */

import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/site";
import ResourcesContent from "@/components/ResourcesContent";

export const metadata: Metadata = buildPageMetadata({
  title: t("meta.resources.title", "es"),
  description: t("meta.resources.description", "es"),
  path: "/es/resources",
  locale: "es",
  mirrored: true,
});

export default function EsResourcesPage() {
  return <ResourcesContent />;
}
