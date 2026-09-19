/**
 * Tests for src/lib/displayNameHygiene.ts (Blessing Boxes slice 6,
 * 2026-09-18 security review item 11).
 */

import { describe, expect, test } from "vitest";
import { sanitizeDisplayName } from "@/lib/displayNameHygiene";

describe("sanitizeDisplayName", () => {
  test("passes a plain name through unchanged", () => {
    expect(sanitizeDisplayName("The Martinez Family")).toBe("The Martinez Family");
  });

  test("trims surrounding whitespace", () => {
    expect(sanitizeDisplayName("  The Martinez Family  ")).toBe("The Martinez Family");
  });

  test("rejects (null) a name containing a bare LF", () => {
    expect(sanitizeDisplayName("The Martinez\nFamily")).toBeNull();
  });

  test("rejects (null) a name containing a CRLF", () => {
    expect(sanitizeDisplayName("The Martinez\r\nFamily")).toBeNull();
  });

  test("strips C0 control characters, doesn't reject", () => {
    expect(sanitizeDisplayName("The\u0007 Martinez Family")).toBe("The Martinez Family");
  });

  test("strips C1 control characters", () => {
    expect(sanitizeDisplayName("The\u0090 Martinez Family")).toBe("The Martinez Family");
  });

  test("strips zero-width characters (U+200B-U+200D, U+2060, U+FEFF)", () => {
    expect(sanitizeDisplayName("The​ Martinez⁠ Family﻿")).toBe("The Martinez Family");
  });

  test("strips bidi control characters (U+202A-U+202E, U+2066-U+2069, U+200E, U+200F, U+061C)", () => {
    expect(sanitizeDisplayName("The‮ Martinez‎ Family؜")).toBe("The Martinez Family");
  });

  test("a name that's ONLY control/zero-width characters -> null (empty after cleaning)", () => {
    expect(sanitizeDisplayName("​‌‍")).toBeNull();
  });

  test("refuses (null) a name containing http://", () => {
    expect(sanitizeDisplayName("Visit http://spam.example")).toBeNull();
  });

  test("refuses (null) a name containing https://", () => {
    expect(sanitizeDisplayName("Visit https://spam.example")).toBeNull();
  });

  test("refuses (null) a name containing www.", () => {
    expect(sanitizeDisplayName("Visit www.spam.example")).toBeNull();
  });

  test("empty input -> null", () => {
    expect(sanitizeDisplayName("")).toBeNull();
  });

  test("whitespace-only input -> null", () => {
    expect(sanitizeDisplayName("   ")).toBeNull();
  });
});
