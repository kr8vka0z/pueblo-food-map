/**
 * /venue/[id] — per-venue dynamically rendered page with structured data.
 *
 * WHY: Gives each venue its own crawlable URL with a venue-specific title,
 * meta description, Open Graph tags, and LocalBusiness/FoodEstablishment
 * JSON-LD — enabling rich search results and accurate link previews for
 * shared venue links. Issue #164 item 6.4.
 *
 * WHY dynamically rendered (not SSG): the cookies() call to read the locale
 * preference opts this route out of static generation — Next.js treats any
 * use of dynamic server APIs as dynamic rendering. generateStaticParams +
 * dynamicParams=false still restrict the route to known venue ids (unknown ids
 * return 404), but each request is rendered at runtime, not at compile time.
 *
 * params is a Promise in Next.js 16 App Router — must be awaited.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/site";
import {
  getVenueById,
  venuePath,
  buildVenueJsonLd,
  serializeJsonLd,
} from "@/lib/venueSchema";
import { venues, categoryLabels } from "@/data/venues";
import { DISPLAY_DAY_KEYS, formatSlot } from "@/lib/hours";

export const dynamicParams = false;

export function generateStaticParams() {
  return venues.map((v) => ({ id: v.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const v = getVenueById(id);
  if (!v) return {};
  return buildPageMetadata({
    title: v.name,
    // WHY name + address (not just category): the prior description was
    // byte-identical for every venue sharing a category — a duplicate-content
    // SEO problem search engines can penalize. Issue #164 quick win (S4).
    description: `${v.name} — ${categoryLabels[v.category]} in Pueblo, CO. ${v.address}.`,
    path: venuePath(v.id),
  });
}

export default async function VenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const v = getVenueById(id);
  if (!v) notFound();

  // Read locale cookie — same pattern as privacy.tsx and other server pages.
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get("pfm-locale")?.value;
  const locale: Locale = rawLocale === "en" || rawLocale === "es" ? rawLocale : "en";

  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}`;
  // Fragment form — bypasses the /?venue= middleware redirect loop.
  const viewOnMapHref = `/#venue=${v.id}`;

  return (
    <main className="flex flex-col min-h-screen bg-[var(--color-bone-50)]">
      {/* Venue-specific JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildVenueJsonLd(v)) }}
      />

      {/* Top nav bar — matches privacy.tsx / suggest.tsx pattern */}
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
          ← {t("report.backToMap", locale)}
        </Link>
      </nav>

      {/* Content */}
      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <header>
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--color-sage-600)] mb-1">
            {categoryLabels[v.category]}
          </p>
          <h1
            className="text-2xl font-normal text-[var(--color-ink-900)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {v.name}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-ink-500)]">{v.address}</p>
        </header>

        {/* SNAP / WIC badges */}
        {(v.accepts_snap || v.accepts_wic) && (
          <div className="flex gap-2">
            {v.accepts_snap && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-sage-100)] text-[var(--color-sage-700)]">
                {t("detail.acceptsSnap", locale)}
              </span>
            )}
            {v.accepts_wic && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-sage-100)] text-[var(--color-sage-700)]">
                {t("detail.acceptsWic", locale)}
              </span>
            )}
          </div>
        )}

        {/* Hours */}
        {v.hours_weekly && (
          <section aria-label={t("detail.hours", locale)}>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-500)] mb-2">
              {t("detail.hours", locale)}
            </h2>
            <dl className="space-y-1">
              {DISPLAY_DAY_KEYS.map((day) => {
                const slots = v.hours_weekly![day];
                return (
                  <div key={day} className="flex gap-4 text-sm pl-1">
                    <dt className="w-8 shrink-0 text-[var(--color-ink-500)]">
                      {t(`day.${day}`, locale)}
                    </dt>
                    <dd className="font-mono text-[var(--color-ink-700)]">
                      {slots && slots.length > 0
                        ? slots.map(formatSlot).join(", ")
                        : t("hours.closed", locale)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        )}

        {/* Notes */}
        {v.notes && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-500)] mb-2">
              {t("detail.about", locale)}
            </h2>
            <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">{v.notes}</p>
          </section>
        )}

        {/* Operator / source attribution */}
        {(v.operator || v.source) && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-500)] mb-2">
              {t("detail.sources", locale)}
            </h2>
            {v.operator && (
              <p className="text-sm text-[var(--color-ink-500)]">
                {t("operator.operated_by", locale)}: {v.operator}
              </p>
            )}
            <p className="text-xs text-[var(--color-ink-400)] mt-1">
              {t("detail.lastVerified", locale)}: {v.last_verified}
            </p>
          </section>
        )}

        {/* Action links */}
        <div className="flex flex-col gap-3 pt-2">
          <a
            href={directionsHref}
            target="_blank"
            rel="noopener noreferrer"
            className={
              "inline-flex items-center justify-center px-4 py-2 rounded " +
              "bg-[var(--color-sage-600)] text-white text-sm font-medium " +
              "hover:bg-[var(--color-sage-700)] transition-colors " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
            }
          >
            {t("detail.getDirections", locale)}
          </a>
          <Link
            href={viewOnMapHref}
            className={
              "inline-flex items-center justify-center px-4 py-2 rounded " +
              "border border-[var(--color-sage-500)] text-[var(--color-sage-700)] text-sm font-medium " +
              "hover:bg-[var(--color-sage-50)] transition-colors " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
            }
          >
            View on the map
          </Link>
        </div>
      </div>
    </main>
  );
}
