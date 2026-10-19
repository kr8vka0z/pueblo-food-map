/**
 * /es — Spanish homepage (#689 PR 2).
 *
 * Thin wrapper around the same HomeShell the EN homepage
 * (src/app/(site)/page.tsx) mounts — no page logic is duplicated (#689
 * design decision 4). HomeShell renders the server-rendered pieces
 * (ItemList JSON-LD, sr-only <h1>, crawl links) in Spanish from
 * `locale="es"`, with the crawl links pointing within the /es tree, then
 * mounts the shared HomePageClient. Stays synchronous for the same reason
 * as the EN page (esHomeNav.test.tsx renders it directly).
 */

import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site";
import { t } from "@/lib/i18n";
import HomeShell from "@/components/HomeShell";

export const metadata: Metadata = buildPageMetadata({
  title: t("meta.home.title", "es"),
  description: t("meta.home.description", "es"),
  path: "/es",
  locale: "es",
  mirrored: true,
});

export default function EsHomePage() {
  return <HomeShell locale="es" />;
}
