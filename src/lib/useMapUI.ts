"use client";

/**
 * useMapUI — UI and selection state for MapWrapper.
 *
 * Owns: selected venue, view mode, WebGL availability, desktop window
 * expanded state, bottom-sheet snap state, and the Mapbox map instance.
 *
 * WHY separate from useMapFilters: UI/selection state doesn't participate
 * in the filter pipeline — separating the two halves makes MapWrapper's
 * state surface legible and makes the pure filter logic (useMapFilters)
 * independently testable.
 */

import { useCallback, useEffect, useState } from "react";
import { isWebGLAvailable } from "@/lib/webgl";
import type { ViewMode } from "@/components/ViewToggle";
import type mapboxgl from "mapbox-gl";

export function useMapUI() {
  // ── Selected venue ────────────────────────────────────────────────────────────
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

  // ── View mode (#129) — map (default) or full-screen list ───────────────────
  const [viewMode, setViewMode] = useState<ViewMode>("map");

  // ── WebGL / Mapbox unavailable (#165) ────────────────────────────────────────
  // Starts false so server + first client render both assume WebGL is available
  // (no hydration mismatch). A useEffect below flips it client-side only when
  // WebGL is genuinely absent.
  const [mapUnavailable, setMapUnavailable] = useState(false);

  const handleMapError = useCallback(() => {
    setMapUnavailable(true);
    setViewMode("list");
  }, []);

  useEffect(() => {
    if (!isWebGLAvailable()) {
      // Intentional post-hydration, client-only correction: WebGL can only be
      // probed on the client, so we flip to the list fallback here. Synchronous
      // (not deferred) so the suppressed map never gets an extra render frame.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleMapError();
    }
  }, [handleMapError]);

  // Switch to map view — but never while the map is unavailable (#165).
  const showVenueOnMap = useCallback(() => {
    if (!mapUnavailable) setViewMode("map");
  }, [mapUnavailable]);

  // ── Desktop window expanded state (PR 5) ───────────────────────────────────
  const [windowExpanded, setWindowExpanded] = useState(false);

  // ── BottomSheet snap state — used to hide SponsorCredit when sheet is full (#69)
  const [sheetFullyExpanded, setSheetFullyExpanded] = useState(false);

  // Reset expanded state when a new venue is selected (issue #122).
  useEffect(() => { queueMicrotask(() => setSheetFullyExpanded(false)); }, [selectedVenueId]);

  // ── Map instance — passed up from Map via onMapReady ───────────────────────
  // Typed as mapboxgl.Map; MapWrapper uses it for flyTo/fitBounds calls.
  const [mapboxMap, setMapboxMap] = useState<mapboxgl.Map | null>(null);

  return {
    // State
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
  };
}
