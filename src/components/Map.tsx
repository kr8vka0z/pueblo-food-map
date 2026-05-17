"use client";

/**
 * Map — Mapbox GL JS basemap via react-map-gl v8.
 *
 * #44: Bare basemap.
 * #45: Venue markers wired (VenueMarker SVG pins, selection ring, click handler).
 *
 * Remaining TODOs for subsequent tickets:
 *   - #46: popups, tooltips, user-location dot, attribution
 *   - #47: flyTo / fitBounds / locate flow
 *   - #48: full test update
 */

import MapGL from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Venue } from "@/types/venue";
import type { Locale } from "@/lib/i18n";
import VenueMarker from "@/components/VenueMarker";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Pueblo, CO city center
const PUEBLO_CENTER = {
  longitude: -104.6091,
  latitude: 38.2544,
  zoom: 13,
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface MapProps {
  venues: Venue[];
  selectedVenueId: string | null;
  userLocation: { lat: number; lng: number } | null; // TODO(#46): render user-location dot
  userDistances: Map<string, number>;
  onSelectVenue: (id: string) => void;
  onMapReady?: (map: unknown) => void; // TODO(#46): wire with MapRef once controls are ported
  locale?: Locale;
}

export default function Map({
  venues,
  selectedVenueId,
  userLocation: _userLocation,
  userDistances,
  onSelectVenue,
  onMapReady: _onMapReady,
  locale = "en",
}: MapProps) {
  return (
    <MapGL
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={PUEBLO_CENTER}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      style={{ width: "100%", height: "100%" }}
    >
      {venues.map((venue) => (
        <VenueMarker
          key={venue.id}
          venue={venue}
          selected={venue.id === selectedVenueId}
          distanceMiles={userDistances.get(venue.id)}
          onClick={() => onSelectVenue(venue.id)}
          locale={locale}
        />
      ))}
    </MapGL>
  );
}
