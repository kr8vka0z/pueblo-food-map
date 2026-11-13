/**
 * useGeolocation — error-code handling, the single low-accuracy attempt, and
 * analytics payloads (#738, #921).
 *
 * Only code 1 is a refusal; code 2/3 land at once in their own "failed" state
 * (never "denied", no retry since #921) that the next request() tries again.
 * location_permission carries `result` + integer `ms`.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGeolocation } from "@/lib/useGeolocation";
import { track, EVENTS } from "@/lib/analytics";

vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  track: vi.fn(),
}));

type Step = { ok: true } | { ok: false; code: number };

/** Each getCurrentPosition call consumes the next scripted step. */
function script(steps: Step[], advanceMsPerCall = 0) {
  const queue = [...steps];
  const getCurrentPosition = vi.fn(
    (success: PositionCallback, error?: PositionErrorCallback, _opts?: PositionOptions) => {
      void _opts;
      vi.advanceTimersByTime(advanceMsPerCall);
      const step = queue.shift();
      if (!step) throw new Error("getCurrentPosition called more often than scripted");
      if (step.ok) {
        success({ coords: { latitude: 38.25, longitude: -104.6 } } as GeolocationPosition);
      } else {
        error?.({ code: step.code } as GeolocationPositionError);
      }
    },
  );
  Object.defineProperty(navigator, "geolocation", {
    value: { getCurrentPosition },
    configurable: true,
  });
  return getCurrentPosition;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(track).mockClear();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (navigator as any).permissions;
});
afterEach(() => vi.useRealTimers());

describe("useGeolocation — error codes (#738, #921)", () => {
  test("code 1 is denied, logged with ms", () => {
    const gcp = script([{ ok: false, code: 1 }], 1500);
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    expect(gcp).toHaveBeenCalledTimes(1);
    expect(result.current.state).toEqual({ permission: "denied", position: null });
    expect(track).toHaveBeenCalledWith(EVENTS.LOCATION_PERMISSION, { result: "denied", ms: 1500 });
  });

  test("one low-accuracy attempt: 5 s timeout, 5 min cached fix", () => {
    const gcp = script([{ ok: true }], 300);
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    expect(gcp).toHaveBeenCalledTimes(1);
    expect(gcp.mock.calls[0][2]).toEqual({ enableHighAccuracy: false, timeout: 5000, maximumAge: 5 * 60_000 });
    expect(result.current.state).toEqual({ permission: "granted", position: { lat: 38.25, lng: -104.6 } });
    expect(track).toHaveBeenCalledWith(EVENTS.LOCATION_PERMISSION, { result: "granted", ms: 300 });
  });

  test.each([
    [3, "timeout"],
    [2, "unavailable"],
  ] as const)("code %i fails at once as %s, never denied, no retry", (code, reason) => {
    const gcp = script([{ ok: false, code }], 5000);
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    expect(gcp).toHaveBeenCalledTimes(1);
    expect(result.current.state).toEqual({ permission: "failed", position: null, reason });
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith(EVENTS.LOCATION_PERMISSION, { result: reason, ms: 5000 });
  });

  test("no navigator.geolocation is unavailable and logged", () => {
    Object.defineProperty(navigator, "geolocation", { value: undefined, configurable: true });
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    expect(result.current.state).toEqual({ permission: "failed", position: null, reason: "unavailable" });
    expect(track).toHaveBeenCalledWith(EVENTS.LOCATION_PERMISSION, { result: "unavailable", ms: 0 });
  });

  test("a later request after a failure tries again and can succeed", () => {
    const gcp = script([{ ok: false, code: 3 }, { ok: true }]);
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    expect(result.current.state.permission).toBe("failed");
    act(() => result.current.request());
    expect(gcp).toHaveBeenCalledTimes(2);
    expect(result.current.state.permission).toBe("granted");
    // The grant after a failed attempt is the first decided outcome, so it IS logged.
    expect(track).toHaveBeenCalledWith(EVENTS.LOCATION_PERMISSION, { result: "granted", ms: 0 });
  });

  test("a failure after an earlier grant is still logged (not a permission decision)", () => {
    script([{ ok: true }, { ok: false, code: 3 }]);
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    vi.mocked(track).mockClear();
    act(() => result.current.request());
    expect(track).toHaveBeenCalledWith(EVENTS.LOCATION_PERMISSION, { result: "timeout", ms: 0 });
  });
});
