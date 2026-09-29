/**
 * HubPages — bodies of the SEO hub pages /food-pantries, /snap-wic-stores,
 * /community-gardens and /blessing-boxes, plus their /es twins (SEO/AEO plan Phase 3, #709).
 * (/blessing-boxes is the exception to "static": its page files are force-dynamic
 * and read D1 at request time; this component is still a plain server component.)
 *
 * WHY server components taking `locale` as a prop (unlike /venues, which is a
 * client component reading useLocale()): these are the pages meant to rank, and
 * on them tree === locale, so the body can be fixed at build time with no client
 * JS and no cookie read — the routes stay statically prerendered. The EN and ES
 * page.tsx files are thin wrappers that mount the same component. PageNav and
 * SiteFooter are the site's existing client chrome; they follow the visitor's
 * locale cookie (an EN page with a stale `es` cookie gets Spanish chrome under
 * an English body — the same accepted tradeoff as the other tree pages).
 *
 * Each page passes its own `venues` list (the build-time snapshot in
 * src/data/venues.ts) so tests can render synthetic fixtures. Filtering,
 * sorting and truth rules live in src/lib/hubPages.ts; the ItemList JSON-LD is
 * built from the exact list rendered (buildVenueListJsonLd) so the two agree.
 * Plain lists only — no images or maps — for older phones on slow 4G.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";
import { localizedHref } from "@/lib/localizedHref";
import { buildVenueListJsonLd, serializeJsonLd } from "@/lib/venueSchema";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";
import {
  allFree,
  boxDeepLink,
  boxesForHub,
  buildBoxListJsonLd,
  gardensForHub,
  hubAddress,
  hubHours,
  pantriesForHub,
  snapWicForHub,
} from "@/lib/hubPages";
import type { Venue } from "@/types/venue";
import PageNav, { PAGE_NAV_CLEARANCE } from "@/components/PageNav";
import SiteFooter from "@/components/SiteFooter";
import FaqSection from "@/components/FaqSection";
import { faqItemsFor } from "@/lib/faqItems";

const PLACE_LINK_CLASS =
  "inline-flex items-center min-h-12 text-base font-semibold text-[var(--color-sage-600)] " +
  "hover:text-[var(--color-sage-700)] transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-[var(--color-sage-500)] rounded";

const DETAIL_CLASS = "text-sm text-[var(--color-ink-500)]";

function JsonLd({ data }: { data: unknown }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
  );
}

function HubShell({
  locale,
  heading,
  intro,
  children,
}: {
  locale: Locale;
  heading: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className={"flex flex-col min-h-screen bg-[var(--color-bone-50)] " + PAGE_NAV_CLEARANCE}>
      <PageNav locale={locale} backHref={localizedHref("/", locale)} />
      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-8 space-y-8">
        <div>
          <h1
            className="text-3xl font-normal text-[var(--color-ink-900)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {heading}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-ink-700)] leading-relaxed">{intro}</p>
        </div>
        {children}
      </div>
      <SiteFooter />
    </main>
  );
}

function PlaceItem({ venue, locale, children }: { venue: Venue; locale: Locale; children?: ReactNode }) {
  const address = hubAddress(venue);
  return (
    <li>
      <Link href={localizedHref(`/venue/${venue.id}`, locale)} className={PLACE_LINK_CLASS}>
        {venue.name}
      </Link>
      {address && <p className={DETAIL_CLASS}>{address}</p>}
      {children}
    </li>
  );
}

/** Hours in words, or the honest "not listed" line — never invented hours. */
function HoursLine({ venue, locale }: { venue: Venue; locale: Locale }) {
  return <p className={DETAIL_CLASS + " mt-0.5"}>{hubHours(venue, locale) ?? t("hubs.hoursMissing", locale)}</p>;
}

export function FoodPantriesHub({ locale, venues }: { locale: Locale; venues: Venue[] }) {
  const pantries = pantriesForHub(venues);
  const intro = t(allFree(pantries) ? "hubs.pantries.introFree" : "hubs.pantries.introPlain", locale, {
    count: String(pantries.length),
  });
  return (
    <HubShell locale={locale} heading={t("hubs.pantries.heading", locale)} intro={intro}>
      <JsonLd data={buildVenueListJsonLd(pantries, locale)} />
      <ul className="space-y-4">
        {pantries.map((v) => (
          <PlaceItem key={v.id} venue={v} locale={locale}>
            <HoursLine venue={v} locale={locale} />
          </PlaceItem>
        ))}
      </ul>
      <FaqSection
        id="pantry-faq-heading"
        heading={t("hubs.pantries.faq.heading", locale)}
        items={faqItemsFor("hubs.pantries.faq", 4, locale)}
        locale={locale}
      />
    </HubShell>
  );
}

export function SnapWicHub({ locale, venues }: { locale: Locale; venues: Venue[] }) {
  const { places, snapCount, wicCount } = snapWicForHub(venues);
  const intro = t("hubs.snapWic.intro", locale, { snap: String(snapCount), wic: String(wicCount) });
  return (
    <HubShell locale={locale} heading={t("hubs.snapWic.heading", locale)} intro={intro}>
      <JsonLd data={buildVenueListJsonLd(places, locale)} />
      <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
        {t("hubs.snapWic.note", locale)} {t("hubs.snapWic.apply", locale)}{" "}
        <Link
          href={localizedHref("/resources", locale)}
          className="inline-flex items-center min-h-12 font-semibold text-[var(--color-sage-600)] underline"
        >
          {t("resources.heading", locale)}
        </Link>
      </p>
      <ul className="space-y-4">
        {places.map((v) => {
          // `=== true` again at render (not just in the filter): a place is
          // badged only for the benefit it is confirmed to take.
          const badges = [
            v.accepts_snap === true && t("hubs.snapWic.badgeSnap", locale),
            v.accepts_wic === true && t("hubs.snapWic.badgeWic", locale),
          ].filter(Boolean);
          return (
            <PlaceItem key={v.id} venue={v} locale={locale}>
              <p className={DETAIL_CLASS + " mt-0.5"}>{t(`category.full.${v.category}`, locale)}</p>
              <p className="mt-0.5 text-sm font-semibold text-[var(--color-ink-700)]">{badges.join(" · ")}</p>
            </PlaceItem>
          );
        })}
      </ul>
    </HubShell>
  );
}

/**
 * /blessing-boxes body (PR B). Read-only: names link into the map card; no
 * check-in, photo, adopt or alert controls (REVIEW.md exception). `degraded`
 * (D1 read failed) shows an honest message and a map link, never "0 boxes",
 * and emits no JSON-LD. A status line shows only when the box has a real
 * signal (not "unknown") — status is computed at request time from check-ins.
 * No "free" wording anywhere: blessing_box is not in FREE_CATEGORIES.
 */
export function BlessingBoxesHub({
  locale,
  boxes,
  degraded,
}: {
  locale: Locale;
  boxes: PublicBlessingBox[];
  degraded: boolean;
}) {
  const sorted = boxesForHub(boxes);
  const showList = !degraded && sorted.length > 0;
  const intro = degraded
    ? t("hubs.boxes.degraded", locale)
    : sorted.length === 0
      ? t("hubs.boxes.empty", locale)
      : t(sorted.length === 1 ? "hubs.boxes.introOne" : "hubs.boxes.intro", locale, {
          count: String(sorted.length),
        });
  return (
    <HubShell locale={locale} heading={t("hubs.boxes.heading", locale)} intro={intro}>
      {showList && <JsonLd data={buildBoxListJsonLd(sorted, locale)} />}
      <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">{t("hubs.boxes.what", locale)}</p>
      {showList ? (
        <ul className="space-y-4">
          {sorted.map((b) => {
            const address = hubAddress(b);
            return (
              <li key={b.id}>
                <Link href={boxDeepLink(b.id, locale)} className={PLACE_LINK_CLASS}>
                  {b.name}
                </Link>
                {address && <p className={DETAIL_CLASS}>{address}</p>}
                {b.box.status !== "unknown" && (
                  <p className={DETAIL_CLASS + " mt-0.5"}>
                    {t("box.status", locale)}: {t(`box.status.${b.box.status}`, locale)}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Link href={localizedHref("/", locale)} className={PLACE_LINK_CLASS + " underline"}>
          {t("hubs.boxes.openMap", locale)}
        </Link>
      )}
    </HubShell>
  );
}

export function CommunityGardensHub({ locale, venues }: { locale: Locale; venues: Venue[] }) {
  const groups = gardensForHub(venues);
  const all = groups.flatMap((g) => g.items);
  // "Free" wording only when every listed category is in FREE_CATEGORIES.
  const intro = t(allFree(all) ? "hubs.gardens.introFree" : "hubs.gardens.introPlain", locale, {
    count: String(all.length),
  });
  return (
    <HubShell locale={locale} heading={t("hubs.gardens.heading", locale)} intro={intro}>
      <JsonLd data={buildVenueListJsonLd(all, locale)} />
      {groups.map(({ category, items }) => (
        <section key={category} aria-labelledby={`${category}-heading`}>
          <h2 id={`${category}-heading`} className="text-lg font-semibold text-[var(--color-ink-700)] mb-2">
            {t(`hubs.gardens.section.${category}`, locale)}
          </h2>
          <ul className="space-y-4">
            {items.map((v) => (
              <PlaceItem key={v.id} venue={v} locale={locale}>
                <HoursLine venue={v} locale={locale} />
              </PlaceItem>
            ))}
          </ul>
        </section>
      ))}
    </HubShell>
  );
}
