/**
 * useMapFilters — search_used records the SETTLED search (#738).
 *
 * A slow typer pausing >600 ms between letters used to log "pan", "pant",
 * "pantry". Now: sent on commit (Enter / leaving the box) or after a ~2 s
 * idle, and never the same term twice in a row.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMapFilters } from "@/lib/useMapFilters";
import { track, EVENTS } from "@/lib/analytics";

vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  track: vi.fn(),
}));

const CENTER = { lat: 38.2544, lng: -104.6091 };

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(track).mockClear();
});
afterEach(() => vi.useRealTimers());

function type(result: { current: ReturnType<typeof useMapFilters> }, text: string) {
  act(() => result.current.setQuery(text));
}

describe("search_used settle logic", () => {
  test("keystrokes 1 s apart (slow typer) send only the final term after the idle", () => {
    const { result } = renderHook(() => useMapFilters(CENTER));
    for (const t of ["pan", "pant", "pantry"]) {
      type(result, t);
      act(() => void vi.advanceTimersByTime(1000));
    }
    expect(track).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1000)); // 2 s since the last keystroke
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith(EVENTS.SEARCH_USED, expect.objectContaining({ term: "pantry" }));
  });

  test("commitSearch (Enter / blur) sends right away", () => {
    const { result } = renderHook(() => useMapFilters(CENTER));
    type(result, "pantry");
    act(() => result.current.commitSearch());
    expect(track).toHaveBeenCalledTimes(1);
  });

  test("the same term is never sent twice in a row (commit then idle)", () => {
    const { result } = renderHook(() => useMapFilters(CENTER));
    type(result, "pantry");
    act(() => result.current.commitSearch());
    act(() => result.current.commitSearch());
    act(() => void vi.advanceTimersByTime(5000));
    expect(track).toHaveBeenCalledTimes(1);
  });

  test("a different term after the first is sent", () => {
    const { result } = renderHook(() => useMapFilters(CENTER));
    type(result, "pantry");
    act(() => result.current.commitSearch());
    type(result, "garden");
    act(() => result.current.commitSearch());
    expect(track).toHaveBeenCalledTimes(2);
  });

  test("an empty query sends nothing", () => {
    const { result } = renderHook(() => useMapFilters(CENTER));
    act(() => result.current.commitSearch());
    type(result, "   ");
    act(() => result.current.commitSearch());
    act(() => void vi.advanceTimersByTime(5000));
    expect(track).not.toHaveBeenCalled();
  });
});
