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
 * The /venue/<id> page used to render its own credit, only for OSM-sourced
 * venues (an `isOsmSourced()` source-prefix check). It now carries SiteFooter,
 * whose credit covers it (SEO/AEO plan Phase 0), so that helper is gone.
 */
export const OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright";
