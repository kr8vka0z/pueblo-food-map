/**
 * HomeShell — the server-rendered shell shared by the EN (/) and ES (/es)
 * homepages: venue-index JSON-LD, a sr-only <h1>, crawl links, the splash
 * gate script, then HomePageClient for the interactive map/splash body.
 *
 * WHY a server shell at all (SEO PR1, see AGENTS.md "Discoverability / SEO"):
 * the homepage used to BE the client component now in HomePageClient.tsx —
 * its first render always returned null (the splash-gate state starts
 * unresolved until an effect runs), so crawlers that don't execute JS, and
 * the ItemList JSON-LD script that lived in that same component, never
 * appeared in the server response at all.
 *
 * WHY one shell for both trees: the two homepages were the same JSX apart
 * from their strings and locale (#689 design decision 4: no page logic is
 * duplicated per tree). Everything locale-facing here comes from `locale` —
 * the JSON-LD URLs, the <h1> (the same meta.home.title string the page's
 * <title> uses), the nav label and the crawl-link labels below.
 *
 * Synchronous on purpose (NOT async): src/__tests__/page.test.tsx and
 * esHomeNav.test.tsx render the pages directly with `render(<HomePage />)`,
 * which cannot await a Promise-returning component.
 */

import Link from "next/link";
import { buildVenueListJsonLd, serializeJsonLd } from "@/lib/venueSchema";
import { t, type Locale } from "@/lib/i18n";
import { localizedHref } from "@/lib/localizedHref";
import { SPLASH_GATE_SCRIPT } from "@/lib/splashGate";
import { venues } from "@/data/venues";
import HomePageClient from "@/app/(site)/HomePageClient";

// EN-tree paths; localizedHref maps each to its /es twin on the Spanish tree
// (all seven are mirrored routes).
const HOME_CRAWL_LINKS: { href: string; label: Record<Locale, string> }[] = [
  {
    href: "/venues",
    label: {
      en: "All food resources in Pueblo County",
      es: "Todos los recursos alimentarios en el Condado de Pueblo", // [CHECK]
    },
  },
  {
    href: "/resources",
    label: {
      en: "Food help programs (SNAP, WIC, 2-1-1)",
      es: "Programas de ayuda alimentaria (SNAP, WIC, 2-1-1)", // [CHECK]
    },
  },
  {
    href: "/about",
    label: { en: "About Pueblo Food Map", es: "Acerca de Pueblo Food Map" }, // [CHECK]
  },
  // SEO Phase 3 hubs (#709)
  {
    href: "/food-pantries",
    label: {
      en: "Food pantries in Pueblo County",
      es: "Despensas de alimentos en el Condado de Pueblo", // [CHECK]
    },
  },
  {
    href: "/snap-wic-stores",
    label: { en: "Places that accept SNAP and WIC", es: "Lugares que aceptan SNAP y WIC" }, // [CHECK]
  },
  {
    href: "/community-gardens",
    label: {
      en: "Community gardens in Pueblo County",
      es: "Huertos comunitarios en el Condado de Pueblo", // [CHECK]
    },
  },
  {
    href: "/blessing-boxes",
    label: {
      en: "Blessing boxes in Pueblo County",
      es: "Cajas de bendiciones en el Condado de Pueblo", // [CHECK]
    },
  },
];

const HOME_CRAWL_NAV_LABEL: Record<Locale, string> = { en: "Site", es: "Sitio" };

const HOME_CRAWL_LINK_CLASS =
  "sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 " +
  "focus:px-3 focus:py-2 focus:rounded focus:bg-[var(--color-bone-50)] " +
  "focus:text-[var(--color-ink-900)] focus:outline-none focus:ring-2 " +
  "focus:ring-[var(--color-sage-500)]";

export default function HomeShell({ locale }: { locale: Locale }) {
  // Build ItemList JSON-LD once (referentially stable — venues array is static).
  const itemListJsonLd = buildVenueListJsonLd(venues, locale);

  return (
    <>
      {/* ItemList JSON-LD — crawlable venue index for search engines, on the homepage only */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemListJsonLd) }}
      />
      {/* sr-only: gives crawlers/AT a real <h1> without changing the splash/map visual design */}
      <h1 className="sr-only">{t("meta.home.title", locale)}</h1>
      {/* Server-rendered links (SEO/AEO plan Phase 0). Before this, the
          homepage's server HTML had zero <a> links, so crawlers that don't run
          JS couldn't get from / to /venues (and from there every venue page).
          Visually hidden like the <h1> above, so the map design is
          unchanged; screen-reader users get the same links. Each link shows
          itself when focused (the skip-link pattern), so keyboard focus never
          lands on something invisible. */}
      {/* `absolute` keeps the zero-size list out of the flex layout. */}
      <nav aria-label={HOME_CRAWL_NAV_LABEL[locale]} className="absolute">
        {/* list-none explicitly, rather than relying on Tailwind Preflight, so
            no bullet can ever show over the map. */}
        <ul className="list-none">
          {HOME_CRAWL_LINKS.map(({ href, label }) => {
            const treeHref = localizedHref(href, locale);
            return (
              <li key={treeHref}>
                <Link href={treeHref} className={HOME_CRAWL_LINK_CLASS}>
                  {label[locale]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {/* Must sit right before HomePageClient: runs before the splash markup is
          parsed, so returning visitors never paint it (see splashGate.ts). */}
      <script dangerouslySetInnerHTML={{ __html: SPLASH_GATE_SCRIPT }} />
      <HomePageClient />
    </>
  );
}
