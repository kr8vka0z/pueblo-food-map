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
import SearchBar from "./SearchBar";
import Wordmark from "./Wordmark";
import LocateButton from "./LocateButton";
import LanguageToggle from "./LanguageToggle";
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
import { useGeolocation } from "@/lib/useGeolocation";
import { useLocale } from "@/lib/LocaleContext";
import { t } from "@/lib/i18n";
import { venues as allVenues } from "@/data/venues";
import { haversineMiles } from "@/lib/distance";
import { computeOpenStatus } from "@/lib/hours";
import { searchVenues } from "@/lib/searchVenues";
import type { VenueCategory } from "@/types/venue";
import HamburgerMenu from "./HamburgerMenu";

// mapbox-gl must not run on the server (uses WebGL + globalThis) — keep the
// dynamic import here in a Client Component as required by Next.js 16
// (ssr:false only works in Client Components per the lazy-loading doc).
const LeafletMap = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[var(--color-bone-100)] text-[var(--color-ink-400)] text-sm motion-safe:animate-pulse">
      Loading map…
    </div>
  ),
});

const PUEBLO_CENTER = { lat: 38.2544, lng: -104.6091 };

// Stable listbox id — used for aria-controls on the search input and id on the listbox.
const LISTBOX_ID = "search-results-listbox";

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
}

export default function MapWrapper({ viewport = 'pueblo-center' }: MapWrapperProps) {
  // ── Locale — from context ─────────────────────────────────────────────────────
  const { locale } = useLocale();

  // ── Geolocation — v2 hook ────────────────────────────────────────────────────
  const geo = useGeolocation();
  // When viewport === 'located', prefer the user's real position if available;
  // fall back to null which will resolve to PUEBLO_CENTER in the origin derivation below.
  const userLocation =
    viewport === 'located' ? geo.state.position : geo.state.position;

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

  // Wraps geo.request() to stamp the request timestamp and increment the
  // recenter counter so Map.tsx re-centers even if userLocation hasn't changed.
  const handleLocateRequest = useCallback(() => {
    userRequestedAtRef.current = Date.now();
    setRecenterRequestId((n) => n + 1);
    geo.request();
  }, [geo]);

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

  // ── Category browse filter (#95) ─────────────────────────────────────────────
  // Single-select filter driven from the search-focus category dropdown.
  // Syncs into selectedCategories for the venue render path.
  const [activeCategoryFilter, setActiveCategoryFilter] =
    useState<VenueCategory | null>(null);

  // ── Selected venue ───────────────────────────────────────────────────────────
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

  // ── Desktop window expanded state (PR 5) ─────────────────────────────────────
  const [windowExpanded, setWindowExpanded] = useState(false);

  // ── BottomSheet snap state — used to hide SponsorCredit when sheet is full (#69) ──
  const [sheetFullyExpanded, setSheetFullyExpanded] = useState(false);

  // ── Map instance — passed up from Map via onMapReady (wired in #47) ────────
  // Stored in state so changes trigger re-render in DesktopVenueWindow.
  // Typed as unknown; DesktopVenueWindow narrows it via its MapboxMap interface.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [mapboxMap, setMapboxMap] = useState<any>(null);

  // ── Typeahead popover state (issue #67) ──────────────────────────────────────
  // isPopoverOpen: true when input is focused + query is non-empty + matches exist.
  // activeIndex: keyboard-highlighted row (-1 = none).
  // blurTimerRef: grace timer so mousedown-inside-popover doesn't lose the click.
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ── Category browse handler (#95) ─────────────────────────────────────────────
  // Selects/toggles a single category from the dropdown; syncs selectedCategories.
  const handleCategoryBrowseSelect = useCallback(
    (cat: VenueCategory | null) => {
      setActiveCategoryFilter(cat);
      setSelectedCategories(cat !== null ? new Set([cat]) : null);
    },
    [],
  );

  // ── Total venue counts per category — from all venues (not filtered) ─────────
  // Used by CategoryDropdown to show stable counts alongside each category row.
  const allVenueCounts = useMemo(() => {
    return allVenues.reduce<Partial<Record<VenueCategory, number>>>(
      (acc, v) => {
        acc[v.category] = (acc[v.category] ?? 0) + 1;
        return acc;
      },
      {},
    );
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
    setActiveCategoryFilter(null);
  }

  // ── Wordmark reset handler (#61) ─────────────────────────────────────────────
  // Recenters the map on Pueblo, clears selected venue, filters, and search.
  // Does NOT re-show the splash screen (splash is a one-time onboarding gate).
  const handleWordmarkReset = useCallback(() => {
    setSelectedVenueId(null);
    setSelectedCategories(null);
    setActiveCategoryFilter(null);
    setQuery("");

    if (!mapboxMap) return;

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      mapboxMap.jumpTo({ center: [PUEBLO_CENTER.lng, PUEBLO_CENTER.lat], zoom: 13 });
    } else {
      mapboxMap.flyTo({ center: [PUEBLO_CENTER.lng, PUEBLO_CENTER.lat], zoom: 13 });
    }
  }, [mapboxMap]);

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
          if (!isMobile) setWindowExpanded(false);
          setIsPopoverOpen(false);
          setActiveIndex(-1);
        }
      }
    },
    // filteredVenues reference is stable between renders with same query/filters.
    [isPopoverOpen, filteredVenues, activeIndex, isMobile],
  );

  /** Called when user clicks/taps a result row inside the popover. */
  const handleSelectVenueFromPopover = useCallback(
    (venueId: string) => {
      setSelectedVenueId(venueId);
      if (!isMobile) setWindowExpanded(false);
      setIsPopoverOpen(false);
      setActiveIndex(-1);
    },
    [isMobile],
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
      {/* Map — fills viewport */}
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
      />

      {/* Top-left cluster: Wordmark + EN/ES toggle (#97)
           - Positioned absolute top-4 left-4, z-index 1000.
           - Wordmark uses selfPositioned=false so it doesn't add its own absolute styles.
           - Both fit side-by-side at 375px without wrapping. */}
      <div
        className="absolute top-4 left-4 flex items-center gap-2"
        style={{ zIndex: 1000 }}
      >
        <Wordmark onClick={handleWordmarkReset} locale={locale} size="sm" selfPositioned={false} />
        <LanguageToggle />
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
        comboboxControls={LISTBOX_ID}
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

      {/* HamburgerMenu — top-right, above the control stack (#71) */}
      <HamburgerMenu locale={locale} />

      {/* LocateButton — below hamburger; top offset set via inline style in component (#71) */}
      <LocateButton geoState={geo.state} onRequest={handleLocateRequest} locale={locale} />

      {/* Legend removed: category browse is now in the search-focus dropdown (#95) */}

      {/* LocationDeniedBanner — appears only after active re-tap → denial */}
      {bannerVisible && (
        <LocationDeniedBanner
          onRetry={() => {
            // Re-request; if still denied, the useEffect above re-shows the banner.
            handleLocateRequest();
          }}
          onDismiss={() => setBannerVisible(false)}
          locale={locale}
        />
      )}

      {/* SponsorCredit — bottom-right, hidden when BottomSheet is fully expanded (#69) */}
      <SponsorCredit hidden={isMobile && sheetFullyExpanded} locale={locale} />

      {/* BottomSheet — mobile only (vaul v2, venue-centric API) */}
      {isMobile && (
        <BottomSheet
          key={selectedVenueId ?? "empty"}
          venue={selectedVenue}
          onClose={() => {
            setSelectedVenueId(null);
            setSheetFullyExpanded(false);
          }}
          onSnapChange={(snap) => setSheetFullyExpanded(snap === 0.9)}
          locale={locale}
        />
      )}

      {/* DesktopVenueWindow — marker-anchored, desktop only */}
      {!isMobile && selectedVenue && (
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
