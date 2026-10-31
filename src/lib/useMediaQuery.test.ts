/**
 * prefersReducedMotion() replaced six inline matchMedia reads; several jsdom
 * tests render those components without stubbing matchMedia, so the helper
 * must answer false (not throw) when matchMedia is missing.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { prefersReducedMotion, useMediaQuery } from "@/lib/useMediaQuery";

describe("prefersReducedMotion", () => {
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
    vi.restoreAllMocks();
  });

  it.each([
    ["matchMedia missing", undefined, false],
    ["setting off", false, false],
    ["setting on", true, true],
  ])("%s → %s", (_label, matches, expected) => {
    window.matchMedia = (matches === undefined
      ? undefined
      : vi.fn((query: string) => ({ matches, media: query }))) as unknown as typeof window.matchMedia;
    expect(prefersReducedMotion()).toBe(expected);
  });
});

// #721 bug: the hook started `false` on every client render and synced a tick
// later, so on a phone MapWrapper's "desktop layout → prefetch the desktop
// card" effect ran once with isMobile=false and downloaded that chunk anyway.
describe("useMediaQuery", () => {
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
  });

  it("returns the real match on the very first client render", () => {
    window.matchMedia = vi.fn((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    const seen: boolean[] = [];
    renderHook(() => {
      const v = useMediaQuery("(max-width: 767px)");
      seen.push(v);
      return v;
    });
    expect(seen[0]).toBe(true);
  });

  it("answers false (not throw) when matchMedia is missing", () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia;
    const { result } = renderHook(() => useMediaQuery("(max-width: 767px)"));
    expect(result.current).toBe(false);
  });

  it("follows a change event", () => {
    let listener: (() => void) | null = null;
    let matches = false;
    window.matchMedia = vi.fn((query: string) => ({
      get matches() {
        return matches;
      },
      media: query,
      addEventListener: (_: string, l: () => void) => (listener = l),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    const { result } = renderHook(() => useMediaQuery("(max-width: 767px)"));
    expect(result.current).toBe(false);
    act(() => {
      matches = true;
      listener?.();
    });
    expect(result.current).toBe(true);
  });
});
