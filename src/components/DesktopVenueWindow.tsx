"use client";

/**
 * DesktopVenueWindow — the venue/box card content for desktop (≥768px).
 *
 * Two states, same component:
 *   collapsed: persistent header bar, then body with name, category
 *              badge, SNAP/WIC pills, distance, hours-today, notes (2 lines).
 *   expanded:  persistent header bar, then scrollable body with full
 *              venue detail, hours table (today highlighted), address,
 *              Get directions, phone, SNAP/WIC, notes.
 *
 * Persistent header bar (issue #64):
 *   - Always visible, same height (~44px), same background in both states.
 *   - Left: "Show details" / "Hide details" toggle (replaces chevron + text-link) —
 *     for a blessing box (no collapsed state, see the box-body section below)
 *     this slot is a "History" link to /box/<id>/history instead (2026-09-18).
 *   - Right: X-close (clears selectedVenueId).
 *   - Tab order: X-close → Show/Hide details (or History) → body content.
 *   - Venue title lives in the body, same layout container in both states
 *     (no title jump between states).
 *
 * Positioning (#682): this component used to anchor itself beside the
 * clicked marker (hand-rolled edge-flip math off `map.project()`) — that's
 * what let it land under the search bar or bottom bar whenever a pin was
 * near an edge. It now renders as plain flex content INSIDE
 * `DesktopSidePanel`, which owns the fixed position/size/chrome; the
 * selected pin is kept clear of the panel by MapWrapper panning the map
 * instead (see MapWrapper's pan-on-select effect). No `mapboxMap` prop, no
 * position state, no edge-flip — one fixed layout regardless of where the
 * marker sits. `expanded` still swaps the BODY content (see the two states
 * above); it no longer changes the component's own width/height, since the
 * panel's size is fixed by the shell.
 *
 * Keyboard:
 *   Escape dismisses. Tab cycles within. Close X (Escape equivalent).
 */

import { useCallback, useEffect, useRef } from "react";
import { MapPin, Phone, Clock, CircleHelp, ExternalLink } from "lucide-react";
import FavoriteButton from "@/components/FavoriteButton";
import ShareButton from "@/components/ShareButton";
import { safeUrl } from "@/lib/safeUrl";
import { track, EVENTS } from "@/lib/analytics";
import DirectionButtons, { type RouteInfo, type WalkStep } from "@/components/DirectionButtons";
import type { Venue } from "@/types/venue";
import { categoryColors } from "@/data/venues";
import { formatMiles } from "@/lib/distance";
import { computeVenueOpenStatus, nextIrregularOccurrence, formatIrregularOccurrence } from "@/lib/hours";
import { getDisplayNotes } from "@/lib/venueNotes";
import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import VenuePopupHeader from "@/components/VenuePopupHeader";
import ReportVenueButton from "@/components/ReportVenueButton";
import HoursList from "@/components/HoursList";
import BoxCardBody from "@/components/BoxCardBody";
import { isNativeDialogOpen } from "@/lib/dialogGuard";
import { useOverlayEscape } from "@/lib/overlayRegistry";
import type { BoxStatus, CheckinKind, PublicBlessingBox } from "@/lib/blessingBoxes";

// ─── Props ───────────────────────────────────────────────────────────────────

interface DesktopVenueWindowProps {
  venue: Venue & { distanceMiles?: number };
  /**
   * Full blessing-box record when `venue.category === "blessing_box"` — see
   * BottomSheet's identical prop for the full rationale (`venue` only ever
   * carries plain-Venue fields). `null`/`undefined` while MapWrapper's box
   * fetch hasn't resolved yet — the box collapsed/expanded bodies show a
   * loading line until it has.
   */
  box?: PublicBlessingBox | null;
  /** Forwarded to BoxCardBody's check-in panel — see BottomSheet's identical prop. */
  onCheckinSuccess?: (result: { status: BoxStatus; lastFilledAt: string | null; kind: CheckinKind }) => void;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onClose: () => void;
  /** Locale forwarded from MapWrapper. Defaults to "en". */
  locale?: Locale;
  /** Called when the user taps the Walk direction button. MapWrapper fetches the route. */
  onWalkRoute?: (venue: Venue) => void;
  /** True when a walking route for this venue is currently drawn on the map. */
  isWalkRouteActive?: boolean;
  /** Called when the user taps Walk while a route is active (clears it). */
  onClearWalkRoute?: () => void;
  /** Walking route distance + duration for the in-card readout (threaded from MapWrapper). */
  walkRouteInfo?: RouteInfo | null;
  /** Turn-by-turn steps from Mapbox (pre-localized). Shown as a collapsible list in DirectionButtons. */
  walkRouteSteps?: WalkStep[] | null;
  /**
   * True when this venue's Walk tap requested geolocation and it was denied
   * or is unavailable (#207). Tells DirectionButtons to show the localized
   * "share your location" hint instead of silently doing nothing.
   */
  showWalkLocationHint?: boolean;
  /** Which turn the step-through stepper is showing (#555) — same as BottomSheet's identical prop, MapWrapper-owned so desktop and mobile agree with the map's camera focus. */
  activeStepIndex?: number;
  /** Moves the stepper to a different turn (#555) — Back/Next or an "All turns" row tap. */
  onStepChange?: (index: number) => void;
}

// ─── DesktopVenueWindow ───────────────────────────────────────────────────────

export default function DesktopVenueWindow({
  venue,
  box,
  onCheckinSuccess,
  expanded,
  onExpand,
  onCollapse,
  onClose,
  locale: localeProp,
  onWalkRoute,
  isWalkRouteActive = false,
  onClearWalkRoute,
  walkRouteInfo,
  walkRouteSteps,
  showWalkLocationHint = false,
  activeStepIndex = 0,
  onStepChange = () => {},
}: DesktopVenueWindowProps) {
  const { locale: ctxLocale } = useLocale();
  const locale = localeProp ?? ctxLocale;
  const windowRef = useRef<HTMLDivElement>(null);

  const isBox = venue.category === "blessing_box";

  const status = computeVenueOpenStatus(venue);
  const nextOccurrence = venue.hours_irregular ? nextIrregularOccurrence(venue.hours_irregular) : null;
  const displayNotes = getDisplayNotes(venue);

  // ── Keyboard handling ────────────────────────────────────────────────────

  // #527: this window is mounted only while a venue is selected — i.e.
  // always "open" for the life of the instance — so it registers into the
  // shared overlay-escape stack unconditionally (`true`). `useOverlayEscape`
  // only invokes the callback below while this window is the TOPMOST
  // overlay, so pressing Escape with e.g. the Filters panel or the Menu open
  // on top of a selected venue no longer also closes this window — see
  // overlayRegistry.ts's own header.
  const handleEscape = useCallback(() => {
    // #508 fix pass: Escape while a box's PhotoViewer is open must close
    // ONLY the photo, not this whole window — see dialogGuard.ts's own
    // header. This handler used to be a plain bubble-phase document
    // listener (no `{capture: true}`), so unlike the vaul/Radix case (see
    // BottomSheet.tsx's own comment) checking the guard directly here is
    // enough; there is no ordering race to work around. `useOverlayEscape`
    // preserves that same bubble-phase dispatch.
    if (isNativeDialogOpen()) return;
    // A box's check-in panel (BoxCardBody -> BoxCheckinPanel) has a note
    // textarea living inside this window. Without this guard, Escape while
    // typing a note both loses focus AND closes the whole card — the
    // browser's own "Escape clears an input" behavior competing with this
    // window's own Escape-to-dismiss. Only global-dismiss when focus is on
    // the window shell itself, not on a form control inside it.
    const active = document.activeElement;
    const typing = active instanceof HTMLElement && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");
    if (typing && windowRef.current?.contains(active)) return;
    onClose();
  }, [onClose]);
  useOverlayEscape(true, handleEscape);

  // Focus the window when it mounts so keyboard users can tab inside
  useEffect(() => {
    windowRef.current?.focus();
  }, [venue.id]);

  // ── Shared body top: name + operator ─────────────────────────────────────
  // Venue title is always at the top of the body, same layout in both states.
  // This prevents any visual position jump when toggling collapsed ↔ expanded.

  const venueNameBlock = (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h2
          className={
            (expanded ? "text-xl" : "text-lg") +
            " font-normal text-[var(--color-ink-900)] leading-tight" +
            (expanded ? " mb-1" : "")
          }
          style={{ fontFamily: "var(--font-display)" }}
          id={`venue-window-title-${venue.id}`}
        >
          {venue.name}
        </h2>
        {venue.operator && (
          <p className={`text-xs text-[var(--color-ink-500)]${expanded ? " mb-2" : ""}`}>
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
      </div>
      {/* gap-4: Share/Save are 48px boxes with -m-1, so this leaves 8px
          between their hit areas (#233). */}
      <div className="flex items-center gap-4 shrink-0">
        <ShareButton venueId={venue.id} venueName={venue.name} locale={locale} size={18} isBox={isBox} />
        <FavoriteButton venueId={venue.id} venueName={venue.name} locale={locale} size={18} />
      </div>
    </div>
  );

  // ── Collapsed body content ────────────────────────────────────────────────

  const collapsedBody = (
    <div className="flex flex-col p-4 gap-3">
      {venueNameBlock}

      {/* Category + SNAP/WIC */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-[var(--color-bone-50)]"
          style={{ backgroundColor: categoryColors[venue.category] }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" aria-hidden />
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
      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-ink-500)]">
        {venue.distanceMiles !== undefined && (
          <span className="flex items-center gap-1">
            <MapPin size={12} aria-hidden className="text-[var(--color-ink-400)]" />
            {formatMiles(venue.distanceMiles)} {t("distance.fromYou", locale)}
          </span>
        )}
        {status && status.state !== "no_hours" && (
          <span className="flex items-center gap-1">
            <Clock size={12} aria-hidden className="text-[var(--color-ink-400)]" />
            {status.state === "open"
              ? `${t("badge.openNow", locale)} · ${t("badge.closesAt", locale, { time: status.time })}`
              : status.state === "opens_at"
              ? t("badge.opensAt", locale, { time: status.time })
              : t("badge.closedToday", locale)}
          </span>
        )}
        {/* Board review finding #1: a "no_hours" venue now survives the
            "Open now" filter instead of vanishing — this label is what tells
            the user why there's no open/closed read, using a different icon
            (not Clock) + explicit text so it's never mistaken for "open" by
            shape alone, not just color. */}
        {status && status.state === "no_hours" && (
          <span className="flex items-center gap-1 text-[var(--color-ink-700)] font-medium">
            <CircleHelp size={12} aria-hidden className="text-[var(--color-ink-700)]" />
            {t("badge.hoursUnknown", locale)}
          </span>
        )}
      </div>
      {/* #400: monthly-schedule next-occurrence — see VenueCard's own comment. */}
      {nextOccurrence && (
        <p className="text-xs text-[var(--color-ink-500)]">
          {t("hours.irregular.next", locale, { when: formatIrregularOccurrence(nextOccurrence, locale) })}
        </p>
      )}

      {/* Notes (2 lines max) — suppressed for OSM artifacts and Plentiful's
          auto-generated boilerplate (src/lib/venueNotes.ts) */}
      {displayNotes && (
        <p className="text-xs text-[var(--color-ink-700)] leading-relaxed line-clamp-2">
          {displayNotes}
        </p>
      )}

      {/* Direction buttons (#134) — Walk (in-app route) / Bus / Drive.
          routeInfo threads distance+duration for the in-card readout.
          walkSteps provides the collapsible turn-by-turn list. */}
      <DirectionButtons
        venue={venue}
        onWalk={onWalkRoute ?? (() => {})}
        locale={locale}
        isRouteActive={isWalkRouteActive}
        onClearRoute={onClearWalkRoute}
        routeInfo={isWalkRouteActive ? walkRouteInfo : null}
        walkSteps={isWalkRouteActive ? walkRouteSteps : null}
        showLocationHint={showWalkLocationHint}
        activeStepIndex={activeStepIndex}
        onStepChange={onStepChange}
      />
    </div>
  );

  // ── Expanded body content ─────────────────────────────────────────────────

  const expandedBody = (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {venueNameBlock}

      {/* Category badge */}
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-[var(--color-bone-50)]"
        style={{ backgroundColor: categoryColors[venue.category] }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" aria-hidden />
        {t(`category.full.${venue.category}`, locale)}
      </span>

      {/* Address — guard: never render "Address not in OpenStreetMap" placeholder */}
      <div className="flex gap-2">
        <MapPin size={14} className="text-[var(--color-ink-400)] shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="text-sm text-[var(--color-ink-700)]">
            {venue.address === "Address not in OpenStreetMap"
              ? `${venue.lat}, ${venue.lng}`
              : venue.address}
          </p>
          {venue.distanceMiles !== undefined && (
            <p className="text-xs text-[var(--color-ink-400)] font-mono mt-0.5">
              {formatMiles(venue.distanceMiles)} {t("distance.fromYou", locale)}
            </p>
          )}
        </div>
      </div>

      {/* Direction buttons (#134) — Walk (in-app route) / Bus / Drive.
          routeInfo threads distance+duration for the in-card readout.
          walkSteps provides the collapsible turn-by-turn list. */}
      <DirectionButtons
        venue={venue}
        onWalk={onWalkRoute ?? (() => {})}
        locale={locale}
        isRouteActive={isWalkRouteActive}
        onClearRoute={onClearWalkRoute}
        routeInfo={isWalkRouteActive ? walkRouteInfo : null}
        walkSteps={isWalkRouteActive ? walkRouteSteps : null}
        showLocationHint={showWalkLocationHint}
        activeStepIndex={activeStepIndex}
        onStepChange={onStepChange}
      />

      {/* Report an issue — secondary action (#70) */}
      <ReportVenueButton venueId={venue.id} locale={locale} />

      {/* SNAP/WIC */}
      {(venue.accepts_snap || venue.accepts_wic) && (
        <div className="flex flex-wrap gap-2">
          {venue.accepts_snap && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-sage-100)] text-[var(--color-sage-700)]">
              {t("detail.acceptsSnap", locale)}
            </span>
          )}
          {venue.accepts_wic && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-sage-100)] text-[var(--color-sage-700)]">
              {t("detail.acceptsWic", locale)}
            </span>
          )}
        </div>
      )}

      {/* Hours table (weekly + monthly, #400) */}
      {(venue.hours_weekly || venue.hours_irregular) && (
        <section aria-label={t("detail.hours", locale)}>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-2">
            {t("detail.hours", locale)}
          </h3>
          <HoursList
            hours_weekly={venue.hours_weekly}
            hours_irregular={venue.hours_irregular}
            compact={true}
          />
        </section>
      )}

      {/* Phone */}
      {venue.phone && (
        <section aria-label={t("detail.contact", locale)}>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-2">
            {t("detail.contact", locale)}
          </h3>
          <a
            href={`tel:${venue.phone}`}
            onClick={() => void track(EVENTS.CALL_CLICKED, { venueId: venue.id })}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-sage-700)] underline underline-offset-2 hover:text-[var(--color-sage-600)] transition-colors"
          >
            <Phone size={13} className="text-[var(--color-sage-600)]" aria-hidden />
            {venue.phone}
          </a>
        </section>
      )}

      {/* Notes — suppressed for OSM artifacts and Plentiful's auto-generated
          boilerplate (src/lib/venueNotes.ts) */}
      {displayNotes && (
        <section aria-label={t("detail.about", locale)}>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-2">
            {t("detail.about", locale)}
          </h3>
          <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
            {displayNotes}
          </p>
        </section>
      )}

      {/* See full details on Plentiful (#128) — Plentiful-sourced venues only */}
      {/* safeUrl: venue.url comes from OSM (anyone can edit); reject non-http(s) */}
      {venue.source.toLowerCase().includes("plentiful") && safeUrl(venue.url) && (
        <a
          href={safeUrl(venue.url)!}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => void track(EVENTS.WEBSITE_CLICKED, { venueId: venue.id })}
          className={
            "flex items-center justify-between gap-2 w-full px-3 py-2.5 " +
            // #534: --color-sage-300 undefined — sage-500 is DESIGN.md's
            // own documented border for this chip shape (see BottomSheet's
            // identical Plentiful-link fix).
            "rounded-[var(--radius-md)] border border-[var(--color-sage-500)] " +
            "bg-[var(--color-sage-50)] text-sm font-medium text-[var(--color-sage-700)] " +
            "hover:bg-[var(--color-sage-100)] transition-colors " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
          }
        >
          <span>{t("detail.plentifulLink", locale)}</span>
          <ExternalLink size={14} className="shrink-0" aria-hidden />
        </a>
      )}
    </div>
  );

  // ── Blessing-box body ─────────────────────────────────────────────────────
  // Card redesign (2026-09-19): BoxCardBody now owns the WHOLE box card —
  // photo, sponsor band, badge, name, address-as-directions-link/trigger,
  // most-needed, host note, check-in panel, footer — so this branch no
  // longer renders venueNameBlock, the category badge, or the three-button
  // DirectionButtons row itself (all now inside BoxCardBody, and the walk
  // restore pass the same day gives the box its own in-app Walk trigger —
  // the address — without bringing that row back; see BoxCardBody's own
  // header). Share/Favorite are handed in via its `actions` slot instead,
  // same visual weight/position the shared venueNameBlock used to give
  // them. Walk props (onWalkRoute etc.) are forwarded straight through from
  // this component's own identically-named props — MapWrapper already
  // passes them here unconditionally (same handleWalkRoute every ordinary
  // venue's DirectionButtons uses below), so wiring is a pure pass-through:
  // `onWalkRoute ? () => onWalkRoute(box) : undefined` binds the box (a
  // PublicBlessingBox, itself a Venue) as the callback's target. No History
  // link here: the header renders it instead (see VenuePopupHeader's own
  // header for why), so `showHistoryLink={false}`. `photoRadiusClassName` is
  // left at its
  // default "" — the box's photo sits below the persistent header bar, not
  // flush against the window's own top corners, so there's no radius to
  // put on it; the outer window's existing `overflow-hidden` still clips
  // anything that runs past its rounded-lg edge regardless. `nameId` (fix
  // pass, 2026-09-19, BLOCKER) wires this window's own `aria-labelledby`
  // (below) to the name heading BoxCardBody now renders — before the card
  // redesign consolidated ownership, that id lived on venueNameBlock's own
  // heading; since a box branch never renders venueNameBlock, the dialog's
  // accessible name was dangling (pointing at no element) for every box
  // until this was wired through.
  //
  // ONE tree, always the scrollable/expanded-style wrapper (fix, 2026-09-18 —
  // Kyle: "When I click show details, nothing shows up"): a box has no
  // collapsed state anymore, so unlike collapsedBody/expandedBody above
  // (a genuine ternary-swapped pair for ordinary venues, whose content really
  // does differ per state) this is one element at a stable tree position,
  // independent of `expanded` — BoxCardBody (and its child BoxCheckinPanel,
  // which holds in-progress note-form state) never remounts.
  const boxBody = (
    <div className="flex-1 overflow-y-auto">
      {box ? (
        <BoxCardBody
          box={box}
          onCheckinSuccess={onCheckinSuccess}
          showHistoryLink={false}
          nameId={`venue-window-title-${venue.id}`}
          onWalkRoute={onWalkRoute ? () => onWalkRoute(box) : undefined}
          isWalkRouteActive={isWalkRouteActive}
          onClearWalkRoute={onClearWalkRoute}
          walkRouteInfo={isWalkRouteActive ? walkRouteInfo : null}
          walkRouteSteps={isWalkRouteActive ? walkRouteSteps : null}
          showWalkLocationHint={showWalkLocationHint}
          activeStepIndex={activeStepIndex}
          onStepChange={onStepChange}
          actions={
            <>
              <ShareButton venueId={venue.id} venueName={venue.name} locale={locale} size={18} isBox />
              <FavoriteButton venueId={venue.id} venueName={venue.name} locale={locale} size={18} />
            </>
          }
        />
      ) : (
        <p className="px-4 py-4 text-sm text-[var(--color-ink-500)]">{t("box.cardLoading", locale)}</p>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={windowRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={`venue-window-title-${venue.id}`}
      tabIndex={-1}
      // #682: fills DesktopSidePanel's fixed-size shell — no left/top/width
      // of its own anymore (see this file's header for why).
      className="flex flex-col h-full overflow-hidden focus:outline-none"
    >
      {/* Persistent header bar — always visible in both states. A box has no
          Show/Hide toggle (historyHref swaps that slot for a History link —
          see VenuePopupHeader's own header); expanded/onToggle are unused
          in that branch but still passed since the prop is shared with the
          ordinary-venue case. */}
      <VenuePopupHeader
        venueId={venue.id}
        expanded={expanded}
        onToggle={expanded ? onCollapse : onExpand}
        onClose={onClose}
        locale={locale}
        historyHref={isBox ? `/box/${encodeURIComponent(venue.id)}/history` : undefined}
      />

      {/* Body — collapsed or expanded. id wired to toggle's aria-controls.
          Box branch stays at a stable top-level position, always the
          scrollable-content wrapper (see boxBody's own header) so
          BoxCardBody never remounts; ordinary venues keep the real ternary
          swap since their collapsed/expanded content genuinely differs. */}
      {isBox ? (
        <div id={`venue-popup-body-${venue.id}`} className="flex flex-col flex-1 overflow-hidden">
          {boxBody}
        </div>
      ) : expanded ? (
        <div
          id={`venue-popup-body-${venue.id}`}
          className="flex flex-col flex-1 overflow-hidden"
        >
          {expandedBody}
        </div>
      ) : (
        <div id={`venue-popup-body-${venue.id}`}>{collapsedBody}</div>
      )}
    </div>
  );
}
