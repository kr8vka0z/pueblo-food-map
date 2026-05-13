"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Sidebar from "./Sidebar";
import { venues as allVenues } from "@/data/venues";
import { haversineMiles } from "@/lib/distance";

const Map = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-500">
      Loading map…
    </div>
  ),
});

const PUEBLO_CENTER = { lat: 38.2544, lng: -104.6091 };

type LocationStatus =
  | "loading"
  | "granted"
  | "denied"
  | "unavailable"
  | "fallback";

type GeolocationAvailability = "available" | "unavailable" | "unknown";

// SSR-safe browser feature detection. Returns "unknown" on the server, the real
// value on the client. Lets us derive `locationStatus` instead of writing it
// from inside an effect (which triggers react-hooks/set-state-in-effect).
const noopSubscribe = () => () => {};

function readGeolocationAvailability(): GeolocationAvailability {
  return typeof navigator !== "undefined" && !!navigator.geolocation
    ? "available"
    : "unavailable";
}

function serverGeolocationAvailability(): GeolocationAvailability {
  return "unknown";
}

export default function MapWrapper() {
  const availability = useSyncExternalStore(
    noopSubscribe,
    readGeolocationAvailability,
    serverGeolocationAvailability,
  );
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [geolocationResult, setGeolocationResult] = useState<
    "granted" | "denied" | null
  >(null);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

  const locationStatus: LocationStatus =
    availability === "unknown"
      ? "loading"
      : availability === "unavailable"
        ? "unavailable"
        : (geolocationResult ?? "loading");

  useEffect(() => {
    if (availability !== "available") return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGeolocationResult("granted");
      },
      () => setGeolocationResult("denied"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }, [availability]);

  const venuesWithDistance = useMemo(() => {
    const origin = userLocation ?? PUEBLO_CENTER;
    return allVenues
      .map((v) => ({
        ...v,
        distanceMiles: haversineMiles(origin, { lat: v.lat, lng: v.lng }),
      }))
      .sort((a, b) => a.distanceMiles - b.distanceMiles);
  }, [userLocation]);

  return (
    <div className="flex h-full flex-col md:flex-row">
      <div className="max-h-64 md:max-h-none md:h-full overflow-hidden md:flex md:flex-col md:w-80 shrink-0">
        <Sidebar
          venues={venuesWithDistance}
          selectedVenueId={selectedVenueId}
          onSelect={setSelectedVenueId}
          locationStatus={locationStatus}
        />
      </div>
      <div className="flex-1 min-h-0">
        <Map
          venues={allVenues}
          selectedVenueId={selectedVenueId}
          userLocation={userLocation}
        />
      </div>
    </div>
  );
}
