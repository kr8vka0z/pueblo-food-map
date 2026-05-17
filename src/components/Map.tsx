"use client";

/**
 * Map — Mapbox GL JS basemap via react-map-gl v8.
 *
 * #44: Bare basemap.
 * #45: Venue markers wired (VenueMarker SVG pins, selection ring, click handler).
 * #46: Hover tooltips, user-location dot, attribution control.
 * #47: flyTo / fitBounds / locate flow + reduced-motion guards (this PR).
 */

import { useState, useCallback, useRef, useEffect } from "react";
import MapGL, {
  Popup,
  Marker,
  AttributionControl,
} from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Venue } from "@/types/venue";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { categoryLabels } from "@/data/venues";
import VenueMarker from "@/components/VenueMarker";
import type mapboxgl from "mapbox-gl";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Pueblo, CO city center
const PUEBLO_CENTER = {
  longitude: -104.6091,
  latitude: 38.2544,
  zoom: 13,
};

// Downtown Pueblo for 15-mile filter
const PUEBLO_LAT = 38.2544;
const PUEBLO_LNG = -104.6091;

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
  /** Called once after the map loads. Receives the underlying mapboxgl.Map instance. */
  onMapReady?: (map: mapboxgl.Map) => void;
  locale?: Locale;
}

export default function Map({
  venues,
  selectedVenueId,
  userLocation,
  userDistances,
  onSelectVenue,
  onMapReady,
  locale = "en",
}: MapProps) {
  // Centralized hover state — one Popup for the whole map avoids per-marker mount churn.
  const [hoveredVenueId, setHoveredVenueId] = useState<string | null>(null);

  const mapRef = useRef<MapRef>(null);

  // Guards — each fires at most once per mount
  const fittedBoundsRef = useRef(false);
  const flownToUserRef = useRef(false);

  // ── Reduced-motion helper ─────────────────────────────────────────────────
  // Evaluated lazily (not at module scope) so SSR never touches window.
  const prefersReducedMotion = useCallback((): boolean => {
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  // ── fitBounds-on-mount: fit to venues within 15mi of downtown Pueblo ──────
  useEffect(() => {
    if (fittedBoundsRef.current) return;
    if (venues.length === 0) return;

    fittedBoundsRef.current = true;

    const inCity = venues.filter((v) => {
      const dLat = v.lat - PUEBLO_LAT;
      const dLng = v.lng - PUEBLO_LNG;
      // Approximate miles: 1 deg lat ≈ 69mi, 1 deg lng ≈ 54mi at this latitude
      const miles = Math.sqrt((dLat * 69) ** 2 + (dLng * 54) ** 2);
      return miles <= 15;
    });

    const source = inCity.length > 0 ? inCity : venues;

    // Mapbox fitBounds: [[lngWest, latSouth], [lngEast, latNorth]]
    const lngs = source.map((v) => v.lng);
    const lats = source.map((v) => v.lat);
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];

    // Schedule after first render so mapRef is populated
    const id = setTimeout(() => {
      mapRef.current?.fitBounds(bounds, { padding: 30, duration: 0 });
    }, 0);
    return () => clearTimeout(id);
  }, [venues]);

  // ── Selected-venue flyTo — 800ms, zoom 16, reduced-motion guard ───────────
  useEffect(() => {
    if (selectedVenueId === null) return;

    const venue = venues.find((v) => v.id === selectedVenueId);
    if (!venue) return;

    if (prefersReducedMotion()) {
      mapRef.current?.jumpTo({ center: [venue.lng, venue.lat], zoom: 16 });
    } else {
      mapRef.current?.flyTo({
        center: [venue.lng, venue.lat],
        zoom: 16,
        duration: 800,
      });
    }
  }, [selectedVenueId, venues, prefersReducedMotion]);

  // ── User-location flyTo — 600ms, zoom 14, fires once, venue has priority ──
  useEffect(() => {
    if (!userLocation) return;
    if (flownToUserRef.current) return;
    if (selectedVenueId !== null) return; // venue flyTo takes priority

    flownToUserRef.current = true;

    if (prefersReducedMotion()) {
      mapRef.current?.jumpTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 14,
      });
    } else {
      mapRef.current?.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 14,
        duration: 600,
      });
    }
  }, [userLocation, selectedVenueId, prefersReducedMotion]);

  // ── Marker interaction handlers ───────────────────────────────────────────

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

  // ── onLoad: fire onMapReady with the underlying mapboxgl.Map instance ─────
  const handleLoad = useCallback(
    (e: { target: mapboxgl.Map }) => {
      onMapReady?.(e.target);
    },
    [onMapReady],
  );

  return (
    <MapGL
      ref={mapRef}
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={PUEBLO_CENTER}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      style={{ width: "100%", height: "100%" }}
      attributionControl={false}
      onLoad={handleLoad}
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
