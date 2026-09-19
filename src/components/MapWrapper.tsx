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
 *     <SearchBar />      — absolute top-center, z-index 1000 (Map/List switch inside)
 *     {isMobile && <BottomSheet />}
 *     <BottomNav />      — bar below 2xl, pill floating bottom-centre at 2xl+ (§3, §5); last in DOM
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
import { useRouter } from "next/navigation";
import type { WalkingRouteGeoJSON, WalkingRouteInfo, WalkStep } from "@/components/Map";
import dynamic from "next/dynamic";
import MapLoadingFallback from "./MapLoadingFallback";
import SearchBar from "./SearchBar";
import BottomNav, { BOTTOM_NAV_HEIGHT_PX, type MenuSection } from "./BottomNav";
import FilterPanel from "./FilterPanel";
import BottomSheet from "./BottomSheet";
import DesktopVenueWindow from "./DesktopVenueWindow";
import EmptySearchPopover from "./EmptySearchPopover";
import ViewSuggestion from "./ViewSuggestion";
import SearchResultsPopover, {
  MAX_VISIBLE,
  type VenueWithDistance,
  optionId,
} from "./SearchResultsPopover";
import LocationDeniedBanner from "./LocationDeniedBanner";
import MapErrorBoundary from "./MapErrorBoundary";
import { useGeolocation, type GeoState } from "@/lib/useGeolocation";
import { useLocale } from "@/lib/LocaleContext";
import { t } from "@/lib/i18n";
import { venues as allVenues } from "@/data/venues";
import type { Venue } from "@/types/venue";
import HamburgerMenu from "./HamburgerMenu";
import ListView from "./ListView";
import {
  PUEBLO_COUNTY_BBOX,
  PUEBLO_CENTER,
} from "@/data/pueblo-bbox";
import { useMapFilters } from "@/lib/useMapFilters";
import { useBoxesList } from "@/lib/useBoxesList";
import { toVenue } from "@/lib/useBoxVenues";
import type { BoxStatus, CheckinKind, PublicBlessingBox } from "@/lib/blessingBoxes";
import { useMapUI, type ViewMode } from "@/lib/useMapUI";
import { useDeferredMapLoad } from "@/lib/useDeferredMapLoad";
import { useMediaQuery, MOBILE_QUERY, BELOW_2XL_QUERY } from "@/lib/useMediaQuery";

// mapbox-gl must not run on the server (uses WebGL + globalThis) — keep the
// dynamic import here in a Client Component as required by Next.js 16
// (ssr:false only works in Client Components per the lazy-loading doc).
// Wrapping MapLoadingFallback in an arrow function satisfies the
// DynamicOptionsLoadingProps signature while still rendering the locale-aware
// component (which reads locale from LocaleContext internally).
const MapCanvas = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => <MapLoadingFallback />,
});

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

// Stable listbox id — used for aria-controls on the search input and id on the
// results listbox. The old category-browse listbox (CategoryDropdown, #95)
// was removed by #513 — search focus no longer opens a category list; the
// Filters panel is a dialog, not a combobox popup. #514 gave empty focus a
// new (non-listbox) popup instead: ViewSuggestion, a single button offering
// the other view — see showViewSuggestion below.
const LISTBOX_ID = "search-results-listbox";

// ─── Viewport prop (from PR 3 splash gate) ────────────────────────────────────
// 'located'      → use the user's geolocation position as initial map center.
// 'pueblo-center' → hardcoded Pueblo center (default).
// PR 3 sets this when dismissing the splash. No other behaviour changes here.
export type SplashViewport = 'located' | 'pueblo-center';

// ─── Walking route URL builder (pure, exported for unit tests) ───────────────

/**
 * Build the Mapbox Directions API URL for a walking route.
 * Exported so tests can assert on URL params (steps=true, language=) without
 * needing to mount MapWrapper (which requires WebGL / Mapbox GL).
 */
export function buildWalkingRouteUrl(
  originLng: number,
  originLat: number,
  destLng: number,
  destLat: number,
  token: string,
  locale: string,
): string {
  return [
    "https://api.mapbox.com/directions/v5/mapbox/walking",
    `${originLng},${originLat};${destLng},${destLat}`,
    `?geometries=geojson&overview=full&steps=true&language=${locale}&access_token=${token}`,
  ].join("/");
}

// ─── Walking step parser (pure, exported for unit tests) ─────────────────────

/**
 * Parse turn-by-turn steps from a Mapbox Directions API route object.
 *
 * Exported as a pure function so tests can exercise the parse logic without
 * mounting MapWrapper (same pattern as buildWalkingRouteUrl). This mirrors the
 * existing exported-pure-function convention in this module.
 *
 * WHY defensive access (s.maneuver?.instruction): the Mapbox API response is
 * consumed via an `as` cast — there is no runtime guarantee that every step
 * has `maneuver` or `instruction`. A missing field would throw inside a
 * `.map()` and be caught by the surrounding try/catch, silently discarding
 * the ENTIRE route (line + info + steps). Defensive access + empty-string
 * filter lets valid steps through while dropping malformed ones.
 *
 * WHY filter distance === 0 separately: the arrival step always has distance 0
 * and an empty or trivial instruction. It is kept here (dropped in formatting
 * via formatStepDistance) rather than filtered at parse time so callers that
 * want to show the arrival step can still do so.
 */
export function parseWalkSteps(
  route: {
    legs?: Array<{
      steps?: Array<{
        maneuver?: { instruction?: string };
        distance: number;
      }>;
    }>;
  },
): WalkStep[] {
  const rawSteps = route.legs?.[0]?.steps ?? [];
  return rawSteps.flatMap((s) => {
    const instruction = s.maneuver?.instruction ?? "";
    // Drop steps whose instruction is missing or empty — they are malformed
    // API responses that would render as blank list items.
    if (!instruction) return [];
    return [{ instruction, distance: s.distance }];
  });
}

// ─── Walk-resume decision (#207, pure) ────────────────────────────────────────

/** Outcome of a Walk-triggered geolocation request once it has resolved. */
export type WalkResumeAction =
  | { kind: "fetch"; origin: { lat: number; lng: number } }
  | { kind: "show-hint" }
  | { kind: "noop" };

/**
 * Decide what to do once a Walk-triggered geolocation request has resolved
 * (i.e. geoState.permission is no longer "prompt").
 *
 * Extracted as a pure function — same pattern as buildWalkingRouteUrl /
 * parseWalkSteps above — so the decision matrix is unit-testable without
 * mounting MapWrapper (WebGL is unavailable in jsdom).
 *
 * WHY the stale-selection check: if the user switches to a different venue
 * while the browser's permission prompt is still open, the eventual grant or
 * denial belongs to the venue that asked, not whatever is selected when it
 * resolves. Drawing a route (or showing a hint) for the wrong venue would be
 * the same "whose route is this?" bug the walkingRouteVenueId/selectedVenueId
 * render-gate already guards against for the fetch path (#208).
 */
export function decideWalkResume(
  awaitingVenueId: string,
  selectedVenueId: string | null,
  geoState: GeoState,
): WalkResumeAction {
  if (awaitingVenueId !== selectedVenueId) return { kind: "noop" };

  if (geoState.permission === "granted" && geoState.position !== null) {
    return { kind: "fetch", origin: geoState.position };
  }

  // Denied, or geolocation unavailable — useGeolocation's request() reports
  // both outcomes as permission: "denied". Never fall back to PUEBLO_CENTER (#207):
  // a walking route drawn from downtown when the user is elsewhere is misleading.
  return { kind: "show-hint" };
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
  /**
   * Boxes (#516): true when the resident arrived via a Menu page's "Boxes"
   * link (/?boxes=1, read once by HomePageClient). Applies the blessing_box
   * category filter on mount, the same one-shot shape `viewport === 'located'`
   * uses for auto-locate below.
   */
  initialBoxesFilter?: boolean;
}

export default function MapWrapper({
  viewport = 'pueblo-center',
  onShowWelcome,
  initialVenueId,
  initialBoxesFilter = false,
}: MapWrapperProps) {
  const router = useRouter();

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
    mapboxMap,
    setMapboxMap,
  } = useMapUI();

  // ── Deferred map load (#226) ─────────────────────────────────────────────────
  // Perf: mapbox-gl is a large WebGL payload that used to fire the instant
  // MapWrapper mounted (the dynamic import factory runs on first render of
  // <MapCanvas>, not on interaction) — it dominated the mobile Lighthouse
  // performance audit. eager=true whenever a venue deep link is present so a
  // shared link (?venue=/#venue=) still opens on its pin immediately; see the
  // hook doc for the idle/interaction triggers that fire otherwise. While
  // false, the render below shows ListView in the map's place instead of
  // mounting <MapCanvas> — same absolute-fill box, so there is no layout shift
  // when the swap happens.
  const mapLoadTriggered = useDeferredMapLoad(Boolean(initialVenueId));

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
  // time the user taps "Near me", not just on the first geolocation event. (#60)
  const [recenterRequestId, setRecenterRequestId] = useState(0);

  // ── Locating state — true while a geo request is in flight (#108) ────────────
  // Rendered by BottomNav's "Near me" item as its spinner state.
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

  // Wraps geo.request() to stamp the request timestamp and increment the
  // recenter counter so Map.tsx re-centers even if userLocation hasn't changed.
  //
  // WHY declared here (moved up from its original spot near handleMoveEnd):
  // handleWalkRoute below (#207) also calls this to request location when a
  // Walk tap has none, instead of falling back to PUEBLO_CENTER — it must be
  // declared before handleWalkRoute's useCallback deps array references it.
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

  // ── Walking route (#134) ──────────────────────────────────────────────────────
  // walkingRoute: the fetched GeoJSON for the current walking route, or null.
  // walkingRouteInfo: human-readable distance + duration text for the overlay.
  // walkingRouteSteps: turn-by-turn steps from Mapbox (pre-localized via language= param).
  // walkingRouteVenueId: which venue the current route targets — used to clear
  //   the route when selection changes to a different venue (or is cleared).
  //
  // WHY MapWrapper owns the fetch: the Directions API call requires the Mapbox
  // token (NEXT_PUBLIC_MAPBOX_TOKEN), which is available client-side. Keeping
  // the fetch here separates data-fetching from map rendering, matching the
  // existing pattern (MapWrapper handles all state, Map.tsx is a controlled
  // component). Map.tsx just receives walkingRoute + walkingRouteInfo as props.
  const [walkingRoute, setWalkingRoute] = useState<WalkingRouteGeoJSON | null>(null);
  const [walkingRouteInfo, setWalkingRouteInfo] = useState<WalkingRouteInfo | null>(null);
  const [walkingRouteSteps, setWalkingRouteSteps] = useState<WalkStep[] | null>(null);
  const [walkingRouteVenueId, setWalkingRouteVenueId] = useState<string | null>(null);

  // ── Walk-without-location (#207) ─────────────────────────────────────────────
  // walkAwaitingVenueIdRef: the venue a Walk tap is waiting on geolocation for.
  //   Set when handleWalkRoute is called with no userLocation (instead of
  //   falling back to PUEBLO_CENTER); consumed by the resume effect below once
  //   geo.state resolves. A ref, not state — read only inside that effect,
  //   never rendered; same "avoid a stale closure" reasoning as walkReqSeq.
  // walkLocationHintVenueId: which venue's Walk tap resulted in a denied/
  //   unavailable geolocation request — drives the localized "share your
  //   location" hint in DirectionButtons. Render-gated on selectedVenueId in
  //   the JSX below, same pattern as walkingRouteVenueId.
  const walkAwaitingVenueIdRef = useRef<string | null>(null);
  const [walkLocationHintVenueId, setWalkLocationHintVenueId] = useState<string | null>(null);

  // ── Stale-route race guard (FIX 1 — hardened) ───────────────────────────────
  // handleWalkRoute is async. If the user taps Walk on venue A then selects
  // venue B before A's fetch resolves, A's resolution must NOT commit state —
  // doing so would draw A's route line on the map while B is selected.
  //
  // WHY a monotonic sequence counter instead of keying on venue.id (original
  // design): keying on venue.id lets two overlapping Walk taps for the SAME
  // venue both pass the guard — the older, slower response can overwrite the
  // newer one if userLocation changed between taps (last-resolve-wins instead
  // of last-request-wins). A monotonic integer gives each fetch a unique token
  // regardless of which venue it targets.
  //
  // WHY a ref (not state): the counter is read inside an async closure. State
  // would capture a stale value at fetch launch; a ref always reflects the
  // current value at resolution time.
  //
  // WHY the seq is bumped on toggle-off and clear (but NOT in the
  // selectedVenueId-change effect): bumping on explicit user actions (toggle-off,
  // handleClearWalkingRoute) ensures a pending fetch can never repopulate a
  // route the user just cleared. We intentionally do NOT touch the seq in the
  // selectedVenueId-change effect — not touching it lets a same-task
  // select+walk-for-the-new-venue succeed. The render-gate below (gating
  // walkingRoute on walkingRouteVenueId === selectedVenueId) is the real safety
  // net for the selection-switch case.
  const walkReqSeq = useRef(0);

  // Clear walking route when selected venue changes to a different venue or is deselected.
  // WHY: if the user taps a new pin or deselects, the old route is stale and visually
  // disconnected — clearing it avoids a confusing "whose route is this?" state.
  // queueMicrotask satisfies the react-hooks/set-state-in-effect rule: setState must not
  // be called synchronously at the top level of an effect body (cascading-render risk).
  //
  // WHY we do NOT touch walkReqSeq here: see the comment above walkReqSeq. The
  // render-gate on the Map line prop (walkingRouteVenueId === selectedVenueId)
  // prevents a stale-venue route from ever drawing, so there is no need to
  // invalidate in-flight fetches here. Bumping the seq here would break the
  // same-task select+walk-for-new-venue flow (latent footgun if future UX
  // allows it).
  useEffect(() => {
    if (selectedVenueId !== walkingRouteVenueId) {
      queueMicrotask(() => {
        setWalkingRoute(null);
        setWalkingRouteInfo(null);
        setWalkingRouteSteps(null);
        setWalkingRouteVenueId(null);
      });
    }
    // #207: a stale "share your location" hint belongs to the venue that
    // triggered it, not whatever is selected now — drop it on selection
    // change, same invariant as the walking route itself just above.
    if (selectedVenueId !== walkLocationHintVenueId) {
      queueMicrotask(() => setWalkLocationHintVenueId(null));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVenueId]);

  /**
   * Fetch a walking route from Mapbox Directions API and draw it on the map.
   * origin is passed explicitly (not read from userLocation) so the resume
   * effect below can call this with a just-resolved geo.state.position
   * without waiting on a re-render to see it (#207).
   */
  const fetchWalkingRoute = useCallback(async (venue: Venue, origin: { lat: number; lng: number }) => {
    // Mint a unique request token. Any earlier in-flight fetch — including one
    // for the SAME venue — that resolves after this point will compare its seq
    // snapshot to walkReqSeq.current and bail if they differ (latest-REQUEST-wins).
    const seq = ++walkReqSeq.current;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      // No token — Directions API will fail. Fail silently; map still works.
      console.warn("[MapWrapper] NEXT_PUBLIC_MAPBOX_TOKEN missing — walking route unavailable");
      return;
    }

    // WHY steps=true: enables turn-by-turn instruction text in the response.
    // WHY language=${locale}: Mapbox returns pre-localized instruction strings,
    // so Spanish users get Spanish turn instructions without client-side translation.
    const url = buildWalkingRouteUrl(
      origin.lng, origin.lat,
      venue.lng, venue.lat,
      token,
      locale,
    );

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn("[MapWrapper] Directions API error:", res.status);
        return;
      }
      const data = await res.json() as {
        routes?: Array<{
          geometry: { type: "LineString"; coordinates: number[][] };
          distance: number;  // meters
          duration: number;  // seconds
          legs?: Array<{
            steps?: Array<{
              maneuver?: { instruction?: string };
              distance: number; // meters
            }>;
          }>;
        }>;
      };

      // Stale-route guard: bail if a newer Walk request (or a clear/toggle-off)
      // has been issued since this fetch was initiated. Uses the monotonic seq
      // so same-venue double-taps are caught too (latest-REQUEST-wins, not
      // latest-resolve-wins).
      if (walkReqSeq.current !== seq) return;

      const route = data.routes?.[0];
      if (!route) return;

      // Convert distance (m) → miles and duration (s) → "N min".
      const miles = (route.distance / 1609.34).toFixed(1);
      const minutes = Math.round(route.duration / 60);

      // Parse turn-by-turn steps via the extracted pure function (FIX 3).
      const steps = parseWalkSteps(route);

      setWalkingRoute({
        type: "Feature",
        properties: {},
        geometry: route.geometry,
      });
      setWalkingRouteInfo({
        distance: `${miles} mi`,
        duration: `${minutes} min`,
      });
      setWalkingRouteSteps(steps.length > 0 ? steps : null);
      setWalkingRouteVenueId(venue.id);
    } catch (err) {
      // Network failure — fail silently. The user can still use the Bus/Drive deeplinks.
      console.warn("[MapWrapper] Directions fetch failed:", err);
    }
  }, [locale]);

  /**
   * Handle a Walk tap: toggle off an active route, fetch one from the user's
   * real location, or — if location hasn't been shared yet — request it
   * instead of silently drawing from PUEBLO_CENTER (#207). A walking route
   * from downtown when the user is elsewhere is misleading; Bus/Drive are
   * unaffected because their Google Maps deeplinks omit origin entirely and
   * let Google use the device's own location.
   */
  const handleWalkRoute = useCallback((venue: Venue) => {
    // If user re-taps Walk on the already-active route, clear it (toggle off).
    if (walkingRouteVenueId === venue.id) {
      // Bump the seq so any pending fetch (same venue, stale userLocation) cannot
      // repopulate the route after the user explicitly toggled it off.
      walkReqSeq.current++;
      setWalkingRoute(null);
      setWalkingRouteInfo(null);
      setWalkingRouteSteps(null);
      setWalkingRouteVenueId(null);
      return;
    }

    // A fresh tap deserves a fresh outcome — drop any stale hint from a
    // previous denied attempt before trying again.
    setWalkLocationHintVenueId(null);

    if (!userLocation) {
      // No shared location yet. Ask for it via the SAME geolocation flow the
      // locate button uses (geo.request(), wrapped by handleLocateRequest) —
      // not a second getCurrentPosition implementation. The resume effect
      // below picks up the result: fetches the route on grant, shows the
      // hint on denial. Skip re-requesting if already awaiting this exact
      // venue (rapid double-tap while the browser's permission prompt is open).
      if (walkAwaitingVenueIdRef.current !== venue.id) {
        walkAwaitingVenueIdRef.current = venue.id;
        handleLocateRequest();
      }
      return;
    }

    void fetchWalkingRoute(venue, userLocation);
  }, [walkingRouteVenueId, userLocation, handleLocateRequest, fetchWalkingRoute]);

  /** Clear the walking route (e.g. when Walk button is tapped while route is active). */
  const handleClearWalkingRoute = useCallback(() => {
    // Bump seq so any pending fetch cannot repopulate the route after an
    // explicit clear — same invariant as the toggle-off branch above.
    walkReqSeq.current++;
    setWalkingRoute(null);
    setWalkingRouteInfo(null);
    setWalkingRouteSteps(null);
    setWalkingRouteVenueId(null);
  }, []);

  // ── Blessing boxes (slice 1, map-first rework 2026-09-18) — live layer,
  // fetched ONCE client-side (useBoxesList's full PublicBlessingBox shape,
  // not useBoxVenues' second fetch of the same endpoint — see toVenue's own
  // header in useBoxVenues.ts) and merged into the same filter/count/marker
  // pipeline every other venue flows through (useMapFilters' own header
  // explains why). boxIdSet lets every selection handler below tell "this
  // id is a box" apart from an ordinary venue with one Set lookup — a box
  // click now opens the SAME in-map card every other venue uses (just with
  // BoxCardBody content), not a separate page, so boxIdSet is only needed
  // where mapUnavailable still routes to a standalone page (below).
  // boxesById/boxOverrides let the open card show the box's full record
  // (status, host note, most-needed, check-ins) that the plain Venue shape
  // doesn't carry, and stay current after a check-in without a refetch.
  // WHY declared THIS early (2026-09-18 fix): the Walk-resume effect below
  // reads boxVenues in its own body and dependency array — a dependency
  // array is evaluated during THIS render pass, not deferred like an effect
  // body, so boxVenues must already be a assigned `const` by the time
  // JS execution reaches that array literal, or it's a ReferenceError
  // (temporal dead zone), not merely stale data. Caught by
  // MapWrapperBoxSelection.test.tsx failing with exactly that error.
  const { boxes: liveBoxes, loading: liveBoxesLoading } = useBoxesList();
  const boxVenues = useMemo(() => liveBoxes.map(toVenue), [liveBoxes]);
  const boxIdSet = useMemo(() => new Set(liveBoxes.map((b) => b.id)), [liveBoxes]);
  const boxesById = useMemo(() => new Map(liveBoxes.map((b) => [b.id, b])), [liveBoxes]);
  // Check-in success patches (kind/status/lastFilledAt) so the open card
  // reflects the just-submitted check-in immediately — see
  // handleBoxCheckinSuccess below. getBoxById checks this map FIRST, so an
  // override always wins over boxesById while it exists.
  //
  // Nothing clears an override today: useBoxesList() fetches exactly once on
  // mount (empty effect deps — see its own header) and never refetches, so
  // there is no later "fresh fetch" that could supersede a stale override.
  // ponytail: an override can drift from reality if the box changes by some
  // OTHER path in the same session (another tab's check-in, an admin edit).
  // Ceiling: acceptable today because nothing refetches to reconcile against.
  // If a periodic/background refetch of liveBoxes is ever added, this map
  // must be explicitly cleared or merged against the fresh data at that
  // point, or the override will permanently shadow it.
  const [boxOverrides, setBoxOverrides] = useState<Map<string, PublicBlessingBox>>(new Map());
  const getBoxById = useCallback(
    (id: string | null): PublicBlessingBox | null => {
      if (!id) return null;
      return boxOverrides.get(id) ?? boxesById.get(id) ?? null;
    },
    [boxOverrides, boxesById],
  );
  const handleBoxCheckinSuccess = useCallback(
    (boxId: string | null, result: { status: BoxStatus; lastFilledAt: string | null; kind: CheckinKind }) => {
      if (!boxId) return;
      setBoxOverrides((prev) => {
        const current = prev.get(boxId) ?? boxesById.get(boxId);
        if (!current) return prev;
        const next = new Map(prev);
        next.set(boxId, {
          ...current,
          box: {
            ...current.box,
            status: result.status,
            lastFilledAt: result.lastFilledAt,
            // Cap at 5 — the card only ever shows recentCheckins[0], and
            // BoxActivityList/history reads its own separate query, not
            // this in-memory list; keeping a handful avoids unbounded growth
            // across many check-ins in one page view.
            //
            // "problem" is skipped here, not just narrowly typed away: a
            // problem report is admin-only (PublicCheckinEvent's own kind
            // union excludes it — see blessingBoxes.ts's toPublicCheckinEvents,
            // the same structural privacy rule this in-memory patch must not
            // undermine) and never sets status (computeBoxStatus excludes it
            // too), so there is nothing for a problem submission to update on
            // the open card besides this optimistic list — correctly, nothing.
            recentCheckins:
              result.kind === "problem"
                ? current.box.recentCheckins
                : [
                    { kind: result.kind, createdAt: new Date().toISOString() },
                    ...current.box.recentCheckins,
                  ].slice(0, 5),
          },
        });
        return next;
      });
    },
    [boxesById],
  );

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

  // ── Resume a Walk request once its triggered geolocation resolves (#207) ────
  // handleWalkRoute stashes the tapped venue's id in walkAwaitingVenueIdRef and
  // calls handleLocateRequest() instead of falling back to PUEBLO_CENTER when
  // userLocation is null. This effect watches geo.state for that request's
  // resolution and applies decideWalkResume's verdict (fetch / show-hint / noop).
  useEffect(() => {
    const awaitingId = walkAwaitingVenueIdRef.current;
    if (!awaitingId) return;
    if (geo.state.permission === "prompt") return; // still waiting on the browser
    // WHY this second guard: useGeolocation's Permissions API onchange listener
    // can independently flip permission to "granted" (position still null,
    // since onchange doesn't call getCurrentPosition) slightly BEFORE the
    // getCurrentPosition call this same Walk tap triggered delivers its actual
    // fix. Treating {granted, position:null} as "resolved" here would consume
    // the ref and show the hint prematurely, then silently drop the real
    // position when it arrives a moment later (the ref is one-shot). Both
    // getCurrentPosition branches (success/error) always settle within 8s
    // (its own timeout option), so this can't wait forever.
    if (geo.state.permission === "granted" && geo.state.position === null) return;

    walkAwaitingVenueIdRef.current = null; // one resolution per request

    const action = decideWalkResume(awaitingId, selectedVenueId, geo.state);
    if (action.kind === "fetch") {
      // Includes boxVenues (map-first rework, 2026-09-18) — a box card's
      // address doubles as its own Walk trigger (walk restore pass,
      // 2026-09-19, see BoxCardBody's own header), sharing this same
      // handleWalkRoute/fetchWalkingRoute path every other venue's Walk
      // button uses, so a Walk tap awaiting location can target a box id,
      // not just allVenues.
      const venue = allVenues.find((v) => v.id === awaitingId) ?? boxVenues.find((v) => v.id === awaitingId);
      if (venue) void fetchWalkingRoute(venue, action.origin);
    } else if (action.kind === "show-hint") {
      setWalkLocationHintVenueId(awaitingId);
    }
    // action.kind === "noop": the venue that asked is no longer selected —
    // nothing to attach the result to (see decideWalkResume's WHY comment).
  // Only re-run when geo.state (object ref) changes — same pattern as bannerVisible.
  }, [geo.state, selectedVenueId, fetchWalkingRoute, boxVenues]);

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

  // ── Breakpoints ──────────────────────────────────────────────────────────────
  // isMobile (<768): BottomSheet instead of DesktopVenueWindow.
  // isBelow2xl (<1536): the bottom nav is a bar covering the map's bottom edge.
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const isBelow2xl = useMediaQuery(BELOW_2XL_QUERY);

  // ── Drawer (HamburgerMenu) — opened from BottomNav at a section (spec §7) ────
  const [menuSection, setMenuSection] = useState<MenuSection | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const handleNavSectionTap = useCallback((section: MenuSection) => {
    // Tapping the open section's own item closes it; any other item re-targets.
    setMenuSection((current) => (current === section ? null : section));
  }, []);
  const handleMenuClose = useCallback(() => setMenuSection(null), []);

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
    venuesWithDistance,
    filteredVenues,
    savedVenues,
    anyFilterActive,
    openNowCount,
    snapCount,
    wicCount,
    toggleCategory,
    clearFilters,
    handleClearAllFilters,
  } = useMapFilters(origin, boxVenues);

  // ── Boxes (#516) — bottom-nav shortcut for the blessing-box category filter.
  // Reuses toggleCategory directly rather than a second flag, so ticking
  // "Blessing Box" in the Filters panel (#513) and tapping Boxes in the bar
  // stay in sync automatically — both read/write the same Set.
  const handleBoxesToggle = useCallback(() => {
    toggleCategory("blessing_box");
  }, [toggleCategory]);

  // ── PageNav "Boxes" (#516) → apply the filter on entry ───────────────────────
  // Same one-shot shape as the auto-locate effect above: a Menu page has no
  // filter state of its own, so it hands off via /?boxes=1 and this effect
  // applies the real filter once the map (and toggleCategory) exist.
  const initialBoxesFilterDoneRef = useRef(false);
  useEffect(() => {
    if (!initialBoxesFilter) return;
    if (initialBoxesFilterDoneRef.current) return;
    initialBoxesFilterDoneRef.current = true;
    toggleCategory("blessing_box");
  }, [initialBoxesFilter, toggleCategory]);

  // ── Filters panel (#513) — the side panel behind SearchBar's Filters button.
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  // Spoken/visible count on the Filters button's badge: every independent
  // filter counts once — the proof step in #513 ("two kinds + Open now →
  // badge 3") is per-item, not per-group, so a multi-category selection
  // contributes its full size, not a flat 1.
  const activeFilterCount =
    (selectedCategories?.size ?? 0) +
    (filterOpenNow ? 1 : 0) +
    (filterSnap ? 1 : 0) +
    (filterWic ? 1 : 0);

  // ── Typeahead popover state (issue #67) ──────────────────────────────────────
  // isPopoverOpen: true when input is focused + query is non-empty + matches exist.
  // activeIndex: keyboard-highlighted row (-1 = none).
  // blurTimerRef: grace timer so mousedown-inside-popover doesn't lose the click.
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // searchAreaRef: wraps SearchBar + ViewSuggestion + SearchResultsPopover
  // (display:contents — adds no box, purely a containment check target).
  // Keyboard-a11y fix (reviewer, PR #522): blur needs to tell "focus moved to
  // one of our own popover rows" (Tab) apart from "focus left the group
  // entirely" (Tab past the last row, or click elsewhere) — relatedTarget
  // containment answers that; a blind timer can't.
  const searchAreaRef = useRef<HTMLDivElement>(null);

  // ── Deep link (#132) ──────────────────────────────────────────────────────────
  // Opened with ?venue=<id> → select that venue once the map is ready to fly.
  // Waiting for mapboxMap ensures the selected-venue flyTo (Map.tsx) actually
  // centers, instead of firing before the map has loaded.
  const deepLinkDoneRef = useRef(false);
  useEffect(() => {
    if (deepLinkDoneRef.current) return;
    if (!mapboxMap) return; // wait until the map can fly
    deepLinkDoneRef.current = true;
    // No existence check against allVenues/boxVenues here (map-first rework,
    // 2026-09-18) — a box's data arrives async from useBoxesList, so an
    // existence check at this exact instant could reject a valid box id
    // before its fetch resolves. selectedVenue's own lookup (below) and
    // getBoxById both gracefully return null/undefined for an unknown id,
    // and Map.tsx's flyTo effect re-fires once `venues`/liveBoxes populate
    // (new array reference) — so there's nothing here to guard against.
    if (initialVenueId) {
      queueMicrotask(() => setSelectedVenueId(initialVenueId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapboxMap]);

  // mapUnavailable variant of the deep link above (review item 4): when the
  // map can't mount, Map.tsx never renders, so mapboxMap stays null forever
  // and the effect above never fires — a shared `/?venue=<id>` link silently
  // selected nothing (PageNav's saved-venue links reuse this same query
  // param). Route straight to the venue/box detail page instead, mirroring
  // the mapUnavailable branches in handleSelect*/handleSelectSavedVenue
  // below. Shares deepLinkDoneRef so whichever branch resolves first (map
  // ready vs. map unavailable — mutually exclusive in practice) wins, never
  // both.
  //
  // WHY this waits on liveBoxesLoading (2026-09-18 fix, found by
  // MapWrapperBoxSelection.test.tsx): mapUnavailable can flip true in the
  // SAME tick useBoxesList's fetch is still in flight, so boxIdSet can still
  // be empty the first (and, before this fix, only — deepLinkDoneRef made it
  // one-shot) time this effect runs. allVenues is a static, always-ready
  // array, so a plain-venue id still resolves instantly on the first pass;
  // only the box case needs to wait for the fetch to settle before this
  // effect is allowed to give up and mark itself done.
  useEffect(() => {
    if (deepLinkDoneRef.current) return;
    if (!mapUnavailable) return; // starts false; flips in a client effect (#165)
    if (!initialVenueId) {
      deepLinkDoneRef.current = true;
      return;
    }
    if (allVenues.some((v) => v.id === initialVenueId)) {
      deepLinkDoneRef.current = true;
      router.replace(`/venue/${encodeURIComponent(initialVenueId)}`);
      return;
    }
    if (boxIdSet.has(initialVenueId)) {
      deepLinkDoneRef.current = true;
      router.replace(`/box/${encodeURIComponent(initialVenueId)}/history`);
      return;
    }
    if (liveBoxesLoading) return; // could still resolve to a box — wait
    deepLinkDoneRef.current = true; // genuinely unknown id — no redirect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapUnavailable, boxIdSet, liveBoxesLoading]);

  // ── Category autozoom (#111, generalized to multi-select by #513) ───────────
  // When one or more categories are checked in the Filters panel, fit the map
  // to the UNION of venues across every checked category. When the user
  // CLEARS every category, return to the all-venues overview.
  //
  // Fires after `selectedCategories` or `mapboxMap` changes — including the
  // map's first ready run, when `mapboxMap` flips from null to real. The
  // Filters panel is interactive before the map loads, so a filter can
  // already be set (or cleared) by then. `prevCategoriesKeyRef` (below) tells
  // that first-ready run apart from a genuine user clear so it never
  // fitBounds-to-all-venues over the #231 fixed home view on a fresh load (#247).
  //
  // Interaction with #108 drift detection: `fitBounds` will fire a `moveend`
  // event which calls `handleMoveEnd` → may set `isDrifted`. That's expected;
  // the Re-center button will appear if the user-dot isn't in the new view, which
  // is correct UX. No loop risk because `handleMoveEnd` only reads bounds, it
  // does not change `selectedCategories`.

  // Previous categories signature, updated only on runs where `mapboxMap` is
  // ready — `undefined` means "the map has never been ready before." Filter
  // churn that happens before the map exists to zoom on is invisible to this
  // ref, so it can't be mistaken for a real clear once the map finally loads.
  // A sorted, joined string (not the Set itself) is what's compared/stored:
  // `selectedCategories` gets a new Set identity on every toggle, so a
  // reference comparison would never read as "unchanged," and checking/
  // unchecking the SAME single category back to itself (add then remove a
  // different one) must still compare equal when the resulting membership is
  // equal — a plain string key gives that for free.
  const prevCategoriesKeyRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!mapboxMap) return;

    const categoriesKey =
      selectedCategories && selectedCategories.size > 0
        ? Array.from(selectedCategories).sort().join(",")
        : null;

    // Compare against, then overwrite with, the CURRENT value — only for runs
    // that reach here (map ready). Pre-ready renders bail above without
    // touching the ref.
    const prevCategoriesKey = prevCategoriesKeyRef.current;
    prevCategoriesKeyRef.current = categoriesKey;

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // The bottom nav covers the map's bottom edge — the bar below 2xl, the
    // floating pill (24px up + 52px tall) at 2xl — so pad by it and fitted pins
    // don't land underneath (docs/bottom-nav-spec.md §5, §10).
    const basePadding = isMobile ? CATEGORY_FIT_PADDING_MOBILE : CATEGORY_FIT_PADDING_DESKTOP;
    const fitPadding = {
      ...basePadding,
      bottom: basePadding.bottom + (isBelow2xl ? BOTTOM_NAV_HEIGHT_PX : 24 + 52),
    };

    if (categoriesKey === null) {
      // Skip unless a real category set was active on the previous ready run —
      // `== null` catches both "map's first ready run" (undefined) and
      // "filter was already empty." Only a genuine non-null → null transition
      // below is a real clear; otherwise whatever view is already showing
      // (the #231 home view, on a fresh load) stands untouched.
      if (prevCategoriesKey == null) return;

      // Real clear — fit the all-venues bounds, capped at CATEGORY_FIT_MAX_ZOOM.
      // NOT the wordmark/home zoom: this is a computed bounds-fit over the
      // whole venue set, a different view than PUEBLO_CENTER/PUEBLO_DEFAULT_ZOOM.
      // Includes boxVenues (map-first rework, 2026-09-18) — without this, the
      // blessing-box category chip never actually zoomed to box pins.
      const allBounds = computeCategoryBounds([...allVenues, ...boxVenues]);
      if (!allBounds) return;
      mapboxMap.fitBounds(allBounds, {
        padding: fitPadding,
        maxZoom: CATEGORY_FIT_MAX_ZOOM,
        duration: reducedMotion ? 0 : 600,
      });
      return;
    }

    // One or more categories checked — compute bounds from all (unfiltered)
    // venues across the UNION of checked categories, so the view doesn't
    // depend on other active filters (Open now/SNAP/WIC).
    // [...allVenues, ...boxVenues]: boxVenues is the only place `blessing_box`
    // category venues live (allVenues is the static published-venues.ts
    // snapshot, which never includes boxes — see "Blessing Boxes — live box
    // layer" in AGENTS.md) — without it, checking the blessing-box category
    // computed bounds over an empty array and never zoomed at all.
    const categoryVenues = [...allVenues, ...boxVenues].filter((v) =>
      selectedCategories!.has(v.category),
    );
    const bounds = computeCategoryBounds(categoryVenues);
    if (!bounds) return;

    mapboxMap.fitBounds(bounds, {
      padding: fitPadding,
      maxZoom: CATEGORY_FIT_MAX_ZOOM,
      duration: reducedMotion ? 0 : 600,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategories, mapboxMap, boxVenues]);
  // Note: `isMobile` / `isBelow2xl` intentionally excluded from deps — we want the padding that
  // was current at the time the category was selected, not re-zoom on resize.
  // `boxVenues` IS included (map-first rework, 2026-09-18) — unlike allVenues
  // (a stable module-level constant), it arrives async from useBoxesList, so
  // the blessing-box chip's zoom must re-run once that fetch resolves if the
  // filter was already active when the effect first ran with an empty array.
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
   * Close the popover on blur — UNLESS focus is moving to one of our own
   * rows (ViewSuggestion's button, SearchResultsPopover's "see all" row).
   *
   * Two distinct blur sources land here now:
   *   - Mouse click on a row: the row's own onMouseDown already called
   *     preventDefault, so the input never actually blurs — this handler
   *     doesn't even run.
   *   - Tab off the input: this DOES fire a real blur. e.relatedTarget is
   *     the element about to receive focus (browsers set it before running
   *     default focus-move handlers), so checking containment against
   *     searchAreaRef tells "Tab into our own row" (relatedTarget inside)
   *     apart from "Tab/click somewhere else" (relatedTarget outside or
   *     null) — a keyboard-a11y fix (reviewer, PR #522): the previous blind
   *     150ms timer raced Tab's own focus-move and could close mid-jump.
   * The 150ms timer stays as the fallback for the "somewhere else" case
   * (still gives a stray mousedown elsewhere a grace period).
   */
  const handleSearchBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const next = e.relatedTarget;
    if (next instanceof Node && searchAreaRef.current?.contains(next)) return;
    blurTimerRef.current = setTimeout(() => {
      setIsPopoverOpen(false);
      setActiveIndex(-1);
    }, 150);
  }, []);

  /**
   * Shared blur handler for the popover rows themselves (ViewSuggestion's
   * button, SearchResultsPopover's "see all" row) — same containment check
   * as handleSearchBlur, needed because Tab-ing further (past the last row)
   * blurs the ROW, not the input, so handleSearchBlur never sees it.
   */
  const handleSuggestionRowBlur = useCallback((e: React.FocusEvent) => {
    const next = e.relatedTarget;
    if (next instanceof Node && searchAreaRef.current?.contains(next)) return;
    blurTimerRef.current = setTimeout(() => {
      setIsPopoverOpen(false);
      setActiveIndex(-1);
    }, 150);
  }, []);

  /**
   * Keyboard handler forwarded from SearchBar: ArrowDown/Up/Enter/Escape.
   * Tab is deliberately NOT handled here — it used to force-close the
   * popover on every Tab press, which raced (and usually won against) the
   * browser's own default focus-move, closing the popover before Tab could
   * land on ViewSuggestion's/SearchResultsPopover's row (keyboard-a11y fix,
   * reviewer, PR #522). Tab's effect on the popover is now decided entirely
   * by blur/focus containment — see handleSearchBlur/handleSuggestionRowBlur.
   */
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
      } else if (e.key === "Enter") {
        if (popoverVisible && activeIndex >= 0 && activeIndex < filteredVenues.length) {
          e.preventDefault();
          const venue = filteredVenues[activeIndex];
          // mapUnavailable branch added (fix, 2026-09-18): unlike a map pin
          // tap (handleSelectVenueFromMap, correctly branch-free — no pins
          // exist to tap when Map.tsx never renders), SearchBar itself is
          // rendered unconditionally, mapUnavailable or not (see its render
          // call below) — so this Enter path stays reachable even when the
          // map can't mount. Without this branch, setSelectedVenueId alone
          // did nothing visible: showVenueOnMap() no-ops while mapUnavailable
          // (useMapUI.ts), and both card components (BottomSheet/
          // DesktopVenueWindow) only render when viewMode === "map" — so a
          // keyboard Enter on a box result silently went nowhere. Same
          // box-vs-venue redirect the other three selection handlers already
          // use (handleSelectSavedVenue/handleSelectVenueFromPopover/
          // handleSelectFromList).
          if (mapUnavailable) {
            router.push(boxIdSet.has(venue.id) ? `/box/${venue.id}/history` : `/venue/${venue.id}`);
            setIsPopoverOpen(false);
            setActiveIndex(-1);
            return;
          }
          setSelectedVenueId(venue.id);
          showVenueOnMap();
          if (!isMobile) setWindowExpanded(false);
          setIsPopoverOpen(false);
          setActiveIndex(-1);
        }
      }
    },
    // filteredVenues reference is stable between renders with same query/filters.
    [isPopoverOpen, filteredVenues, activeIndex, isMobile, showVenueOnMap, mapUnavailable, boxIdSet, router],
  );

  // Select a venue from the Saved list (#132 9c). Clears active filters + search
  // so the venue is in the filtered set — that makes its pin visible and lets the
  // map fly to it (Map.tsx's selected-venue flyTo reads the filtered set) — then
  // opens its detail card.
  const handleSelectSavedVenue = useCallback(
    (venueId: string) => {
      handleClearAllFilters();
      setSelectedVenueId(venueId);
      if (mapUnavailable) {
        // A box has no /venue/<id> page (that route is static, restricted
        // to allVenues' build-time id set) — send it to its own history
        // page instead, the one standalone page a box still has.
        router.push(boxIdSet.has(venueId) ? `/box/${venueId}/history` : `/venue/${venueId}`);
        return;
      }
      showVenueOnMap();
      if (!isMobile) setWindowExpanded(false);
    },
    [boxIdSet, handleClearAllFilters, isMobile, mapUnavailable, router, showVenueOnMap],
  );

  /** Called when user clicks/taps a result row inside the popover. */
  const handleSelectVenueFromPopover = useCallback(
    (venueId: string) => {
      setSelectedVenueId(venueId);
      if (mapUnavailable) {
        router.push(boxIdSet.has(venueId) ? `/box/${venueId}/history` : `/venue/${venueId}`);
        return;
      }
      showVenueOnMap();
      if (!isMobile) setWindowExpanded(false);
      setIsPopoverOpen(false);
      setActiveIndex(-1);
    },
    [boxIdSet, isMobile, mapUnavailable, router, showVenueOnMap],
  );

  // Select a venue from the list (#129) — switch back to the map, centered on it.
  // When mapUnavailable (#165 / #285), navigating to /venue/[id] (or a box's
  // /box/<id>/history — the one standalone page a box still has) reaches
  // full details.
  const handleSelectFromList = useCallback(
    (venueId: string) => {
      setSelectedVenueId(venueId);
      if (mapUnavailable) {
        router.push(boxIdSet.has(venueId) ? `/box/${venueId}/history` : `/venue/${venueId}`);
        return;
      }
      showVenueOnMap();
      if (!isMobile) setWindowExpanded(false);
    },
    [boxIdSet, isMobile, mapUnavailable, router, showVenueOnMap],
  );

  // A box pin now opens the SAME in-map card every other venue uses
  // (map-first rework, 2026-09-18) — no special-case here at all; the map
  // view is never rendered when mapUnavailable, so there's no redirect
  // branch to thread through on this path either.
  const handleSelectVenueFromMap = useCallback(
    (id: string) => {
      setSelectedVenueId(id);
      if (!isMobile) {
        setWindowExpanded(false);
      }
    },
    [isMobile, setSelectedVenueId, setWindowExpanded],
  );

  const handleMapReady = useCallback(
    (map: mapboxgl.Map) => {
      setMapboxMap(map);
    },
    [setMapboxMap],
  );

  // Derive the active option id for aria-activedescendant.
  const activeDescendantId =
    isPopoverOpen && activeIndex >= 0
      ? optionId(LISTBOX_ID, activeIndex)
      : undefined;

  // The results popover should show: focused + non-empty query + has matches.
  const showResultsPopover =
    isPopoverOpen && query.trim() !== "" && filteredVenues.length > 0;

  // ViewSuggestion (#514) shows on the OTHER half of the same condition:
  // focused + EMPTY query. Mutually exclusive with showResultsPopover and
  // EmptySearchPopover (both require a non-empty query) by construction.
  const showViewSuggestion = isPopoverOpen && query.trim() === "";

  // WHY one shared handler: every path that switches views (the search bar's
  // own suggestion row and results row, #514, "Near me" below, and the Menu
  // line) must honor the same mapUnavailable guard (selecting "map" while the
  // map can't mount would show a blank screen, #165).
  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      if (mapUnavailable && mode === "map") return;
      setViewMode(mode);
    },
    [mapUnavailable, setViewMode],
  );

  /**
   * ViewSuggestion / the results-popover's "See all N matches" row (#514):
   * switch view then close whatever search popover triggered it.
   *
   * WHY blur the input: both rows call `onMouseDown={(e) => e.preventDefault()}`
   * (mirrors SearchResultsPopover's option rows) so the 150ms blur grace
   * period can't race the tap closed before this handler runs — but that
   * same preventDefault means the input never naturally loses focus on its
   * own. Without an explicit blur here, "search closes" (#514 spec) isn't
   * true: the keyboard stays up on phone, and — worse — a second empty tap
   * on the now-unfocused-looking bar fires no `focus` event (it was already
   * focused), so the OTHER direction's row (e.g. "Back to the map" right
   * after switching to list) never appears until the user taps away first.
   * Same pattern SearchBar's own Enter handler already uses
   * (`e.currentTarget.blur()`). The blur this triggers re-schedules
   * isPopoverOpen=false via the normal 150ms timer — harmless, since it's
   * already false.
   */
  const handleViewSuggestionSelect = useCallback(
    (mode: ViewMode) => {
      handleViewModeChange(mode);
      setIsPopoverOpen(false);
      setActiveIndex(-1);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    },
    [handleViewModeChange],
  );

  // "Near me" (docs/bottom-nav-spec.md §6). The bar persists in list view, but
  // a fly-to-your-location is invisible there — so it returns to the map first
  // (a no-op when the map can't mount; the location still re-sorts the list).
  const handleNearMe = useCallback(() => {
    handleViewModeChange("map");
    handleLocateRequest();
  }, [handleViewModeChange, handleLocateRequest]);

  // §10: the venue sheet (phone only) covers the bottom edge; the nav steps
  // aside while it is open at any detent.
  const venueSheetOpen = isMobile && viewMode === "map" && selectedVenue !== null;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="relative h-full w-full">
      {/* Map — fills viewport; skipped entirely when WebGL is unavailable (#165)
          or the interactive load hasn't been triggered yet (#226 — see
          useDeferredMapLoad; ListView below covers this same window).
          MapErrorBoundary catches fatal init throws as a secondary safety net. */}
      {!mapUnavailable && mapLoadTriggered && (
        <MapErrorBoundary onError={handleMapError}>
          <MapCanvas
            venues={filteredVenues}
            selectedVenueId={selectedVenueId}
            userLocation={userLocation}
            userDistances={userDistances}
            recenterRequestId={recenterRequestId}
            onSelectVenue={handleSelectVenueFromMap}
            onMapReady={handleMapReady}
            onMoveEnd={handleMoveEnd}
            walkingRoute={walkingRouteVenueId === selectedVenueId ? walkingRoute : null}
          />
        </MapErrorBoundary>
      )}

      {/* List view (#129) — full-screen overlay above the map, below top chrome.
          When mapUnavailable, the notice prop carries the fallback banner (#165)
          so it renders inside ListView's z-[700] stacking context and stays visible.
          Also doubles as the #226 pre-load placeholder: while !mapLoadTriggered
          (viewMode is still "map" — this does not touch viewMode itself), this
          same branch covers the map's box so cold load never mounts mapbox-gl
          before idle/interaction. Reusing ListView (rather than a new skeleton)
          means the placeholder is already fully interactive — tapping a venue
          card both selects it and counts as the interaction that triggers the
          real map load. */}
      {(viewMode === "list" || !mapLoadTriggered) && (
        <ListView
          venues={filteredVenues}
          selectedVenueId={selectedVenueId}
          onSelect={handleSelectFromList}
          onClearFilters={handleClearAllFilters}
          showClearFilters={anyFilterActive || query.trim() !== ""}
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

      {/* searchAreaRef wraps these three — display:contents so it adds no box
          of its own — purely so blur handlers can ask "did focus move to one
          of OUR OWN rows, or leave the group entirely?" (keyboard-a11y fix,
          reviewer, PR #522). See handleSearchBlur/handleSuggestionRowBlur. */}
      <div ref={searchAreaRef} className="contents">
        {/* SearchBar — controlled (PR 6), ARIA combobox wired (#67).
            filtersButton (#513) opens the FilterPanel below — search focus
            opens ViewSuggestion (empty query) or SearchResultsPopover (typed),
            never a category list of its own. Nothing renders on the right end
            of the bar (#514 removed the inline Map/List switch — see
            ViewSuggestion/HamburgerMenu for its replacements). */}
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
          comboboxExpanded={showResultsPopover}
          comboboxControls={showResultsPopover ? LISTBOX_ID : undefined}
          comboboxActiveDescendant={activeDescendantId}
          onFocus={handleSearchFocus}
          onBlur={handleSearchBlur}
          onKeyDownExtra={handleSearchKeyDown}
          filtersButton={{
            count: activeFilterCount,
            onClick: () => setFilterPanelOpen(true),
            ariaLabel:
              activeFilterCount > 0
                ? t("filters.button.labelActive", locale, { count: String(activeFilterCount) })
                : t("filters.button.label", locale),
          }}
        />

        {/* ViewSuggestion (#514) — shown on an EMPTY, focused search bar; offers
            the other view. Mutually exclusive with SearchResultsPopover/
            EmptySearchPopover below (both require a non-empty query). Renders
            nothing itself while on the list with the map disabled (#165) —
            see the component's own guard. onFocus/onBlur (keyboard-a11y fix,
            reviewer, PR #522) make its button Tab-reachable: onFocus mirrors
            handleSearchFocus (clears any pending close timer), onBlur decides
            whether Tab-ing further should close the popover. */}
        {showViewSuggestion && (
          <ViewSuggestion
            mode={viewMode}
            count={filteredVenues.length}
            mapDisabled={mapUnavailable}
            locale={locale}
            onSelect={() => handleViewSuggestionSelect(viewMode === "map" ? "list" : "map")}
            onFocus={handleSearchFocus}
            onBlur={handleSuggestionRowBlur}
          />
        )}

        {/* SearchResultsPopover — shown when query is non-empty AND has matches (#67).
            Mutually exclusive with EmptySearchPopover. onSeeAllAsList (#514) is
            map-only — on the list, typing already updates ListView live.
            onSeeAllAsListFocus/onSeeAllAsListBlur (keyboard-a11y fix, reviewer,
            PR #522) — same pattern as ViewSuggestion above, scoped to that one
            new row (the option <li>s above it carry no tabIndex, so they were
            never keyboard-reachable and need no such wiring). */}
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
            onSeeAllAsList={
              viewMode === "map" ? () => handleViewSuggestionSelect("list") : undefined
            }
            onSeeAllAsListFocus={handleSearchFocus}
            onSeeAllAsListBlur={handleSuggestionRowBlur}
          />
        )}
      </div>

      {/* FilterPanel (#513) — the left side panel opened by SearchBar's Filters
          button. Not tied to search focus (replaces CategoryDropdown, #95). */}
      <FilterPanel
        open={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        locale={locale}
        resultCount={filteredVenues.length}
        filterOpenNow={filterOpenNow}
        onToggleOpenNow={() => setFilterOpenNow((v) => !v)}
        openNowCount={openNowCount}
        filterSnap={filterSnap}
        onToggleSnap={() => setFilterSnap((v) => !v)}
        snapCount={snapCount}
        filterWic={filterWic}
        onToggleWic={() => setFilterWic((v) => !v)}
        wicCount={wicCount}
        selectedCategories={selectedCategories}
        onToggleCategory={toggleCategory}
        onClearAll={clearFilters}
      />

      {/* EmptySearchPopover — shown when query is non-empty but yields no results.
          Mutually exclusive with SearchResultsPopover (they depend on filteredVenues.length). */}
      {query.trim() !== "" && filteredVenues.length === 0 && (
        <EmptySearchPopover
          query={query.trim()}
          onSelectCategory={(label) => setQuery(label)}
        />
      )}

      {/* HamburgerMenu — the drawer, opened by BottomNav at a section (#71, spec §7).
          viewMode/onToggleView/mapDisabled (#514) drive its "List view"/"Map
          view" line — the second way into the switch, for anyone who never
          taps search. */}
      <HamburgerMenu
        onShowWelcome={onShowWelcome}
        savedVenues={savedVenues}
        onSelectVenue={handleSelectSavedVenue}
        open={menuSection !== null}
        onClose={handleMenuClose}
        view={menuSection ?? "top"}
        ignoreOutsideRef={navRef}
        viewMode={viewMode}
        onToggleView={() => handleViewModeChange(viewMode === "map" ? "list" : "map")}
        mapDisabled={mapUnavailable}
      />

      {/* Outside-county message — appears when resolved position is beyond maxBounds (#108). Map mode only (#129). */}
      {viewMode === "map" && outsideCountyVisible && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            position: "absolute",
            // Below 2xl: lifted clear of the bottom nav bar AND the Mapbox
            // credits row above it (globals.css's `@media (width < 96rem)`
            // rule lifts that row the same way). Recomputed 2026-09-16 — the
            // old "+ 52" dated from a taller credits control that no longer
            // exists:
            //   BOTTOM_NAV_HEIGHT_PX (76) — the nav bar itself
            //   + 8                       — nav-to-credits gap (globals.css)
            //   + 26                      — credits row height: the 20px
            //                               logo/attrib control (globals.css
            //                               `.mapboxgl-ctrl-logo`) plus its
            //                               own 6px bottom margin
            //                               (`.mapboxgl-ctrl-bottom-right
            //                               .mapboxgl-ctrl`) — margins don't
            //                               collapse in a flex row, so both
            //                               count toward the row's height
            //   + 12                      — clearance above the credits row
            // 2xl: above the floating nav pill (24px up + 52px tall + 12px
            // gap) — credits aren't lifted at 2xl (the pill sits centred,
            // clear of the bottom-right corner), so this branch is unchanged.
            bottom: isBelow2xl
              ? `calc(${BOTTOM_NAV_HEIGHT_PX}px + 8px + 26px + 12px + env(safe-area-inset-bottom))`
              : 24 + 52 + 12,
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
        />
      )}

      {/* BottomSheet — mobile only (vaul v2, venue-centric API). Map mode only (#129). */}
      {isMobile && viewMode === "map" && (
        <BottomSheet
          key={selectedVenueId ?? "empty"}
          venue={selectedVenue}
          box={getBoxById(selectedVenueId)}
          onCheckinSuccess={(result) => handleBoxCheckinSuccess(selectedVenueId, result)}
          onClose={() => setSelectedVenueId(null)}
          onWalkRoute={handleWalkRoute}
          isWalkRouteActive={
            selectedVenueId !== null && walkingRouteVenueId === selectedVenueId
          }
          onClearWalkRoute={handleClearWalkingRoute}
          walkRouteInfo={
            selectedVenueId !== null && walkingRouteVenueId === selectedVenueId
              ? walkingRouteInfo
              : null
          }
          walkRouteSteps={
            selectedVenueId !== null && walkingRouteVenueId === selectedVenueId
              ? walkingRouteSteps
              : null
          }
          showWalkLocationHint={
            selectedVenueId !== null && walkLocationHintVenueId === selectedVenueId
          }
        />
      )}

      {/* DesktopVenueWindow — marker-anchored, desktop only. Map mode only (#129). */}
      {!isMobile && viewMode === "map" && selectedVenue && (
        <DesktopVenueWindow
          key={selectedVenueId}
          venue={selectedVenue}
          box={getBoxById(selectedVenueId)}
          onCheckinSuccess={(result) => handleBoxCheckinSuccess(selectedVenueId, result)}
          expanded={windowExpanded}
          mapboxMap={mapboxMap}
          onExpand={() => setWindowExpanded(true)}
          onCollapse={() => setWindowExpanded(false)}
          onClose={() => {
            setSelectedVenueId(null);
            setWindowExpanded(false);
          }}
          onWalkRoute={handleWalkRoute}
          isWalkRouteActive={
            selectedVenueId !== null && walkingRouteVenueId === selectedVenueId
          }
          onClearWalkRoute={handleClearWalkingRoute}
          walkRouteInfo={
            selectedVenueId !== null && walkingRouteVenueId === selectedVenueId
              ? walkingRouteInfo
              : null
          }
          walkRouteSteps={
            selectedVenueId !== null && walkingRouteVenueId === selectedVenueId
              ? walkingRouteSteps
              : null
          }
          showWalkLocationHint={
            selectedVenueId !== null && walkLocationHintVenueId === selectedVenueId
          }
        />
      )}

      {/* BottomNav — LAST in DOM order so keyboard users reach the map and the
          search first (spec §12). */}
      {!venueSheetOpen && (
        <BottomNav
          locale={locale}
          openSection={menuSection}
          onSectionTap={handleNavSectionTap}
          geoState={geo.state}
          isLocating={isLocating}
          isDrifted={isDrifted}
          onNearMe={handleNearMe}
          boxesActive={selectedCategories?.has("blessing_box") ?? false}
          onBoxesToggle={handleBoxesToggle}
          navRef={navRef}
        />
      )}
    </div>
  );
}
