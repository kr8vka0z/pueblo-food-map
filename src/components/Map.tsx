"use client";

/**
 * Map — Mapbox GL JS basemap via react-map-gl v8.
 *
 * #44: Bare basemap.
 * #45: Venue markers wired (VenueMarker SVG pins, selection ring, click handler).
 * #46: Hover tooltips, user-location dot, attribution control (this PR).
 *
 * Remaining TODOs for subsequent tickets:
 *   - #47: flyTo / fitBounds / locate flow
 *   - #48: full test update
 */

import { useState, useCallback } from "react";
import MapGL, { Popup, Marker, AttributionControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Venue } from "@/types/venue";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { categoryLabels } from "@/data/venues";
import VenueMarker from "@/components/VenueMarker";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Pueblo, CO city center
const PUEBLO_CENTER = {
  longitude: -104.6091,
  latitude: 38.2544,
  zoom: 13,
};

// Design tokens (mirrors globals.css @theme)
const BRAND_NAVY = "#190F3F";
const SAGE_500 = "#4A8466";

// ─── Props ────────────────────────────────────────────────────────────────────

interface MapProps {
  venues: Venue[];
  selectedVenueId: string | null;
  userLocation: { lat: number; lng: number } | null;
  userDistances: Map<string, number>;
  onSelectVenue: (id: string) => void;
  onMapReady?: (map: unknown) => void; // TODO(#47): wire with MapRef for flyTo / fitBounds
  locale?: Locale;
}

export default function Map({
  venues,
  selectedVenueId,
  userLocation,
  userDistances,
  onSelectVenue,
  onMapReady: _onMapReady,
  locale = "en",
}: MapProps) {
  // Centralized hover state — one Popup for the whole map avoids per-marker mount churn.
  const [hoveredVenueId, setHoveredVenueId] = useState<string | null>(null);

  const handleMarkerHover = useCallback((id: string) => {
    setHoveredVenueId(id);
  }, []);

  const handleMarkerLeave = useCallback(() => {
    setHoveredVenueId(null);
  }, []);

  const hoveredVenue = hoveredVenueId
    ? venues.find((v) => v.id === hoveredVenueId) ?? null
    : null;

  const youAreHere = t("distance.youAreHere", locale);

  return (
    <MapGL
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={PUEBLO_CENTER}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      style={{ width: "100%", height: "100%" }}
      attributionControl={false}
    >
      {/* Attribution — bottom-left per spec §10.3; styled in globals.css */}
      <AttributionControl position="bottom-left" compact={true} />

      {/* Venue markers */}
      {venues.map((venue) => (
        <VenueMarker
          key={venue.id}
          venue={venue}
          selected={venue.id === selectedVenueId}
          distanceMiles={userDistances.get(venue.id)}
          onClick={() => onSelectVenue(venue.id)}
          onHover={handleMarkerHover}
          onLeave={handleMarkerLeave}
          locale={locale}
        />
      ))}

      {/* Hover tooltip — single Popup rendered for the currently-hovered venue */}
      {hoveredVenue && (
        <Popup
          longitude={hoveredVenue.lng}
          latitude={hoveredVenue.lat}
          anchor="top"
          offset={12}
          closeButton={false}
          closeOnClick={false}
          className="pfm-tooltip"
        >
          <div className="pfm-tooltip__content">
            <span className="pfm-tooltip__name">{hoveredVenue.name}</span>
            <span className="pfm-tooltip__category">
              {categoryLabels[hoveredVenue.category]}
            </span>
          </div>
        </Popup>
      )}

      {/* User-location dot — renders when geolocation is granted */}
      {userLocation && (
        <>
          <Marker
            longitude={userLocation.lng}
            latitude={userLocation.lat}
            anchor="center"
          >
            {/* Circle: navy border + sage fill. Pulse via CSS animation.
                motion-safe class is stripped by prefers-reduced-motion reset
                in globals.css, so the @keyframes never run when reduced motion
                is active. */}
            <div
              className="pfm-user-dot"
              aria-hidden="true"
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                backgroundColor: SAGE_500,
                border: `3px solid ${BRAND_NAVY}`,
                boxShadow: `0 0 0 2px rgba(255,255,255,0.8), 0 2px 4px rgba(0,0,0,0.3)`,
              }}
            />
          </Marker>

          {/* "You are here" label — always visible while userLocation is set */}
          <Popup
            longitude={userLocation.lng}
            latitude={userLocation.lat}
            anchor="top"
            offset={14}
            closeButton={false}
            closeOnClick={false}
            className="pfm-tooltip pfm-tooltip--location"
          >
            <div className="pfm-tooltip__content">
              <span className="pfm-tooltip__name">{youAreHere}</span>
            </div>
          </Popup>
        </>
      )}
    </MapGL>
  );
}
