"use client";

/**
 * DirectionButtons — Walk / Bus / Drive direction buttons on venue detail cards.
 *
 * Walk: triggers the in-app Mapbox Directions walking route (onWalk callback).
 *   The parent (MapWrapper) owns the fetch and state; this component just fires
 *   the callback and optionally shows an active/clear state.
 *   When a route is active, shows a collapsible turn-by-turn step list (walkSteps prop)
 *   and a secondary "Open in Google Maps" text link for users who want native GPS (#134).
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
 *
 * WHY turn instructions are NOT in i18n: Mapbox returns them pre-localized via the
 * language= query param (set to the active locale in MapWrapper). No client translation needed.
 */

import { useState } from "react";
import type { Venue } from "@/types/venue";
import { t, type Locale } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Walking route distance + duration for the in-card readout. Raw values; localized via t(). */
export interface RouteInfo {
  /** Miles as string, e.g. "0.4" — interpolated into directions.routeDistance as {distance} */
  distance: string;
  /** Duration string, e.g. "8 min" — interpolated into directions.routeDuration as {duration} */
  duration: string;
}

/**
 * A single turn-by-turn step. Instruction text is pre-localized by Mapbox.
 * Re-exported here so callers (BottomSheet, DesktopVenueWindow) can import
 * from a single component file without reaching into Map.tsx.
 */
export type { WalkStep } from "@/components/Map";
// WHY re-export from Map.tsx: Map.tsx is the canonical home of the type
// (it's part of the walking-route data model), but DirectionButtons is the
// consumer. Re-exporting keeps imports tidy for callers of DirectionButtons.

// ─── Props ────────────────────────────────────────────────────────────────────

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
  /**
   * Turn-by-turn steps from Mapbox Directions API.
   * Instructions are pre-localized (Mapbox language= param in MapWrapper).
   * Rendered as a collapsible list when the route is active.
   */
  walkSteps?: Array<{ instruction: string; distance: number }> | null;
}

// ─── Google Maps deeplink builder ────────────────────────────────────────────

function googleMapsUrl(
  lat: number,
  lng: number,
  travelmode: "transit" | "driving" | "walking",
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

// ─── Per-step distance formatter ─────────────────────────────────────────────

// WHY feet below 160 m (≈528 ft / 0.1 mi): showing "0.0 mi" for a 50-meter
// step is meaningless. Feet give precise, readable values for short steps.
// 160 m ≈ 525 ft is a natural threshold (~1 city block).
const FT_THRESHOLD_METERS = 160;
const METERS_PER_FOOT = 0.3048;
const METERS_PER_MILE = 1609.34;

function formatStepDistance(meters: number, locale: Locale): string {
  if (meters === 0) return "";
  if (meters < FT_THRESHOLD_METERS) {
    const ft = Math.round(meters / METERS_PER_FOOT);
    return t("directions.stepFt", locale, { distance: String(ft) });
  }
  const mi = (meters / METERS_PER_MILE).toFixed(2);
  return t("directions.stepMi", locale, { distance: mi });
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

// Stable ID for the step list — used by aria-controls on the toggle.
// WHY a constant string (not useId): the list is per-component instance, and
// there will never be two DirectionButtons on the same page for the same venue.
const STEPS_LIST_ID = "walk-steps-list";

export default function DirectionButtons({
  venue,
  onWalk,
  locale,
  isRouteActive = false,
  onClearRoute,
  routeInfo = null,
  walkSteps = null,
}: DirectionButtonsProps) {
  // Toggle state for the step list — collapsed by default.
  const [stepsExpanded, setStepsExpanded] = useState(false);

  const busUrl = googleMapsUrl(venue.lat, venue.lng, "transit");
  const driveUrl = googleMapsUrl(venue.lat, venue.lng, "driving");
  const walkGoogleUrl = googleMapsUrl(venue.lat, venue.lng, "walking");

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

  const hasSteps = isRouteActive && Array.isArray(walkSteps) && walkSteps.length > 0;

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

      {/* Turn-by-turn step list — collapsible, shown only when route is active with steps.
          Toggle button with aria-expanded/aria-controls for WCAG 4.1.2 disclosure pattern.
          Instructions arrive pre-localized from Mapbox (language= param in MapWrapper). */}
      {hasSteps && (
        <div className="mt-2">
          <button
            type="button"
            data-testid="walk-steps-toggle"
            aria-expanded={stepsExpanded}
            aria-controls={STEPS_LIST_ID}
            onClick={() => setStepsExpanded((v) => !v)}
            className={
              "text-sm font-medium text-[var(--color-sage-600)] " +
              "hover:text-[var(--color-sage-700)] underline-offset-2 hover:underline " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
            }
          >
            {stepsExpanded
              ? t("directions.hideSteps", locale)
              : t("directions.showSteps", locale)}
          </button>

          {/* WHY hidden attribute over CSS display:none: screen readers skip hidden elements.
              The list must not be announced when collapsed. */}
          <ol
            id={STEPS_LIST_ID}
            data-testid="walk-steps-list"
            aria-label={t("directions.stepsListLabel", locale)}
            hidden={!stepsExpanded}
            className="mt-2 space-y-1.5 text-sm text-[var(--color-ink-700)]"
          >
            {walkSteps!.map((step, i) => {
              const distText = formatStepDistance(step.distance, locale);
              return (
                <li key={i} className="flex items-start gap-2">
                  <span className="shrink-0 w-5 text-right text-[var(--color-ink-400)] text-xs font-mono select-none">
                    {i + 1}.
                  </span>
                  <span className="flex-1">{step.instruction}</span>
                  {distText && (
                    <span className="shrink-0 text-xs text-[var(--color-ink-400)] font-mono">
                      {distText}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* "Open in Google Maps" walk handoff — secondary text link, shown when route is active.
          WHY text link (not button): it opens an external URL, so an <a> is semantically correct.
          WHY secondary (not a full button): the in-app route is the primary action; this is a
          fallback for users who want native GPS turn-by-turn on their phone.
          WHY origin is omitted: same as Bus/Drive — Google uses device location automatically. */}
      {isRouteActive && (
        <div className="mt-2 text-center">
          <a
            data-testid="walk-googlemaps-link"
            href={walkGoogleUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("directions.openInGoogleMapsAria", locale, { name: venue.name })}
            className={
              "text-xs text-[var(--color-ink-500)] underline underline-offset-2 " +
              "hover:text-[var(--color-ink-700)] " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
            }
          >
            {t("directions.openInGoogleMaps", locale)}
          </a>
        </div>
      )}
    </div>
  );
}
