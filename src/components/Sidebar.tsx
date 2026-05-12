"use client";

import type { Venue } from "@/types/venue";
import { categoryLabels, categoryColors } from "@/data/venues";
import { formatMiles } from "@/lib/distance";

interface SidebarProps {
  venues: Array<Venue & { distanceMiles: number | null }>;
  selectedVenueId: string | null;
  onSelect: (id: string) => void;
  locationStatus: "loading" | "granted" | "denied" | "unavailable" | "fallback";
}

const locationStatusMessage: Record<SidebarProps["locationStatus"], string> = {
  loading: "Detecting your location…",
  granted: "Sorted by distance from your current location.",
  denied:
    "Location permission denied. Showing distance from downtown Pueblo.",
  unavailable:
    "Location not available on this device. Showing distance from downtown Pueblo.",
  fallback: "Showing distance from downtown Pueblo.",
};

export default function Sidebar({
  venues,
  selectedVenueId,
  onSelect,
  locationStatus,
}: SidebarProps) {
  return (
    <aside className="flex w-full flex-col border-b border-gray-200 bg-white md:h-full md:w-80 md:border-b-0 md:border-r">
      <div className="border-b border-gray-200 px-4 py-2 text-xs text-gray-500">
        {locationStatusMessage[locationStatus]}
      </div>
      <ul className="flex-1 divide-y divide-gray-100 overflow-y-auto">
        {venues.map((v) => {
          const isSelected = selectedVenueId === v.id;
          return (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => onSelect(v.id)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? "bg-blue-50"
                    : "hover:bg-gray-50 focus:bg-gray-50"
                }`}
              >
                <span
                  className="mt-1 inline-block h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: categoryColors[v.category] }}
                  aria-hidden
                />
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-sm font-medium text-gray-900">
                    {v.name}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {categoryLabels[v.category]} · {v.address}
                  </span>
                </span>
                {v.distanceMiles !== null && (
                  <span className="shrink-0 text-xs font-medium text-gray-600">
                    {formatMiles(v.distanceMiles)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
