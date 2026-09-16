/**
 * /resources — plain-language guide to food help programs (2-1-1 Colorado,
 * SNAP, WIC, Double Up Food Bucks, the Food Resource Hotline, Everyday Eats).
 *
 * Static server component with an English `metadata` export, same pattern as
 * /about (AGENTS.md "Known bilingual limitation", #287): the visible body is
 * ResourcesContent, a client component that reads the visitor's locale, so
 * this route never reads cookies() and stays fully static.
 */

import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site";
import ResourcesContent from "@/components/ResourcesContent";

export const metadata: Metadata = buildPageMetadata({
  title: "Food help programs",
  description:
    "How to get SNAP, WIC, Double Up Food Bucks, 2-1-1 Colorado, the Food Resource Hotline and senior food boxes in Pueblo County, CO — what each is for and how to sign up.",
  path: "/resources",
});

export default function ResourcesPage() {
  return <ResourcesContent />;
}
