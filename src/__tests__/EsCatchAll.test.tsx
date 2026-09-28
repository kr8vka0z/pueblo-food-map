/**
 * src/app/es/[...rest]/page.tsx tests (#689 PR 2 follow-up, staging
 * finding). No existing test convention covers route-level not-found
 * files in this repo (see es/not-found.tsx's own header — those are
 * verified against a real build instead); this is a plain unit check that
 * the catch-all actually calls next/navigation's notFound(), which is
 * what makes it resolve against es/not-found.tsx instead of the English
 * global-not-found.tsx (see EsCatchAll's own header for the full mechanism
 * — this file can't unit-test the actual cross-tree not-found resolution,
 * that requires a real build; see this repo's build/staging verification
 * notes in the PR).
 */
import { describe, test, expect, vi } from "vitest";

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

import EsCatchAll from "@/app/es/[...rest]/page";

describe("EsCatchAll (/es/[...rest])", () => {
  test("calls next/navigation's notFound()", () => {
    expect(() => EsCatchAll()).toThrow();
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
