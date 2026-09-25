/**
 * isValidEmail — non-string input guard (#595).
 *
 * Separate file from email.test.ts (existing, write-guarded on fix/*
 * branches) — covers only the new typeof guard added for #595, so a
 * non-string `contactEmail` rejects instead of crashing `.slice()`.
 */

import { describe, test, expect } from "vitest";
import { isValidEmail } from "@/lib/email";

describe("isValidEmail — non-string input (#595)", () => {
  test.each([123, true, false, {}, [], null, undefined])(
    "rejects %j instead of throwing",
    (value) => {
      expect(() => isValidEmail(value)).not.toThrow();
      expect(isValidEmail(value)).toBe(false);
    },
  );

  test("still accepts a well-formed string email", () => {
    expect(isValidEmail("person@example.com")).toBe(true);
  });
});
