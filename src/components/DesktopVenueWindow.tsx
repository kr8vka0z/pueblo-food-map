"use client";

/**
 * DesktopVenueWindow — marker-anchored floating panel for desktop (≥768px).
 *
 * Two states, same component:
 *   collapsed  (~360×auto): persistent header bar, then body with name, category
 *                           badge, SNAP/WIC pills, distance, hours-today, notes
 *                           (2 lines).
 *   expanded   (~420×720):  persistent header bar, then scrollable body with full
 *                           venue detail, hours table (today highlighted), address,
 *                           Get directions, phone, SNAP/WIC, notes.
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
 * Anchoring:
 *   Rendered OUTSIDE the Leaflet map container (sibling div, absolute over map).
 *   Position computed from marker screen coords via map.latLngToContainerPoint().
 *   Default: top-right of marker, 12px gap.
 *   Edge-flip math (hand-rolled — @floating-ui not in deps):
 *     - Clips right edge → top-left
 *     - Clips bottom edge → place above marker
 *     - Combined clip (right + above also clips top) → clamp vertically
 *   Recomputes on Leaflet 'move' + 'zoom' events.
 *
 * Keyboard:
 *   Escape dismisses. Tab cycles within. Close X (Escape equivalent).
 */

import { useEffect, useRef, useState } from "react";
import { MapPin, Phone, Clock, CircleHelp, ExternalLink } from "lucide-react";
import FavoriteButton from "@/components/FavoriteButton";
import ShareButton from "@/components/ShareButton";
import { safeUrl } from "@/lib/safeUrl";
import { BOTTOM_NAV_HEIGHT_PX } from "@/components/BottomNav";
import DirectionButtons, { type RouteInfo, type WalkStep } from "@/components/DirectionButtons";

/**
 * Minimal interface covering the mapboxgl.Map methods DesktopVenueWindow uses.
 * Wired in #47: onMapReady now delivers a mapboxgl.Map instance.
 *
 * Key difference from Leaflet:
 *   Leaflet:  latLngToContainerPoint([lat, lng]) → Point
 *   Mapbox:   project([lng, lat]) → Point  (lng/lat order reversed)
 */
interface MapboxMap {
  /** Convert [lng, lat] to container pixel coordinates. */
  project: (lnglat: [number, number]) => { x: number; y: number };
  getContainer: () => HTMLElement;
  on: (event: string, fn: () => void) => MapboxMap;
  off: (event: string, fn: () => void) => MapboxMap;
}
import type { Venue } from "@/types/venue";
import { categoryColors } from "@/data/venues";
import { formatMiles } from "@/lib/distance";
import { computeOpenStatus } from "@/lib/hours";
import { getDisplayNotes } from "@/lib/venueNotes";
import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import VenuePopupHeader from "@/components/VenuePopupHeader";
import ReportVenueButton from "@/components/ReportVenueButton";
import HoursList from "@/components/HoursList";
import BoxCardBody from "@/components/BoxCardBody";
import { isNativeDialogOpen } from "@/lib/dialogGuard";
import type { BoxStatus, CheckinKind, PublicBlessingBox } from "@/lib/blessingBoxes";

// ─── Constants ───────────────────────────────────────────────────────────────

const WINDOW_QUICK_W = 360;
const WINDOW_QUICK_H = 220;
const WINDOW_EXPANDED_W = 420;
const WINDOW_EXPANDED_H = 720;
const MARKER_GAP = 12; // px gap between marker tip and window edge

// ─── Edge-flip math ───────────────────────────────────────────────────────────

interface WindowPosition {
  left: number;
  top: number;
}

/**
 * Compute the absolute CSS position (relative to the map container) for the
 * floating window so that it:
 *  1. Appears top-right of the marker by default.
 *  2. Flips left if it would clip the right edge of the viewport.
 *  3. Places above the marker if it would clip the bottom edge.
 *  4. Clamps vertically if after flipping it would clip the top edge.
 *
 * @param markerX  marker screen X in the map container (px from left)
 * @param markerY  marker screen Y in the map container (px from top) — this is
 *                 the tip of the pin (iconAnchor bottom-center)
 * @param containerW  width of the map container (px)
 * @param containerH  height of the map container (px)
 * @param windowW  width of the floating window (px)
 * @param windowH  height of the floating window (px)
 */
function computeWindowPosition(
  markerX: number,
  markerY: number,
  containerW: number,
  containerH: number,
  windowW: number,
  windowH: number,
): WindowPosition {
  // Default: top-right of the marker tip
  let left = markerX + MARKER_GAP;
  let top = markerY - windowH;

  // Clip check — right edge
  if (left + windowW > containerW - MARKER_GAP) {
    // Flip to left side of marker
    left = markerX - windowW - MARKER_GAP;
  }

  // Clip check — left edge (after flip)
  if (left < MARKER_GAP) {
    left = MARKER_GAP;
  }

  // Clip check — bottom edge
  if (top + windowH > containerH - MARKER_GAP) {
    // Place above the marker
    top = markerY - windowH - MARKER_GAP;
  }

  // Clip check — top edge (after above-placement or tall window)
  if (top < MARKER_GAP) {
    top = MARKER_GAP;
  }

  return { left, top };
}

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
  /** mapboxgl.Map instance delivered by Map.tsx onLoad → onMapReady. */
  mapboxMap: MapboxMap | null;
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
  mapboxMap,
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
  const [position, setPosition] = useState<WindowPosition>({ left: 0, top: 0 });

  const isBox = venue.category === "blessing_box";
  // A box has no expand/collapse state (2026-09-18 — see boxBody's own
  // comment below) and always shows its full content, so it always sizes
  // like an ordinary venue's expanded window regardless of the `expanded`
  // prop (still meaningful for ordinary venues, which genuinely toggle).
  const windowW = expanded || isBox ? WINDOW_EXPANDED_W : WINDOW_QUICK_W;
  const windowH = expanded || isBox ? WINDOW_EXPANDED_H : WINDOW_QUICK_H;

  const status = computeOpenStatus(venue.hours_weekly);
  const displayNotes = getDisplayNotes(venue);

  // ── Position computation ─────────────────────────────────────────────────
  // Recomputes position on mount and whenever the map pans/zooms.
  // The initial compute is scheduled via queueMicrotask to satisfy the
  // react-hooks/set-state-in-effect rule (setState must not be called
  // synchronously at the top level of an effect body).

  useEffect(() => {
    if (!mapboxMap) return;

    function computeAndSet() {
      if (!mapboxMap) return;
      // Mapbox project takes [lng, lat] (opposite of Leaflet's [lat, lng])
      const pt = mapboxMap.project([venue.lng, venue.lat]);
      const container = mapboxMap.getContainer();
      // Use the card's actual rendered size so anchoring tracks the
      // content-hugged height (#121); fall back to design constants pre-layout.
      const el = windowRef.current;
      // Subtract the bottom nav's footprint so the window's bottom-edge clip
      // check (review item 7a) treats that space as already occupied — the
      // nav sits ABOVE the map's own bottom edge at every breakpoint this
      // component renders at (desktop, >=768px), and BOTTOM_NAV_HEIGHT_PX
      // (76) happens to equal both shapes it takes there: below 2xl it's the
      // bar itself; at 2xl+ it's the floating pill's 24px offset + 52px
      // height. Without this, a window anchored near the bottom of a short
      // viewport could render partly behind the nav.
      const clippedContainerH = container.offsetHeight - BOTTOM_NAV_HEIGHT_PX;
      const pos = computeWindowPosition(
        pt.x,
        pt.y,
        container.offsetWidth,
        clippedContainerH,
        el?.offsetWidth || windowW,
        el?.offsetHeight || windowH,
      );
      setPosition(pos);
    }

    // Initial position — deferred one microtask to avoid synchronous
    // setState-in-effect lint violation.
    queueMicrotask(computeAndSet);

    mapboxMap.on("move", computeAndSet);
    mapboxMap.on("zoom", computeAndSet);
    return () => {
      mapboxMap.off("move", computeAndSet);
      mapboxMap.off("zoom", computeAndSet);
    };
  }, [mapboxMap, venue.lat, venue.lng, windowW, windowH]);

  // ── Keyboard handling ────────────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // #508 fix pass: Escape while a box's PhotoViewer is open must close
      // ONLY the photo, not this whole window — see dialogGuard.ts's own
      // header. This handler is a plain bubble-phase document listener
      // (registered below, no `{capture: true}`), so unlike the vaul/Radix
      // case (see BottomSheet.tsx's own comment) checking the guard
      // directly here is enough; there is no ordering race to work around.
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
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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
      <div className="flex items-center gap-0.5 shrink-0">
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

      {/* Hours table */}
      {venue.hours_weekly && (
        <section aria-label={t("detail.hours", locale)}>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-2">
            {t("detail.hours", locale)}
          </h3>
          <HoursList
            hours_weekly={venue.hours_weekly}
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
          className={
            "flex items-center justify-between gap-2 w-full px-3 py-2.5 " +
            "rounded-[var(--radius-md)] border border-[var(--color-sage-300)] " +
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
      className={
        "absolute z-[900] flex flex-col " +
        "bg-[var(--color-bone-50)] " +
        "rounded-[var(--radius-lg)] " +
        "border border-[var(--color-bone-200)] " +
        "shadow-[0_8px_32px_rgba(0,0,0,0.18)] " +
        "overflow-hidden " +
        "focus:outline-none " +
        "transition-[width,height] duration-150"
      }
      style={{
        left: position.left,
        top: position.top,
        width: windowW,
        height: "auto",
        maxHeight: "calc(100% - 24px)",
      }}
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
