"use client";

/**
 * useGeolocation — v2 geolocation hook.
 *
 * Spec: docs/pueblo-food-map-v2-handoff.md §Open questions #5
 *
 * - On mount: reads navigator.permissions.query to detect existing grant/denial.
 *   Defaults to { permission: 'prompt', position: null } if Permissions API
 *   is unavailable (e.g. SSR, older browsers).
 * - request(): calls getCurrentPosition; a timeout/unavailable error retries
 *   once at low accuracy (#738). Does NOT auto-invoke on mount.
 *   No watchPosition (battery concern per spec).
 * - Position is captured once per request() call.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { track, EVENTS } from "@/lib/analytics";

/**
 * Why a request ended without a position AND without a refusal (#738).
 * "timeout" = GeolocationPositionError.TIMEOUT (3); "unavailable" = every
 * other non-refusal (POSITION_UNAVAILABLE 2, or no navigator.geolocation).
 */
export type GeoFailureReason = "timeout" | "unavailable";

/**
 * "failed" is deliberately NOT "denied" (#738): analytics showed most
 * "denied" results were really GPS timeouts or OS-level failures, and a
 * denied session short-circuits later taps to the Pueblo-center fallback.
 * "failed" means "we couldn't get a fix this time" — the browser's
 * permission is unknown/unrefused, so the next request() simply tries again.
 */
export type GeoState =
  | { permission: "prompt"; position: null }
  | { permission: "granted"; position: { lat: number; lng: number } | null }
  | { permission: "denied"; position: null }
  | { permission: "failed"; position: null; reason: GeoFailureReason };

/**
 * The two GeoState results that leave a visitor without a position (#739):
 * what LocationHelpCard explains. Lives here, next to GeoState, so SplashScreen
 * (which only has its own hook instance) can hand the result to MapWrapper.
 */
export type LocationFailure = Extract<GeoState, { permission: "denied" | "failed" }>;

// GeolocationPositionError codes (spec values; avoids relying on the global
// GeolocationPositionError constructor, absent in jsdom and some old WebViews).
const GEO_PERMISSION_DENIED = 1;
const GEO_TIMEOUT = 3;
const FIRST_TIMEOUT_MS = 8000;
const FIRST_MAX_AGE_MS = 60_000;
const RETRY_TIMEOUT_MS = 6000;
const RETRY_MAX_AGE_MS = 5 * 60_000;

const DEFAULT_STATE: GeoState = { permission: "prompt", position: null };

export function useGeolocation(): {
  state: GeoState;
  request: () => void;
} {
  const [state, setState] = useState<GeoState>(DEFAULT_STATE);

  // Mirrors state.permission for request()'s own read at call time (see WHY
  // below) — a ref, not state, so it's never stale inside the
  // getCurrentPosition callbacks below (those close over whatever `permRef`
  // held at the START of the request, by design).
  const permRef = useRef(state.permission);
  useEffect(() => {
    permRef.current = state.permission;
  }, [state.permission]);

  // On mount: probe Permissions API to pick up any prior grant/denial.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return;

    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        function applyStatus(s: PermissionState) {
          if (s === "granted") {
            setState((prev) =>
              prev.permission === "granted"
                ? prev
                : { permission: "granted", position: null },
            );
          } else if (s === "denied") {
            setState({ permission: "denied", position: null });
          }
          // "prompt" leaves the default in place
        }

        applyStatus(status.state);

        // Listen for live changes (e.g., user revokes in browser settings)
        status.onchange = () => applyStatus(status.state);
      })
      .catch(() => {
        // Permissions API unavailable or rejected — stay at default "prompt"
      });
  }, []);

  const request = useCallback(() => {
    // #485 PR 2 (location_permission {result}): only a request that has not
    // yet been decided is an actual permission DECISION — once granted, every
    // later tap (MapWrapper's "re-center" path, handleLocateRequest) calls
    // request() again just to get a fresh fix, and would otherwise fire a
    // new "granted" event per tap, inflating the count Kyle wants ("did the
    // user grant location," not "how many times did a granted user tap Near
    // Me"). Read BEFORE calling geolocation, since a callback firing later
    // must judge the OUTCOME of the prompt this call started, not whatever
    // permRef says by the time it resolves. #738: "failed" counts as still
    // undecided — a prompt answered "Allow" that then timed out, retried on
    // the next tap, is the first time we see the grant succeed.
    const wasUndecided = permRef.current === "prompt" || permRef.current === "failed";
    const startedAt = Date.now();
    // Integer ms from this request() to its final outcome, including the
    // retry (#738: tap-to-result timings are how the timeout bug was found).
    const elapsed = () => Math.max(0, Math.round(Date.now() - startedAt));

    const fail = (reason: GeoFailureReason) => {
      // Not a permission decision, so logged on EVERY failed request (#738).
      void track(EVENTS.LOCATION_PERMISSION, { result: reason, ms: elapsed() });
      setState({ permission: "failed", position: null, reason });
    };

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      fail("unavailable");
      return;
    }
    const geolocation = navigator.geolocation;

    const onSuccess = (pos: GeolocationPosition) => {
      if (wasUndecided) {
        void track(EVENTS.LOCATION_PERMISSION, { result: "granted", ms: elapsed() });
      }
      setState({
        permission: "granted",
        position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
      });
    };

    const onRefused = () => {
      // "dismissed" (the issue's third result value) isn't distinguishable
      // from an explicit "Block": every browser's Geolocation API reports
      // code 1 for both (see #485 comment thread) — "denied" covers both
      // here. ONLY code 1 gets here (#738).
      if (wasUndecided) {
        void track(EVENTS.LOCATION_PERMISSION, { result: "denied", ms: elapsed() });
      }
      setState({ permission: "denied", position: null });
    };

    geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        if (err.code === GEO_PERMISSION_DENIED) return onRefused();
        // Position unavailable / timeout (#738): a precise GPS fix is often
        // impossible indoors or on low-end Android, but "near me" only needs
        // a neighborhood. Retry ONCE with network/cell positioning and a
        // cached fix a few minutes old.
        geolocation.getCurrentPosition(
          onSuccess,
          (retryErr) => {
            if (retryErr.code === GEO_PERMISSION_DENIED) return onRefused();
            fail(retryErr.code === GEO_TIMEOUT ? "timeout" : "unavailable");
          },
          { enableHighAccuracy: false, timeout: RETRY_TIMEOUT_MS, maximumAge: RETRY_MAX_AGE_MS },
        );
      },
      // maximumAge: a fix under a minute old is as good as a fresh one for
      // "near me", and skips the GPS cold start that caused the 8.0 s
      // timeouts (#738); it was 0 (always force a new reading) before.
      { enableHighAccuracy: true, timeout: FIRST_TIMEOUT_MS, maximumAge: FIRST_MAX_AGE_MS },
    );
  }, []);

  return { state, request };
}
