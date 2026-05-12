"use client";

// Leaflet touches `window` at module load, so the inner Map component cannot be
// server-rendered. Next.js 16 disallows `ssr: false` inside Server Components,
// so this client wrapper is the boundary that owns the dynamic import.

import dynamic from "next/dynamic";

const Map = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-500">
      Loading map…
    </div>
  ),
});

export default function MapWrapper() {
  return <Map />;
}
