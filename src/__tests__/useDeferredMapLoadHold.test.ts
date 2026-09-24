/**
 * Unit tests for useDeferredMapLoad's `hold` param (#588) — the splash-gate
 * addition to the #226 deferred-map-load hook. See useDeferredMapLoad.test.ts
 * for the pre-existing eager/idle/interaction coverage this file doesn't
 * repeat.
 *
 * Covers:
 *   1. hold=true suppresses the idle-callback/setTimeout auto-trigger
 *      (requestIdleCallback is never even registered)
 *   2. hold=true still triggers on a real interaction event (splash-CTA tap)
 *   3. hold's true→false edge (splash dismissed) triggers immediately, with
 *      no interaction event and no elapsed idle/timeout budget — the
 *      belt-and-suspenders path for a dismissal that never dispatches a
 *      pointer/key DOM event (script-driven .click(), some AT activation)
 *   4. hold=false (default) is unaffected — matches pre-#588 behavior
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useDeferredMapLoad,
  IDLE_TIMEOUT_MS,
  FALLBACK_DELAY_MS,
} from "@/lib/useDeferredMapLoad";

beforeEach(() => {
  delete (window as { requestIdleCallback?: unknown }).requestIdleCallback;
  delete (window as { cancelIdleCallback?: unknown }).cancelIdleCallback;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useDeferredMapLoad — hold suppresses the idle/timeout auto-trigger", () => {
  test("hold=true: never triggers even after the idle timeout + fallback budget elapses", () => {
    const { result } = renderHook(() => useDeferredMapLoad(false, true));
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS + FALLBACK_DELAY_MS + 1000);
    });
    expect(result.current).toBe(false);
  });

  test("hold=true: requestIdleCallback is never registered", () => {
    const ric = vi.fn();
    (window as unknown as { requestIdleCallback: typeof ric }).requestIdleCallback = ric;

    renderHook(() => useDeferredMapLoad(false, true));
    expect(ric).not.toHaveBeenCalled();
  });
});

describe("useDeferredMapLoad — hold=true still triggers on a real interaction", () => {
  test.each(["pointerdown", "touchstart", "scroll", "keydown", "focusin"])(
    "%s on window flips the gate immediately even while held",
    (eventType) => {
      const { result } = renderHook(() => useDeferredMapLoad(false, true));
      expect(result.current).toBe(false);

      act(() => {
        window.dispatchEvent(new Event(eventType));
      });
      expect(result.current).toBe(true);
    },
  );
});

describe("useDeferredMapLoad — hold's true→false edge (splash dismissed)", () => {
  test("dropping hold triggers immediately, with no interaction and no elapsed timer", () => {
    const { result, rerender } = renderHook(
      ({ hold }) => useDeferredMapLoad(false, hold),
      { initialProps: { hold: true } },
    );
    expect(result.current).toBe(false);

    act(() => {
      rerender({ hold: false });
    });
    expect(result.current).toBe(true);
  });

  test("a hold that starts false and never flips true behaves exactly like no hold at all", () => {
    const { result } = renderHook(() => useDeferredMapLoad(false, false));
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(FALLBACK_DELAY_MS);
    });
    expect(result.current).toBe(true);
  });
});
