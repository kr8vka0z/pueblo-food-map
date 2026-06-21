"use client";

/**
 * DirectionButtons — Walk / Bus / Drive direction buttons on venue detail cards.
 *
 * Walk: triggers the in-app Mapbox Directions walking route (onWalk callback).
 *   The parent (MapWrapper) owns the fetch and state; this component just fires
 *   the callback and optionally shows an active/clear state.
 *
 * Bus / Drive: open Google Maps in a new tab with travelmode preset.
 *   Deeplink format: https://www.google.com/maps/dir/?api=1&destination=<LAT>,<LNG>&travelmode=<MODE>
 *   - api=1 is required or params are silently ignored
 *   - origin is OMITTED — Google uses the user's current location automatically
 *   - dir_action=navigate is OMITTED — would force-start turn-by-turn (jarring for transit)
 *   On mobile, the Google Maps native app intercepts the link; on desktop it opens the web app.
 *
 * WHY api=1 is required: Google Maps' new URL format (/maps/dir/) requires the api=1 param;
 * without it all other params are silently dropped and Google shows a blank search instead.
 * WHY origin is omitted: Google Maps automatically uses the device's current location when no
 * origin is specified — this is better than using a stale origin or asking the user to share
 * location again in Google Maps.
 *
 * WHY routeInfo renders in-card (not as a map overlay): the map overlay (position:absolute
 * bottom:48px inside MapGL) sits behind the mobile BottomSheet (fixed bottom-0 z-[800]),
 * making it invisible on mobile. The in-card readout renders in the same surface as the Walk
 * button, so it is always visible regardless of mobile/desktop context (#134 FIX 1).
 */

import type { Venue } from "@/types/venue";
import { t, type Locale } from "@/lib/i18n";

// ─── Props ────────────────────────────────────────────────────────────────────

/** Walking route distance + duration for the in-card readout. Raw values; localized via t(). */
export interface RouteInfo {
  /** Miles as string, e.g. "0.4" — interpolated into directions.routeDistance as {distance} */
  distance: string;
  /** Duration string, e.g. "8 min" — interpolated into directions.routeDuration as {duration} */
  duration: string;
}

interface DirectionButtonsProps {
  venue: Venue;
  /** Called when the user taps Walk. Parent fetches the route and adds it to the map. */
  onWalk: (venue: Venue) => void;
  locale: Locale;
  /**
   * True when a walking route for this venue is currently drawn on the map.
   * Walk button shows a "clear" affordance instead of the default label.
   */
  isRouteActive?: boolean;
  /** Called when the user taps the Walk button while a route is already active. */
  onClearRoute?: () => void;
  /**
   * Walking route distance + duration — shown below the buttons when the route is active.
   * Localized via directions.routeDistance / directions.routeDuration i18n keys (#134 FIX 2).
   */
  routeInfo?: RouteInfo | null;
}

// ─── Google Maps deeplink builder ────────────────────────────────────────────

function googleMapsUrl(
  lat: number,
  lng: number,
  travelmode: "transit" | "driving",
): string {
  // WHY URLSearchParams: avoids manual encoding bugs (e.g. commas in destination).
  // Using a base URL + params avoids the OpenNext routing trap of server-side
  // redirects on "/" — this is purely a client-side href value.
  const params = new URLSearchParams({
    api: "1",
    destination: `${lat},${lng}`,
    travelmode,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

// ─── Button styles ────────────────────────────────────────────────────────────
//
// Three equal-width buttons in a row, using the bone/ink/sage palette.
// Walk: sage fill (primary action — in-app route).
// Bus / Drive: bone outline (secondary — opens external app).

const baseClass =
  "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[var(--radius-md)] " +
  "text-sm font-semibold transition-colors duration-150 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-1";

const walkActiveClass =
  baseClass +
  " bg-[var(--color-sage-100)] text-[var(--color-sage-700)] border border-[var(--color-sage-400)]";

const walkInactiveClass =
  baseClass +
  " bg-[var(--color-sage-500)] text-[var(--color-bone-50)] hover:bg-[var(--color-sage-600)]";

const externalClass =
  baseClass +
  " bg-[var(--color-bone-50)] text-[var(--color-ink-700)] border border-[var(--color-bone-300)] " +
  "hover:bg-[var(--color-bone-100)] hover:border-[var(--color-bone-400)]";

// ─── DirectionButtons ─────────────────────────────────────────────────────────

export default function DirectionButtons({
  venue,
  onWalk,
  locale,
  isRouteActive = false,
  onClearRoute,
  routeInfo = null,
}: DirectionButtonsProps) {
  const busUrl = googleMapsUrl(venue.lat, venue.lng, "transit");
  const driveUrl = googleMapsUrl(venue.lat, venue.lng, "driving");

  function handleWalkClick() {
    if (isRouteActive && onClearRoute) {
      onClearRoute();
    } else {
      onWalk(venue);
    }
  }

  // Accessible label for Walk includes venue name so screen readers identify the route target.
  const walkLabel = isRouteActive
    ? t("directions.clearRoute", locale)
    : t("directions.walkAriaLabel", locale, { name: venue.name });
  // Visible label (shorter) vs accessible label (full context).
  const walkVisibleLabel = isRouteActive
    ? t("directions.clearRoute", locale)
    : t("directions.walk", locale);

  return (
    <div>
      <div className="flex gap-2">
        {/* Walk — in-app route */}
        <button
          type="button"
          aria-label={walkLabel}
          onClick={handleWalkClick}
          className={isRouteActive ? walkActiveClass : walkInactiveClass}
        >
          {walkVisibleLabel}
        </button>

        {/* Bus — Google Maps transit deeplink */}
        <a
          href={busUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("directions.busAriaLabel", locale, { name: venue.name })}
          className={externalClass}
        >
          {t("directions.bus", locale)}
        </a>

        {/* Drive — Google Maps driving deeplink */}
        <a
          href={driveUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("directions.driveAriaLabel", locale, { name: venue.name })}
          className={externalClass}
        >
          {t("directions.drive", locale)}
        </a>
      </div>

      {/* In-card walking route readout — distance + duration below the buttons.
          Shown only when a route is active for this venue. Uses i18n keys so
          Spanish users see localized unit strings (e.g. "{distance} caminando"). */}
      {isRouteActive && routeInfo && (
        <div
          data-testid="walking-route-info"
          className={[
            "mt-2 flex items-center justify-center gap-2",
            "text-sm font-semibold text-[var(--color-sage-700)]",
          ].join(" ")}
        >
          <span data-testid="walking-route-distance">
            {t("directions.routeDistance", locale, { distance: routeInfo.distance })}
          </span>
          <span aria-hidden>·</span>
          <span data-testid="walking-route-duration">
            {t("directions.routeDuration", locale, { duration: routeInfo.duration })}
          </span>
        </div>
      )}
    </div>
  );
}
