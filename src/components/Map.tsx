"use client";

import { useEffect } from "react";
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
  selectedVenue,
  userLocation,
}: {
  selectedVenue: Venue | null;
  userLocation: { lat: number; lng: number } | null;
}) {
  const map = useMap();

  // Fly to the user's location the first time we get it.
  useEffect(() => {
    if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 14, { duration: 0.6 });
    }
  }, [userLocation, map]);

  // Fly to the selected venue whenever it changes.
  useEffect(() => {
    if (selectedVenue) {
      map.flyTo([selectedVenue.lat, selectedVenue.lng], 16, { duration: 0.8 });
    }
  }, [selectedVenue, map]);

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
        selectedVenue={selectedVenue}
        userLocation={userLocation}
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
