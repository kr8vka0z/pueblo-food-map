"use client";

/**
 * Map — Mapbox GL JS basemap via react-map-gl v8.
 *
 * #44: Bare basemap only. Accepts the same Props interface as the previous
 * Leaflet implementation so callers (MapWrapper.tsx) don't need changes.
 * All venue/interaction props are accepted but intentionally unused here;
 * they will be wired in subsequent tickets:
 *
 *   - #45: venue markers (VenueMarker SVG pins)
 *   - #46: popups, tooltips, user-location dot, attribution
 *   - #47: flyTo / fitBounds / locate flow
 *   - #48: full test update
 */

import MapGL from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Venue } from "@/types/venue";
import type { Locale } from "@/lib/i18n";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Pueblo, CO city center
const PUEBLO_CENTER = {
  longitude: -104.6091,
  latitude: 38.2544,
  zoom: 13,
};

// ─── Props — kept identical to the Leaflet version for caller compatibility ────
// Unused props are prefixed with _ (TypeScript convention for intentional no-ops).

interface MapProps {
  venues: Venue[];
  selectedVenueId: string | null;
  userLocation: { lat: number; lng: number } | null;
  userDistances: Map<string, number>;
  onSelectVenue: (id: string) => void;
  onMapReady?: (map: unknown) => void; // TODO(#46): wire with MapRef once controls are ported
  locale?: Locale;
}

export default function Map({
  venues: _venues,
  selectedVenueId: _selectedVenueId,
  userLocation: _userLocation,
  userDistances: _userDistances,
  onSelectVenue: _onSelectVenue,
  onMapReady: _onMapReady,
  locale: _locale = "en",
}: MapProps) {
  return (
    <MapGL
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={PUEBLO_CENTER}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
