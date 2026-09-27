/**
 * /admin/submissions — redirect regression test (#675, "fold the Review
 * queue into Places"). Same pattern as /admin/flags/page.test.tsx and
 * /admin/box-photos/page.test.tsx: next/navigation's real `redirect()`
 * throws internally, mocked here so the test can assert it fired with the
 * right target without a real Next router.
 */

import { describe, expect, test, vi } from "vitest";

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (target: string) => {
    mockRedirect(target);
    throw new Error("REDIRECT_CALLED");
  },
}));

import SubmissionsPage from "@/app/admin/submissions/page";

describe("SubmissionsPage — redirects to the Places tab's To review + public filter", () => {
  test("calls redirect('/admin/places?show=review&from=public')", () => {
    expect(() => SubmissionsPage()).toThrow("REDIRECT_CALLED");
    expect(mockRedirect).toHaveBeenCalledWith("/admin/places?show=review&from=public");
  });
});
