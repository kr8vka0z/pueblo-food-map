/**
 * Tests for src/lib/checkinClientToken.ts (Blessing Boxes slice 2).
 * Default vitest environment (jsdom) — window/localStorage are real here.
 */

import { describe, test, expect, beforeEach } from "vitest";
import { getCheckinClientToken } from "@/lib/checkinClientToken";

describe("getCheckinClientToken", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("mints a token on first call and persists it", () => {
    const first = getCheckinClientToken();
    expect(first).toBeTruthy();
    expect(window.localStorage.getItem("pfm-checkin-client-token")).toBe(first);
  });

  test("returns the SAME token on a later call, not a fresh one", () => {
    const first = getCheckinClientToken();
    const second = getCheckinClientToken();
    expect(second).toBe(first);
  });

  test("a throwing localStorage (privacy mode) -> null, never throws", () => {
    const blockedStorage = {
      getItem: () => {
        throw new Error("storage blocked");
      },
      setItem: () => {
        throw new Error("storage blocked");
      },
    };
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", { value: blockedStorage, configurable: true });
    try {
      expect(getCheckinClientToken()).toBeNull();
    } finally {
      if (original) Object.defineProperty(window, "localStorage", original);
    }
  });
});
