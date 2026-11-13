"use client";

/**
 * VenueCardBody — the place card's content for an ordinary venue (not a
 * blessing box; that is BoxCardBody), shared by both shells (#725):
 *   - variant "sheet": BottomSheet on a phone. The card starts with the
 *     action row (VenueActionRow, #917), which also carries the keyboard-only
 *     close X; everything below Get directions sits in a detail section that
 *     peeks at the screen edge until the grab bar expands it (#666).
 *   - variant "panel": DesktopVenueWindow on a computer. Always shows the
 *     full details (#732, Kyle 2026-10-24: the old Show/Hide details toggle
 *     and its collapsed copy of the card are gone). The action row and its ×
 *     live in the panel's pinned top (DesktopVenueWindow), so the card
 *     starts at the name.
 *
 * One block order for both. The size differences between the two (smaller
 * text and icons on desktop, compact hours table) are deliberate and kept as
 * per-variant classes; the phone card renders exactly as it did before.
 */

import { X, MapPin, Clock, CircleHelp, ExternalLink } from "lucide-react";
import type { Venue } from "@/types/venue";
import { formatMiles } from "@/lib/distance";
import { computeVenueOpenStatus, nextIrregularOccurrence, formatIrregularOccurrence } from "@/lib/hours";
import { getDisplayNotes } from "@/lib/venueNotes";
import { displayAddress } from "@/lib/venueSummary";
import { t, type Locale } from "@/lib/i18n";
import { safeUrl } from "@/lib/safeUrl";
import { HIDDEN_UNTIL_FOCUS, PRESS_FEEDBACK } from "@/lib/interactionStyles";
import { track, EVENTS } from "@/lib/analytics";
import type { Walk } from "@/lib/useWalkingRoute";
import ReportVenueButton from "@/components/ReportVenueButton";
import VenueActionRow from "@/components/VenueActionRow";
import HoursList from "@/components/HoursList";
import DirectionButtons from "@/components/DirectionButtons";
import EventHereLine, { type EventHere } from "@/components/EventHereLine";
import CategoryLabel from "@/components/CategoryLabel";

interface VenueCardBodyProps {
  venue: Venue & { distanceMiles?: number };
  variant: "sheet" | "panel";
  locale: Locale;
  walk?: Walk;
  /** An upcoming/live event tied to this place (#759): one line that opens its card. */
  eventHere?: EventHere | null;
  /** "sheet" only: the keyboard-only close X at the end of the action row. */
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

      {/* See full details on Plentiful (#128) — Plentiful-sourced venues only.
          safeUrl: venue.url comes from OSM (anyone can edit); reject non-http(s). */}
      {venue.source.toLowerCase().includes("plentiful") && safeUrl(venue.url) && (
        <a
          href={safeUrl(venue.url)!}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => void track(EVENTS.WEBSITE_CLICKED, { venueId: venue.id, surface: "map" })}
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
    // Panel: no top padding, the pinned action row above it (DesktopVenueWindow) ends 12px above the name.
    <div className={sheet ? "flex flex-col px-5 pt-5 pb-[max(1rem,env(safe-area-inset-bottom))] gap-3" : "flex flex-col px-4 pb-4 gap-3"}>
      {/* Phone (#917, R4): the action row is the card's first line, 12px
          above the name, so the name runs the full width. It ends with a
          close button hidden until keyboard focus (#882), which takes no room. */}
      {sheet && (
        <VenueActionRow
          venue={venue}
          locale={locale}
          close={
            onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label={t("detail.close", locale)}
                className={
                  // #882: hidden on the phone (the sheet closes by swiping down), shown on keyboard focus.
                  HIDDEN_UNTIL_FOCUS + " flex items-center justify-center w-12 h-12 rounded-md " +
                  "text-[var(--color-ink-500)] hover:bg-[var(--color-sage-100)] transition-colors " +
                  PRESS_FEEDBACK + " " +
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
                }
              >
                <X size={18} aria-hidden />
              </button>
            )
          }
        />
      )}
      <h2
        id={nameId}
        // The panel's heading is focused directly by DesktopSidePanel (#682
        // 8b), so it needs tabIndex={-1} without joining the Tab order.
        tabIndex={nameId ? -1 : undefined}
        className="text-xl font-normal text-[var(--color-ink-900)] leading-tight outline-none"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {venue.name}
      </h2>

      {/* Category label (#917, R3): colored words on their own line under the name. */}
      <CategoryLabel
        category={venue.category}
        label={t(`category.full.${venue.category}`, locale)}
        benefits={[
          ...(venue.accepts_snap ? [t("badge.snap", locale)] : []),
          ...(venue.accepts_wic ? [t("badge.wic", locale)] : []),
        ]}
      />

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
          on a computer, which has the room. pointer-events-none with the clamp:
          on iOS Safari a flick that starts on clipped overflowing text never
          scrolls the sheet (see EventCardBody's About). */}
      {displayNotes && (
        <p className={`text-sm text-[var(--color-ink-700)] leading-relaxed${sheet ? " line-clamp-2 pointer-events-none" : ""}`}>
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

      {/* Detail section. Phone (#666): always mounted at full height. Since
          #882 the sheet itself slides (vaul snap points), so collapsed means
          this sits mostly below the screen edge with its top `data-peek-px`
          showing; tapping that peek expands. No clip or fade any more: the
          content must keep its real height for the sheet to measure. */}
      <div
        id={detailSectionId}
        data-peek-px="64"
        onClick={open ? undefined : onRequestExpand}
        className={"relative flex flex-col gap-4 pt-1 " + (open ? "" : "cursor-pointer")}
      >
        {/* `inert` while collapsed (#683 review): hides the half-shown
            controls from Tab and screen readers, and lets a tap fall through
            to the wrapper's expand handler. `contents` keeps the children as
            the wrapper's flex items. */}
        <div className="contents" inert={!open}>
          {details}
        </div>
      </div>
    </div>
  );
}
