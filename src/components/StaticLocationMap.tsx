/**
 * StaticLocationMap — a plain, non-interactive reference map for the admin
 * "Add a venue" / edit form's Location section (#678). Deliberately a
 * Mapbox Static Images API `<img>`, not a react-map-gl instance
 * (AdminBoxesMap.tsx's interactive map, itself removed from the Boxes tab
 * by this same issue) — a static image needs no mapbox-gl bundle, no
 * WebGL, and no client-side pan/zoom state for a form field that only
 * needs "does this pin land in the right place".
 *
 * Zoomed to neighborhood level (`13.5`, ~1.5 miles across at 420px — Kyle's
 * own call, wider than a street-level zoom, so nearby major streets and
 * landmarks give context) rather than a tight street-level view. `pin-l`
 * (large pin) colored to match the venue's category on the public map
 * (`categoryColors`, src/data/venues.ts) — the SAME color a visitor would
 * see for this venue on the live map, so an admin previewing placement
 * isn't looking at an arbitrary color.
 *
 * No "use client": a static `<img>` needs no interactivity of its own.
 * AddVenueForm.tsx (a client component) owns debouncing the lat/lng it
 * passes down — this component just renders whatever coordinates it's
 * given, so it stays trivially testable with plain props.
 */

import type { VenueCategory } from "@/types/venue";
import { categoryColors } from "@/data/venues";
import { googleMapsUrl } from "@/components/DirectionButtons";

export interface StaticLocationMapProps {
  lat: number | null;
  lng: number | null;
  /** "" is a valid in-progress form state (no category picked yet) — falls back to a neutral pin color rather than refusing to render a map. */
  category: VenueCategory | "";
  name: string;
  address: string;
}

const MAP_ZOOM = 13.5;
const MAP_SIZE = "420x240@2x";
// A venue with no category selected yet still gets a map (coordinates alone
// are enough to place a pin) — this is the same neutral gray
// src/app/globals.css's --color-ink-400 resolves to, kept as a literal hex
// here because the Mapbox Static Images URL is built server-side-string,
// not CSS, so a `var(--color-…)` reference can't resolve inside it.
const DEFAULT_PIN_COLOR = "6A645A";

/** Narrows to a valid {lat, lng} pair in one step, or null — a plain boolean guard can't narrow TWO independent nullable params at once. */
function toValidCoordinates(lat: number | null, lng: number | null): { lat: number; lng: number } | null {
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** Exported for direct unit-testing of the URL shape (center, pin, color) without needing a DOM render. */
export function buildStaticMapUrl(lat: number, lng: number, category: VenueCategory | "", token: string): string {
  const hex = (category ? categoryColors[category] : `#${DEFAULT_PIN_COLOR}`).replace("#", "");
  return (
    `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/` +
    `pin-l+${hex}(${lng},${lat})/${lng},${lat},${MAP_ZOOM}/${MAP_SIZE}` +
    `?access_token=${token}`
  );
}

export default function StaticLocationMap({ lat, lng, category, name, address }: StaticLocationMapProps) {
  // Read at render time, not module scope — same reasoning AdminBoxesMap.tsx
  // gave for this (a test can stub process.env per-case without
  // vi.resetModules(); Next still inlines the literal build-time value in
  // production regardless of where in the module it's read).
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const coords = toValidCoordinates(lat, lng);

  if (!mapboxToken) {
    return (
      <p className="flex h-[240px] w-full items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-[var(--color-bone-100)] px-4 text-center text-sm text-[var(--color-ink-500)] sm:w-[420px]">
        Map unavailable right now.
      </p>
    );
  }

  if (!coords) {
    return (
      <p className="flex h-[240px] w-full items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-[var(--color-bone-100)] px-4 text-center text-sm text-[var(--color-ink-500)] sm:w-[420px]">
        Add coordinates to see the map.
      </p>
    );
  }

  const src = buildStaticMapUrl(coords.lat, coords.lng, category, mapboxToken);
  const alt = name && address ? `Map of ${name} at ${address}` : "Map of the venue's location";

  return (
    <div className="w-full sm:w-[420px]">
      {/* eslint-disable-next-line @next/next/no-img-element -- external Mapbox Static Images URL that changes with the form's own coordinates; next/image's remotePatterns + optimizer add nothing for a fixed-size static map image (see this file's own header). */}
      <img
        src={src}
        alt={alt}
        width={420}
        height={240}
        className="h-[240px] w-full rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] object-cover"
      />
      <a
        href={googleMapsUrl(coords.lat, coords.lng)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-sm font-medium text-[var(--color-sage-700)] underline underline-offset-2"
      >
        Open in Google Maps
      </a>
    </div>
  );
}
