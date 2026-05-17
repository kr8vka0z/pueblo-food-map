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

import { useCallback, useEffect, useState } from "react";

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
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ permission: "denied", position: null });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          permission: "granted",
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        });
      },
      () => {
        setState({ permission: "denied", position: null });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  }, []);

  return { state, request };
}
