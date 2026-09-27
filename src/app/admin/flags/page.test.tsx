/**
 * /admin/flags — redirect regression test (#674, "fold the Data refresh
 * tab into Places"). The queue this page used to render was deleted along
 * with ProposalsReviewView.tsx; see page.tsx's own header for why this
 * stays a redirect (bookmarks, the refresh-alert email) rather than a 404.
 *
 * next/navigation's real `redirect()` throws internally to unwind to
 * Next's router (same control-flow-by-throw shape as `forbidden()`/
 * `notFound()` elsewhere in this app) — mocked here the same way those are
 * mocked in every other admin page.test.tsx, so this test can assert it
 * fired with the right target via `.rejects.toThrow` / the mock's own call
 * args, without needing a real Next router.
 */

import { describe, expect, test, vi } from "vitest";

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (target: string) => {
    mockRedirect(target);
    throw new Error("REDIRECT_CALLED");
  },
}));

import FlagsPage from "@/app/admin/flags/page";

describe("FlagsPage — redirects to Places' To review filter", () => {
  test("calls redirect('/admin/places?show=review')", () => {
    expect(() => FlagsPage()).toThrow("REDIRECT_CALLED");
    expect(mockRedirect).toHaveBeenCalledWith("/admin/places?show=review");
  });
});
