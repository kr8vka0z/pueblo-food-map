/**
 * /resources — plain-language guide to food help programs (2-1-1 Colorado,
 * SNAP, WIC, Double Up Food Bucks, the Food Resource Hotline, Everyday Eats).
 *
 * Static server component with an English `metadata` export, same pattern as
 * /about (ARCHITECTURE.md "i18n model", #287): the visible body is
 * ResourcesContent, a client component that reads the visitor's locale, so
 * this route never reads cookies() and stays fully static.
 */

import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/site";
import ResourcesContent from "@/components/ResourcesContent";
import { resourcesFaqJsonLd } from "@/lib/resourcesFaq";

export const metadata: Metadata = buildPageMetadata({
  title: t("meta.resources.title", "en"),
  description: t("meta.resources.description", "en"),
  path: "/resources",
  // #689 PR 2: this page has an /es counterpart — carries hreflang now.
  mirrored: true,
});

export default function ResourcesPage() {
  return <ResourcesContent faqJsonLd={resourcesFaqJsonLd("en")} />;
}
