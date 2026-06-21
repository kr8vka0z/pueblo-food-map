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
 * Typeahead dropdown wired in #67: SearchResultsPopover + ARIA combobox.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import MapLoadingFallback from "./MapLoadingFallback";
import SearchBar from "./SearchBar";
import Wordmark from "./Wordmark";
import LocateButton from "./LocateButton";
import CategoryDropdown from "./CategoryDropdown";
import BottomSheet from "./BottomSheet";
import DesktopVenueWindow from "./DesktopVenueWindow";
import SponsorCredit from "./SponsorCredit";
import EmptySearchPopover from "./EmptySearchPopover";
import SearchResultsPopover, {
  MAX_VISIBLE,
  type VenueWithDistance,
  optionId,
} from "./SearchResultsPopover";
import LocationDeniedBanner from "./LocationDeniedBanner";
import MapErrorBoundary from "./MapErrorBoundary";
import { useGeolocation } from "@/lib/useGeolocation";
import { useLocale } from "@/lib/LocaleContext";
import { t } from "@/lib/i18n";
import { venues as allVenues } from "@/data/venues";
import type { Venue, VenueCategory } from "@/types/venue";
import HamburgerMenu from "./HamburgerMenu";
import ListView from "./ListView";
import {
  PUEBLO_COUNTY_BBOX,
  PUEBLO_CENTER_LAT,
  PUEBLO_CENTER_LNG,
} from "@/data/pueblo-bbox";
import { useMapFilters } from "@/lib/useMapFilters";
import { useMapUI } from "@/lib/useMapUI";

// mapbox-gl must not run on the server (uses WebGL + globalThis) — keep the
// dynamic import here in a Client Component as required by Next.js 16
// (ssr:false only works in Client Components per the lazy-loading doc).
// Wrapping MapLoadingFallback in an arrow function satisfies the
// DynamicOptionsLoadingProps signature while still rendering the locale-aware
// component (which reads locale from LocaleContext internally).
const LeafletMap = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => <MapLoadingFallback />,
});

const PUEBLO_CENTER = { lat: PUEBLO_CENTER_LAT, lng: PUEBLO_CENTER_LNG };

/**
 * Drift-detection padding (in degrees).
 * The "Re-center" button appears when the user-location dot is this far
 * outside the visible map viewport. 0.002° ≈ 220m — gives the dot a small
 * inset buffer so the button doesn't flicker at the exact edge.
 * Easy to tune for live review: increase for more generous hide threshold.
 */
export const DRIFT_PAD_DEG = 0.002;

/**
 * Checks whether a lat/lng point is inside the given viewport bounds,
 * shrunk by DRIFT_PAD_DEG on every edge.
 */
export function isPointInBounds(
  point: { lat: number; lng: number },
  bounds: mapboxgl.LngLatBounds,
): boolean {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return (
    point.lng >= sw.lng + DRIFT_PAD_DEG &&
    point.lng <= ne.lng - DRIFT_PAD_DEG &&
    point.lat >= sw.lat + DRIFT_PAD_DEG &&
    point.lat <= ne.lat - DRIFT_PAD_DEG
  );
}

/**
 * Returns true if the resolved position is outside the Pueblo County maxBounds.
 * Tied to the same bbox constant used by Map.tsx so they stay in sync.
 */
export function isOutsideCounty(point: { lat: number; lng: number }): boolean {
  const [[lngWest, latSouth], [lngEast, latNorth]] = PUEBLO_COUNTY_BBOX;
  return (
    point.lng < lngWest ||
    point.lng > lngEast ||
    point.lat < latSouth ||
    point.lat > latNorth
  );
}

// ─── Category autozoom constants (#111) ───────────────────────────────────────
//
// Padding (px) around the fitBounds result so pins aren't hidden behind chrome.
// Mobile: extra bottom clearance for the bottom-sheet peek bar (≈88px) + some top
//   clearance for the search bar (≈72px). Desktop: extra top clearance for the
//   search bar (≈72px) and right clearance for the control stack (≈60px).
//
// Tune these values during live review — they are the first thing to eyeball.
export const CATEGORY_FIT_PADDING_MOBILE = { top: 80, bottom: 120, left: 40, right: 40 };
export const CATEGORY_FIT_PADDING_DESKTOP = { top: 80, bottom: 60, left: 60, right: 80 };

/**
 * Maximum zoom level applied when fitting a category's bounds.
 * Prevents sparse categories (2–3 venues in a tight cluster) from slamming
 * to street level. Tune during live review.
 */
export const CATEGORY_FIT_MAX_ZOOM = 14;

/**
 * Compute the [[lngW, latS], [lngE, latN]] bounding box for a list of venues.
 * Returns null if the array is empty.
 */
export function computeCategoryBounds(
  venues: Pick<Venue, "lat" | "lng">[],
): [[number, number], [number, number]] | null {
  if (venues.length === 0) return null;
  let lngW = Infinity, latS = Infinity, lngE = -Infinity, latN = -Infinity;
  for (const v of venues) {
    if (v.lng < lngW) lngW = v.lng;
    if (v.lng > lngE) lngE = v.lng;
    if (v.lat < latS) latS = v.lat;
    if (v.lat > latN) latN = v.lat;
  }
  return [[lngW, latS], [lngE, latN]];
}

// Stable listbox ids — used for aria-controls on the search input and id on each listbox.
const LISTBOX_ID = "search-results-listbox";
// Mirrors the LISTBOX_ID constant inside CategoryDropdown — kept in sync here so
// MapWrapper can compute the correct aria-controls without importing a private const.
const CATEGORY_LISTBOX_ID = "category-browse-listbox";

// ─── Viewport prop (from PR 3 splash gate) ────────────────────────────────────
// 'located'      → use the user's geolocation position as initial map center.
// 'pueblo-center' → hardcoded Pueblo center (default).
// PR 3 sets this when dismissing the splash. No other behaviour changes here.
export type SplashViewport = 'located' | 'pueblo-center';

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

interface MapWrapperProps {
  /** Optional: viewport mode from splash gate (PR 3). Defaults to 'pueblo-center'. */
  viewport?: SplashViewport;
  /**
   * Called when the user activates "Show welcome screen" from the hamburger
   * menu (#99). Re-shows the SplashScreen WITHOUT clearing localStorage.
   */
  onShowWelcome?: () => void;
  /** Deep link (#132): venue id from a ?venue=<id> URL to open on load. */
  initialVenueId?: string | null;
}

export default function MapWrapper({ viewport = 'pueblo-center', onShowWelcome, initialVenueId }: MapWrapperProps) {
  // ── Locale — from context ─────────────────────────────────────────────────────
  const { locale } = useLocale();

  // ── Geolocation — v2 hook ────────────────────────────────────────────────────
  const geo = useGeolocation();
  // Prefer the user's real position if available; fall back to null which will
  // resolve to PUEBLO_CENTER in the origin derivation below.
  const userLocation = geo.state.position;

  // ── UI / selection state — extracted hook ────────────────────────────────────
  const {
    selectedVenueId,
    setSelectedVenueId,
    viewMode,
    setViewMode,
    mapUnavailable,
    handleMapError,
    showVenueOnMap,
    windowExpanded,
    setWindowExpanded,
    sheetFullyExpanded,
    setSheetFullyExpanded,
    mapboxMap,
    setMapboxMap,
  } = useMapUI();

  // ── Location-denied banner (PR 7) ────────────────────────────────────────────
  // Shows only when the user ACTIVELY re-taps locate (not on initial mount when
  // permission is already denied — that path uses silent Pueblo-center fallback).
  //
  // Strategy: track "user requested at" as a timestamp ref.
  //   - handleLocateRequest sets the ref and calls geo.request()
  //   - A useEffect watches geo.state.permission; if it transitions to "denied"
  //     AND a request was made after the last time the banner was shown, the
  //     banner appears.
  //   - bannerShownAt tracks when we last surfaced the banner so subsequent
  //     automatic Permissions API changes don't re-trigger it.
  const [bannerVisible, setBannerVisible] = useState(false);
  const userRequestedAtRef = useRef<number>(0);   // epoch ms of last user-initiated request
  const bannerShownAtRef   = useRef<number>(0);   // epoch ms of last time banner was shown

  useEffect(() => {
    if (
      geo.state.permission === "denied" &&
      userRequestedAtRef.current > bannerShownAtRef.current
    ) {
      setBannerVisible(true);
      bannerShownAtRef.current = Date.now();
    }
    // Depend on geo.state (object reference) rather than just permission:
    // useGeolocation always creates a new state object on each setState call,
    // so this effect fires even when permission stays "denied" across retries.
  }, [geo.state]);

  // ── Explicit recenter counter — incremented on each user-initiated locate tap ──
  // Map.tsx's flyTo effect depends on this value so the map re-centers every
  // time the user taps LocateButton, not just on the first geolocation event. (#60)
  const [recenterRequestId, setRecenterRequestId] = useState(0);

  // ── Locating state — true while a geo request is in flight (#108) ────────────
  // Rendered by LocateButton as the "Locating…" spinner state.
  const [isLocating, setIsLocating] = useState(false);
  // geoRequestedAtRef: epoch ms of last in-flight locate request (ref, not state,
  // so the useEffect below doesn't depend on isLocating itself).
  const geoRequestedAtRef = useRef<number>(0);
  const loadingClearedAtRef = useRef<number>(0); // epoch ms of last time spinner was cleared

  // ── Drift detection (#108) ───────────────────────────────────────────────────
  // isDrifted: true when the user-location dot has left the visible viewport.
  const [isDrifted, setIsDrifted] = useState(false);

  // ── Outside-county message (#108) ────────────────────────────────────────────
  const [outsideCountyVisible, setOutsideCountyVisible] = useState(false);

  // Watch geo.state for resolution of an in-flight locate request.
  // Mirrors the existing bannerVisible effect: use refs (not isLocating state)
  // as the gate so this effect never depends on the state it sets.
  useEffect(() => {
    if (geo.state.permission === "prompt") return;
    if (geoRequestedAtRef.current <= loadingClearedAtRef.current) return;
    // Geo request resolved — clear locating spinner and check outside-county
    loadingClearedAtRef.current = Date.now();
    setIsLocating(false);
    if (geo.state.permission === "granted" && geo.state.position !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOutsideCountyVisible(isOutsideCounty(geo.state.position));
    }
  // Only re-run when geo.state (object ref) changes — same pattern as bannerVisible.
  }, [geo.state]);

  // Handle map moveend: update drift state (called from Map's onMoveEnd prop).
  // Runs from a DOM event callback, not from a React effect.
  const handleMoveEnd = useCallback(
    (bounds: mapboxgl.LngLatBounds) => {
      const pos = geo.state.permission === "granted" ? geo.state.position : null;
      if (!pos) {
        setIsDrifted(false);
        return;
      }
      setIsDrifted(!isPointInBounds(pos, bounds));
    },
    [geo.state],
  );

  // Wraps geo.request() to stamp the request timestamp and increment the
  // recenter counter so Map.tsx re-centers even if userLocation hasn't changed.
  const handleLocateRequest = useCallback(() => {
    userRequestedAtRef.current = Date.now();
    setRecenterRequestId((n) => n + 1);
    setOutsideCountyVisible(false);

    const alreadyLocated =
      geo.state.permission === "granted" && geo.state.position !== null;
    if (!alreadyLocated) {
      geoRequestedAtRef.current = Date.now();
      setIsLocating(true);
    } else {
      // Already located — this is a Re-center tap; clear drift immediately
      setIsDrifted(false);
    }
    geo.request();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.request, geo.state]);

  // ── Splash "Find food near me" → auto-locate on entry ─────────────────────────
  // The user enters the map via the splash CTA, which sets viewport='located'
  // (only after the splash's own geo grant). SplashScreen and MapWrapper use
  // SEPARATE useGeolocation instances, so the map starts with no position — which
  // is why a second "recenter" tap used to be needed. Run the locate flow once
  // here so the map centers on the user immediately; permission is already
  // granted, so getCurrentPosition resolves without re-prompting.
  const autoLocateDoneRef = useRef(false);
  useEffect(() => {
    if (viewport !== 'located') return;
    if (autoLocateDoneRef.current) return;
    autoLocateDoneRef.current = true;
    // Defer out of the effect body (set-state-in-effect lint rule).
    queueMicrotask(() => handleLocateRequest());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport]);

  // ── Mobile detection ─────────────────────────────────────────────────────────
  const isMobile = useIsMobile();

  // ── Origin — user position or Pueblo center fallback ─────────────────────────
  const origin = userLocation ?? PUEBLO_CENTER;

  // ── Filter pipeline — extracted hook (testable independently of map render) ──
  const {
    query,
    setQuery,
    selectedCategories,
    filterOpenNow,
    setFilterOpenNow,
    filterSnap,
    setFilterSnap,
    filterWic,
    setFilterWic,
    filterFavorites,
    setFilterFavorites,
    activeCategoryFilter,
    setActiveCategoryFilter,
    venuesWithDistance,
    filteredVenues,
    savedVenues,
    favoriteSet,
    favoritesCount,
    anyFilterActive,
    allVenueCounts,
    openNowCount,
    snapCount,
    wicCount,
    handleCategoryBrowseSelect,
    handleClearAllFilters,
  } = useMapFilters(origin);

  // ── Typeahead popover state (issue #67) ──────────────────────────────────────
  // isPopoverOpen: true when input is focused + query is non-empty + matches exist.
  // activeIndex: keyboard-highlighted row (-1 = none).
  // blurTimerRef: grace timer so mousedown-inside-popover doesn't lose the click.
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Deep link (#132) ──────────────────────────────────────────────────────────
  // Opened with ?venue=<id> → select that venue once the map is ready to fly.
  // Waiting for mapboxMap ensures the selected-venue flyTo (Map.tsx) actually
  // centers, instead of firing before the map has loaded.
  const deepLinkDoneRef = useRef(false);
  useEffect(() => {
    if (deepLinkDoneRef.current) return;
    if (!mapboxMap) return; // wait until the map can fly
    deepLinkDoneRef.current = true;
    if (initialVenueId && allVenues.some((v) => v.id === initialVenueId)) {
      queueMicrotask(() => setSelectedVenueId(initialVenueId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapboxMap]);

  // ── Wordmark reset handler (#61) ─────────────────────────────────────────────
  // Recenters the map on Pueblo, clears selected venue, filters, and search.
  // Does NOT re-show the splash screen (splash is a one-time onboarding gate).
  const handleWordmarkReset = useCallback(() => {
    setSelectedVenueId(null);
    handleClearAllFilters();

    if (!mapboxMap) return;

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      mapboxMap.jumpTo({ center: [PUEBLO_CENTER.lng, PUEBLO_CENTER.lat], zoom: 13 });
    } else {
      mapboxMap.flyTo({ center: [PUEBLO_CENTER.lng, PUEBLO_CENTER.lat], zoom: 13 });
    }
  }, [handleClearAllFilters, mapboxMap]);

  // ── Category autozoom (#111) ─────────────────────────────────────────────────
  // When a single category is activated from the dropdown, fit the map to all
  // venues in that category. When cleared, return to the all-venues overview.
  //
  // Fires after `activeCategoryFilter` changes, so it runs on every select/clear.
  // `mapboxMap` may be null on first render (map not yet loaded) — the guard
  // below is safe; the user can't open the dropdown before the map loads anyway.
  //
  // Interaction with #108 drift detection: `fitBounds` will fire a `moveend`
  // event which calls `handleMoveEnd` → may set `isDrifted`. That's expected;
  // the Re-center button will appear if the user-dot isn't in the new view, which
  // is correct UX. No loop risk because `handleMoveEnd` only reads bounds, it
  // does not change `activeCategoryFilter`.
  useEffect(() => {
    if (!mapboxMap) return;

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (activeCategoryFilter === null) {
      // Cleared — return to all-venues overview (mirrors wordmark reset zoom).
      const allBounds = computeCategoryBounds(allVenues);
      if (!allBounds) return;
      mapboxMap.fitBounds(allBounds, {
        padding: isMobile ? CATEGORY_FIT_PADDING_MOBILE : CATEGORY_FIT_PADDING_DESKTOP,
        maxZoom: CATEGORY_FIT_MAX_ZOOM,
        duration: reducedMotion ? 0 : 600,
      });
      return;
    }

    // Single category selected — compute bounds from all (unfiltered) venues in
    // this category so the view doesn't depend on other active filters.
    const categoryVenues = allVenues.filter((v) => v.category === activeCategoryFilter);
    const bounds = computeCategoryBounds(categoryVenues);
    if (!bounds) return;

    mapboxMap.fitBounds(bounds, {
      padding: isMobile ? CATEGORY_FIT_PADDING_MOBILE : CATEGORY_FIT_PADDING_DESKTOP,
      maxZoom: CATEGORY_FIT_MAX_ZOOM,
      duration: reducedMotion ? 0 : 600,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategoryFilter, mapboxMap]);
  // Note: `isMobile` intentionally excluded from deps — we want the padding that
  // was current at the time the category was selected, not re-zoom on resize.
  // `allVenues` is a module-level constant (stable ref); no dep needed.

  // Pre-compute distance map for Map.tsx (aria-labels on markers)
  const userDistances = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of venuesWithDistance) {
      m.set(v.id, v.distanceMiles);
    }
    return m;
  }, [venuesWithDistance]);

  // Selected venue object — used by BottomSheet (mobile) and DesktopVenueWindow (desktop)
  const selectedVenue = useMemo(
    () =>
      filteredVenues.find((v) => v.id === selectedVenueId) ??
      venuesWithDistance.find((v) => v.id === selectedVenueId) ??
      null,
    [filteredVenues, venuesWithDistance, selectedVenueId],
  );

  // ── Typeahead popover handlers (issue #67) ───────────────────────────────────
  // These come after filteredVenues / isMobile are declared so closures are valid.

  /** Open the popover when the input gains focus. */
  const handleSearchFocus = useCallback(() => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setIsPopoverOpen(true);
    // Don't reset activeIndex on focus — keeps highlight if user refocuses.
  }, []);

  /**
   * Schedule popover close on blur with a grace period.
   * The grace period allows a mousedown inside the popover (which fires before
   * blur) to call e.preventDefault(), keeping the click target alive.
   */
  const handleSearchBlur = useCallback(() => {
    blurTimerRef.current = setTimeout(() => {
      setIsPopoverOpen(false);
      setActiveIndex(-1);
    }, 150);
  }, []);

  /** Keyboard handler forwarded from SearchBar: ArrowDown/Up/Enter/Escape/Tab. */
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const popoverVisible = isPopoverOpen && filteredVenues.length > 0;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!popoverVisible) {
          setIsPopoverOpen(true);
          setActiveIndex(0);
          return;
        }
        setActiveIndex((prev) => {
          const lastRendered = Math.min(filteredVenues.length - 1, MAX_VISIBLE - 1);
          return prev < lastRendered ? prev + 1 : prev;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!popoverVisible) return;
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsPopoverOpen(false);
        setActiveIndex(-1);
      } else if (e.key === "Tab") {
        setIsPopoverOpen(false);
        setActiveIndex(-1);
      } else if (e.key === "Enter") {
        if (popoverVisible && activeIndex >= 0 && activeIndex < filteredVenues.length) {
          e.preventDefault();
          const venue = filteredVenues[activeIndex];
          setSelectedVenueId(venue.id);
          showVenueOnMap();
          if (!isMobile) setWindowExpanded(false);
          setIsPopoverOpen(false);
          setActiveIndex(-1);
        }
      }
    },
    // filteredVenues reference is stable between renders with same query/filters.
    [isPopoverOpen, filteredVenues, activeIndex, isMobile, showVenueOnMap],
  );

  // Select a venue from the Saved list (#132 9c). Clears active filters + search
  // so the venue is in the filtered set — that makes its pin visible and lets the
  // map fly to it (Map.tsx's selected-venue flyTo reads the filtered set) — then
  // opens its detail card.
  const handleSelectSavedVenue = useCallback(
    (venueId: string) => {
      handleClearAllFilters();
      setSelectedVenueId(venueId);
      showVenueOnMap();
      if (!isMobile) setWindowExpanded(false);
    },
    [handleClearAllFilters, isMobile, showVenueOnMap],
  );

  /** Called when user clicks/taps a result row inside the popover. */
  const handleSelectVenueFromPopover = useCallback(
    (venueId: string) => {
      setSelectedVenueId(venueId);
      showVenueOnMap();
      if (!isMobile) setWindowExpanded(false);
      setIsPopoverOpen(false);
      setActiveIndex(-1);
    },
    [isMobile, showVenueOnMap],
  );

  // Select a venue from the list (#129) — switch back to the map, centered on it.
  // showVenueOnMap guards against bouncing to a suppressed/blank map when mapUnavailable (#165).
  const handleSelectFromList = useCallback(
    (venueId: string) => {
      setSelectedVenueId(venueId);
      showVenueOnMap();
      if (!isMobile) setWindowExpanded(false);
    },
    [isMobile, showVenueOnMap],
  );

  // Derive the active option id for aria-activedescendant.
  const activeDescendantId =
    isPopoverOpen && activeIndex >= 0
      ? optionId(LISTBOX_ID, activeIndex)
      : undefined;

  // The results popover should show: focused + non-empty query + has matches.
  const showResultsPopover =
    isPopoverOpen && query.trim() !== "" && filteredVenues.length > 0;

  // Category browse dropdown: focused + empty query (#95).
  const showCategoryDropdown = isPopoverOpen && query.trim() === "";

  // Cancel blur timer when mousedown fires inside the category dropdown —
  // same grace-period pattern as the results popover.
  const handleCategoryDropdownMouseDown = useCallback(() => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="relative h-full w-full">
      {/* Map — fills viewport; skipped entirely when WebGL is unavailable (#165).
          MapErrorBoundary catches fatal init throws as a secondary safety net. */}
      {!mapUnavailable && (
        <MapErrorBoundary onError={handleMapError}>
          <LeafletMap
            venues={filteredVenues}
            selectedVenueId={selectedVenueId}
            userLocation={userLocation}
            userDistances={userDistances}
            recenterRequestId={recenterRequestId}
            onSelectVenue={(id) => {
              setSelectedVenueId(id);
              if (!isMobile) {
                setWindowExpanded(false);
              }
            }}
            onMapReady={(map) => setMapboxMap(map)}
            onMoveEnd={handleMoveEnd}
          />
        </MapErrorBoundary>
      )}

      {/* List view (#129) — full-screen overlay above the map, below top chrome.
          When mapUnavailable, the notice prop carries the fallback banner (#165)
          so it renders inside ListView's z-[700] stacking context and stays visible. */}
      {viewMode === "list" && (
        <ListView
          venues={filteredVenues}
          selectedVenueId={selectedVenueId}
          onSelect={handleSelectFromList}
          onClearFilters={handleClearAllFilters}
          showClearFilters={anyFilterActive || query.trim() !== ""}
          locale={locale}
          notice={
            mapUnavailable ? (
              <div
                role="status"
                aria-live="polite"
                className="w-full px-4 py-3 flex items-start gap-3 bg-[var(--color-bone-100)] border-b border-[var(--color-bone-300)] text-[var(--color-ink-700)]"
              >
                <span className="flex-1">
                  <strong className="block text-sm font-semibold mb-0.5">
                    {t("map.unavailableTitle", locale)}
                  </strong>
                  <span className="text-sm">{t("map.unavailableBody", locale)}</span>
                </span>
              </div>
            ) : undefined
          }
        />
      )}

      {/* Top-left cluster: Wordmark (#97; EN/ES toggle moved to hamburger menu #109)
           - Positioned absolute top-4 left-4, z-index 1000.
           - Wordmark uses selfPositioned=false so it doesn't add its own absolute styles. */}
      <div
        className="absolute top-4 left-4 flex items-center gap-2"
        style={{ zIndex: 1000 }}
      >
        <Wordmark onClick={handleWordmarkReset} locale={locale} size="sm" selfPositioned={false} />
      </div>

      {/* SearchBar — controlled (PR 6), ARIA combobox wired (#67)
          filterChip shows the active category filter (#95). */}
      <SearchBar
        value={query}
        onChange={(next) => {
          setQuery(next);
          // Reset activeIndex on every keystroke — new results set.
          setActiveIndex(-1);
        }}
        placeholder={t("search.placeholder", locale)}
        ariaLabel={t("search.aria", locale)}
        comboboxEnabled={true}
        comboboxExpanded={showResultsPopover || showCategoryDropdown}
        comboboxControls={
          showCategoryDropdown
            ? CATEGORY_LISTBOX_ID
            : showResultsPopover
              ? LISTBOX_ID
              : undefined
        }
        comboboxActiveDescendant={activeDescendantId}
        onFocus={handleSearchFocus}
        onBlur={handleSearchBlur}
        onKeyDownExtra={handleSearchKeyDown}
        filterChip={
          activeCategoryFilter !== null
            ? {
                label: t(`category.full.${activeCategoryFilter}`, locale),
                clearAriaLabel: t("categoryBrowse.clearFilter", locale),
                onClear: () => handleCategoryBrowseSelect(null),
              }
            : undefined
        }
      />

      {/* SearchResultsPopover — shown when query is non-empty AND has matches (#67).
          Mutually exclusive with EmptySearchPopover. */}
      {showResultsPopover && (
        <SearchResultsPopover
          venues={filteredVenues as VenueWithDistance[]}
          activeIndex={activeIndex}
          listboxId={LISTBOX_ID}
          onSelect={handleSelectVenueFromPopover}
          onClose={() => {
            setIsPopoverOpen(false);
            setActiveIndex(-1);
          }}
          locale={locale}
        />
      )}

      {/* CategoryDropdown — shown when search is focused + query is empty (#95).
          Mutually exclusive with SearchResultsPopover and EmptySearchPopover. */}
      {showCategoryDropdown && (
        <CategoryDropdown
          counts={allVenueCounts}
          activeCategory={activeCategoryFilter}
          onSelect={(cat) => {
            handleCategoryBrowseSelect(cat);
            // Close dropdown after selection
            setIsPopoverOpen(false);
          }}
          onMouseDown={handleCategoryDropdownMouseDown}
          locale={locale}
          openNowActive={filterOpenNow}
          openNowCount={openNowCount}
          onToggleOpenNow={() => setFilterOpenNow((v) => !v)}
          snapActive={filterSnap}
          snapCount={snapCount}
          onToggleSnap={() => setFilterSnap((v) => !v)}
          wicActive={filterWic}
          wicCount={wicCount}
          onToggleWic={() => setFilterWic((v) => !v)}
          favoritesActive={filterFavorites}
          favoritesCount={favoritesCount}
          onToggleFavorites={() => setFilterFavorites((v) => !v)}
        />
      )}

      {/* EmptySearchPopover — shown when query is non-empty but yields no results.
          Mutually exclusive with SearchResultsPopover (they depend on filteredVenues.length). */}
      {query.trim() !== "" && filteredVenues.length === 0 && (
        <EmptySearchPopover
          query={query.trim()}
          onSelectCategory={(label) => setQuery(label)}
          locale={locale}
        />
      )}

      {/* HamburgerMenu — top-right, above the control stack (#71).
          When mapUnavailable, intercept onViewModeChange so selecting "map"
          is a no-op — prevents the user from landing on a blank screen. */}
      <HamburgerMenu
        locale={locale}
        onShowWelcome={onShowWelcome}
        savedVenues={savedVenues}
        onSelectVenue={handleSelectSavedVenue}
        viewMode={viewMode}
        onViewModeChange={(mode) => {
          // WHY: ignore "map" selection while unavailable — map mount is
          // suppressed, so switching to map view would show a blank screen.
          if (mapUnavailable && mode === "map") return;
          setViewMode(mode);
        }}
      />

      {/* LocateButton — bottom-center, morphing control (#108). Map mode only (#129). */}
      {viewMode === "map" && (
        <LocateButton
          geoState={geo.state}
          isLocating={isLocating}
          isDrifted={isDrifted}
          onRequest={handleLocateRequest}
          sheetVisible={isMobile}
          sheetFullyExpanded={isMobile && sheetFullyExpanded}
          locale={locale}
        />
      )}

      {/* Outside-county message — appears when resolved position is beyond maxBounds (#108). Map mode only (#129). */}
      {viewMode === "map" && outsideCountyVisible && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            position: "absolute",
            bottom: isMobile ? 88 + 12 + 52 : 24 + 52, // above locate button
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1001,
            whiteSpace: "nowrap",
          }}
          className={[
            "flex items-center gap-2 px-4 py-2 rounded-full",
            "bg-[var(--color-clay-100)] text-[var(--color-clay-700)]",
            "text-sm font-medium",
            "elevation-2",
          ].join(" ")}
        >
          <span>{t("locate.outsideCounty", locale)}</span>
          <button
            type="button"
            aria-label={t("detail.close", locale)}
            onClick={() => setOutsideCountyVisible(false)}
            className="text-[var(--color-clay-500)] hover:text-[var(--color-clay-700)] transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* Legend removed: category browse is now in the search-focus dropdown (#95) */}

      {/* LocationDeniedBanner — appears only after active re-tap → denial. Map mode only (#129). */}
      {viewMode === "map" && bannerVisible && (
        <LocationDeniedBanner
          onRetry={() => {
            // Re-request; if still denied, the useEffect above re-shows the banner.
            handleLocateRequest();
          }}
          onDismiss={() => setBannerVisible(false)}
          locale={locale}
        />
      )}

      {/* SponsorCredit — bottom-right, hidden when BottomSheet is fully expanded (#69). Map mode only (#129). */}
      {viewMode === "map" && (
        <SponsorCredit hidden={isMobile && sheetFullyExpanded} locale={locale} />
      )}

      {/* BottomSheet — mobile only (vaul v2, venue-centric API). Map mode only (#129). */}
      {isMobile && viewMode === "map" && (
        <BottomSheet
          key={selectedVenueId ?? "empty"}
          venue={selectedVenue}
          onClose={() => {
            setSelectedVenueId(null);
            setSheetFullyExpanded(false);
          }}
          onExpandedChange={setSheetFullyExpanded}
          locale={locale}
        />
      )}

      {/* DesktopVenueWindow — marker-anchored, desktop only. Map mode only (#129). */}
      {!isMobile && viewMode === "map" && selectedVenue && (
        <DesktopVenueWindow
          key={selectedVenueId}
          venue={selectedVenue}
          expanded={windowExpanded}
          mapboxMap={mapboxMap}
          onExpand={() => setWindowExpanded(true)}
          onCollapse={() => setWindowExpanded(false)}
          onClose={() => {
            setSelectedVenueId(null);
            setWindowExpanded(false);
          }}
          locale={locale}
        />
      )}
    </div>
  );
}
