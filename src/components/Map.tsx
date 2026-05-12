"use client";

import { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Venue } from "@/types/venue";
import { categoryLabels, categoryColors } from "@/data/venues";

const PUEBLO_CENTER: [number, number] = [38.2544, -104.6091];

interface MapProps {
  venues: Venue[];
  selectedVenueId: string | null;
  userLocation: { lat: number; lng: number } | null;
}

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

  // Recompute map size whenever the leaflet container resizes, AND on a
  // short delay after mount so the initial size measurement is right.
  // Leaflet caches the container size internally; without these calls the
  // map's logical center is correct but the tiles render as if the container
  // were a different size — visually misaligned by hundreds of meters.
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

  // Fit the map to venues within ~15 miles of downtown Pueblo on mount so
  // the user sees the bulk of food access points without the eastern
  // outliers (Olney Springs, Boone) dragging the bounds so wide that
  // Pueblo proper becomes a postage stamp. Outliers still render as
  // markers; they're just not used to compute the initial framing.
  useEffect(() => {
    if (fittedBoundsRef.current) return;
    if (venues.length === 0) return;
    fittedBoundsRef.current = true;
    const PUEBLO = { lat: 38.2544, lng: -104.6091 };
    const inCity = venues.filter((v) => {
      const dLat = v.lat - PUEBLO.lat;
      const dLng = v.lng - PUEBLO.lng;
      // Rough miles: 1 deg lat ≈ 69 mi, 1 deg lng at 38°N ≈ 54 mi.
      const miles = Math.sqrt((dLat * 69) ** 2 + (dLng * 54) ** 2);
      return miles <= 15;
    });
    const source = inCity.length > 0 ? inCity : venues;
    const bounds = source.map((v) => [v.lat, v.lng] as [number, number]);
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [venues, map]);

  // Single effect: venue takes priority over user-location. If a venue is
  // selected, fly there. Otherwise, fly to the user's location only the
  // first time it arrives. This avoids competing flyTo calls.
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

function VenueTooltipBody({ venue }: { venue: Venue }) {
  return (
    <div className="space-y-1 text-sm max-w-xs">
      <h3 className="font-semibold text-base leading-tight">{venue.name}</h3>
      <p className="text-xs uppercase tracking-wide text-gray-500">
        {categoryLabels[venue.category]}
      </p>
      <p className="text-xs text-gray-700">{venue.address}</p>
      {venue.hours_weekly && (
        <p className="text-xs">
          <span className="font-medium">Hours: </span>
          {Object.entries(venue.hours_weekly)
            .map(([day, slots]) => `${day} ${slots.join(", ")}`)
            .join(" · ")}
        </p>
      )}
      {venue.phone && <p className="text-xs">{venue.phone}</p>}
      {venue.email && <p className="text-xs">{venue.email}</p>}
      {venue.notes && (
        <p className="text-xs text-gray-700 leading-snug">{venue.notes}</p>
      )}
    </div>
  );
}

export default function Map({
  venues,
  selectedVenueId,
  userLocation,
}: MapProps) {
  const selectedVenue =
    venues.find((v) => v.id === selectedVenueId) ?? null;

  return (
    <MapContainer
      center={PUEBLO_CENTER}
      zoom={13}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapController
        venues={venues}
        selectedLat={selectedVenue?.lat ?? null}
        selectedLng={selectedVenue?.lng ?? null}
        userLat={userLocation?.lat ?? null}
        userLng={userLocation?.lng ?? null}
      />

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

      {venues.map((v) => {
        const isSelected = v.id === selectedVenueId;
        return (
          <CircleMarker
            key={v.id}
            center={[v.lat, v.lng]}
            radius={isSelected ? 12 : 9}
            pathOptions={{
              color: categoryColors[v.category],
              fillColor: categoryColors[v.category],
              fillOpacity: isSelected ? 1 : 0.85,
              weight: isSelected ? 4 : 2,
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -10]}
              opacity={1}
              permanent={isSelected}
            >
              <VenueTooltipBody venue={v} />
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
