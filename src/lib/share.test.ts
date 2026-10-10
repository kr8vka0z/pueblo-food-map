/**
 * share.test.ts — the event share link and the share-sheet -> copy fallback
 * (#759). shareLink is also what shareVenue now calls, so this covers both.
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { eventShareUrl, shareLink } from "@/lib/share";

const nav = navigator as unknown as Record<string, unknown>;

function setNavigator(share: unknown, writeText: unknown) {
  Object.defineProperty(navigator, "share", { value: share, configurable: true, writable: true });
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true, writable: true });
}

afterEach(() => {
  delete nav.share;
  delete nav.clipboard;
});

describe("eventShareUrl", () => {
  test("is the map URL with ?event=<id>, and the /es URL on a Spanish page", () => {
    expect(eventShareUrl("abc 1", "en")).toBe(`${window.location.origin}/?event=abc%201`);
    expect(eventShareUrl("abc", "es")).toBe(`${window.location.origin}/es?event=abc`);
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
