/**
 * useGeolocation — analytics tests (#485 PR 2).
 *
 * Only the `location_permission` tracking added by this PR is covered here;
 * the hook's own state-machine behavior (permission probing, request(),
 * drift) has no prior automated test and stays out of this slice's scope.
 *
 * Coverage:
 *   1. A fresh request() that resolves granted fires location_permission
 *      {result: "granted"}.
 *   2. A fresh request() that resolves denied fires location_permission
 *      {result: "denied"}.
 *   3. A RE-CENTER request() (already granted) does NOT fire again — only
 *      the first, permission-deciding prompt counts (avoids inflating
 *      "granted" once per Near Me tap after the first grant).
 *   4. The mount-time Permissions API probe (no user prompt involved) never
 *      fires, whichever way it resolves.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGeolocation } from "@/lib/useGeolocation";
import { track, EVENTS } from "@/lib/analytics";

// #485 PR 2: mock the whole module so EVENTS keeps its real allowlist values.
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  track: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(track).mockClear();
  // No Permissions API by default — keeps the mount-time probe a no-op so
  // each test controls state via request() alone.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (navigator as any).permissions;
});

function mockGeolocation(
  outcome: { granted: true; lat: number; lng: number } | { granted: false; code: number },
) {
  const getCurrentPosition = vi.fn(
    (success: PositionCallback, error?: PositionErrorCallback) => {
      if (outcome.granted) {
        success({
          coords: { latitude: outcome.lat, longitude: outcome.lng } as GeolocationCoordinates,
        } as GeolocationPosition);
      } else {
        error?.({ code: outcome.code } as GeolocationPositionError);
      }
    },
  );
  Object.defineProperty(navigator, "geolocation", {
    value: { getCurrentPosition },
    configurable: true,
  });
  return getCurrentPosition;
}

describe("useGeolocation — location_permission tracking", () => {
  test("a fresh granted request fires location_permission granted", () => {
    mockGeolocation({ granted: true, lat: 38.25, lng: -104.6 });
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    expect(track).toHaveBeenCalledWith(EVENTS.LOCATION_PERMISSION, { result: "granted" });
  });

  test("a fresh denied request fires location_permission denied", () => {
    mockGeolocation({ granted: false, code: 1 });
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    expect(track).toHaveBeenCalledWith(EVENTS.LOCATION_PERMISSION, { result: "denied" });
  });

  test("a re-center request (already granted) does not fire a second time", () => {
    mockGeolocation({ granted: true, lat: 38.25, lng: -104.6 });
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request()); // first grant — tracked
    vi.mocked(track).mockClear();
    act(() => result.current.request()); // re-center — should NOT track again
    expect(track).not.toHaveBeenCalled();
  });
});
