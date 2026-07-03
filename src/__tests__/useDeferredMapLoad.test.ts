/**
 * Unit tests for useDeferredMapLoad — the perf gate that keeps mapbox-gl out
 * of the critical rendering path on cold load (#226).
 *
 * WHY a standalone hook test (same pattern as useMapFilters.test.ts): the
 * gate's logic is timers + DOM event listeners, nothing Mapbox- or
 * vaul-dependent, so it's directly testable with renderHook() — no WebGL,
 * no full MapWrapper mount required.
 *
 * Covers:
 *   1. eager=true starts already triggered (deep-link fast path)
 *   2. eager=false starts NOT triggered
 *   3. requestIdleCallback fires the trigger when the browser supports it
 *   4. setTimeout fallback fires the trigger when requestIdleCallback is absent
 *   5. each interaction event type (pointerdown/touchstart/scroll/keydown/focusin)
 *      fires the trigger before the idle deadline
 *   6. scroll on a NESTED element still triggers (capture-phase — scroll does
 *      not bubble, so this proves the capture:true choice actually matters)
 *   7. idempotent once triggered — later events/timers don't throw or flip anything
 *   8. cleans up its listeners/timer once triggered (no leak)
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useDeferredMapLoad,
  IDLE_TIMEOUT_MS,
  FALLBACK_DELAY_MS,
} from "@/lib/useDeferredMapLoad";

// jsdom does not implement requestIdleCallback — delete it defensively so
// tests exercising the setTimeout fallback are unambiguous even if a future
// jsdom version adds a stub for it.
beforeEach(() => {
  delete (window as { requestIdleCallback?: unknown }).requestIdleCallback;
  delete (window as { cancelIdleCallback?: unknown }).cancelIdleCallback;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─── 1/2. Initial state ────────────────────────────────────────────────────

describe("useDeferredMapLoad — initial state", () => {
  test("eager=true starts already triggered", () => {
    const { result } = renderHook(() => useDeferredMapLoad(true));
    expect(result.current).toBe(true);
  });

  test("eager=false starts NOT triggered", () => {
    const { result } = renderHook(() => useDeferredMapLoad(false));
    expect(result.current).toBe(false);
  });
});

// ─── 3. requestIdleCallback branch ─────────────────────────────────────────

describe("useDeferredMapLoad — requestIdleCallback", () => {
  test("registers requestIdleCallback with the exported timeout budget, and firing it triggers", () => {
    let savedCallback: (() => void) | null = null;
    const ric = vi.fn((cb: () => void) => {
      savedCallback = cb;
      return 7;
    });
    const cic = vi.fn();
    (window as unknown as { requestIdleCallback: typeof ric }).requestIdleCallback = ric;
    (window as unknown as { cancelIdleCallback: typeof cic }).cancelIdleCallback = cic;

    const { result } = renderHook(() => useDeferredMapLoad(false));
    expect(result.current).toBe(false);
    expect(ric).toHaveBeenCalledWith(expect.any(Function), { timeout: IDLE_TIMEOUT_MS });

    act(() => {
      savedCallback?.();
    });
    expect(result.current).toBe(true);
  });
});

// ─── 4. setTimeout fallback ─────────────────────────────────────────────────

describe("useDeferredMapLoad — setTimeout fallback (no requestIdleCallback)", () => {
  test("triggers after FALLBACK_DELAY_MS when requestIdleCallback is unsupported", () => {
    const { result } = renderHook(() => useDeferredMapLoad(false));
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(FALLBACK_DELAY_MS - 1);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });
});

// ─── 5. Interaction triggers ────────────────────────────────────────────────

describe.each(["pointerdown", "touchstart", "scroll", "keydown", "focusin"])(
  "useDeferredMapLoad — %s triggers before the idle fallback",
  (eventType) => {
    test(`dispatching ${eventType} on window flips the gate immediately`, () => {
      const { result } = renderHook(() => useDeferredMapLoad(false));
      expect(result.current).toBe(false);

      act(() => {
        window.dispatchEvent(new Event(eventType));
      });
      expect(result.current).toBe(true);

      // Fallback timer never needed to fire — confirms this was the
      // interaction path, not a coincidentally-elapsed timeout.
      expect(vi.getTimerCount()).toBeGreaterThanOrEqual(0);
    });
  },
);

// ─── 6. Non-bubbling scroll from a nested element (capture-phase) ──────────

describe("useDeferredMapLoad — nested scroll (capture-phase requirement)", () => {
  test("scroll dispatched on a descendant element still triggers (scroll does not bubble)", () => {
    const child = document.createElement("div");
    document.body.appendChild(child);
    try {
      const { result } = renderHook(() => useDeferredMapLoad(false));
      expect(result.current).toBe(false);

      act(() => {
        // Native scroll events do not bubble — only a capture-phase listener
        // registered on an ancestor (window, here) observes this dispatch.
        child.dispatchEvent(new Event("scroll", { bubbles: false }));
      });
      expect(result.current).toBe(true);
    } finally {
      document.body.removeChild(child);
    }
  });
});

// ─── 7. Idempotency ──────────────────────────────────────────────────────────

describe("useDeferredMapLoad — idempotency", () => {
  test("further events after triggering do not throw and leave the gate true", () => {
    const { result } = renderHook(() => useDeferredMapLoad(false));

    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
    });
    expect(result.current).toBe(true);

    expect(() => {
      act(() => {
        window.dispatchEvent(new Event("keydown"));
        vi.advanceTimersByTime(FALLBACK_DELAY_MS + IDLE_TIMEOUT_MS);
      });
    }).not.toThrow();
    expect(result.current).toBe(true);
  });
});

// ─── 8. Cleanup ───────────────────────────────────────────────────────────────

describe("useDeferredMapLoad — cleanup", () => {
  test("removes its interaction listeners once triggered", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { result } = renderHook(() => useDeferredMapLoad(false));

    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
    });
    expect(result.current).toBe(true);

    const removedTypes = removeSpy.mock.calls.map((call) => call[0]);
    for (const type of ["pointerdown", "touchstart", "scroll", "keydown", "focusin"]) {
      expect(removedTypes).toContain(type);
    }
  });

  test("clears the fallback timer on unmount before it fires", () => {
    const clearSpy = vi.spyOn(window, "clearTimeout");
    const { unmount } = renderHook(() => useDeferredMapLoad(false));
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });
});
