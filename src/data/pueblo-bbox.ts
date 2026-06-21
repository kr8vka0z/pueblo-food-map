/**
 * Pueblo County geographic constants.
 *
 * Sourced from US Census TIGER/Line cartographic boundary data (State_County
 * MapServer layer 1, geometryPrecision 5, FIPS 08-101).
 *
 * maxBounds is the Mapbox GL pan constraint bbox. It covers the full county
 * polygon plus ~0.06° (~4 mi) of padding on every side so the county border
 * never hard-clips at the map edge.
 *
 * All 108 venues in src/data/venues.ts fall within this bbox.
 *
 * Format: [[lngWest, latSouth], [lngEast, latNorth]]
 */

export const PUEBLO_COUNTY_BBOX: [[number, number], [number, number]] = [
  [-105.1107, 37.6747],
  [-103.9939, 38.5824],
];

/**
 * Downtown Pueblo, CO — the default map center / distance-filter origin.
 * Single source of truth for the lat/lng pair.
 *
 * PUEBLO_CENTER_LAT / PUEBLO_CENTER_LNG are the raw scalars for consumers
 * that need a specific shape (e.g. react-map-gl viewState uses
 * { latitude, longitude }).
 *
 * PUEBLO_CENTER is the {lat,lng} form used by the filter pipeline and
 * distance calculations. Exported here so MapWrapper and tests share one
 * constant (#166 8.6 dedup).
 */
export const PUEBLO_CENTER_LAT = 38.2544;
export const PUEBLO_CENTER_LNG = -104.6091;
/** Downtown Pueblo as a plain {lat, lng} point — use for distance math and filter origin. */
export const PUEBLO_CENTER = { lat: PUEBLO_CENTER_LAT, lng: PUEBLO_CENTER_LNG };

/**
 * Minimum zoom level for the map.
 *
 * At zoom 9 on a 375px-wide viewport the full county (~90km N–S,
 * ~95km E–W) fits comfortably with room to spare. Zoom 8 would show
 * the county as a small object; 9 is the practical floor.
 */
export const PUEBLO_COUNTY_MIN_ZOOM = 9;
