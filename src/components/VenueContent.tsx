"use client";

/**
 * VenueContent — visible body of /venue/[id].
 *
 * This SAME component renders on BOTH /venue/[id] (src/app/(site)/venue/[id]/
 * page.tsx) and /es/venue/[id] (src/app/es/venue/[id]/page.tsx) — its text
 * reads the tree's locale via useLocale() (#289). This is the highest-risk
 * page in the repo (see the EN page.tsx's own header comment on the
 * 2026-08-24 to 2026-09-02 production outage) — this extraction changes ONLY
 * the visible JSX, not generateStaticParams, dynamicParams, generateMetadata,
 * or the venue JSON-LD, all of which stay in each server page.tsx untouched
 * and still read no dynamic API.
 *
 * The category label here uses t(`category.full.${category}`, locale) —
 * matching generateMetadata's description, which calls the SAME
 * venuePageMetadataFields helper (venueSchema.ts) with the page's own
 * locale (#689 supersedes #287/#386's old "metadata stays English" rule).
 *
 * #704 (SEO/AEO plan Phase 2) adds the answer-first summary paragraph and
 * the Nearby list. The summary is built HERE (client-side, via
 * buildVenueSummary — no Date/Intl, so no hydration mismatch — same
 * contract every t() call on this page already relies on) rather than
 * passed as a server-computed string prop: `locale` can diverge from the
 * page's own `tree` post-hydration (an EN-tree visitor with an `es`
 * cookie — see localizedHref.ts's own header), and the visible body must
 * always match whichever locale is currently showing, exactly like the
 * category label and every other t() string on this page. `nearby` (the
 * 3–5 nearest same-category venues) stays server-computed and passed down
 * as a prop instead — it needs the whole venue list, which this client
 * component doesn't otherwise import.
 */

import Link from "next/link";
import { Phone } from "lucide-react";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { localizedHref } from "@/lib/localizedHref";
import { venuePath } from "@/lib/venueSchema";
import { buildVenueSummary, PLACEHOLDER_ADDRESS, type NearbyVenue } from "@/lib/venueSummary";
import { formatMiles } from "@/lib/distance";
import type { Venue } from "@/types/venue";
import { DISPLAY_DAY_KEYS, formatSlot, describeIrregularSchedule } from "@/lib/hours";
import { getDisplayNotes } from "@/lib/venueNotes";
import SiteFooter from "@/components/SiteFooter";

interface VenueContentProps {
  venue: Venue;
  /** Server-computed (#704) — see this file's own header for why. Defaults
   * to [] so every existing test/call site that doesn't pass it still
   * renders (no Nearby block) exactly as before. */
  nearby?: NearbyVenue[];
}

export default function VenueContent({ venue: v, nearby = [] }: VenueContentProps) {
  const { locale, tree } = useLocale();
  const displayNotes = getDisplayNotes(v);
  const summary = buildVenueSummary(v, locale, { includeAddress: false });

  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}`;
  // Fragment form, matching HomePageClient's #venue= handling — there is no
  // /?venue= redirect to bypass (next.config.ts removed it; see that file's
  // 2026-06-20 note), this is just the CTA's original link form.
  // localizedHref (#689 PR 2) keeps this in the /es tree on an /es/venue/<id> page.
  const viewOnMapHref = localizedHref(`/#venue=${v.id}`, tree);

  return (
    <main className="flex flex-col min-h-screen bg-[var(--color-bone-50)]">
      {/* Breadcrumb (SEO/AEO plan Phase 0): Map › All places › this venue.
          Replaces the old lone "← Back to map" link, so every venue page
          links up to /venues in its server HTML. It mirrors the
          BreadcrumbList JSON-LD in src/app/(site)/venue/[id]/page.tsx. */}
      <nav
        aria-label={t("breadcrumb.label", locale)}
        className="min-h-12 flex items-center px-4 border-b border-[var(--color-bone-200)] shrink-0"
      >
        <ol className="flex flex-wrap items-center gap-x-2 text-sm">
          <li>
            <Link
              href={localizedHref("/", tree)}
              className={
                "inline-flex items-center min-h-11 font-medium text-[var(--color-sage-600)] " +
                "hover:text-[var(--color-sage-700)] transition-colors " +
                "focus-visible:outline-none focus-visible:ring-2 " +
                "focus-visible:ring-[var(--color-sage-500)] rounded"
              }
            >
              {t("breadcrumb.map", locale)}
            </Link>
          </li>
          <li aria-hidden className="text-[var(--color-ink-400)]">›</li>
          <li>
            <Link
              href={localizedHref("/venues", tree)}
              className={
                "inline-flex items-center min-h-11 font-medium text-[var(--color-sage-600)] " +
                "hover:text-[var(--color-sage-700)] transition-colors " +
                "focus-visible:outline-none focus-visible:ring-2 " +
                "focus-visible:ring-[var(--color-sage-500)] rounded"
              }
            >
              {t("footer.venues", locale)}
            </Link>
          </li>
          <li aria-hidden className="text-[var(--color-ink-400)]">›</li>
          <li aria-current="page" className="text-[var(--color-ink-500)] truncate max-w-[16rem]">
            {v.name}
          </li>
        </ol>
      </nav>

      {/* Content */}
      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <header>
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--color-sage-600)] mb-1">
            {t(`category.full.${v.category}`, locale)}
          </p>
          <h1
            className="text-2xl font-normal text-[var(--color-ink-900)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {v.name}
          </h1>
          {/* Same OSM placeholder guard as BottomSheet.tsx/DesktopVenueWindow.tsx's
              own address lines — never render the literal "Address not in
              OpenStreetMap" string. */}
          <p className="mt-1 text-sm text-[var(--color-ink-500)]">
            {v.address === PLACEHOLDER_ADDRESS ? `${v.lat}, ${v.lng}` : v.address}
          </p>
          {/* Answer-first summary (#704) — the fact people actually search
              for ("[name] hours", "does [store] take EBT"), assembled from
              verified fields only. Includes "Last verified" (decision 6:
              shown near the top instead of only under Sources & data).
              includeAddress: false (review fix) — the street address is
              already shown just above; the summary here starts from "is a
              free pantry in {city}, CO" instead of repeating it. Meta
              description and JSON-LD description (venueSchema.ts) keep the
              full address — those are read out of page context. */}
          <p className="mt-3 text-sm text-[var(--color-ink-700)] leading-relaxed">
            {summary.join(" ")}
          </p>
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

        {/* Hours (weekly + monthly, #400) — this page is STATIC (prerendered
            at build time; see this component's own header on the 2026-08-24
            outage) and must never depend on `new Date()`, so unlike
            VenueCard/BottomSheet/DesktopVenueWindow this renders each
            irregular entry's RULE as prose only ("4th Tue of each month,
            11am – 12pm") — no live open/closed badge, no "Next: ..." date
            line (both would go stale the instant the build finishes and
            mismatch on client hydrate). Those stay on the client-rendered
            map card, where a fresh `new Date()` read is safe. */}
        {(v.hours_weekly || v.hours_irregular) && (
          <section aria-label={t("detail.hours", locale)}>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-500)] mb-2">
              {t("detail.hours", locale)}
            </h2>
            {v.hours_weekly && (
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
            )}
            {v.hours_irregular && v.hours_irregular.length > 0 && (
              <div className={v.hours_weekly ? "mt-2" : undefined}>
                <p className="text-xs font-semibold text-[var(--color-ink-500)] mb-1">
                  {t("hours.irregular.heading", locale)}
                </p>
                <ul className="space-y-0.5">
                  {v.hours_irregular.map((entry, i) => (
                    <li key={i} className="text-sm text-[var(--color-ink-700)]">
                      {describeIrregularSchedule(entry, locale, t)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Phone / Contact — same tel: link pattern as BottomSheet/DesktopVenueWindow */}
        {v.phone && (
          <section aria-label={t("detail.contact", locale)}>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-500)] mb-2">
              {t("detail.contact", locale)}
            </h2>
            <a
              href={`tel:${v.phone}`}
              className="inline-flex items-center gap-2.5 min-h-11 text-sm font-semibold text-[var(--color-sage-700)] underline underline-offset-2 hover:text-[var(--color-sage-600)] transition-colors"
            >
              <Phone size={15} className="text-[var(--color-sage-600)]" aria-hidden />
              {v.phone}
            </a>
          </section>
        )}

        {/* Notes — same boilerplate guard as BottomSheet/DesktopVenueWindow
            (src/lib/venueNotes.ts); without it Plentiful's auto-generated
            "{name}. in Pueblo, CO. Phone: ..." filler leaked onto this page
            even where the map card already hid it. */}
        {displayNotes && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-500)] mb-2">
              {t("detail.about", locale)}
            </h2>
            <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">{displayNotes}</p>
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
          </section>
        )}

        {/* Nearby (#704): the 3–5 nearest same-category places, server-computed
            (see this file's own header) and passed down as `nearby` — adds no
            client JS. Omitted entirely on 0 results; shows whatever exists
            below 3 (decision 5). */}
        {nearby.length > 0 && (
          <section aria-label={t("detail.nearby", locale)}>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-ink-500)] mb-2">
              {t("detail.nearby", locale)}
            </h2>
            <ul className="space-y-2">
              {nearby.map((n) => (
                <li key={n.id}>
                  <Link
                    href={localizedHref(venuePath(n.id), tree)}
                    className={
                      "inline-flex flex-col min-h-12 justify-center text-sm font-medium text-[var(--color-sage-700)] " +
                      "hover:text-[var(--color-sage-600)] transition-colors " +
                      "focus-visible:outline-none focus-visible:ring-2 " +
                      "focus-visible:ring-[var(--color-sage-500)] rounded"
                    }
                  >
                    {n.name}
                    <span className="text-xs font-normal text-[var(--color-ink-500)]">
                      {t("detail.nearby.away", locale, { miles: formatMiles(n.distanceMiles) })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
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
            {t("detail.viewOnMap", locale)}
          </Link>
        </div>
      </div>
      {/* SiteFooter (SEO/AEO plan Phase 0): links to /venues, /resources
          and /about, and carries the ODbL "© OpenStreetMap contributors"
          credit (#133 4.5) that this page used to render itself, for
          OSM-sourced venues only. */}
      <SiteFooter />
    </main>
  );
}
