"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import dynamic from "next/dynamic";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import CategoryRail from "./CategoryRail";
import BottomSheet from "./BottomSheet";
import VenueDetail from "./VenueDetail";
import SearchInput from "./SearchInput";
import { venues as allVenues } from "@/data/venues";
import { haversineMiles } from "@/lib/distance";
import { computeOpenStatus } from "@/lib/hours";
import type { Locale } from "@/lib/i18n";
import type { VenueCategory } from "@/types/venue";

// Leaflet must not run on the server — keep the dynamic import here
// in a Client Component as required by Next.js 16 (ssr:false only works
// in Client Components per the lazy-loading doc).
const LeafletMap = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[var(--color-bone-100)] text-[var(--color-ink-400)] text-sm animate-pulse">
      Loading map…
    </div>
  ),
});

const PUEBLO_CENTER = { lat: 38.2544, lng: -104.6091 };
const LOCALE_KEY = "pfm-locale";

type LocationStatus =
  | "loading"
  | "granted"
  | "denied"
  | "unavailable"
  | "fallback";
type GeolocationAvailability = "available" | "unavailable" | "unknown";

// Bottom sheet snap points (fractions matching BottomSheet.tsx SNAP_POINTS)
const SNAP_PEEK = 0.18 as const;
const SNAP_FULL = 0.87 as const;
type SnapPoint = 0.18 | 0.5 | 0.87;

// ─── SSR-safe geolocation detection ─────────────────────────────────────────

const noopSubscribe = () => () => {};

function readGeoAvailability(): GeolocationAvailability {
  return typeof navigator !== "undefined" && !!navigator.geolocation
    ? "available"
    : "unavailable";
}

function serverGeoAvailability(): GeolocationAvailability {
  return "unknown";
}

// ─── SSR-safe localStorage locale ────────────────────────────────────────────

function readLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_KEY);
    if (saved === "en" || saved === "es") return saved;
  } catch {
    // ignore
  }
  return "en";
}

function serverLocale(): Locale {
  return "en";
}

// ─── MapWrapper ───────────────────────────────────────────────────────────────

export default function MapWrapper() {
  // ── Locale — SSR-safe via useSyncExternalStore ───────────────────────────
  const locale = useSyncExternalStore(noopSubscribe, readLocale, serverLocale);
  const [localeOverride, setLocaleOverride] = useState<Locale | null>(null);
  const activeLocale: Locale = localeOverride ?? locale;

  function handleLocaleChange(l: Locale) {
    setLocaleOverride(l);
    try {
      localStorage.setItem(LOCALE_KEY, l);
    } catch {
      // ignore
    }
  }

  // ── Geolocation ─────────────────────────────────────────────────────────────
  const geoAvailability = useSyncExternalStore(
    noopSubscribe,
    readGeoAvailability,
    serverGeoAvailability,
  );
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [geoResult, setGeoResult] = useState<"granted" | "denied" | null>(
    null,
  );

  const locationStatus: LocationStatus =
    geoAvailability === "unknown"
      ? "loading"
      : geoAvailability === "unavailable"
        ? "unavailable"
        : (geoResult ?? "loading");

  useEffect(() => {
    if (geoAvailability !== "available") return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoResult("granted");
      },
      () => setGeoResult("denied"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }, [geoAvailability]);

  function handleLocate() {
    if (geoAvailability !== "available") return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoResult("granted");
      },
      () => setGeoResult("denied"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  }

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] =
    useState<Set<VenueCategory> | null>(null);
  const [filterOpenNow, setFilterOpenNow] = useState(false);
  const [filterSnap, setFilterSnap] = useState(false);
  const [filterWalking, setFilterWalking] = useState(false);

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
    const q = searchQuery.trim().toLowerCase();
    const now = new Date();

    return venuesWithDistance
      .filter((v) => {
        if (
          q &&
          !v.name.toLowerCase().includes(q) &&
          !v.address.toLowerCase().includes(q)
        ) {
          return false;
        }
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
  }, [
    venuesWithDistance,
    searchQuery,
    selectedCategories,
    filterOpenNow,
    filterSnap,
    filterWalking,
  ]);

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

  // Derive selected venue — keep it visible even if it's been filtered out
  const selectedVenue = useMemo(
    () =>
      filteredVenues.find((v) => v.id === selectedVenueId) ??
      venuesWithDistance.find((v) => v.id === selectedVenueId) ??
      null,
    [filteredVenues, venuesWithDistance, selectedVenueId],
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col"
      style={{ height: "100%", maxWidth: 1440, margin: "0 auto", width: "100%" }}
    >
      {/* Top bar — search is inside bar on md+, floating below on mobile */}
      <TopBar
        locale={activeLocale}
        onLocaleChange={handleLocaleChange}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onLocate={handleLocate}
        showSearchInBar
      />

      {/* Mobile: floating search input below top bar */}
      <div className="md:hidden px-3 py-2 bg-[var(--color-bone-50)] border-b border-[var(--color-bone-200)] z-50">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          locale={activeLocale}
        />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Desktop: filter rail (280px) */}
        <div className="hidden lg:flex lg:w-[280px] shrink-0 border-r border-[var(--color-bone-200)] overflow-y-auto">
          <div className="w-full">
            <CategoryRail
              selected={selectedCategories}
              counts={categoryCounts}
              totalCount={filteredVenues.length}
              onToggle={handleToggleCategory}
              filterOpenNow={filterOpenNow}
              onFilterOpenNow={setFilterOpenNow}
              filterSnap={filterSnap}
              onFilterSnap={setFilterSnap}
              filterWalking={filterWalking}
              onFilterWalking={setFilterWalking}
              locale={activeLocale}
            />
          </div>
        </div>

        {/* Desktop: venue list column (380px) */}
        <div className="hidden lg:flex lg:w-[380px] shrink-0">
          <Sidebar
            venues={filteredVenues}
            selectedVenueId={selectedVenueId}
            selectedCategories={selectedCategories}
            categoryCounts={categoryCounts}
            totalCount={filteredVenues.length}
            onSelectVenue={(id) => setSelectedVenueId(id)}
            onToggleCategory={handleToggleCategory}
            locationStatus={locationStatus}
            locale={activeLocale}
            showCategoryChips={false}
          />
        </div>

        {/* Tablet: sidebar (360px) with chips */}
        <div className="hidden md:flex lg:hidden w-[360px] shrink-0">
          <Sidebar
            venues={filteredVenues}
            selectedVenueId={selectedVenueId}
            selectedCategories={selectedCategories}
            categoryCounts={categoryCounts}
            totalCount={filteredVenues.length}
            onSelectVenue={(id) => setSelectedVenueId(id)}
            onToggleCategory={handleToggleCategory}
            locationStatus={locationStatus}
            locale={activeLocale}
            showCategoryChips
          />
        </div>

        {/* Map — fills remaining space on all breakpoints */}
        <div className="flex-1 relative min-w-0">
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

          {/* Tablet/Desktop: detail slide-over panel */}
          {selectedVenue && (
            <div
              className={
                "hidden md:flex absolute top-0 right-0 h-full w-[420px] z-[700] " +
                "bg-[var(--color-bone-50)] elevation-2 " +
                "animate-[slideInRight_250ms_cubic-bezier(0.32,0.72,0,1)_both]"
              }
              role="dialog"
              aria-modal="true"
              aria-label={selectedVenue.name}
            >
              <style>{`
                @keyframes slideInRight {
                  from { transform: translateX(100%); opacity: 0; }
                  to   { transform: translateX(0);    opacity: 1; }
                }
                @media (prefers-reduced-motion: reduce) {
                  [style*="slideInRight"] {
                    animation: none !important;
                  }
                }
              `}</style>
              <VenueDetail
                venue={selectedVenue}
                onClose={() => setSelectedVenueId(null)}
                locale={activeLocale}
              />
            </div>
          )}
        </div>

        {/* Mobile: bottom sheet */}
        <div className="md:hidden">
          <BottomSheet
            venues={filteredVenues}
            selectedVenueId={selectedVenueId}
            selectedCategories={selectedCategories}
            categoryCounts={categoryCounts}
            totalCount={allVenues.length}
            onSelectVenue={(id) => setSelectedVenueId(id)}
            onToggleCategory={handleToggleCategory}
            locale={activeLocale}
            snap={sheetSnap}
            onSnapChange={setSheetSnap}
          />
        </div>
      </div>
    </div>
  );
}
