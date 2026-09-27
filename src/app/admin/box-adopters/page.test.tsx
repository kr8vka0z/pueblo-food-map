/**
 * /admin/box-adopters — redirect regression test (#677, "fold Photo review
 * and Sponsor requests into the Blessing Boxes tab"). Same pattern as
 * /admin/box-photos/page.test.tsx.
 */

import { describe, expect, test, vi } from "vitest";

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (target: string) => {
    mockRedirect(target);
    throw new Error("REDIRECT_CALLED");
  },
}));

import BoxAdoptersPage from "@/app/admin/box-adopters/page";

describe("BoxAdoptersPage — redirects to the Blessing Boxes tab's To review filter", () => {
  test("calls redirect('/admin/boxes?show=review')", () => {
    expect(() => BoxAdoptersPage()).toThrow("REDIRECT_CALLED");
    expect(mockRedirect).toHaveBeenCalledWith("/admin/boxes?show=review");
  });
});
