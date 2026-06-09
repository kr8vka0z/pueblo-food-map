/**
 * Unit tests for the favorites store (#132).
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  getFavorites,
  isFavorite,
  addFavorite,
  removeFavorite,
  toggleFavorite,
  __resetFavoritesForTests,
} from "@/lib/favorites";

const STORAGE_KEY = "pfm.favorites.v1";

beforeEach(() => {
  __resetFavoritesForTests();
});

describe("favorites store — initial state", () => {
  test("isFavorite returns false initially", () => {
    expect(isFavorite("x")).toBe(false);
  });

  test("getFavorites returns empty array initially", () => {
    expect(getFavorites().length).toBe(0);
  });
});

describe("favorites store — toggleFavorite", () => {
  test("toggleFavorite returns true (now saved) on first toggle", () => {
    expect(toggleFavorite("x")).toBe(true);
  });

  test("after toggle, isFavorite is true and getFavorites includes the id", () => {
    toggleFavorite("x");
    expect(isFavorite("x")).toBe(true);
    expect(getFavorites()).toContain("x");
  });

  test("localStorage contains the id after toggle", () => {
    toggleFavorite("x");
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    expect(stored).toEqual(["x"]);
  });

  test("second toggleFavorite returns false (now removed)", () => {
    toggleFavorite("x");
    expect(toggleFavorite("x")).toBe(false);
  });

  test("after second toggle, isFavorite is false", () => {
    toggleFavorite("x");
    toggleFavorite("x");
    expect(isFavorite("x")).toBe(false);
  });

  test("after second toggle, localStorage has empty array", () => {
    toggleFavorite("x");
    toggleFavorite("x");
    // Either the key is gone or it is an empty array
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      expect(JSON.parse(raw)).toEqual([]);
    }
  });
});

describe("favorites store — addFavorite / removeFavorite idempotency", () => {
  test("addFavorite is idempotent — adding same id twice yields length 1", () => {
    addFavorite("y");
    addFavorite("y");
    expect(getFavorites().length).toBe(1);
  });

  test("removeFavorite of an absent id is a no-op", () => {
    // Should not throw and should not change state
    expect(() => removeFavorite("does-not-exist")).not.toThrow();
    expect(getFavorites().length).toBe(0);
  });
});

describe("favorites store — malformed localStorage", () => {
  test("getFavorites returns empty array and does not throw on bad JSON", () => {
    // Reset ensures cache is null; then seed bad JSON BEFORE first read
    __resetFavoritesForTests();
    localStorage.setItem(STORAGE_KEY, "not-json");
    // Cache is null after reset, so getFavorites() triggers readFromStorage()
    let result: readonly string[] | undefined;
    expect(() => {
      result = getFavorites();
    }).not.toThrow();
    expect(result?.length).toBe(0);
  });
});
