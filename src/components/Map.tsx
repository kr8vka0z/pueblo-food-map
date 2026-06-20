"use client";

/**
 * Map — Mapbox GL JS basemap via react-map-gl v8.
 *
 * #44: Bare basemap.
 * #45: Venue markers wired (VenueMarker SVG pins, selection ring, click handler).
 * #46: Hover tooltips, user-location dot, attribution control.
 * #47: flyTo / fitBounds / locate flow + reduced-motion guards (this PR).
 * #62: Pan/zoom constraint (maxBounds + minZoom) + inverted county mask layer.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import MapGL, {
  Popup,
  Marker,
  AttributionControl,
  Source,
  Layer,
} from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import type { LayerProps } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Venue } from "@/types/venue";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { categoryLabels } from "@/data/venues";
import VenueMarker from "@/components/VenueMarker";
import type mapboxgl from "mapbox-gl";
import {
  PUEBLO_COUNTY_BBOX,
  PUEBLO_COUNTY_MIN_ZOOM,
  PUEBLO_CENTER_LAT,
  PUEBLO_CENTER_LNG,
} from "@/data/pueblo-bbox";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Pueblo, CO city center
const PUEBLO_CENTER = {
  longitude: PUEBLO_CENTER_LNG,
  latitude: PUEBLO_CENTER_LAT,
  zoom: 13,
};

// Downtown Pueblo for 15-mile filter
const PUEBLO_LAT = 38.2544;
const PUEBLO_LNG = -104.6091;

// Design tokens (mirrors globals.css @theme)
const BRAND_NAVY = "#190F3F";
const SAGE_500 = "#4A8466";

// ─── County mask constants ─────────────────────────────────────────────────────
//
// The mask is a GeoJSON polygon with two rings:
//   1. A world-covering outer ring (CCW — standard GeoJSON exterior winding).
//   2. The county boundary as a hole (CW — GeoJSON hole winding).
//
// This causes the fill layer to cover everything EXCEPT the county, creating
// the dimmed-surroundings effect (#62).
//
// The county boundary ring coordinates are sourced from
// public/data/pueblo-county-boundary.geojson (Census TIGER/Line, FIPS 08-101,
// simplified to ~17 KB via mapshaper dp 60%). We load the URL at runtime so
// the boundary data is not bundled into the JS.

const COUNTY_BOUNDARY_URL = "/data/pueblo-county-boundary.geojson";

// Mask fill layer: black @ 50% opacity covers out-of-county area.
const COUNTY_MASK_FILL_LAYER: LayerProps = {
  id: "pueblo-county-mask-fill",
  type: "fill",
  paint: {
    "fill-color": "#000000",
    "fill-opacity": 0.5,
  },
};

// County border line layer: thin brand-navy line traces the county edge.
const COUNTY_BORDER_LAYER: LayerProps = {
  id: "pueblo-county-border",
  type: "line",
  paint: {
    "line-color": BRAND_NAVY,
    "line-width": 1.5,
    "line-opacity": 0.7,
  },
};

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
  /**
   * Incremented by MapWrapper each time the user explicitly taps the locate
   * button. The flyTo effect depends on this counter so it fires on every tap,
   * not just the first (#60). Passive watchPosition jitter (same counter value)
   * does NOT re-center. Defaults to 0 (no explicit recenter requested yet).
   */
  recenterRequestId?: number;
  /**
   * Called after each pan/zoom completes (moveend). Receives the current
   * viewport bounds so MapWrapper can detect whether the user-location dot
   * has drifted off-screen (#108 drift detection).
   */
  onMoveEnd?: (bounds: mapboxgl.LngLatBounds) => void;
}

export default function Map({
  venues,
  selectedVenueId,
  userLocation,
  userDistances,
  onSelectVenue,
  onMapReady,
  locale = "en",
  recenterRequestId = 0,
  onMoveEnd,
}: MapProps) {
  // Centralized hover state — one Popup for the whole map avoids per-marker mount churn.
  const [hoveredVenueId, setHoveredVenueId] = useState<string | null>(null);

  // ── County boundary for inverted mask (#62) ───────────────────────────────
  // Fetched once on mount; null until loaded. The boundary URL is a public
  // static file (/data/pueblo-county-boundary.geojson) served from the Worker
  // assets, so no auth or CORS complexity.
  const [countyRing, setCountyRing] = useState<number[][] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(COUNTY_BOUNDARY_URL)
      .then((r) => r.json())
      .then((geojson) => {
        if (cancelled) return;
        const ring = geojson?.features?.[0]?.geometry?.coordinates?.[0];
        if (Array.isArray(ring) && ring.length > 0) {
          setCountyRing(ring as number[][]);
        }
      })
      .catch(() => {
        // Mask silently absent on fetch failure — map is still functional.
      });
    return () => { cancelled = true; };
  }, []);

  // Build the inverted mask GeoJSON: world outer ring (CCW) + county hole (CW).
  // Memoized on countyRing so it only rebuilds when the boundary data arrives.
  const maskGeoJSON = useMemo(() => {
    if (!countyRing) return null;
    // GeoJSON spec: exterior ring = CCW, holes = CW.
    // The Census ring is already CCW; reverse it for the hole winding.
    const holeRing = [...countyRing].reverse();
    return {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          // Outer ring: entire world (CCW)
          [
            [-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90],
          ],
          // Hole: county boundary (CW)
          holeRing,
        ],
      },
    };
  }, [countyRing]);

  const mapRef = useRef<MapRef>(null);

  // Guards — each fires at most once per mount
  const fittedBoundsRef = useRef(false);
  // Tracks the last recenterRequestId that triggered a flyTo. The effect fires
  // when recenterRequestId changes (explicit locate tap) OR when userLocation
  // first arrives passively (recenterRequestId stays 0). Using a ref avoids
  // adding it to the dependency array and breaking the passive-center behavior.
  const lastRecenterIdRef = useRef(-1);
  // Tracks whether the passive initial center has already fired (recenterRequestId
  // === 0 path), so watchPosition jitter doesn't re-center without a tap.
  const passiveFlownRef = useRef(false);

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

  // ── User-location flyTo — 600ms, zoom 14 ────────────────────────────────────
  //
  // Two triggers, each handled exactly once:
  //
  // 1. Passive initial center (recenterRequestId === 0):
  //    Fires when userLocation first resolves after mount. passiveFlownRef
  //    prevents re-triggering on subsequent watchPosition jitter.
  //
  // 2. Explicit recenter tap (recenterRequestId > 0):
  //    Fires every time recenterRequestId increments (i.e. user tapped locate).
  //    lastRecenterIdRef tracks the last processed id so the same tap value
  //    does not re-fire when userLocation jitters. (#60)
  //
  // Venue flyTo (selectedVenueId effect above) takes priority for PASSIVE
  // centering only. An explicit recenter tap always flies to the user, even
  // when a venue is selected (#123).
  useEffect(() => {
    if (!userLocation) return;

    const isExplicitTap = recenterRequestId > 0 && recenterRequestId !== lastRecenterIdRef.current;
    const isPassiveFirst = recenterRequestId === 0 && !passiveFlownRef.current;

    if (!isExplicitTap && !isPassiveFirst) return;

    // Don't yank the map off a selected venue on first-fix / watchPosition
    // jitter — but DO honor an explicit recenter tap (#123).
    if (selectedVenueId !== null && !isExplicitTap) return;

    if (isExplicitTap) {
      lastRecenterIdRef.current = recenterRequestId;
    } else {
      passiveFlownRef.current = true;
    }

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
  }, [userLocation, selectedVenueId, recenterRequestId, prefersReducedMotion]);

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

  // ── moveend: notify MapWrapper so it can update drift detection (#108) ────
  const handleMoveEnd = useCallback(
    (e: { target: mapboxgl.Map }) => {
      if (!onMoveEnd) return;
      const bounds = e.target.getBounds();
      if (bounds) onMoveEnd(bounds);
    },
    [onMoveEnd],
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
      onMoveEnd={handleMoveEnd}
      maxBounds={PUEBLO_COUNTY_BBOX}
      minZoom={PUEBLO_COUNTY_MIN_ZOOM}
      onError={(e) => {
        /*
         * WHY only warn, not switch to list view:
         * react-map-gl's onError fires for ALL map errors — tile 404s, single
         * failed requests, network blips — not just fatal init failures. Switching
         * to list on any error would nuke a working map every time a tile fails to
         * load. Fatal init failures (e.g. "Failed to initialize WebGL") are caught
         * by the WebGL probe (before mount) and MapErrorBoundary (render-phase
         * throw), both of which correctly activate the list fallback. This handler
         * is intentionally observation-only.
         */
        console.warn("[Map] Mapbox error:", e.error);
      }}
    >
      {/* Attribution — bottom-left per spec §10.3; styled in globals.css */}
      <AttributionControl position="bottom-left" compact={true} />

      {/* County mask — inverted fill + border line (#62).
          Rendered only after the boundary GeoJSON has loaded.
          The mask source uses inline GeoJSON data (not a URL) so we don't need
          a second network round-trip after the boundary fetch completes. */}
      {maskGeoJSON && (
        <Source
          id="pueblo-county-mask"
          type="geojson"
          data={maskGeoJSON}
        >
          <Layer {...COUNTY_MASK_FILL_LAYER} />
        </Source>
      )}
      {countyRing && (
        <Source
          id="pueblo-county-boundary"
          type="geojson"
          data={{
            type: "Feature" as const,
            properties: {},
            geometry: {
              type: "Polygon" as const,
              coordinates: [countyRing],
            },
          }}
        >
          <Layer {...COUNTY_BORDER_LAYER} />
        </Source>
      )}

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
