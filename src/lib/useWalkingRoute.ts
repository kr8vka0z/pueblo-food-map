"use client";

/**
 * useWalkingRoute — the in-app walking route (#134) for MapWrapper: the
 * Mapbox Directions fetch, the latest-request-wins guard (#207), the
 * walk-without-location resume (#207), the "share your location" hint, and
 * the step-through stepper state (#555).
 *
 * WHY a hook (#726): this used to be five useStates, two refs and two effects
 * inline in MapWrapper, with the "clear the route" block copied three times
 * and eight walk props threaded one by one through BottomSheet /
 * DesktopVenueWindow / BoxCardBody. The cards now take ONE `walk` object,
 * built per venue by `walkFor(id)`.
 *
 * The pure helpers (URL builder, step parser, resume decision) stay in
 * `walkRoute.ts`, where their tests import them from.
 *
 * WHY MapWrapper (via this hook) owns the fetch, not Map.tsx: the Directions
 * call needs the client-side Mapbox token, and Map.tsx stays a controlled
 * component that only draws the `route` it is handed.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { WalkingRouteGeoJSON, WalkingRouteInfo, WalkStep } from "@/components/Map";
import type { Venue } from "@/types/venue";
import type { GeoState } from "@/lib/useGeolocation";
import type { Locale } from "@/lib/i18n";
import { buildWalkingRouteUrl, parseWalkSteps, decideWalkResume } from "@/lib/walkRoute";

/**
 * Everything one place card needs for walking directions. Built by
 * `walkFor(id)` so `isActive`/`info`/`steps`/`showLocationHint` are already
 * scoped to that card's own venue. Absent (`walk` undefined) means "no map
 * to draw a route on" — a box card's address then stays a plain link.
 */
export interface Walk {
  /** Walk tap: starts, or (same venue again) toggles off, the route. */
  onWalk: (venue: Venue) => void;
  /** True when this card's venue has the route drawn on the map. */
  isActive: boolean;
  onClear: () => void;
  /** Distance + duration readout; null unless `isActive`. */
  info: WalkingRouteInfo | null;
  /** Turn-by-turn steps (pre-localized by Mapbox); null unless `isActive`. */
  steps: WalkStep[] | null;
  /** This venue's Walk tap asked for location and was refused (#207). */
  showLocationHint: boolean;
  /** Which turn the stepper shows (#555), shared by the phone strip and the card. */
  activeStepIndex: number;
  onStepChange: (index: number) => void;
}

interface Options {
  locale: Locale;
  userLocation: { lat: number; lng: number } | null;
  geoState: GeoState;
  selectedVenueId: string | null;
  /** The locate button's own flow (geo.request() + spinner + recenter). A Walk tap with no location calls it instead of drawing from PUEBLO_CENTER (#207). */
  requestLocation: () => void;
  /** Fresh location reading WITHOUT re-centering on the user — a stepper tap must not fight its own fly-to-the-turn. */
  refreshLocation: () => void;
  /** Looks a venue (or box) up by id for the resume effect. */
  findVenue: (id: string) => Venue | undefined;
}

export function useWalkingRoute({
  locale,
  userLocation,
  geoState,
  selectedVenueId,
  requestLocation,
  refreshLocation,
  findVenue,
}: Options) {
  // route: the fetched GeoJSON; info: distance + duration text; steps: the
  // turn list; routeVenueId: which venue the route targets — used to clear
  // it when the selection moves to a different venue (or is cleared).
  const [route, setRoute] = useState<WalkingRouteGeoJSON | null>(null);
  const [info, setInfo] = useState<WalkingRouteInfo | null>(null);
  const [steps, setSteps] = useState<WalkStep[] | null>(null);
  const [routeVenueId, setRouteVenueId] = useState<string | null>(null);

  // ── Step-through directions (#555) ──────────────────────────────────────────
  // activeStepIndex lives here, not in the panel, because the phone strip and
  // the venue card both render the stepper for the same route and must agree.
  // Reset to 0 wherever the route itself resets (see resetRoute).
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  // focusPoint/focusRequestId: the camera target Map.tsx's step-through focus
  // effect watches. A separate pair from MapWrapper's recenterRequestId —
  // bumping that one would fly the camera to the USER, fighting the turn the
  // stepper just centered on.
  const [focusPoint, setFocusPoint] = useState<{ lng: number; lat: number } | null>(null);
  const [focusRequestId, setFocusRequestId] = useState(0);

  // ── Walk-without-location (#207) ─────────────────────────────────────────────
  // awaitingVenueIdRef: the venue a Walk tap is waiting on geolocation for.
  //   Set when walk() runs with no userLocation; consumed by the resume effect
  //   below once geoState resolves. A ref, not state — read only inside that
  //   effect, never rendered; same "avoid a stale closure" reasoning as reqSeq.
  // hintVenueId: which venue's Walk tap ended in a denied/unavailable
  //   location request — drives the "share your location" hint. Scoped per
  //   card by walkFor(), same pattern as routeVenueId.
  const awaitingVenueIdRef = useRef<string | null>(null);
  const [hintVenueId, setHintVenueId] = useState<string | null>(null);

  // ── Stale-route race guard (FIX 1 — hardened) ───────────────────────────────
  // The fetch is async. If the user taps Walk on venue A then selects venue B
  // before A's fetch resolves, A's resolution must NOT commit state — doing so
  // would draw A's route line on the map while B is selected.
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
  // selectedVenueId-change effect): bumping on explicit user actions ensures a
  // pending fetch can never repopulate a route the user just cleared. We
  // intentionally do NOT touch the seq in the selection-change effect — not
  // touching it lets a same-task select+walk-for-the-new-venue succeed.
  // MapWrapper's render-gate (drawing `route` only when routeVenueId ===
  // selectedVenueId) is the real safety net for the selection-switch case.
  const reqSeq = useRef(0);

  const resetRoute = useCallback(() => {
    setRoute(null);
    setInfo(null);
    setSteps(null);
    setRouteVenueId(null);
    setActiveStepIndex(0);
  }, []);

  // Clear the route when the selected venue changes to a different venue or
  // is deselected — the old route is stale and visually disconnected.
  // queueMicrotask satisfies the react-hooks/set-state-in-effect rule. See
  // reqSeq above for why the seq is NOT bumped here.
  useEffect(() => {
    if (selectedVenueId !== routeVenueId) queueMicrotask(resetRoute);
    // A stale "share your location" hint belongs to the venue that triggered
    // it, not whatever is selected now — same invariant as the route itself.
    if (selectedVenueId !== hintVenueId) queueMicrotask(() => setHintVenueId(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVenueId]);

  /**
   * Fetch a walking route from the Mapbox Directions API. origin is passed
   * explicitly (not read from userLocation) so the resume effect can call
   * this with a just-resolved position without waiting on a re-render.
   */
  const fetchRoute = useCallback(async (venue: Venue, origin: { lat: number; lng: number }) => {
    // Mint a unique request token. Any earlier in-flight fetch — including one
    // for the SAME venue — that resolves after this point will compare its seq
    // snapshot to reqSeq.current and bail (latest-REQUEST-wins).
    const seq = ++reqSeq.current;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      // No token — Directions API will fail. Fail silently; map still works.
      console.warn("[MapWrapper] NEXT_PUBLIC_MAPBOX_TOKEN missing — walking route unavailable");
      return;
    }

    // steps=true for the turn list; language= so Spanish visitors get
    // Spanish instructions without client-side translation.
    const url = buildWalkingRouteUrl(origin.lng, origin.lat, venue.lng, venue.lat, token, locale);

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
              maneuver?: { instruction?: string; location?: number[]; type?: string; modifier?: string };
              distance: number; // meters
            }>;
          }>;
        }>;
      };

      // Stale-route guard: bail if a newer Walk request (or a clear/toggle-off)
      // has been issued since this fetch started.
      if (reqSeq.current !== seq) return;

      const r = data.routes?.[0];
      if (!r) return;

      const miles = (r.distance / 1609.34).toFixed(1);
      const minutes = Math.round(r.duration / 60);
      const parsed = parseWalkSteps(r);

      setRoute({ type: "Feature", properties: {}, geometry: r.geometry });
      setInfo({ distance: `${miles} mi`, duration: `${minutes} min` });
      setSteps(parsed.length > 0 ? parsed : null);
      setRouteVenueId(venue.id);
      setActiveStepIndex(0);
    } catch (err) {
      // Network failure — fail silently. Bus/Drive deeplinks still work.
      console.warn("[MapWrapper] Directions fetch failed:", err);
    }
  }, [locale]);

  /**
   * A Walk tap: toggle off an active route, fetch one from the user's real
   * location, or — if location hasn't been shared yet — request it instead
   * of silently drawing from PUEBLO_CENTER (#207). Bus/Drive are unaffected:
   * their Google Maps deeplinks let Google use the device's own location.
   */
  const walk = useCallback((venue: Venue) => {
    if (routeVenueId === venue.id) {
      // Re-tap on the active route = toggle off. Bump the seq so a pending
      // fetch (same venue, stale location) can't repopulate it.
      reqSeq.current++;
      resetRoute();
      return;
    }

    // A fresh tap deserves a fresh outcome — drop a stale denied hint.
    setHintVenueId(null);

    if (!userLocation) {
      // Ask via the SAME flow the locate button uses; the resume effect picks
      // up the result. Skip re-requesting if already awaiting this exact venue
      // (rapid double-tap while the browser's permission prompt is open).
      if (awaitingVenueIdRef.current !== venue.id) {
        awaitingVenueIdRef.current = venue.id;
        requestLocation();
      }
      return;
    }

    void fetchRoute(venue, userLocation);
  }, [routeVenueId, userLocation, requestLocation, fetchRoute, resetRoute]);

  /** Explicit clear (Clear route control). Bumps the seq — same invariant as toggle-off. */
  const clear = useCallback(() => {
    reqSeq.current++;
    resetRoute();
  }, [resetRoute]);

  /**
   * Move the stepper to a turn (#555): set the active step, point the map's
   * focus effect at that turn, and refresh the user's location for the new
   * vantage point. A step with no coordinate (malformed response only — see
   * parseWalkSteps) still advances; only the camera hop is skipped.
   */
  const stepTo = useCallback((index: number) => {
    setActiveStepIndex(index);
    const location = steps?.[index]?.location;
    if (location) {
      setFocusPoint({ lng: location[0], lat: location[1] });
      setFocusRequestId((n) => n + 1);
    }
    refreshLocation();
  }, [steps, refreshLocation]);

  // ── Resume a Walk once its triggered geolocation resolves (#207) ─────────────
  useEffect(() => {
    const awaitingId = awaitingVenueIdRef.current;
    if (!awaitingId) return;
    if (geoState.permission === "prompt") return; // still waiting on the browser
    // WHY this second guard: useGeolocation's Permissions API onchange listener
    // can independently flip permission to "granted" (position still null,
    // since onchange doesn't call getCurrentPosition) slightly BEFORE the
    // getCurrentPosition call this same Walk tap triggered delivers its actual
    // fix. Treating {granted, position:null} as "resolved" here would consume
    // the ref and show the hint prematurely, then silently drop the real
    // position when it arrives a moment later (the ref is one-shot). Both
    // getCurrentPosition branches always settle (each bounded by its timeout),
    // so this can't wait forever.
    if (geoState.permission === "granted" && geoState.position === null) return;

    awaitingVenueIdRef.current = null; // one resolution per request

    const action = decideWalkResume(awaitingId, selectedVenueId, geoState);
    if (action.kind === "fetch") {
      // findVenue covers boxes too — a box card's address is its own Walk
      // trigger, so a Walk awaiting location can target a box id.
      const venue = findVenue(awaitingId);
      if (venue) void fetchRoute(venue, action.origin);
    } else if (action.kind === "show-hint") {
      setHintVenueId(awaitingId);
    }
    // "noop": the venue that asked is no longer selected — nothing to attach
    // the result to (see decideWalkResume's WHY comment).
  }, [geoState, selectedVenueId, fetchRoute, findVenue]);

  /** The `walk` object for one card, scoped to venue `id`. */
  const walkFor = (id: string | null): Walk => {
    const isActive = id !== null && routeVenueId === id;
    return {
      onWalk: walk,
      isActive,
      onClear: clear,
      info: isActive ? info : null,
      steps: isActive ? steps : null,
      showLocationHint: id !== null && hintVenueId === id,
      activeStepIndex,
      onStepChange: stepTo,
    };
  };

  return { route, routeVenueId, focusPoint, focusRequestId, walkFor };
}
