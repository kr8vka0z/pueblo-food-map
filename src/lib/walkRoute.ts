/**
 * Walking-directions helpers for MapWrapper: the Mapbox Directions URL, the
 * turn-by-turn step parser, and the decision of what to do once a
 * Walk-triggered location request resolves (#207).
 *
 * WHY a lib module rather than inside MapWrapper.tsx: these are pure, and
 * tests exercise them directly without mounting MapWrapper, which needs WebGL
 * that jsdom lacks.
 */

import type { WalkStep } from "@/components/Map";
import type { GeoState } from "@/lib/useGeolocation";

/**
 * Build the Mapbox Directions API URL for a walking route (steps=true for the
 * turn list, language= for the visitor's locale).
 */
export function buildWalkingRouteUrl(
  originLng: number,
  originLat: number,
  destLng: number,
  destLat: number,
  token: string,
  locale: string,
): string {
  return [
    "https://api.mapbox.com/directions/v5/mapbox/walking",
    `${originLng},${originLat};${destLng},${destLat}`,
    `?geometries=geojson&overview=full&steps=true&language=${locale}&access_token=${token}`,
  ].join("/");
}

/**
 * Parse turn-by-turn steps from a Mapbox Directions API route object.
 *
 * WHY defensive access (s.maneuver?.instruction): the Mapbox API response is
 * consumed via an `as` cast — there is no runtime guarantee that every step
 * has `maneuver` or `instruction`. A missing field would throw inside a
 * `.map()` and be caught by the surrounding try/catch, silently discarding
 * the ENTIRE route (line + info + steps). Defensive access + empty-string
 * filter lets valid steps through while dropping malformed ones.
 *
 * WHY filter distance === 0 separately: the arrival step always has distance 0
 * and an empty or trivial instruction. It is kept here (dropped in formatting
 * via formatStepDistance) rather than filtered at parse time so callers that
 * want to show the arrival step can still do so.
 *
 * WHY also drop a step with no valid maneuver.location (#555, step-through
 * directions): the stepper flies the camera to a step's own coordinate on
 * every arrow tap (Map.tsx's focus effect). A step missing that coordinate —
 * same "malformed API response" category as a missing instruction — would
 * step the camera to `undefined` and throw, so it is dropped here rather
 * than defended against at every later read site.
 */
export function parseWalkSteps(
  route: {
    legs?: Array<{
      steps?: Array<{
        maneuver?: {
          instruction?: string;
          location?: unknown;
          type?: string;
          modifier?: string;
        };
        distance: number;
      }>;
    }>;
  },
): WalkStep[] {
  const rawSteps = route.legs?.[0]?.steps ?? [];
  return rawSteps.flatMap((s) => {
    const instruction = s.maneuver?.instruction ?? "";
    // Drop steps whose instruction is missing or empty — they are malformed
    // API responses that would render as blank list items.
    if (!instruction) return [];
    // WHY a malformed location is dropped but the STEP is kept (#555): the
    // written turn list is the older, more-relied-on half of this feature.
    // Dropping the whole step would delete a readable instruction to protect
    // a camera hop — the stepper simply doesn't move the map for a step it
    // has no coordinate for (handleStepChange guards on it). The live API
    // supplies `location` on every step (measured 2026-09-20), so this only
    // ever fires on a malformed response.
    const raw = s.maneuver?.location;
    const location =
      Array.isArray(raw) && raw.length === 2 &&
      typeof raw[0] === "number" && typeof raw[1] === "number"
        ? ([raw[0], raw[1]] as [number, number])
        : undefined;
    return [{
      instruction,
      distance: s.distance,
      location,
      maneuverType: s.maneuver?.type,
      maneuverModifier: s.maneuver?.modifier,
    }];
  });
}

/** Outcome of a Walk-triggered geolocation request once it has resolved. */
export type WalkResumeAction =
  | { kind: "fetch"; origin: { lat: number; lng: number } }
  | { kind: "show-hint" }
  | { kind: "noop" };

/**
 * Decide what to do once a Walk-triggered geolocation request has resolved
 * (i.e. geoState.permission is no longer "prompt").
 *
 * WHY the stale-selection check: if the user switches to a different venue
 * while the browser's permission prompt is still open, the eventual grant or
 * denial belongs to the venue that asked, not whatever is selected when it
 * resolves. Drawing a route (or showing a hint) for the wrong venue would be
 * the same "whose route is this?" bug the walkingRouteVenueId/selectedVenueId
 * render-gate already guards against for the fetch path (#208).
 */
export function decideWalkResume(
  awaitingVenueId: string,
  selectedVenueId: string | null,
  geoState: GeoState,
): WalkResumeAction {
  if (awaitingVenueId !== selectedVenueId) return { kind: "noop" };

  if (geoState.permission === "granted" && geoState.position !== null) {
    return { kind: "fetch", origin: geoState.position };
  }

  // Denied, or the fix failed (permission "failed": timeout/unavailable, #738).
  // Never fall back to PUEBLO_CENTER (#207):
  // a walking route drawn from downtown when the user is elsewhere is misleading.
  return { kind: "show-hint" };
}
