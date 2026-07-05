/**
 * /venues — full, server-rendered directory of every venue on the map.
 *
 * WHY this page exists: the homepage is a live Mapbox canvas — invisible to
 * crawlers and AI answer engines that don't execute the map's client JS (the
 * ItemList JSON-LD on `/` covers structured data, but offers no readable HTML
 * a user or a text-only crawler can actually scan). This page emits the full
 * venue list as plain server-rendered HTML, grouped by category, so search
 * and answer engines get a crawlable index and users get a no-map way to
 * browse every resource. SEO/AEO PR4 item S5.
 *
 * Static server component: reads locale from cookie (same pattern as /about
 * and /venue/[id]) so the whole page renders in the visitor's language on
 * first response, with no client-side language flash.
 *
 * groupVenuesByCategory is exported as a pure, framework-free function (no
 * Next.js APIs, no Date/random) specifically so it's unit-testable without
 * rendering the page — see src/__tests__/venues.test.tsx.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/site";
import SiteFooter from "@/components/SiteFooter";
import { venues, categoryLabels } from "@/data/venues";
import type { Venue, VenueCategory } from "@/types/venue";
import { DISPLAY_DAY_KEYS, formatSlot } from "@/lib/hours";

export const metadata: Metadata = buildPageMetadata({
  title: "All Food Resources",
  description:
    "Browse every food resource on the Pueblo Food Map — food pantries, grocery stores, community gardens, farms, and meal sites across Pueblo County, CO, with addresses and hours.",
  path: "/venues",
});

/**
 * Group venues by category, in categoryLabels' key order, with empty
 * categories omitted and each group's items sorted by name.
 *
 * Pure and deterministic (no side effects, no Date/random) so it's testable
 * against synthetic fixtures without touching the real venues dataset.
 */
export function groupVenuesByCategory(
  list: Venue[],
): { category: VenueCategory; items: Venue[] }[] {
  const categories = Object.keys(categoryLabels) as VenueCategory[];
  return categories
    .map((category) => ({
      category,
      items: list
        .filter((v) => v.category === category)
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((group) => group.items.length > 0);
}

export default async function VenuesPage() {
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get("pfm-locale")?.value;
  const locale: Locale = rawLocale === "en" || rawLocale === "es" ? rawLocale : "en";

  const groups = groupVenuesByCategory(venues);

  return (
    <main className="flex flex-col min-h-screen bg-[var(--color-bone-50)]">
      {/* Top nav bar — matches about.tsx / venue/[id]/page.tsx pattern */}
      <nav className="h-12 flex items-center px-4 border-b border-[var(--color-bone-200)] shrink-0">
        <Link
          href="/"
          className={
            "text-sm font-medium text-[var(--color-sage-600)] " +
            "hover:text-[var(--color-sage-700)] transition-colors " +
            "focus-visible:outline-none focus-visible:ring-2 " +
            "focus-visible:ring-[var(--color-sage-500)] rounded"
          }
        >
          ← {t("footer.backToMap", locale)}
        </Link>
      </nav>

      {/* Page content */}
      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-8 space-y-8">
        <div>
          <h1
            className="text-3xl font-normal text-[var(--color-ink-900)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {t("venues.heading", locale)}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-ink-700)]">
            {t("venues.intro", locale)}
          </p>
        </div>

        {groups.map(({ category, items }) => {
          const headingId = `${category}-heading`;
          return (
            <section key={category} aria-labelledby={headingId}>
              <h2
                id={headingId}
                className="text-lg font-semibold text-[var(--color-ink-800)] mb-2"
              >
                {t(`category.full.${category}`, locale)}
              </h2>
              <ul className="space-y-4">
                {items.map((v) => {
                  const openDays = DISPLAY_DAY_KEYS.filter(
                    (day) => (v.hours_weekly?.[day]?.length ?? 0) > 0,
                  ).map(
                    (day) =>
                      `${t(`day.${day}`, locale)} ${v.hours_weekly![day]!.map(formatSlot).join(", ")}`,
                  );
                  const hoursText =
                    openDays.length > 0 ? openDays.join(" · ") : t("venues.noHours", locale);

                  return (
                    <li key={v.id}>
                      <Link
                        href={`/venue/${v.id}`}
                        className={
                          "text-sm font-medium text-[var(--color-sage-600)] " +
                          "hover:text-[var(--color-sage-700)] transition-colors " +
                          "focus-visible:outline-none focus-visible:ring-2 " +
                          "focus-visible:ring-[var(--color-sage-500)] rounded"
                        }
                      >
                        {v.name}
                      </Link>
                      <p className="mt-0.5 text-sm text-[var(--color-ink-500)]">{v.address}</p>
                      <p className="mt-0.5 text-sm text-[var(--color-ink-500)]">{hoursText}</p>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {/* Site footer: links back to map, about, privacy, suggest */}
      <SiteFooter />
    </main>
  );
}
