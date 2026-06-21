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
 *   - Left: "Show details" / "Hide details" toggle (replaces chevron + text-link).
 *   - Right: X-close (clears selectedVenueId).
 *   - Tab order: X-close → Show/Hide details → body content.
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
import { MapPin, Phone, Clock, ExternalLink } from "lucide-react";
import FavoriteButton from "@/components/FavoriteButton";
import ShareButton from "@/components/ShareButton";
import { safeUrl } from "@/lib/safeUrl";
import DirectionButtons, { type RouteInfo } from "@/components/DirectionButtons";

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
import { categoryColors, categoryLabels } from "@/data/venues";
import { formatMiles } from "@/lib/distance";
import { computeOpenStatus } from "@/lib/hours";
import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import VenuePopupHeader from "@/components/VenuePopupHeader";
import ReportVenueButton from "@/components/ReportVenueButton";
import HoursList from "@/components/HoursList";

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
}

// ─── DesktopVenueWindow ───────────────────────────────────────────────────────

export default function DesktopVenueWindow({
  venue,
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
}: DesktopVenueWindowProps) {
  const { locale: ctxLocale } = useLocale();
  const locale = localeProp ?? ctxLocale;
  const windowRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<WindowPosition>({ left: 0, top: 0 });

  const windowW = expanded ? WINDOW_EXPANDED_W : WINDOW_QUICK_W;
  const windowH = expanded ? WINDOW_EXPANDED_H : WINDOW_QUICK_H;

  const status = computeOpenStatus(venue.hours_weekly);

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
      const pos = computeWindowPosition(
        pt.x,
        pt.y,
        container.offsetWidth,
        container.offsetHeight,
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
      if (e.key === "Escape") {
        onClose();
      }
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
        <ShareButton venueId={venue.id} venueName={venue.name} locale={locale} size={18} />
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
      </div>

      {/* Notes (2 lines max) — guard: never render OSM artifact strings */}
      {venue.notes && !/osm/i.test(venue.notes) && (
        <p className="text-xs text-[var(--color-ink-700)] leading-relaxed line-clamp-2">
          {venue.notes}
        </p>
      )}

      {/* Direction buttons (#134) — Walk (in-app route) / Bus / Drive.
          routeInfo threads distance+duration for the in-card readout. */}
      <DirectionButtons
        venue={venue}
        onWalk={onWalkRoute ?? (() => {})}
        locale={locale}
        isRouteActive={isWalkRouteActive}
        onClearRoute={onClearWalkRoute}
        routeInfo={isWalkRouteActive ? walkRouteInfo : null}
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
        {categoryLabels[venue.category]}
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
          routeInfo threads distance+duration for the in-card readout. */}
      <DirectionButtons
        venue={venue}
        onWalk={onWalkRoute ?? (() => {})}
        locale={locale}
        isRouteActive={isWalkRouteActive}
        onClearRoute={onClearWalkRoute}
        routeInfo={isWalkRouteActive ? walkRouteInfo : null}
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
            className="flex items-center gap-2 text-sm text-[var(--color-ink-700)] hover:text-[var(--color-sage-600)] transition-colors"
          >
            <Phone size={13} className="text-[var(--color-ink-400)]" aria-hidden />
            {venue.phone}
          </a>
        </section>
      )}

      {/* Notes — guard: never render OSM artifact strings */}
      {venue.notes && !/osm/i.test(venue.notes) && (
        <section aria-label={t("detail.about", locale)}>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-2">
            {t("detail.about", locale)}
          </h3>
          <p className="text-sm text-[var(--color-ink-700)] leading-relaxed">
            {venue.notes}
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
      {/* Persistent header bar — always visible in both states */}
      <VenuePopupHeader
        venueId={venue.id}
        expanded={expanded}
        onToggle={expanded ? onCollapse : onExpand}
        onClose={onClose}
        locale={locale}
      />

      {/* Body — collapsed or expanded. id wired to toggle's aria-controls. */}
      {expanded ? (
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
