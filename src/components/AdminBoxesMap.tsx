"use client";

/**
 * AdminBoxesMap — the /admin/boxes tab's small status map (admin dashboard
 * build, approved mockup Direction B). Deliberately a NEW, much smaller
 * component rather than reusing src/components/Map.tsx wholesale — that
 * component carries a lot of PUBLIC-map-only behavior (walking routes,
 * popups, geolocation, the county mask layer) this admin surface has no use
 * for. What IS reused is the app's established react-map-gl setup: same
 * `NEXT_PUBLIC_MAPBOX_TOKEN` env var, same "streets-v12" style, same fixed
 * Pueblo center constants (src/data/pueblo-bbox.ts), same explicit
 * AttributionControl pattern (Mapbox's ToS requires attribution; Map.tsx
 * disables the default control and renders its own — this component does
 * the same, just without that file's extra positioning/customization).
 *
 * Markers are plain colored dots (STATUS_META's own colors, mirrored from
 * BoxHealthList.tsx so a box never reads a different color on the map than
 * it does in the side lists) rather than VenueMarker.tsx's SVG pin — "do
 * not hand-roll SVG" per the task spec, and a small dot is legible enough
 * at this marker count. Clicking a dot navigates to the box's edit screen,
 * same destination BoxHealthList's own rows already use.
 *
 * "Non-interactive-ish" per the task spec: no popups, no fly-to, no
 * geolocation — pan/zoom stay (Mapbox's own default gesture handling),
 * since disabling those on a real MapGL instance is more custom wiring
 * than this small status view needs.
 */

import { useRouter } from "next/navigation";
import MapGL, { AttributionControl, Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { PUEBLO_CENTER_LAT, PUEBLO_CENTER_LNG, PUEBLO_DEFAULT_ZOOM } from "@/data/pueblo-bbox";
import type { BoxHealthEntry, BoxHealthStatus } from "@/lib/boxHealth";

// Same CSS vars BoxHealthList.tsx's STATUS_META uses (globals.css @theme) —
// a raw `var(--color-…)` string works fine in an inline `style` object (CSS
// custom properties resolve at render time regardless of how the element got
// styled); a literal hex here was unnecessary duplication that could drift
// from globals.css, not something Tailwind's inline-style limitation forced.
const STATUS_DOT_COLOR: Record<BoxHealthStatus, string> = {
  ok: "var(--color-sage-500)",
  low: "var(--color-warning)",
  empty: "var(--color-danger)",
  problem: "var(--color-clay-500)",
  quiet: "var(--color-ink-400)",
};

const STATUS_LABEL: Record<BoxHealthStatus, string> = {
  ok: "OK",
  low: "Low",
  empty: "Empty",
  problem: "Problem",
  quiet: "Quiet",
};

export interface AdminBoxesMapProps {
  entries: BoxHealthEntry[];
}

export default function AdminBoxesMap({ entries }: AdminBoxesMapProps) {
  const router = useRouter();
  // Read at render time (not module scope) so a test can stub this per-case
  // without needing vi.resetModules() — Next still inlines the literal
  // build-time value in production either way (NEXT_PUBLIC_* substitution
  // happens at compile time regardless of where in the module it's read).
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!mapboxToken) {
    // Fail-soft, same "never a hard crash over a missing map" posture the
    // rest of this admin surface takes for best-effort reads — the
    // all-boxes table below still carries every box either way.
    return (
      <p className="text-sm text-[var(--color-ink-500)]">
        Map unavailable right now — see the list of boxes below instead.
      </p>
    );
  }

  return (
    <div>
      <div className="h-64 w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] sm:h-80">
        <MapGL
          mapboxAccessToken={mapboxToken}
          initialViewState={{ longitude: PUEBLO_CENTER_LNG, latitude: PUEBLO_CENTER_LAT, zoom: PUEBLO_DEFAULT_ZOOM }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          attributionControl={false}
        >
          <AttributionControl position="bottom-right" compact={true} />
          {entries.map((entry) => (
            <Marker key={entry.venueId} longitude={entry.lng} latitude={entry.lat}>
              <button
                type="button"
                onClick={() => router.push(`/admin/venues/${entry.venueId}/edit`)}
                aria-label={`${entry.name} — ${STATUS_LABEL[entry.health.status]}`}
                className="h-4 w-4 rounded-full border-2 border-white shadow-md"
                style={{ backgroundColor: STATUS_DOT_COLOR[entry.health.status] }}
              />
            </Marker>
          ))}
        </MapGL>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-ink-500)]">
        {(Object.keys(STATUS_LABEL) as BoxHealthStatus[]).map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_DOT_COLOR[status] }} aria-hidden />
            {STATUS_LABEL[status]}
          </li>
        ))}
      </ul>
    </div>
  );
}
