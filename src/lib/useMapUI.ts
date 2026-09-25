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
import type mapboxgl from "mapbox-gl";

/**
 * "map" or "list" — which of the two full-screen views MapWrapper shows.
 * Owned here (not a component file) since #514 removed the last component
 * (ViewToggle) that used to be this type's sole home; MapWrapper,
 * HamburgerMenu, and ViewSuggestion all import it from this hook instead.
 */
export type ViewMode = "map" | "list";

/** Why the map is replaced by the list fallback (see mapUnavailableReason). */
export type MapUnavailableReason = "webgl" | "offline";

export function useMapUI() {
  // ── Selected venue ────────────────────────────────────────────────────────────
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

  // ── View mode (#129) — map (default) or full-screen list ───────────────────
  const [viewMode, setViewMode] = useState<ViewMode>("map");

  // ── WebGL / Mapbox unavailable (#165) ────────────────────────────────────────
  // Starts false so server + first client render both assume WebGL is available
  // (no hydration mismatch). A useEffect below flips it client-side only when
  // WebGL is genuinely absent.
  //
  // The reason only picks the notice copy (MapWrapper): "webgl" = this device
  // can't draw the map at all; "offline" (#130) = the page opened with no
  // connection (e.g. served by public/sw.js's cache), so Mapbox's style and
  // tiles can't load — the list works because venue data is in the bundle.
  const [mapUnavailableReason, setMapUnavailableReason] = useState<MapUnavailableReason | null>(null);
  const mapUnavailable = mapUnavailableReason !== null;

  const handleMapError = useCallback((reason: MapUnavailableReason = "webgl") => {
    setMapUnavailableReason(reason);
    setViewMode("list");
  }, []);

  useEffect(() => {
    // Intentional post-hydration, client-only correction: WebGL and
    // connectivity can only be probed on the client, so we flip to the list
    // fallback here. Synchronous (not deferred) so the suppressed map never
    // gets an extra render frame. WebGL is checked first: it's permanent, so
    // its message stays right after the connection comes back.
    //
    // ponytail: mount-time check only. Going offline mid-session is left
    // alone (Map.tsx's onError comment: a blip must not nuke a working map),
    // and coming back online doesn't re-enable the map until a reload.
    // Upgrade path: an `online` listener that clears an "offline" reason.
    if (!isWebGLAvailable()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleMapError("webgl");
    } else if (!navigator.onLine) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleMapError("offline");
    }
  }, [handleMapError]);

  // Switch to map view — but never while the map is unavailable (#165).
  const showVenueOnMap = useCallback(() => {
    if (!mapUnavailable) setViewMode("map");
  }, [mapUnavailable]);

  // ── Desktop window expanded state (PR 5) ───────────────────────────────────
  const [windowExpanded, setWindowExpanded] = useState(false);

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
    mapUnavailableReason,
    handleMapError,
    showVenueOnMap,
    windowExpanded,
    setWindowExpanded,
    mapboxMap,
    setMapboxMap,
  };
}
