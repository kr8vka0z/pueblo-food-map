/**
 * useGeolocation — error-code handling, low-accuracy retry, and analytics
 * payloads (#738).
 *
 * Only code 1 is a refusal; code 2/3 retry once at low accuracy and, if that
 * also fails, land in their own "failed" state (never "denied") that the next
 * request() simply retries. location_permission carries `result` + integer
 * `ms`.
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

describe("useGeolocation — error codes (#738)", () => {
  test("code 1 is denied: no retry, logged with ms", () => {
    const gcp = script([{ ok: false, code: 1 }], 1500);
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    expect(gcp).toHaveBeenCalledTimes(1);
    expect(result.current.state).toEqual({ permission: "denied", position: null });
    expect(track).toHaveBeenCalledWith(EVENTS.LOCATION_PERMISSION, { result: "denied", ms: 1500 });
  });

  test("first attempt allows a ~60 s cached fix", () => {
    const gcp = script([{ ok: true }]);
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    expect(gcp.mock.calls[0][2]).toMatchObject({ enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 });
  });

  test.each([2, 3])("code %i retries once at low accuracy with a cached fix", (code) => {
    const gcp = script([{ ok: false, code }, { ok: true }], 100);
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    expect(gcp).toHaveBeenCalledTimes(2);
    expect(gcp.mock.calls[1][2]).toMatchObject({ enableHighAccuracy: false, maximumAge: 5 * 60_000 });
    expect(result.current.state).toEqual({ permission: "granted", position: { lat: 38.25, lng: -104.6 } });
    // ms spans both attempts.
    expect(track).toHaveBeenCalledWith(EVENTS.LOCATION_PERMISSION, { result: "granted", ms: 200 });
  });

  test("retry refused (code 1) is denied", () => {
    script([{ ok: false, code: 3 }, { ok: false, code: 1 }]);
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    expect(result.current.state).toEqual({ permission: "denied", position: null });
  });

  test("timeout on both attempts is failed/timeout, not denied", () => {
    const gcp = script([{ ok: false, code: 3 }, { ok: false, code: 3 }], 4000);
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    expect(gcp).toHaveBeenCalledTimes(2); // retries once only
    expect(result.current.state).toEqual({ permission: "failed", position: null, reason: "timeout" });
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith(EVENTS.LOCATION_PERMISSION, { result: "timeout", ms: 8000 });
  });

  test("position-unavailable on both attempts is failed/unavailable", () => {
    script([{ ok: false, code: 2 }, { ok: false, code: 2 }]);
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    expect(result.current.state).toEqual({ permission: "failed", position: null, reason: "unavailable" });
    expect(track).toHaveBeenCalledWith(EVENTS.LOCATION_PERMISSION, { result: "unavailable", ms: 0 });
  });

  test("no navigator.geolocation is unavailable and logged", () => {
    Object.defineProperty(navigator, "geolocation", { value: undefined, configurable: true });
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    expect(result.current.state).toEqual({ permission: "failed", position: null, reason: "unavailable" });
    expect(track).toHaveBeenCalledWith(EVENTS.LOCATION_PERMISSION, { result: "unavailable", ms: 0 });
  });

  test("a later request after a failure tries again and can succeed", () => {
    const gcp = script([{ ok: false, code: 3 }, { ok: false, code: 3 }, { ok: true }]);
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    expect(result.current.state.permission).toBe("failed");
    act(() => result.current.request());
    expect(gcp).toHaveBeenCalledTimes(3);
    expect(result.current.state.permission).toBe("granted");
    // The grant after a failed attempt is the first decided outcome, so it IS logged.
    expect(track).toHaveBeenCalledWith(EVENTS.LOCATION_PERMISSION, { result: "granted", ms: 0 });
  });

  test("a failure after an earlier grant is still logged (not a permission decision)", () => {
    script([{ ok: true }, { ok: false, code: 3 }, { ok: false, code: 3 }]);
    const { result } = renderHook(() => useGeolocation());
    act(() => result.current.request());
    vi.mocked(track).mockClear();
    act(() => result.current.request());
    expect(track).toHaveBeenCalledWith(EVENTS.LOCATION_PERMISSION, { result: "timeout", ms: 0 });
  });
});
