"use client";

/**
 * VenueCardBody — the place card's content for an ordinary venue (not a
 * blessing box; that is BoxCardBody), shared by both shells (#725):
 *   - variant "sheet": BottomSheet on a phone. Header row carries the close
 *     X; everything below Get directions sits in a detail section that is
 *     clipped to a short faded "peek" until the grab bar expands it (#666).
 *   - variant "panel": DesktopVenueWindow on a computer. Always shows the
 *     full details (#732, Kyle 2026-10-24: the old Show/Hide details toggle
 *     and its collapsed copy of the card are gone). Close lives in the
 *     panel's own header bar, so there is no X here.
 *
 * One block order for both. The size differences between the two (smaller
 * text and icons on desktop, compact hours table) are deliberate and kept as
 * per-variant classes; the phone card renders exactly as it did before.
 */

import { X, MapPin, Phone, Clock, CircleHelp, ExternalLink } from "lucide-react";
import type { Venue } from "@/types/venue";
import { categoryColors } from "@/lib/categories";
import { formatMiles } from "@/lib/distance";
import { computeVenueOpenStatus, nextIrregularOccurrence, formatIrregularOccurrence } from "@/lib/hours";
import { getDisplayNotes } from "@/lib/venueNotes";
import { PLACEHOLDER_ADDRESS } from "@/lib/venueSummary";
import { t, type Locale } from "@/lib/i18n";
import { safeUrl } from "@/lib/safeUrl";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";
import { track, EVENTS } from "@/lib/analytics";
import type { Walk } from "@/lib/useWalkingRoute";
import ReportVenueButton from "@/components/ReportVenueButton";
import FavoriteButton from "@/components/FavoriteButton";
import ShareButton from "@/components/ShareButton";
import HoursList from "@/components/HoursList";
import DirectionButtons from "@/components/DirectionButtons";
import EventHereLine, { type EventHere } from "@/components/EventHereLine";

/** The address to show for a venue: OSM's placeholder text is never shown, its coordinates are. */
export function displayAddress(venue: Venue): string {
  return venue.address === PLACEHOLDER_ADDRESS ? `${venue.lat}, ${venue.lng}` : venue.address;
}

interface VenueCardBodyProps {
  venue: Venue & { distanceMiles?: number };
  variant: "sheet" | "panel";
  locale: Locale;
  walk?: Walk;
  /** An upcoming/live event tied to this place (#759): one line that opens its card. */
  eventHere?: EventHere | null;
  /** "sheet" only: the X in the name row. */
  onClose?: () => void;
  /** "sheet" only: whether the detail section shows in full or as the clipped peek (#666). */
  expanded?: boolean;
  /** "sheet" only: tapping the clipped peek expands it — same action as the grab bar. */
  onRequestExpand?: () => void;
  /** "sheet" only: the detail section's id, for the grab bar's aria-controls. */
  detailSectionId?: string;
  /** "panel" only: the heading's id. DesktopSidePanel focuses it and the dialog's aria-labelledby points at it. */
  nameId?: string;
}

export default function VenueCardBody({
  venue,
  variant,
  locale,
  walk,
  eventHere = null,
  onClose,
  expanded = false,
  onRequestExpand,
  detailSectionId,
  nameId,
}: VenueCardBodyProps) {
  const sheet = variant === "sheet";
  // The panel never clips: on a computer the card always shows full details.
  const open = !sheet || expanded;
  const status = computeVenueOpenStatus(venue);
  const nextOccurrence = venue.hours_irregular ? nextIrregularOccurrence(venue.hours_irregular) : null;
  const displayNotes = getDisplayNotes(venue);
  const iconSm = sheet ? 14 : 12;
  const sectionHeading =
    (sheet ? "text-[11px]" : "text-[10px]") +
    " font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-2";

  const details = (
    <>
      {/* Address — never the OSM placeholder text */}
      <div className={sheet ? "flex gap-2.5" : "flex gap-2"}>
        <MapPin size={sheet ? 16 : 14} className="text-[var(--color-ink-400)] shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="text-sm text-[var(--color-ink-700)]">{displayAddress(venue)}</p>
          {venue.distanceMiles !== undefined && (
            <p className={`${sheet ? "text-sm" : "text-xs"} text-[var(--color-ink-400)] font-mono mt-0.5`}>
              {formatMiles(venue.distanceMiles)} {t("distance.fromYou", locale)}
            </p>
          )}
        </div>
      </div>

      {/* SNAP/WIC detail badges */}
      {(venue.accepts_snap || venue.accepts_wic) && (
        <div className="flex flex-wrap gap-2">
          {venue.accepts_snap && (
            <span className={`inline-flex items-center ${sheet ? "px-2.5 py-1 rounded-md text-sm" : "px-2 py-0.5 rounded text-xs"} font-medium bg-[var(--color-sage-100)] text-[var(--color-sage-700)]`}>
              {t("detail.acceptsSnap", locale)}
            </span>
          )}
          {venue.accepts_wic && (
            <span className={`inline-flex items-center ${sheet ? "px-2.5 py-1 rounded-md text-sm" : "px-2 py-0.5 rounded text-xs"} font-medium bg-[var(--color-sage-100)] text-[var(--color-sage-700)]`}>
              {t("detail.acceptsWic", locale)}
            </span>
          )}
        </div>
      )}

      {/* Full weekly + monthly hours (#400) — today highlighted + aria-current */}
      {(venue.hours_weekly || venue.hours_irregular) && (
        <section aria-label={t("detail.hours", locale)}>
          <h3 className={sectionHeading}>{t("detail.hours", locale)}</h3>
          <HoursList hours_weekly={venue.hours_weekly} hours_irregular={venue.hours_irregular} compact={!sheet} />
        </section>
      )}

      {/* Phone / Contact */}
      {venue.phone && (
        <section aria-label={t("detail.contact", locale)}>
          <h3 className={sectionHeading}>{t("detail.contact", locale)}</h3>
          <a
            href={`tel:${venue.phone}`}
            onClick={() => void track(EVENTS.CALL_CLICKED, { venueId: venue.id })}
            // before:* — 2px overlay up/down takes the 44px link to 48 (#233).
            className="relative before:absolute before:inset-x-0 before:-inset-y-0.5 inline-flex items-center gap-2.5 min-h-11 text-sm font-semibold text-[var(--color-sage-700)] underline underline-offset-2 hover:text-[var(--color-sage-600)] transition-colors"
          >
            <Phone size={sheet ? 15 : 13} className="text-[var(--color-sage-600)]" aria-hidden />
            {venue.phone}
          </a>
        </section>
      )}

      {/* See full details on Plentiful (#128) — Plentiful-sourced venues only.
          safeUrl: venue.url comes from OSM (anyone can edit); reject non-http(s). */}
      {venue.source.toLowerCase().includes("plentiful") && safeUrl(venue.url) && (
        <a
          href={safeUrl(venue.url)!}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => void track(EVENTS.WEBSITE_CLICKED, { venueId: venue.id })}
          className={
            // min-h-12: one line of text + py-3 is 46px on wide phones; the floor is 48 (#659).
            "flex items-center justify-between gap-2 w-full min-h-12 " +
            (sheet ? "px-4 py-3 " : "px-3 py-2.5 ") +
            // #534: sage-500 is DESIGN.md's documented border for this chip shape.
            "rounded-[var(--radius-md)] border border-[var(--color-sage-500)] " +
            "bg-[var(--color-sage-50)] text-sm font-medium text-[var(--color-sage-700)] " +
            "hover:bg-[var(--color-sage-100)] transition-colors " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
          }
        >
          <span>{t("detail.plentifulLink", locale)}</span>
          <ExternalLink size={sheet ? 15 : 14} className="shrink-0" aria-hidden />
        </a>
      )}

      <ReportVenueButton venueId={venue.id} locale={locale} />
    </>
  );

  return (
    <div className={sheet ? "flex flex-col px-5 pt-5 pb-[max(1rem,env(safe-area-inset-bottom))] gap-3" : "flex flex-col p-4 gap-3"}>
      {/* Name row: title, Share, Save (+ close on a phone). gap-4: Share/Save
          (-m-1) and × (-ml-1) each give back 4px of it, leaving 8px between
          their 48px hit areas (#233). */}
      <div className="flex items-start gap-4">
        <h2
          id={nameId}
          // The panel's heading is focused directly by DesktopSidePanel (#682
          // 8b), so it needs tabIndex={-1} without joining the Tab order.
          tabIndex={nameId ? -1 : undefined}
          className="flex-1 text-xl font-normal text-[var(--color-ink-900)] leading-tight outline-none"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {venue.name}
        </h2>
        <ShareButton venueId={venue.id} venueName={venue.name} locale={locale} size={sheet ? 20 : 18} />
        <FavoriteButton venueId={venue.id} venueName={venue.name} locale={locale} size={sheet ? 20 : 18} />
        {sheet && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("detail.close", locale)}
            className={
              "flex items-center justify-center w-12 h-12 " +
              "-mt-2 -mb-2 -ml-1 -mr-3 rounded-md " +
              "text-[var(--color-ink-500)] hover:bg-[var(--color-bone-100)] transition-colors " +
              PRESS_FEEDBACK + " " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
            }
          >
            <X size={18} aria-hidden />
          </button>
        )}
      </div>

      {eventHere && <EventHereLine {...eventHere} />}

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
          className={`inline-flex items-center gap-1.5 ${sheet ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs"} rounded-full font-medium text-[var(--color-bone-50)]`}
          style={{ backgroundColor: categoryColors[venue.category] }}
        >
          <span className={`${sheet ? "w-2 h-2" : "w-1.5 h-1.5"} rounded-full bg-white/40 shrink-0`} aria-hidden />
          {t(`category.full.${venue.category}`, locale)}
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
      <div className={`flex ${sheet ? "items-center gap-4 text-sm" : "flex-wrap items-center gap-3 text-xs"} text-[var(--color-ink-500)]`}>
        {venue.distanceMiles !== undefined && (
          <span className={`flex items-center ${sheet ? "gap-1.5" : "gap-1"}`}>
            <MapPin size={iconSm} aria-hidden className="text-[var(--color-ink-400)]" />
            {formatMiles(venue.distanceMiles)} {t("distance.fromYou", locale)}
          </span>
        )}
        {status && status.state !== "no_hours" && (
          <span className={`flex items-center ${sheet ? "gap-1.5" : "gap-1"}`}>
            <Clock size={iconSm} aria-hidden className="text-[var(--color-ink-400)]" />
            {status.state === "open"
              ? `${t("badge.openNow", locale)} · ${t("badge.closesAt", locale, { time: status.time })}`
              : status.state === "opens_at"
              ? t("badge.opensAt", locale, { time: status.time })
              : t("badge.closedToday", locale)}
          </span>
        )}
        {/* Board review finding #1: a "no_hours" venue survives the "Open now"
            filter — this label says why there's no open/closed read, with a
            different icon (not Clock) so it's never mistaken for "open". */}
        {status && status.state === "no_hours" && (
          <span className={`flex items-center ${sheet ? "gap-1.5" : "gap-1"} text-[var(--color-ink-700)] font-medium`}>
            <CircleHelp size={iconSm} aria-hidden className="text-[var(--color-ink-700)]" />
            {t("badge.hoursUnknown", locale)}
          </span>
        )}
      </div>
      {/* #400: monthly-schedule next-occurrence — see VenueCard's own comment. */}
      {nextOccurrence && (
        <p className={`${sheet ? "text-sm" : "text-xs"} text-[var(--color-ink-500)]`}>
          {t("hours.irregular.next", locale, { when: formatIrregularOccurrence(nextOccurrence, locale) })}
        </p>
      )}

      {/* Notes — suppressed for OSM artifacts and Plentiful's auto-generated
          boilerplate (src/lib/venueNotes.ts). Two lines on a phone; in full
          on a computer, which has the room. */}
      {displayNotes && (
        <p className={`text-sm text-[var(--color-ink-700)] leading-relaxed${sheet ? " line-clamp-2" : ""}`}>
          {displayNotes}
        </p>
      )}

      {/* Direction buttons (#134) — Walk (in-app route) / Bus / Drive. */}
      <DirectionButtons
        venue={venue}
        onWalk={walk?.onWalk ?? (() => {})}
        locale={locale}
        isRouteActive={walk?.isActive ?? false}
        onClearRoute={walk?.onClear}
        routeInfo={walk?.info}
        walkSteps={walk?.steps}
        showLocationHint={walk?.showLocationHint}
        activeStepIndex={walk?.activeStepIndex}
        onStepChange={walk?.onStepChange}
      />

      {/* Detail section. Phone (#666): always mounted, clipped to a short
          peek with a bottom fade until expanded; tapping the peek expands it.
          `data-vaul-no-drag` is deliberately NOT set, so a drag started on the
          peek still reaches vaul's swipe-down-to-close. */}
      <div
        id={detailSectionId}
        onClick={open ? undefined : onRequestExpand}
        className={"relative flex flex-col gap-4 pt-1 " + (open ? "" : "max-h-16 overflow-hidden cursor-pointer")}
      >
        {/* `inert` while clipped (#683 review): hides the clipped controls
            from Tab and screen readers, and lets a tap fall through to the
            wrapper's expand handler. `contents` keeps the children as the
            wrapper's flex items. */}
        <div className="contents" inert={!open}>
          {details}
        </div>
        {!open && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-b from-transparent to-[var(--color-bone-50)]"
          />
        )}
      </div>
    </div>
  );
}
