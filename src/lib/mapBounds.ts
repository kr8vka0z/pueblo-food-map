/**
 * Map viewport geometry for MapWrapper: the re-center drift check, the
 * out-of-county check, and the bounding boxes the category / Boxes-button
 * camera fits use (#111, #670).
 *
 * WHY a lib module rather than inside MapWrapper.tsx: these are pure (no
 * React, no DOM), and tests exercise them directly without mounting
 * MapWrapper, which needs WebGL that jsdom lacks. The walking-route fit
 * constants (ROUTE_FIT_*) stay in MapWrapper because they are sized from the
 * RouteStrip and BottomNav component heights.
 */

import type mapboxgl from "mapbox-gl";
import type { Venue } from "@/types/venue";
import { PUEBLO_COUNTY_BBOX } from "@/data/pueblo-bbox";
import { haversineMiles } from "@/lib/distance";

/**
 * Drift-detection padding (in degrees).
 * The "Re-center" button appears when the user-location dot is this far
 * outside the visible map viewport. 0.002° ≈ 220m — gives the dot a small
 * inset buffer so the button doesn't flicker at the exact edge.
 * Easy to tune for live review: increase for more generous hide threshold.
 */
export const DRIFT_PAD_DEG = 0.002;

/**
 * Checks whether a lat/lng point is inside the given viewport bounds,
 * shrunk by DRIFT_PAD_DEG on every edge.
 */
export function isPointInBounds(
  point: { lat: number; lng: number },
  bounds: mapboxgl.LngLatBounds,
): boolean {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return (
    point.lng >= sw.lng + DRIFT_PAD_DEG &&
    point.lng <= ne.lng - DRIFT_PAD_DEG &&
    point.lat >= sw.lat + DRIFT_PAD_DEG &&
    point.lat <= ne.lat - DRIFT_PAD_DEG
  );
}

/**
 * Returns true if the resolved position is outside the Pueblo County maxBounds.
 * Tied to the same bbox constant used by Map.tsx so they stay in sync.
 */
export function isOutsideCounty(point: { lat: number; lng: number }): boolean {
  const [[lngWest, latSouth], [lngEast, latNorth]] = PUEBLO_COUNTY_BBOX;
  return (
    point.lng < lngWest ||
    point.lng > lngEast ||
    point.lat < latSouth ||
    point.lat > latNorth
  );
}

// ─── Category autozoom constants (#111) ───────────────────────────────────────
//
// Padding (px) around the fitBounds result so pins aren't hidden behind chrome.
// Mobile: extra bottom clearance for the bottom-sheet peek bar (≈88px) + some top
//   clearance for the search bar (≈72px). Desktop: extra top clearance for the
//   search bar (≈72px) and right clearance for the control stack (≈60px).
//
// Tune these values during live review — they are the first thing to eyeball.
export const CATEGORY_FIT_PADDING_MOBILE = { top: 80, bottom: 120, left: 40, right: 40 };
export const CATEGORY_FIT_PADDING_DESKTOP = { top: 80, bottom: 60, left: 60, right: 80 };

/**
 * Maximum zoom level applied when fitting a category's bounds.
 * Prevents sparse categories (2–3 venues in a tight cluster) from slamming
 * to street level. Tune during live review.
 */
export const CATEGORY_FIT_MAX_ZOOM = 14;

/**
 * Compute the [[lngW, latS], [lngE, latN]] bounding box for a list of venues.
 * Returns null if the array is empty.
 */
export function computeCategoryBounds(
  venues: Pick<Venue, "lat" | "lng">[],
): [[number, number], [number, number]] | null {
  if (venues.length === 0) return null;
  let lngW = Infinity, latS = Infinity, lngE = -Infinity, latN = -Infinity;
  for (const v of venues) {
    if (v.lng < lngW) lngW = v.lng;
    if (v.lng > lngE) lngE = v.lng;
    if (v.lat < latS) latS = v.lat;
    if (v.lat > latN) latN = v.lat;
  }
  return [[lngW, latS], [lngE, latN]];
}

// Miles-per-degree constants for nearestBoundsAround's mile→degree conversion
// below. Latitude is ~constant (69.0 mi/degree everywhere); longitude shrinks
// toward the poles by cos(latitude), which is why LNG needs the extra factor
// and LAT doesn't. Precise enough for a map fit box — not routing math.
const MILES_PER_DEGREE_LAT = 69.0;
const MILES_PER_DEGREE_LNG_AT_EQUATOR = 69.172;

/**
 * Compute a symmetric [[lngW, latS], [lngE, latN]] bounding box centered on
 * `origin`, sized to just cover the `n` nearest of `venues` (#670: the Boxes
 * bottom-nav button, tapped on with a known visitor location, zooms to the
 * visitor's 5 nearest boxes rather than every box in the county).
 *
 * WHY centered-and-symmetric rather than a tight bbox around just the n
 * venues: a plain bbox over N points is usually off-center from the visitor
 * (whichever side has a farther point pulls the box that way), so the
 * visitor's own dot could land near an edge instead of the middle. Fitting a
 * box built from the single farthest-of-the-n distance, in every direction,
 * guarantees the visitor is dead center — matching the issue's "centered on
 * the visitor" requirement exactly, at the cost of sometimes including a few
 * venues beyond the nearest n on the box's shorter axis. That's an accepted
 * tradeoff (a slightly wider view with a couple of "free" extra pins beats a
 * center-line the button interaction requires).
 *
 * WHY plain mile/degree ratios rather than a haversine-based box (matching
 * the ratios computeCategoryBounds's lat/lng-only math already uses): this
 * box only needs to be "just far enough to show 5 pins," not chart-accurate;
 * the padding + CATEGORY_FIT_MAX_ZOOM cap the caller already applies absorbs
 * the small ellipsoidal error.
 *
 * Returns null for an empty venue list, same contract as computeCategoryBounds.
 */
export function nearestBoundsAround(
  origin: { lat: number; lng: number },
  venues: Pick<Venue, "lat" | "lng">[],
  n: number,
): [[number, number], [number, number]] | null {
  if (venues.length === 0) return null;

  const nearest = [...venues]
    .sort((a, b) => haversineMiles(origin, a) - haversineMiles(origin, b))
    .slice(0, n);

  // Half-size of the box: distance to the farthest of the nearest n (the
  // "5th-nearest box" the issue names, or the farthest available if fewer
  // than n exist).
  const halfSizeMiles = Math.max(...nearest.map((v) => haversineMiles(origin, v)));

  const latDelta = halfSizeMiles / MILES_PER_DEGREE_LAT;
  const milesPerDegreeLng =
    MILES_PER_DEGREE_LNG_AT_EQUATOR * Math.cos((origin.lat * Math.PI) / 180);
  const lngDelta = halfSizeMiles / milesPerDegreeLng;

  return [
    [origin.lng - lngDelta, origin.lat - latDelta],
    [origin.lng + lngDelta, origin.lat + latDelta],
  ];
}
