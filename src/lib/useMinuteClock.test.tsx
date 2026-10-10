/**
 * useMinuteClock.test.tsx — two callers share ONE timer and the same tick, and
 * the timer goes away with the last caller (#759: "no second timer").
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMinuteClock } from "@/lib/useMinuteClock";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-21T17:00:00.000Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useMinuteClock", () => {
  test("two callers share one interval and see the same value after a tick", () => {
    const first = renderHook(() => useMinuteClock());
    const second = renderHook(() => useMinuteClock());
    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(first.result.current).toBe(Date.parse("2026-11-21T17:01:00.000Z"));
    expect(second.result.current).toBe(first.result.current);
  });

  test("the timer stops when the last caller unmounts and restarts for the next", () => {
    const a = renderHook(() => useMinuteClock());
    const b = renderHook(() => useMinuteClock());
    a.unmount();
    expect(vi.getTimerCount()).toBe(1);
    b.unmount();
    expect(vi.getTimerCount()).toBe(0);

    const c = renderHook(() => useMinuteClock());
    expect(vi.getTimerCount()).toBe(1);
    c.unmount();
  });

  test("coming back to a visible tab refreshes at once", () => {
    const { result, unmount } = renderHook(() => useMinuteClock());
    vi.setSystemTime(new Date("2026-11-21T17:30:00.000Z"));

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current).toBe(Date.parse("2026-11-21T17:30:00.000Z"));
    unmount();
  });
});
