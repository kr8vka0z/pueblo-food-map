/**
 * /admin/box-photos — redirect regression test (#677, "fold Photo review
 * and Sponsor requests into the Blessing Boxes tab"). Same pattern as
 * /admin/flags/page.test.tsx: next/navigation's real `redirect()` throws
 * internally, mocked here so the test can assert it fired with the right
 * target without a real Next router.
 */

import { describe, expect, test, vi } from "vitest";

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (target: string) => {
    mockRedirect(target);
    throw new Error("REDIRECT_CALLED");
  },
}));

import BoxPhotosPage from "@/app/(site)/admin/box-photos/page";

describe("BoxPhotosPage — redirects to the Blessing Boxes tab's To review filter", () => {
  test("calls redirect('/admin/boxes?show=review')", () => {
    expect(() => BoxPhotosPage()).toThrow("REDIRECT_CALLED");
    expect(mockRedirect).toHaveBeenCalledWith("/admin/boxes?show=review");
  });
});
