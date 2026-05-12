"use client";

import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { venues, categoryLabels, categoryColors } from "@/data/venues";

const PUEBLO_CENTER: [number, number] = [38.2544, -104.6091];

export default function Map() {
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
      {venues.map((v) => (
        <CircleMarker
          key={v.id}
          center={[v.lat, v.lng]}
          radius={9}
          pathOptions={{
            color: categoryColors[v.category],
            fillColor: categoryColors[v.category],
            fillOpacity: 0.85,
            weight: 2,
          }}
        >
          <Popup>
            <div className="space-y-1 text-sm">
              <h3 className="font-semibold text-base">{v.name}</h3>
              <p className="text-xs uppercase tracking-wide text-gray-500">
                {categoryLabels[v.category]}
              </p>
              <p>{v.address}</p>
              {v.hours_weekly && (
                <p className="text-xs">
                  <span className="font-medium">Hours: </span>
                  {Object.entries(v.hours_weekly)
                    .map(([day, slots]) => `${day} ${slots.join(", ")}`)
                    .join(" · ")}
                </p>
              )}
              {v.phone && (
                <p className="text-xs">
                  <a href={`tel:${v.phone}`} className="text-blue-600 underline">
                    {v.phone}
                  </a>
                </p>
              )}
              {v.email && (
                <p className="text-xs">
                  <a href={`mailto:${v.email}`} className="text-blue-600 underline">
                    {v.email}
                  </a>
                </p>
              )}
              {v.url && (
                <p className="text-xs">
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    Source
                  </a>
                </p>
              )}
              {v.notes && <p className="text-xs text-gray-700">{v.notes}</p>}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
