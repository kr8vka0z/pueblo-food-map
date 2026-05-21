/**
 * Pueblo County geographic constants.
 *
 * Sourced from US Census TIGER/Line cartographic boundary data (State_County
 * MapServer layer 1, geometryPrecision 5, FIPS 08-101).
 *
 * maxBounds is the Mapbox GL pan constraint bbox. It covers the full county
 * polygon plus ~0.06° (~4 mi) of padding on every side so the county border
 * never hard-clips at the map edge. The east side is widened to accommodate
 * four OSM-sourced grocery venues (Boone/Avondale area) that fall slightly
 * east of the Census county polygon boundary.
 *
 * All 112 venues in src/data/venues.ts fall within this bbox.
 *
 * Format: [[lngWest, latSouth], [lngEast, latNorth]]
 */

export const PUEBLO_COUNTY_BBOX: [[number, number], [number, number]] = [
  [-105.1107, 37.6747],
  [-103.8830, 38.5824],
];

/**
 * Minimum zoom level for the map.
 *
 * At zoom 9 on a 375px-wide viewport the full county (~90km N–S,
 * ~95km E–W) fits comfortably with room to spare. Zoom 8 would show
 * the county as a small object; 9 is the practical floor.
 */
export const PUEBLO_COUNTY_MIN_ZOOM = 9;
