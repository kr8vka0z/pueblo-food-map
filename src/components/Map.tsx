"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  CircleMarker,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Venue } from "@/types/venue";
import { categoryLabels } from "@/data/venues";
import { formatMiles } from "@/lib/distance";
import { createVenueIcon } from "./VenueMarker";

const PUEBLO_CENTER: [number, number] = [38.2544, -104.6091];

// CARTO Voyager basemap — warmer / calmer than raw OSM, better marker
// hierarchy, free for OSS, same OSM data underneath (spec §10.1).
const CARTO_VOYAGER =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

interface MapProps {
  venues: Venue[];
  selectedVenueId: string | null;
  userLocation: { lat: number; lng: number } | null;
  userDistances: Map<string, number>;
  onSelectVenue: (id: string) => void;
}

// ─── MapController (logic preserved verbatim from original) ──────────────────

function MapController({
  venues,
  selectedLat,
  selectedLng,
  userLat,
  userLng,
}: {
  venues: Venue[];
  selectedLat: number | null;
  selectedLng: number | null;
  userLat: number | null;
  userLng: number | null;
}) {
  const map = useMap();
  const flownToUserRef = useRef(false);
  const fittedBoundsRef = useRef(false);

  // Recompute map size on container resize to prevent tile misalignment.
  useEffect(() => {
    const container = map.getContainer();
    const t = setTimeout(() => map.invalidateSize({ pan: false }), 100);
    const ro = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    ro.observe(container);
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, [map]);

  // Fit to venues within ~15 miles of downtown Pueblo on mount.
  useEffect(() => {
    if (fittedBoundsRef.current) return;
    if (venues.length === 0) return;
    fittedBoundsRef.current = true;
    const PUEBLO = { lat: 38.2544, lng: -104.6091 };
    const inCity = venues.filter((v) => {
      const dLat = v.lat - PUEBLO.lat;
      const dLng = v.lng - PUEBLO.lng;
      const miles = Math.sqrt((dLat * 69) ** 2 + (dLng * 54) ** 2);
      return miles <= 15;
    });
    const source = inCity.length > 0 ? inCity : venues;
    const bounds = source.map((v) => [v.lat, v.lng] as [number, number]);
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [venues, map]);

  // Venue flyTo takes priority over user location flyTo.
  useEffect(() => {
    if (selectedLat != null && selectedLng != null) {
      map.flyTo([selectedLat, selectedLng], 16, { duration: 0.8 });
      return;
    }
    if (userLat != null && userLng != null && !flownToUserRef.current) {
      flownToUserRef.current = true;
      map.flyTo([userLat, userLng], 14, { duration: 0.6 });
    }
  }, [selectedLat, selectedLng, userLat, userLng, map]);

  return null;
}

// ─── Attribution helper (bottom-left) ────────────────────────────────────────

function AttributionBottomLeft() {
  const map = useMap();

  useEffect(() => {
    const ctrl = L.control.attribution({
      position: "bottomleft",
      prefix: false,
    });
    ctrl.addTo(map);
    // Style the attribution element
    const el = ctrl.getContainer();
    if (el) {
      el.style.fontSize = "11px";
      el.style.opacity = "0.8";
      el.style.background = "transparent";
      el.style.boxShadow = "none";
    }
    return () => {
      ctrl.remove();
    };
  }, [map]);

  return null;
}

// ─── Map component ────────────────────────────────────────────────────────────

export default function Map({
  venues,
  selectedVenueId,
  userLocation,
  userDistances,
  onSelectVenue,
}: MapProps) {
  const selectedVenue = venues.find((v) => v.id === selectedVenueId) ?? null;

  return (
    <MapContainer
      center={PUEBLO_CENTER}
      zoom={13}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
      attributionControl={false}
    >
      <TileLayer
        attribution={CARTO_ATTRIBUTION}
        url={CARTO_VOYAGER}
      />

      {/* Attribution at bottom-left per spec §10.3 */}
      <AttributionBottomLeft />

      <MapController
        venues={venues}
        selectedLat={selectedVenue?.lat ?? null}
        selectedLng={selectedVenue?.lng ?? null}
        userLat={userLocation?.lat ?? null}
        userLng={userLocation?.lng ?? null}
      />

      {/* User location dot — blue circle (v1; no custom marker needed) */}
      {userLocation && (
        <CircleMarker
          center={[userLocation.lat, userLocation.lng]}
          radius={8}
          pathOptions={{
            color: "#1d4ed8",
            fillColor: "#3b82f6",
            fillOpacity: 1,
            weight: 3,
          }}
        >
          <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
            <span className="text-xs font-medium">You are here</span>
          </Tooltip>
        </CircleMarker>
      )}

      {/* Venue markers — custom SVG pin via L.divIcon */}
      {venues.map((v) => {
        const isSelected = v.id === selectedVenueId;
        const icon = createVenueIcon({ category: v.category, selected: isSelected });
        const distMiles = userDistances.get(v.id);
        const distLabel = distMiles !== undefined ? formatMiles(distMiles) : "";
        const ariaLabel = `${v.name}, ${categoryLabels[v.category]}${distLabel ? `, ${distLabel} from you` : ""}`;

        return (
          <Marker
            key={v.id}
            position={[v.lat, v.lng]}
            icon={icon}
            title={ariaLabel}
            eventHandlers={{
              click: () => onSelectVenue(v.id),
            }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={1}>
              <div className="text-sm font-medium leading-tight max-w-[200px]">
                {v.name}
                <span className="block text-xs text-gray-500 font-normal">
                  {categoryLabels[v.category]}
                </span>
              </div>
            </Tooltip>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
