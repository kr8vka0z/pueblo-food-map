/**
 * Retired admin routes — redirect regression tests. Each of these pages used
 * to render its own review queue; the queue was folded into a tab, and old
 * links must still land on the right filter:
 *   /admin/flags         (#674, Data refresh tab → Places)
 *   /admin/submissions   (#675, public Review queue → Places)
 *   /admin/box-photos    (#677, Photo review → Blessing Boxes)
 *   /admin/box-adopters  (#677, Sponsor requests → Blessing Boxes)
 * /admin/flags is a one-line Server Component `redirect()` page (it still
 * serves the links in refresh-alert emails; see its header). The other three
 * are plain-path `redirects()` entries in next.config.ts (#724).
 *
 * next/navigation's real `redirect()` throws internally to unwind to Next's
 * router; it is mocked to throw too, so the page case asserts the redirect
 * fired with the right target without a real Next router.
 */

import { describe, expect, test, vi } from "vitest";
import nextConfig from "../../../../next.config";

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (target: string) => {
    mockRedirect(target);
    throw new Error("REDIRECT_CALLED");
  },
}));

describe("retired admin routes redirect to their new home", () => {
  test("/admin/flags calls redirect('/admin/places?show=review')", async () => {
    const { default: Page } = await import("@/app/(site)/admin/flags/page");
    expect(() => Page()).toThrow("REDIRECT_CALLED");
    expect(mockRedirect).toHaveBeenCalledTimes(1);
    expect(mockRedirect).toHaveBeenCalledWith("/admin/places?show=review");
  });

  test.each([
    { source: "/admin/submissions", destination: "/admin/places?show=review&from=public" },
    { source: "/admin/box-photos", destination: "/admin/boxes?show=review" },
    { source: "/admin/box-adopters", destination: "/admin/boxes?show=review" },
  ])("$source redirects to $destination", async ({ source, destination }) => {
    const rules = (await nextConfig.redirects?.()) ?? [];
    expect(rules.filter((r) => r.source === source)).toEqual([
      { source, destination, permanent: false },
    ]);
  });
});
