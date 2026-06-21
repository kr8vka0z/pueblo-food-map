"use client";

/**
 * BottomSheet v3 — vaul-based mobile-only sheet with boolean expanded toggle.
 *
 * Replaces the fragile three-snap-point model (v2) with desktop-parity:
 *   collapsed: venue summary — name, category badge, distance, hours-today,
 *              SNAP/WIC pills, two-line notes, Get directions, "Show details"
 *   expanded:  collapsed content + address, full hours table, phone, report
 *
 * vaul is kept as the drawer container for drag-to-dismiss, scrim, Escape,
 * and a11y Dialog.Title — but WITHOUT snapPoints.
 *
 * Three dismissal paths:
 *   1. Escape key (vaul handles natively via onOpenChange)
 *   2. Tap on scrim (vaul handles by default)
 *   3. Explicit close X button
 */

import { useState } from "react";
import { Drawer } from "vaul";
import { X, ChevronUp, ChevronDown, MapPin, Phone, Clock, ExternalLink } from "lucide-react";
import type { Venue } from "@/types/venue";
import { categoryColors, categoryLabels } from "@/data/venues";
import { formatMiles } from "@/lib/distance";
import { computeOpenStatus } from "@/lib/hours";
import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { safeUrl } from "@/lib/safeUrl";
import ReportVenueButton from "@/components/ReportVenueButton";
import FavoriteButton from "@/components/FavoriteButton";
import ShareButton from "@/components/ShareButton";
import HoursList from "@/components/HoursList";

// ─── Props ───────────────────────────────────────────────────────────────────

interface BottomSheetProps {
  venue: (Venue & { distanceMiles?: number }) | null;
  onClose: () => void;
  /** Called when expanded state changes — e.g. to hide overlapping UI when expanded. */
  onExpandedChange?: (expanded: boolean) => void;
  /** Override locale for testing. If omitted, reads from LocaleContext. */
  locale?: Locale;
}

// ─── BottomSheet ─────────────────────────────────────────────────────────────

export default function BottomSheet({ venue, onClose, onExpandedChange, locale: localeProp }: BottomSheetProps) {
  const { locale: ctxLocale } = useLocale();
  const locale = localeProp ?? ctxLocale;
  const [expanded, setExpanded] = useState(false);

  const open = venue !== null;
  const status = venue ? computeOpenStatus(venue.hours_weekly) : null;

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) onClose();
  }

  const directionsUrl = venue
    ? `https://maps.google.com/?q=${venue.lat},${venue.lng}`
    : "#";

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Drawer.Root
      open={open}
      onOpenChange={handleOpenChange}
      modal={false}
      dismissible
    >
      <Drawer.Portal>
        <Drawer.Content
          key={venue?.id ?? "empty"}
          className={
            "fixed bottom-0 left-0 right-0 z-[800] flex flex-col " +
            "bg-[var(--color-bone-50)] " +
            "rounded-t-[var(--radius-xl)] " +
            "elevation-2 " +
            "focus:outline-none"
          }
          style={{ maxHeight: "calc(100dvh - 100px)" }}
          aria-label={t("detail.venueDetailsPanel", locale)}
        >
          {/* Drawer.Title — required by Radix to fix a11y missing-title violation */}
          <Drawer.Title className="sr-only">
            {venue ? `${venue.name} ${t("detail.venueDetails", locale)}` : t("detail.venueDetailsPanel", locale)}
          </Drawer.Title>

          {/* Single scrollable body.
              No drag handle: the "Show details" button is the one expand
              affordance — a grabber bar wrongly implied swipe-to-expand (#122
              follow-up). vaul still allows swipe-down-to-dismiss on the content. */}
          {venue && (
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col px-5 pt-5 pb-4 gap-3">
                {/* Header row: title + close */}
                <div className="flex items-start gap-2">
                  <h2
                    className="flex-1 text-xl font-normal text-[var(--color-ink-900)] leading-tight"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {venue.name}
                  </h2>
                  <ShareButton venueId={venue.id} venueName={venue.name} locale={locale} size={20} />
                  <FavoriteButton venueId={venue.id} venueName={venue.name} locale={locale} size={20} />
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label={t("detail.close", locale)}
                    className={
                      "flex items-center justify-center w-8 h-8 -mr-1 rounded-md " +
                      "text-[var(--color-ink-500)] hover:bg-[var(--color-bone-100)] transition-colors " +
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
                    }
                  >
                    <X size={18} aria-hidden />
                  </button>
                </div>

                {/* Operator attribution */}
                {venue.operator && (
                  <p className="text-xs text-[var(--color-ink-500)] -mt-1">
                    {t("operator.operated_by", locale)}{" "}
                    <a
                      href="https://pueblofoodproject.org/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[var(--color-ink-700)] hover:text-[var(--color-sage-600)] transition-colors"
                    >
                      {venue.operator}
                    </a>
                  </p>
                )}

                {/* Category badge + SNAP/WIC pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium text-[var(--color-bone-50)]"
                    style={{ backgroundColor: categoryColors[venue.category] }}
                  >
                    <span className="w-2 h-2 rounded-full bg-white/40 shrink-0" aria-hidden />
                    {categoryLabels[venue.category]}
                  </span>
                  {venue.accepts_snap && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-sage-100)] text-[var(--color-sage-700)]">
                      {t("badge.snap", locale)}
                    </span>
                  )}
                  {venue.accepts_wic && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-sage-100)] text-[var(--color-sage-700)]">
                      {t("badge.wic", locale)}
                    </span>
                  )}
                </div>

                {/* Distance + hours today */}
                <div className="flex items-center gap-4 text-sm text-[var(--color-ink-500)]">
                  {venue.distanceMiles !== undefined && (
                    <span className="flex items-center gap-1.5">
                      <MapPin size={14} aria-hidden className="text-[var(--color-ink-400)]" />
                      {formatMiles(venue.distanceMiles)} {t("distance.fromYou", locale)}
                    </span>
                  )}
                  {status && status.state !== "no_hours" && (
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} aria-hidden className="text-[var(--color-ink-400)]" />
                      {status.state === "open"
                        ? `${t("badge.openNow", locale)} · ${t("badge.closesAt", locale, { time: status.time })}`
                        : status.state === "opens_at"
                        ? t("badge.opensAt", locale, { time: status.time })
                        : t("badge.closedToday", locale)}
                    </span>
                  )}
                </div>

                {/* Notes (2 lines max) — guard: never render OSM artifact strings */}
                {venue.notes && !/osm/i.test(venue.notes) && (
                  <p className="text-sm text-[var(--color-ink-700)] leading-relaxed line-clamp-2">
                    {venue.notes}
                  </p>
                )}

                {/* Get directions — primary action */}
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={
                    "flex items-center justify-center gap-2 w-full h-12 rounded-[var(--radius-md)] " +
                    "bg-[var(--color-sage-500)] text-[var(--color-bone-50)] " +
                    "text-xl font-semibold transition-colors duration-150 " +
                    "hover:bg-[var(--color-sage-600)] focus-visible:outline-none " +
                    "focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2"
                  }
                >
                  {t("detail.getDirections", locale)}
                </a>

                {/* Show/Hide details toggle */}
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls="bottomsheet-detail"
                  onClick={() => {
                    setExpanded((v) => {
                      const n = !v;
                      onExpandedChange?.(n);
                      return n;
                    });
                  }}
                  className={
                    "flex items-center gap-1.5 text-sm font-medium text-[var(--color-sage-600)] " +
                    "hover:text-[var(--color-sage-700)] " +
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
                    "rounded text-left"
                  }
                >
                  {expanded ? (
                    <>
                      {t("detail.hideDetails", locale)}
                      <ChevronUp size={16} aria-hidden />
                    </>
                  ) : (
                    <>
                      {t("detail.showDetails", locale)}
                      <ChevronDown size={16} aria-hidden />
                    </>
                  )}
                </button>

                {/* Expanded detail section */}
                <div id="bottomsheet-detail">
                  {expanded && (
                    <div className="flex flex-col gap-4 pt-1">
                      {/* Address — guard: never render "Address not in OpenStreetMap" placeholder */}
                      <div className="flex gap-2.5">
                        <MapPin size={16} className="text-[var(--color-ink-400)] shrink-0 mt-0.5" aria-hidden />
                        <div>
                          <p className="text-sm text-[var(--color-ink-700)]">
                            {venue.address === "Address not in OpenStreetMap"
                              ? `${venue.lat}, ${venue.lng}`
                              : venue.address}
                          </p>
                          {venue.distanceMiles !== undefined && (
                            <p className="text-sm text-[var(--color-ink-400)] font-mono mt-0.5">
                              {formatMiles(venue.distanceMiles)} {t("distance.fromYou", locale)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* SNAP/WIC detail badges */}
                      {(venue.accepts_snap || venue.accepts_wic) && (
                        <div className="flex flex-wrap gap-2">
                          {venue.accepts_snap && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-[var(--color-sage-100)] text-[var(--color-sage-700)]">
                              {t("detail.acceptsSnap", locale)}
                            </span>
                          )}
                          {venue.accepts_wic && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-[var(--color-sage-100)] text-[var(--color-sage-700)]">
                              {t("detail.acceptsWic", locale)}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Full weekly hours table — today highlighted + aria-current */}
                      {venue.hours_weekly && (
                        <section aria-label={t("detail.hours", locale)}>
                          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-2">
                            {t("detail.hours", locale)}
                          </h3>
                          <HoursList
                            hours_weekly={venue.hours_weekly}
                            compact={false}
                          />
                        </section>
                      )}

                      {/* Phone / Contact */}
                      {venue.phone && (
                        <section aria-label={t("detail.contact", locale)}>
                          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-2">
                            {t("detail.contact", locale)}
                          </h3>
                          <a
                            href={`tel:${venue.phone}`}
                            className="flex items-center gap-2.5 text-sm text-[var(--color-ink-700)] hover:text-[var(--color-sage-600)] transition-colors"
                          >
                            <Phone size={15} className="text-[var(--color-ink-400)]" aria-hidden />
                            {venue.phone}
                          </a>
                        </section>
                      )}

                      {/* See full details on Plentiful (#128) — Plentiful-sourced venues only */}
                      {/* safeUrl: venue.url comes from OSM (anyone can edit); reject non-http(s) */}
                      {venue.source.toLowerCase().includes("plentiful") && safeUrl(venue.url) && (
                        <a
                          href={safeUrl(venue.url)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={
                            "flex items-center justify-between gap-2 w-full px-4 py-3 " +
                            "rounded-[var(--radius-md)] border border-[var(--color-sage-300)] " +
                            "bg-[var(--color-sage-50)] text-sm font-medium text-[var(--color-sage-700)] " +
                            "hover:bg-[var(--color-sage-100)] transition-colors " +
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
                          }
                        >
                          <span>{t("detail.plentifulLink", locale)}</span>
                          <ExternalLink size={15} className="shrink-0" aria-hidden />
                        </a>
                      )}

                      {/* Report venue */}
                      <ReportVenueButton venueId={venue.id} locale={locale} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
