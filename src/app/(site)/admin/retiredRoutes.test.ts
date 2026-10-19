/**
 * Retired admin routes — redirect regression tests. Each of these pages used
 * to render its own review queue; the queue was folded into a tab, and the
 * page became a one-line Server Component `redirect()` so old links still
 * land on the right filter:
 *   /admin/flags         (#674, Data refresh tab → Places)
 *   /admin/submissions   (#675, public Review queue → Places)
 *   /admin/box-photos    (#677, Photo review → Blessing Boxes)
 *   /admin/box-adopters  (#677, Sponsor requests → Blessing Boxes)
 * /admin/flags also still serves the links in refresh-alert emails sent
 * before the alert link moved to /admin/places?show=review; those emails
 * still sit in inboxes. See each page.tsx's own header for why it is a
 * redirect and not a 404.
 *
 * next/navigation's real `redirect()` throws internally to unwind to Next's
 * router; it is mocked to throw too, so each case asserts the redirect fired
 * with the right target without a real Next router.
 */

import { beforeEach, describe, expect, test, vi } from "vitest";

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (target: string) => {
    mockRedirect(target);
    throw new Error("REDIRECT_CALLED");
  },
}));

describe("retired admin routes redirect to their new home", () => {
  beforeEach(() => {
    mockRedirect.mockClear();
  });

  test.each([
    { route: "/admin/flags", load: () => import("@/app/(site)/admin/flags/page"), target: "/admin/places?show=review" },
    { route: "/admin/submissions", load: () => import("@/app/(site)/admin/submissions/page"), target: "/admin/places?show=review&from=public" },
    { route: "/admin/box-photos", load: () => import("@/app/(site)/admin/box-photos/page"), target: "/admin/boxes?show=review" },
    { route: "/admin/box-adopters", load: () => import("@/app/(site)/admin/box-adopters/page"), target: "/admin/boxes?show=review" },
  ])("$route calls redirect('$target')", async ({ load, target }) => {
    const { default: Page } = await load();
    expect(() => Page()).toThrow("REDIRECT_CALLED");
    expect(mockRedirect).toHaveBeenCalledTimes(1);
    expect(mockRedirect).toHaveBeenCalledWith(target);
  });
});
