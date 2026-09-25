"use client";

/**
 * DirectionButtons — Walk / Bus / Drive direction buttons on venue detail cards.
 *
 * Walk: triggers the in-app Mapbox Directions walking route (onWalk callback).
 *   The parent (MapWrapper) owns the fetch and state; this component just fires
 *   the callback and optionally shows an active/clear state.
 *   When a route is active, shows a collapsible turn-by-turn step list (walkSteps prop)
 *   and a secondary "Open in Google Maps" text link for users who want native GPS (#134).
 *   When Walk is tapped with no shared location, MapWrapper requests geolocation
 *   instead of drawing a route from downtown; if that's denied/unavailable it sets
 *   showLocationHint, and this component renders a localized "share your location"
 *   status message instead of silently doing nothing (#207).
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
 *
 * WalkStepper (#555, step-through directions): the compact "Step N of M"
 * panel with Back/Next arrows — MapWrapper owns which step is active
 * (activeStepIndex/onStepChange) so the phone strip and this card's own
 * readout can share one turn without a second source of truth. Reuses
 * WalkStepsList for its "All turns" disclosure rather than forking a second
 * list, and formatStepDistance for its "in 280 ft" line.
 */

import { useId, useState } from "react";
import {
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CornerUpLeft,
  CornerUpRight,
  MapPin as MapPinIcon,
} from "lucide-react";
import type { Venue } from "@/types/venue";
import type { WalkStep } from "@/components/Map";
import { t, type Locale } from "@/lib/i18n";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";

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
   * Rendered via WalkStepper when the route is active.
   */
  walkSteps?: WalkStep[] | null;
  /**
   * True when Walk was tapped with no shared location and the resulting
   * geolocation request was denied or is unavailable (#207). Renders a
   * localized "share your location" hint instead of silently doing nothing —
   * MapWrapper never falls back to drawing a route from PUEBLO_CENTER.
   */
  showLocationHint?: boolean;
  /** Which turn the step-through stepper is showing (#555). Defaults to 0. */
  activeStepIndex?: number;
  /** Moves the stepper to a different turn (#555) — Back/Next or an "All turns" row tap. */
  onStepChange?: (index: number) => void;
}

// ─── Google Maps deeplink builder ────────────────────────────────────────────

// Exported (2026-09-19, Blessing Box card redesign) so BoxCardBody's plain
// address-as-directions-link can build the same deeplink this component's own
// Bus/Drive buttons use — one URL builder, not a second copy of the
// query-string logic. `travelmode` is OPTIONAL (fix pass, 2026-09-19): a box
// card omits it entirely rather than forcing "driving" — many box visitors
// walk or ride the bus, and Google Maps' own destination-only deeplink
// already lets the person pick a mode once it opens.
export function googleMapsUrl(
  lat: number,
  lng: number,
  travelmode?: "transit" | "driving" | "walking",
): string {
  // WHY URLSearchParams: avoids manual encoding bugs (e.g. commas in destination).
  // Using a base URL + params avoids the OpenNext routing trap of server-side
  // redirects on "/" — this is purely a client-side href value.
  const params = new URLSearchParams({
    api: "1",
    destination: `${lat},${lng}`,
    ...(travelmode ? { travelmode } : {}),
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

// ─── Step list (extracted, #531) ──────────────────────────────────────────────
//
// The `<ol>` of turn-by-turn steps only — no toggle, no "Clear route"/"Open in
// Google Maps" links. Pulled out of WalkRouteStatus below (which still owns
// those, wrapping this list behind its own Show/Hide steps disclosure) so
// RouteStrip.tsx's "Steps" sheet (#531 — the strip's own way into the same
// list, two taps away otherwise) can render the identical markup instead of
// forking a second copy that could drift from this one (distance thresholds,
// per-step layout, i18n keys).
export interface WalkStepsListProps {
  steps: Array<{ instruction: string; distance: number }>;
  locale: Locale;
  /** Forwarded to the `<ol>` — lets a disclosure trigger elsewhere point `aria-controls` at it. Omit when nothing needs to reference it (RouteStrip's sheet doesn't). */
  id?: string;
  /** WalkRouteStatus hides (not unmounts) the list while its toggle is collapsed, so screen readers skip it (`hidden`, not CSS display:none). RouteStrip's sheet never needs this — its own conditional mount already covers the same requirement. */
  hidden?: boolean;
  /** Caller-owned layout classes (spacing, max-height/scroll, text size) — this component supplies no default so the two callers can size it differently (WalkRouteStatus scrolls inside a fixed-height card; RouteStrip's sheet scrolls inside its own panel). */
  className?: string;
  /**
   * #555: when provided, each row becomes a button that calls this with its
   * index — WalkStepper's "All turns" disclosure uses this to let someone
   * jump straight to an arbitrary turn. Omit (both pre-#555 callers do,
   * unchanged) to keep the plain, non-interactive list exactly as it was.
   */
  onSelectStep?: (index: number) => void;
  /** #555: highlights the row matching this index. Only meaningful alongside `onSelectStep`. */
  activeIndex?: number;
}

export function WalkStepsList({ steps, locale, id, hidden, className, onSelectStep, activeIndex }: WalkStepsListProps) {
  return (
    <ol
      id={id}
      data-testid="walk-steps-list"
      aria-label={t("directions.stepsListLabel", locale)}
      hidden={hidden}
      className={className}
    >
      {steps.map((step, i) => {
        const distText = formatStepDistance(step.distance, locale);
        const rowContent = (
          <>
            <span className="shrink-0 w-5 text-right text-[var(--color-ink-400)] text-xs font-mono select-none">
              {i + 1}.
            </span>
            <span className="flex-1">{step.instruction}</span>
            {distText && (
              <span className="shrink-0 text-xs text-[var(--color-ink-400)] font-mono">
                {distText}
              </span>
            )}
          </>
        );
        return (
          <li key={i} className="flex items-start gap-2">
            {onSelectStep ? (
              <button
                type="button"
                onClick={() => onSelectStep(i)}
                className={
                  "flex flex-1 items-start gap-2 text-left rounded " +
                  (i === activeIndex ? "text-[var(--color-sage-700)] font-medium" : "") +
                  " focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
                }
              >
                {rowContent}
              </button>
            ) : (
              rowContent
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ─── Turn glyph (#555) ────────────────────────────────────────────────────────
//
// Picks one of the four icons already imported for this file's own use
// (no new dependency) based on Mapbox's `maneuver.type`/`.modifier`. Not a
// full icon set for every Mapbox maneuver type (roundabout, fork, merge,
// etc. all fall through to the plain "continue straight" arrow) — a
// ponytail-scope call: those are rare turns, and Mapbox's own instruction
// text already names them, so the glyph is a visual accent, not the only
// signal.
function TurnGlyph({
  maneuverType,
  maneuverModifier,
}: {
  maneuverType?: string;
  maneuverModifier?: string;
}) {
  const className = "h-5 w-5 shrink-0 text-[var(--color-sage-600)]";
  if (maneuverType === "arrive" || maneuverType === "depart") {
    return <MapPinIcon className={className} aria-hidden />;
  }
  if (maneuverModifier?.includes("left")) {
    return <CornerUpLeft className={className} aria-hidden />;
  }
  if (maneuverModifier?.includes("right")) {
    return <CornerUpRight className={className} aria-hidden />;
  }
  return <ArrowUp className={className} aria-hidden />;
}

// 48px square — WCAG 2.5.5-comfortable touch target for the one-handed,
// walking-while-glancing-at-the-phone use case this stepper is built for.
const stepNavClass =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] " +
  "bg-[var(--color-sage-600)] text-[var(--color-bone-50)] " +
  "disabled:bg-[var(--color-bone-200)] disabled:text-[var(--color-ink-400)] " +
  "hover:enabled:bg-[var(--color-sage-700)] " +
  PRESS_FEEDBACK + " " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-1";

// ─── WalkStepper (#555) ────────────────────────────────────────────────────────
//
// The step-through panel: one turn at a time, Back/Next, and an "All turns"
// disclosure that reuses WalkStepsList (above) rather than a second list
// implementation. Owns ONLY the disclosure's open/closed state — which turn
// is active lives in MapWrapper (activeIndex/onStepChange props) because the
// map's per-turn camera focus and this panel must always agree on the
// current step; two independent pieces of state here could drift apart.
export interface WalkStepperProps {
  /** Every step Mapbox returned, INCLUDING any whose `location` is undefined
   *  — nothing filters these out (see `WalkStep.location`'s own WHY in
   *  Map.tsx: a turn with no usable coordinate is still worth reading, so it
   *  is kept and only its camera hop is skipped). Anything here that reaches
   *  for a coordinate must guard first, the way MapWrapper's
   *  `handleStepChange` does. */
  steps: WalkStep[];
  activeIndex: number;
  onStepChange: (index: number) => void;
  locale: Locale;
  className?: string;
}

export function WalkStepper({
  steps,
  activeIndex,
  onStepChange,
  locale,
  className,
}: WalkStepperProps) {
  const [allTurnsOpen, setAllTurnsOpen] = useState(false);
  const allTurnsId = useId();

  const total = steps.length;
  // Defensive clamp: activeIndex is owned by the caller, so a stale value
  // surviving a route swap (fewer steps than before) can't index past the end.
  const index = Math.min(Math.max(activeIndex, 0), Math.max(total - 1, 0));
  const step = steps[index];
  if (!step) return null;

  const nextStep = steps[index + 1];
  const isLast = index === total - 1;
  const distText = formatStepDistance(step.distance, locale);
  // "You have arrived" replaces the distance line on the final step (distance
  // is always 0 there) rather than showing a meaningless "0 ft".
  const distanceLine =
    isLast || step.distance === 0
      ? t("directions.stepArrived", locale)
      : distText
        ? t("directions.stepIn", locale, { distance: distText })
        : null;

  return (
    <div className={className}>
      <p
        className="text-xs font-medium text-[var(--color-ink-400)]"
        data-testid="walk-stepper-counter"
      >
        {t("directions.stepCounter", locale, {
          current: String(index + 1),
          total: String(total),
        })}
      </p>

      {/* aria-live: announces the new turn to screen reader users on every
          Back/Next tap without them needing to re-navigate to this text. */}
      <div
        className="mt-1 flex items-start gap-2"
        role="status"
        aria-live="polite"
        data-testid="walk-stepper-instruction"
      >
        <TurnGlyph
          maneuverType={step.maneuverType}
          maneuverModifier={step.maneuverModifier}
        />
        <span className="text-base font-semibold text-[var(--color-ink-900)]">
          {step.instruction}
        </span>
      </div>

      {distanceLine && (
        <p
          className="mt-0.5 pl-7 text-sm text-[var(--color-ink-400)]"
          data-testid="walk-stepper-distance"
        >
          {distanceLine}
        </p>
      )}

      {nextStep && (
        <p
          className="mt-2 border-t border-[var(--color-bone-200)] pt-2 text-xs text-[var(--color-ink-400)]"
          data-testid="walk-stepper-then"
        >
          {t("directions.stepThen", locale, { instruction: nextStep.instruction })}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          data-testid="walk-stepper-back"
          aria-label={t("directions.stepBack", locale)}
          disabled={index === 0}
          onClick={() => onStepChange(index - 1)}
          className={stepNavClass}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          data-testid="walk-stepper-next"
          aria-label={t("directions.stepNext", locale)}
          disabled={isLast}
          onClick={() => onStepChange(index + 1)}
          className={stepNavClass}
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="mt-2">
        <button
          type="button"
          data-testid="walk-stepper-all-turns-toggle"
          aria-expanded={allTurnsOpen}
          aria-controls={allTurnsId}
          onClick={() => setAllTurnsOpen((v) => !v)}
          className={
            "flex items-center gap-1 py-1.5 text-sm font-medium text-[var(--color-sage-600)] " +
            "hover:text-[var(--color-sage-700)] " +
            PRESS_FEEDBACK + " " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
          }
        >
          {allTurnsOpen ? (
            <>
              <ChevronUp className="h-4 w-4" aria-hidden />
              {t("directions.fewerTurns", locale)}
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" aria-hidden />
              {t("directions.allTurns", locale)}
            </>
          )}
        </button>

        <WalkStepsList
          steps={steps}
          locale={locale}
          id={allTurnsId}
          hidden={!allTurnsOpen}
          onSelectStep={onStepChange}
          activeIndex={index}
          // Same overscroll-contain reasoning as WalkRouteStatus's pre-#555
          // list — see that component's own comment on this class.
          className="mt-2 space-y-1.5 text-sm text-[var(--color-ink-700)] max-h-48 overflow-y-auto overscroll-contain"
        />
      </div>
    </div>
  );
}

// ─── Active-route status (readout) ───────────────────────────────────────────
//
// Distance/duration, the collapsible turn-by-turn steps, and the "Open in
// Google Maps" walk handoff — everything this component shows below its Walk
// button once a route is active, plus the "share your location" hint (#207)
// for the sibling case where no route exists yet. Extracted (2026-09-19,
// Blessing Box walk restore — see BoxCardBody's own header) so BoxCardBody's
// address-as-directions-link can render the identical readout for a box's
// in-app walking route without duplicating this JSX; DirectionButtons itself
// keeps calling it below, byte-identical output for ordinary venues.
//
// WHY `locationHintId` is a prop, not generated here: the trigger element's
// own `aria-describedby` must point at the same id this component puts on
// the hint `<p>`, and a trigger rendered by the CALLER (this component's own
// Walk button, or BoxCardBody's address button) can't reach an id minted
// inside a child it hasn't rendered yet. `stepsListId` has no such
// cross-component wiring need — nothing outside this component ever
// references it — so it stays internal via useId(), same as before extraction.
export interface WalkRouteStatusProps {
  /** Only id/name/lat/lng are read — a box (PublicBlessingBox extends Venue) or an ordinary Venue both satisfy this with no conversion. */
  venue: Pick<Venue, "id" | "name" | "lat" | "lng">;
  locale: Locale;
  isRouteActive: boolean;
  routeInfo?: RouteInfo | null;
  walkSteps?: WalkStep[] | null;
  showLocationHint?: boolean;
  locationHintId: string;
  /**
   * Renders a standalone "Clear route" text control between the steps block
   * and the "Open in Google Maps" link, when the route is active. Optional —
   * DirectionButtons itself never passes this (its own Walk button IS the
   * clear affordance, re-labeling to "Clear walking route" on tap, so a
   * second control here would be redundant for ordinary venues; leaving it
   * undefined keeps their output byte-identical). BoxCardBody's own trigger
   * (the address) stays labeled as the address at all times instead of
   * relabeling (the address text is the box's one visible location cue on
   * the card — losing it while a route is drawn would be a regression), so
   * it needs this explicit control to clear a route (2026-09-19, walk
   * restore pass, advisor()-reviewed).
   */
  onClearRoute?: () => void;
  /** Which turn WalkStepper shows (#555). Defaults to 0. */
  activeStepIndex?: number;
  /** Moves the stepper to a different turn (#555). Defaults to a no-op —
   *  callers that never draw a route (most WalkRouteStatus instances, most
   *  of the time) don't need to wire anything. */
  onStepChange?: (index: number) => void;
}

export function WalkRouteStatus({
  venue,
  locale,
  isRouteActive,
  routeInfo = null,
  walkSteps = null,
  showLocationHint = false,
  locationHintId,
  onClearRoute,
  activeStepIndex = 0,
  onStepChange = () => {},
}: WalkRouteStatusProps) {
  const walkGoogleUrl = googleMapsUrl(venue.lat, venue.lng, "walking");

  const stepperSteps = walkSteps ?? [];
  const hasSteps = isRouteActive && stepperSteps.length > 0;

  return (
    <>
      {/* Location-needed hint (#207) — shown when Walk requested geolocation
          (because userLocation was null) and the browser denied it or it's
          unavailable. role="status" + aria-live announces it immediately for
          screen reader users; aria-describedby on the trigger element links
          it for users who tab back later. !isRouteActive is defensive — the
          two states shouldn't ever coexist, but the guard makes that
          invariant explicit here too. */}
      {!isRouteActive && showLocationHint && (
        <p
          id={locationHintId}
          data-testid="walk-location-hint"
          role="status"
          aria-live="polite"
          className="mt-2 text-sm text-[var(--color-ink-500)]"
        >
          {t("directions.locationHint", locale)}
        </p>
      )}

      {/* In-card walking route readout — distance + duration. Shown only
          when a route is active. Uses i18n keys so Spanish users see
          localized unit strings (e.g. "{distance} caminando"). */}
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

      {/* Step-through directions (#555) — replaces the old collapsible
          Show/Hide steps toggle + full list. One turn at a time; its own
          "All turns" disclosure (inside WalkStepper) still reaches the full
          WalkStepsList for anyone who wants to scan every turn at once.
          KNOWN LIMITATION (unchanged from the pre-#555 toggle): Mapbox-sourced
          turn instructions do not refresh when the user toggles EN/ES while a
          route is active — they stay in the language active at fetch time
          until the user re-taps Walk. */}
      {hasSteps && (
        <WalkStepper
          // WHY keyed on the venue (#555, preserving FIX 2's behavior): the
          // "All turns" disclosure is local state inside WalkStepper, and
          // this component stays mounted across a venue change — so without
          // a key, a list left open on venue A would still be open on venue
          // B's unrelated route. The pre-#555 code spent a ref + an effect
          // collapsing `stepsExpanded` for exactly this; remounting on the
          // venue id is the same guarantee with neither.
          key={venue.id}
          steps={stepperSteps}
          activeIndex={activeStepIndex}
          onStepChange={onStepChange}
          locale={locale}
          className="mt-2"
        />
      )}

      {/* Clear route — only rendered when the trigger itself doesn't already
          double as the clear affordance (see onClearRoute's own doc above).
          Same visual weight as the steps toggle above it. */}
      {isRouteActive && onClearRoute && (
        <div className="mt-2">
          <button
            type="button"
            data-testid="walk-clear-route"
            onClick={onClearRoute}
            className={
              "py-1.5 text-sm font-medium text-[var(--color-sage-600)] " +
              "hover:text-[var(--color-sage-700)] underline-offset-2 hover:underline " +
              PRESS_FEEDBACK + " " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
            }
          >
            {t("directions.clearRoute", locale)}
          </button>
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
              // ~16px tall -> inline-block so the padding growth actually
              // expands this link's own box (a plain inline element's padding
              // doesn't reliably grow its hit rect across browsers). Same type
              // size/color as before (mobile review #10).
              "inline-block py-1.5 text-xs text-[var(--color-ink-500)] underline underline-offset-2 " +
              "hover:text-[var(--color-ink-700)] " +
              PRESS_FEEDBACK + " " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
            }
          >
            {t("directions.openInGoogleMaps", locale)}
          </a>
        </div>
      )}
    </>
  );
}

// ─── Button styles ────────────────────────────────────────────────────────────
//
// Three equal-width buttons in a row, using the bone/ink/sage palette.
// Walk: sage fill (primary action — in-app route).
// Bus / Drive: bone outline (secondary — opens external app).

const baseClass =
  "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[var(--radius-md)] " +
  "text-sm font-semibold transition-colors duration-150 " +
  PRESS_FEEDBACK + " " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-1";

// #534: --color-sage-400 undefined in globals.css @theme — sage-600 is
// DESIGN.md's documented "primary/active" color, matching this button's
// own active-route semantics (5.2:1 border contrast against the sage-100
// fill vs. 3.1:1 for sage-500, safer for outdoor phone use).
const walkActiveClass =
  baseClass +
  " bg-[var(--color-sage-100)] text-[var(--color-sage-700)] border border-[var(--color-sage-600)]";

const walkInactiveClass =
  baseClass +
  " bg-[var(--color-sage-600)] text-[var(--color-bone-50)] hover:bg-[var(--color-sage-700)]";

// #534: --color-bone-400 undefined — the bone scale stops at bone-300, so a
// hover-darkened border steps into the ink family instead, reusing the same
// hover:border-ink-400 darken-on-hover pattern ReportVenueButton.tsx already
// uses for an identical rest-bone/hover-darker border (5.2:1 against the
// bone-100 hover fill, DESIGN.md's own measured number for ink-400).
const externalClass =
  baseClass +
  " bg-[var(--color-bone-50)] text-[var(--color-ink-700)] border border-[var(--color-bone-300)] " +
  "hover:bg-[var(--color-bone-100)] hover:border-[var(--color-ink-400)]";

// ─── DirectionButtons ─────────────────────────────────────────────────────────

export default function DirectionButtons({
  venue,
  onWalk,
  locale,
  isRouteActive = false,
  onClearRoute,
  routeInfo = null,
  walkSteps = null,
  showLocationHint = false,
  activeStepIndex = 0,
  onStepChange = () => {},
}: DirectionButtonsProps) {
  // Per-instance id for the "share your location" hint (#207) — aria-describedby
  // target on the Walk button below, shared with WalkRouteStatus's own <p id>
  // (see that component's own header for why this one stays a prop instead of
  // being generated internally like stepsListId).
  const locationHintId = useId();

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
          aria-describedby={showLocationHint ? locationHintId : undefined}
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

      <WalkRouteStatus
        venue={venue}
        locale={locale}
        isRouteActive={isRouteActive}
        routeInfo={routeInfo}
        walkSteps={walkSteps}
        showLocationHint={showLocationHint}
        locationHintId={locationHintId}
        activeStepIndex={activeStepIndex}
        onStepChange={onStepChange}
      />
    </div>
  );
}
