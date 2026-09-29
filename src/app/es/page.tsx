/**
 * /es — Spanish homepage (#689 PR 2).
 *
 * Thin wrapper around the same HomePageClient the EN homepage
 * (src/app/(site)/page.tsx) mounts — no page logic is duplicated (#689
 * design decision 4). Server-rendered pieces (ItemList JSON-LD, sr-only
 * <h1>, crawl links) are re-emitted here in Spanish rather than imported,
 * because they're the page's OWN localized content, not shared logic.
 *
 * Internal links point within the /es tree as plain "/es/..." literals, NOT
 * via localizedHref: this file only ever renders on the /es tree (tree is
 * always "es" here), so there's no ambiguity localizedHref would resolve —
 * unlike a shared component (SiteFooter, BottomNav, ...) that renders on
 * BOTH trees and needs it to pick the right one. Same reasoning as the EN
 * homepage's own HOME_CRAWL_LINKS (src/app/(site)/page.tsx), which is
 * equally hardcoded to "/venues" etc.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { buildVenueListJsonLd, serializeJsonLd } from "@/lib/venueSchema";
import { buildPageMetadata } from "@/lib/site";
import { t } from "@/lib/i18n";
import { venues } from "@/data/venues";
import HomePageClient from "../(site)/HomePageClient";

export const metadata: Metadata = buildPageMetadata({
  title: t("meta.home.title", "es"),
  description: t("meta.home.description", "es"),
  path: "/es",
  locale: "es",
  mirrored: true,
});

const HOME_CRAWL_LINKS = [
  { href: "/es/venues", label: "Todos los recursos alimentarios en el Condado de Pueblo" }, // [CHECK]
  { href: "/es/resources", label: "Programas de ayuda alimentaria (SNAP, WIC, 2-1-1)" }, // [CHECK]
  { href: "/es/about", label: "Acerca de Pueblo Food Map" }, // [CHECK]
  // SEO Phase 3 hubs (#709)
  { href: "/es/food-pantries", label: "Despensas de alimentos en el Condado de Pueblo" }, // [CHECK]
  { href: "/es/snap-wic-stores", label: "Lugares que aceptan SNAP y WIC" }, // [CHECK]
  { href: "/es/community-gardens", label: "Huertos comunitarios en el Condado de Pueblo" }, // [CHECK]
  { href: "/es/blessing-boxes", label: "Cajas de bendiciones en el Condado de Pueblo" }, // [CHECK]
] as const;

const HOME_CRAWL_LINK_CLASS =
  "sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 " +
  "focus:px-3 focus:py-2 focus:rounded focus:bg-[var(--color-bone-50)] " +
  "focus:text-[var(--color-ink-900)] focus:outline-none focus:ring-2 " +
  "focus:ring-[var(--color-sage-500)]";

export default function EsHomePage() {
  // Build ItemList JSON-LD once (referentially stable — venues array is static).
  const itemListJsonLd = buildVenueListJsonLd(venues, "es");

  return (
    <>
      {/* ItemList JSON-LD — crawlable venue index for search engines, on /es only */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemListJsonLd) }}
      />
      {/* sr-only: gives crawlers/AT a real <h1> without changing the splash/map visual design */}
      <h1 className="sr-only">Pueblo Food Map — Recursos de alimentos en el Condado de Pueblo, CO</h1>
      {/* Server-rendered links, Spanish (mirrors src/app/(site)/page.tsx's
          same EN links — see that file's own comment for why they exist). */}
      <nav aria-label="Sitio" className="absolute">
        <ul className="list-none">
          {HOME_CRAWL_LINKS.map(({ href, label }) => (
            <li key={href}>
              <Link href={href} className={HOME_CRAWL_LINK_CLASS}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <HomePageClient />
    </>
  );
}
