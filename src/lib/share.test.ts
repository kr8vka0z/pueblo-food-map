/**
 * share.test.ts — venue/box and event share links (#132, #164, #759) and the
 * share-sheet -> copy fallback. shareLink is also what shareVenue calls, so
 * the fallback cases cover both; one test pins that delegation.
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { eventShareUrl, shareLink, shareVenue, venueShareUrl } from "@/lib/share";

const nav = navigator as unknown as Record<string, unknown>;

function setNavigator(share: unknown, writeText: unknown) {
  Object.defineProperty(navigator, "share", { value: share, configurable: true, writable: true });
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true, writable: true });
}

afterEach(() => {
  delete nav.share;
  delete nav.clipboard;
});

describe("venueShareUrl", () => {
  // Canonical form is /venue/<id> since #164 6.4 (was /?venue=<id>).
  test("is the venue page URL, with the id encoded", () => {
    expect(venueShareUrl("abc")).toBe(`${window.location.origin}/venue/abc`);
    expect(venueShareUrl("a b")).toBe(`${window.location.origin}/venue/a%20b`);
  });

  test("a blessing box links to /box/<id>, not the static /venue/<id> page", () => {
    expect(venueShareUrl("box 1", true)).toBe(`${window.location.origin}/box/box%201`);
  });
});

describe("shareVenue", () => {
  test("returns 'shared' and calls navigator.share once with url ending /venue/v1", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator(share, vi.fn());

    expect(await shareVenue({ venueId: "v1", title: "Test Venue" })).toBe("shared");
    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Test Venue", url: venueShareUrl("v1") }),
    );
    expect((share.mock.calls[0][0] as { url: string }).url.endsWith("/venue/v1")).toBe(true);
  });
});

describe("eventShareUrl", () => {
  test("is the event page URL (#762), and the /es page on a Spanish page", () => {
    expect(eventShareUrl("abc 1", "en")).toBe(`${window.location.origin}/event/abc%201`);
    expect(eventShareUrl("abc", "es")).toBe(`${window.location.origin}/es/event/abc`);
  });
});

describe("shareLink", () => {
  const args = { url: "https://pueblofoodmap.com/?event=1", title: "Turkey drive" };

  test("uses the phone's share sheet when there is one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    setNavigator(share, writeText);

    expect(await shareLink(args)).toBe("shared");
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: args.url }));
    expect(writeText).not.toHaveBeenCalled();
  });

  test("copies the link when there is no share sheet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator(undefined, writeText);

    expect(await shareLink(args)).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(args.url);
  });

  test("copies when the share sheet fails, but NOT when the visitor dismissed it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator(vi.fn().mockRejectedValue(new Error("boom")), writeText);
    expect(await shareLink(args)).toBe("copied");

    writeText.mockClear();
    setNavigator(vi.fn().mockRejectedValue(new DOMException("dismissed", "AbortError")), writeText);
    expect(await shareLink(args)).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  test("reports unsupported when neither exists", async () => {
    setNavigator(undefined, undefined);
    expect(await shareLink(args)).toBe("unsupported");
  });
});
