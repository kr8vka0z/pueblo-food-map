"use client";

/**
 * useGeolocation — v2 geolocation hook.
 *
 * Spec: docs/pueblo-food-map-v2-handoff.md §Open questions #5
 *
 * - On mount: reads navigator.permissions.query to detect existing grant/denial.
 *   Defaults to { permission: 'prompt', position: null } if Permissions API
 *   is unavailable (e.g. SSR, older browsers).
 * - request(): calls getCurrentPosition once. Does NOT auto-invoke on mount.
 *   No watchPosition (battery concern per spec).
 * - Position is captured once per request() call.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { track, EVENTS } from "@/lib/analytics";

export type GeoState =
  | { permission: "prompt"; position: null }
  | { permission: "granted"; position: { lat: number; lng: number } | null }
  | { permission: "denied"; position: null };

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
    // #485 PR 2 (location_permission {result}): only a request that starts
    // from "prompt" is an actual permission DECISION — once granted, every
    // later tap (MapWrapper's "re-center" path, handleLocateRequest) calls
    // request() again just to get a fresh fix, and would otherwise fire a
    // new "granted" event per tap, inflating the count Kyle wants ("did the
    // user grant location," not "how many times did a granted user tap Near
    // Me"). Read BEFORE calling geolocation, since a callback firing later
    // must judge the OUTCOME of the prompt this call started, not whatever
    // permRef says by the time it resolves.
    const wasPrompt = permRef.current === "prompt";

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ permission: "denied", position: null });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (wasPrompt) void track(EVENTS.LOCATION_PERMISSION, { result: "granted" });
        setState({
          permission: "granted",
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        });
      },
      () => {
        // "dismissed" (the issue's third result value) isn't distinguishable
        // from an explicit "Block": every browser's Geolocation API reports
        // code 1 for both (see #485 comment thread) — "denied" covers both
        // here.
        if (wasPrompt) void track(EVENTS.LOCATION_PERMISSION, { result: "denied" });
        setState({ permission: "denied", position: null });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  }, []);

  return { state, request };
}
