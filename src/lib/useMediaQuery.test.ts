/**
 * prefersReducedMotion() replaced six inline matchMedia reads; several jsdom
 * tests render those components without stubbing matchMedia, so the helper
 * must answer false (not throw) when matchMedia is missing.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { prefersReducedMotion } from "@/lib/useMediaQuery";

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
