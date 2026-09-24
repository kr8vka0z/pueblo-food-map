"use client";

/**
 * VenueContent — visible body of /venue/[id].
 *
 * Extracted from src/app/venue/[id]/page.tsx so the page's text reads the
 * visitor's locale via useLocale() (#289). This is the highest-risk page in
 * the repo (see that file's own header comment on the 2026-08-24 to
 * 2026-09-02 production outage) — this extraction changes ONLY the visible
 * JSX, not generateStaticParams, dynamicParams, generateMetadata, or the
 * venue JSON-LD, all of which stay in the server page.tsx untouched and
 * still read no dynamic API.
 *
 * The category label here uses t(`category.full.${category}`, locale) —
 * visible on-screen text, in scope for bilingual support — unlike
 * generateMetadata's description (machine-readable metadata, stays English
 * per #287/#386) which still reads the raw English categoryLabels map.
 */

import Link from "next/link";
import { Phone } from "lucide-react";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import type { Venue } from "@/types/venue";
import { DISPLAY_DAY_KEYS, formatSlot, describeIrregularSchedule } from "@/lib/hours";
import { getDisplayNotes } from "@/lib/venueNotes";

interface VenueContentProps {
  venue: Venue;
}

export default function VenueContent({ venue: v }: VenueContentProps) {
  const { locale } = useLocale();
  const displayNotes = getDisplayNotes(v);

  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}`;
  // Fragment form, matching HomePageClient's #venue= handling — there is no
  // /?venue= redirect to bypass (next.config.ts removed it; see that file's
  // 2026-06-20 note), this is just the CTA's original link form.
  const viewOnMapHref = `/#venue=${v.id}`;

  return (
    <main className="flex flex-col min-h-screen bg-[var(--color-bone-50)]">
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
            {t(`category.full.${v.category}`, locale)}
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
            {t("detail.viewOnMap", locale)}
          </Link>
        </div>
      </div>
    </main>
  );
}
