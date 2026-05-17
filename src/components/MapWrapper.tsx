"use client";

/**
 * MapWrapper — v2 shell composition.
 *
 * Spec: docs/pueblo-food-map-v2-handoff.md §Mobile·375×812·map(located)
 *       and §Desktop·1440×900·map(located)
 *
 * Layout (all viewports):
 *   <div relative h-full w-full>
 *     <Map />            — fills viewport
 *     <SearchBar />      — absolute top-center, z-index 1000
 *     <LocateButton />   — absolute top-right, z-index 1000
 *     {isMobile && <BottomSheet />}   — PR 5 will replace with vaul v2
 *   </div>
 *
 * No sidebar. No category rail. No desktop split-pane.
 * Search behavior wired in PR 6: query state + searchVenues filter + EmptySearchPopover.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import dynamic from "next/dynamic";
import SearchBar from "./SearchBar";
import LocateButton from "./LocateButton";
import BottomSheet from "./BottomSheet";
import EmptySearchPopover from "./EmptySearchPopover";
import { useGeolocation } from "@/lib/useGeolocation";
import { venues as allVenues } from "@/data/venues";
import { haversineMiles } from "@/lib/distance";
import { computeOpenStatus } from "@/lib/hours";
import { searchVenues } from "@/lib/searchVenues";
import type { VenueCategory } from "@/types/venue";

// Leaflet must not run on the server — keep the dynamic import here
// in a Client Component as required by Next.js 16 (ssr:false only works
// in Client Components per the lazy-loading doc).
const LeafletMap = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[var(--color-bone-100)] text-[var(--color-ink-400)] text-sm motion-safe:animate-pulse">
      Loading map…
    </div>
  ),
});

const PUEBLO_CENTER = { lat: 38.2544, lng: -104.6091 };

// Bottom sheet snap points (fractions matching BottomSheet.tsx SNAP_POINTS)
const SNAP_PEEK = 0.18 as const;
const SNAP_FULL = 0.87 as const;
type SnapPoint = 0.18 | 0.5 | 0.87;

// isMobile: true if viewport < 768px. Detected client-side only.
// Initial state is false (SSR-safe); sync happens inside the effect via
// the MediaQueryList.onchange path only, avoiding the cascading-render
// lint rule. The initial `matches` sync runs via a one-shot "change"
// dispatch substitute: we compare in the effect and only set when different.
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    // Sync the initial value without triggering cascading-render lint rule:
    // we schedule it as a microtask so it runs after the effect commit phase.
    const syncId = setTimeout(() => setIsMobile(mql.matches), 0);
    return () => {
      clearTimeout(syncId);
      mql.removeEventListener("change", handler);
    };
  }, []);

  return isMobile;
}

// ─── MapWrapper ───────────────────────────────────────────────────────────────

export default function MapWrapper() {
  // ── Geolocation — v2 hook ────────────────────────────────────────────────────
  const geo = useGeolocation();
  const userLocation = geo.state.position;

  // ── Mobile detection ─────────────────────────────────────────────────────────
  const isMobile = useIsMobile();

  // ── Search query state (PR 6) ────────────────────────────────────────────────
  const [query, setQuery] = useState("");

  // ── Filter state — kept minimal; further filter controls are deferred ────────
  const [selectedCategories, setSelectedCategories] =
    useState<Set<VenueCategory> | null>(null);
  const [filterOpenNow] = useState(false);
  const [filterSnap] = useState(false);
  const [filterWalking] = useState(false);

  // ── Selected venue ───────────────────────────────────────────────────────────
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

  // ── Bottom sheet snap ────────────────────────────────────────────────────────
  const [sheetSnap, setSheetSnap] = useState<SnapPoint>(SNAP_PEEK);

  // ── Category toggle ──────────────────────────────────────────────────────────
  const handleToggleCategory = useCallback((cat: VenueCategory | null) => {
    if (cat === null) {
      setSelectedCategories(null);
    } else {
      setSelectedCategories((prev) => {
        const next = new Set(prev ?? []);
        if (next.has(cat)) {
          next.delete(cat);
          return next.size === 0 ? null : next;
        }
        next.add(cat);
        return next;
      });
    }
  }, []);

  // ── Computed venues ──────────────────────────────────────────────────────────
  const origin = userLocation ?? PUEBLO_CENTER;

  const venuesWithDistance = useMemo(() => {
    return allVenues.map((v) => ({
      ...v,
      distanceMiles: haversineMiles(origin, { lat: v.lat, lng: v.lng }),
    }));
  }, [origin]);

  const filteredVenues = useMemo(() => {
    const now = new Date();

    // Apply existing category / boolean filters first, then layer search on top.
    const afterFilters = venuesWithDistance
      .filter((v) => {
        if (selectedCategories !== null && selectedCategories.size > 0) {
          if (!selectedCategories.has(v.category)) return false;
        }
        if (filterOpenNow) {
          const status = computeOpenStatus(v.hours_weekly, now);
          if (status.state !== "open") return false;
        }
        if (filterSnap && !v.accepts_snap) return false;
        if (filterWalking && (v.distanceMiles ?? Infinity) > 1) return false;
        return true;
      })
      .sort((a, b) => a.distanceMiles - b.distanceMiles);

    // PR 6: apply text search (name + readable category, substring, EN-only).
    return searchVenues(afterFilters, query);
  }, [
    venuesWithDistance,
    selectedCategories,
    filterOpenNow,
    filterSnap,
    filterWalking,
    query,
  ]);

  const anyFilterActive =
    (selectedCategories !== null && selectedCategories.size > 0) ||
    filterOpenNow ||
    filterSnap ||
    filterWalking;

  function handleClearFilters() {
    setSelectedCategories(null);
  }

  // Pre-compute distance map for Map.tsx (aria-labels on markers)
  const userDistances = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of venuesWithDistance) {
      m.set(v.id, v.distanceMiles);
    }
    return m;
  }, [venuesWithDistance]);

  // Category counts over the filtered set
  const categoryCounts = useMemo(() => {
    return filteredVenues.reduce<Partial<Record<VenueCategory, number>>>(
      (acc, v) => {
        acc[v.category] = (acc[v.category] ?? 0) + 1;
        return acc;
      },
      {},
    );
  }, [filteredVenues]);

  // NOTE: selectedVenue derivation lives here for PR 5 (FloatingWindow) to consume.
  // Uncomment when PR 5 lands:
  //
  // const selectedVenue = useMemo(
  //   () =>
  //     filteredVenues.find((v) => v.id === selectedVenueId) ??
  //     venuesWithDistance.find((v) => v.id === selectedVenueId) ??
  //     null,
  //   [filteredVenues, venuesWithDistance, selectedVenueId],
  // );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="relative h-full w-full">
      {/* Map — fills viewport */}
      <LeafletMap
        venues={filteredVenues}
        selectedVenueId={selectedVenueId}
        userLocation={userLocation}
        userDistances={userDistances}
        onSelectVenue={(id) => {
          setSelectedVenueId(id);
          setSheetSnap(SNAP_FULL);
        }}
      />

      {/* SearchBar — controlled (PR 6) */}
      <SearchBar
        value={query}
        onChange={setQuery}
      />

      {/* EmptySearchPopover — shown when query is non-empty but yields no results */}
      {query.trim() !== "" && filteredVenues.length === 0 && (
        <EmptySearchPopover
          query={query.trim()}
          onSelectCategory={(label) => setQuery(label)}
        />
      )}

      {/* LocateButton — absolute top-right, z-index 1000 */}
      <LocateButton geoState={geo.state} onRequest={geo.request} />

      {/* BottomSheet — mobile only (PR 5 will replace with vaul v2 variant) */}
      {isMobile && (
        <BottomSheet
          venues={filteredVenues}
          selectedVenueId={selectedVenueId}
          selectedCategories={selectedCategories}
          categoryCounts={categoryCounts}
          totalCount={allVenues.length}
          onSelectVenue={(id) => setSelectedVenueId(id)}
          onToggleCategory={handleToggleCategory}
          snap={sheetSnap}
          onSnapChange={setSheetSnap}
          anyFilterActive={anyFilterActive}
          onClearFilters={handleClearFilters}
        />
      )}

      {/* Desktop: FloatingWindow goes here in PR 5. selectedVenue is derived above. */}
    </div>
  );
}
