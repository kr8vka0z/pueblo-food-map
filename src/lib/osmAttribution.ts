/**
 * OSM attribution helpers (#133 4.5).
 *
 * ODbL requires "© OpenStreetMap contributors" to stay visible wherever
 * OSM-derived venue data is shown. `Map.tsx`'s Mapbox AttributionControl
 * covers the map view itself; ListView, the /venues directory, and other
 * SiteFooter pages show venue data WITHOUT the map (ListView is an
 * `absolute inset-0` overlay that covers the control entirely in list
 * mode), so those surfaces need their own credit line, linking to
 * https://www.openstreetmap.org/copyright.
 *
 * WHY a source-string prefix check, not a `source_type` field: the public
 * `Venue` type (src/types/venue.ts) has no `source_type` — only the admin
 * D1 row does, and that's stripped before publish. `source` is the only
 * signal a published Venue carries, and the OSM scraper
 * (scripts/fetch-osm-grocery.py / ingest-osm-grocery.py) always writes it
 * as "OpenStreetMap (way/<id>)" or "OpenStreetMap (node/<id>)" — see
 * published-venues.ts for real examples.
 */
export const OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright";

export function isOsmSourced(source: string): boolean {
  return source.startsWith("OpenStreetMap");
}
