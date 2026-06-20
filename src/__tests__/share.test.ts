/**
 * Unit tests for src/lib/share.ts (#132).
 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { venueShareUrl, shareVenue } from "@/lib/share";

// ─── venueShareUrl ────────────────────────────────────────────────────────────

describe("venueShareUrl", () => {
  // Updated in PR2 (#164 6.4): canonical form is now /venue/<id> not /?venue=<id>.
  test("ends with /venue/abc for plain id", () => {
    const url = venueShareUrl("abc");
    expect(url.endsWith("/venue/abc")).toBe(true);
  });

  test("encodes spaces in id (a b → a%20b)", () => {
    const url = venueShareUrl("a b");
    expect(url).toContain("/venue/a%20b");
  });
});

// ─── shareVenue — native share sheet ─────────────────────────────────────────

describe("shareVenue — navigator.share available and resolves", () => {
  afterEach(() => {
    // Restore share if we defined it
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (navigator as any).share;
    } catch {
      // Some environments won't let delete; redefine to undefined
      Object.defineProperty(navigator, "share", {
        value: undefined,
        configurable: true,
        writable: true,
      });
    }
  });

  test("returns 'shared' and calls navigator.share once with url ending /?venue=v1", async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: shareMock,
      configurable: true,
      writable: true,
    });

    const result = await shareVenue({ venueId: "v1", title: "Test Venue" });

    expect(result).toBe("shared");
    expect(shareMock).toHaveBeenCalledTimes(1);
    const callArg = shareMock.mock.calls[0][0] as { url: string };
    expect(callArg.url.endsWith("/venue/v1")).toBe(true);
  });
});

// ─── shareVenue — AbortError (user dismissed) ────────────────────────────────

describe("shareVenue — navigator.share rejects with AbortError", () => {
  afterEach(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (navigator as any).share;
    } catch {
      Object.defineProperty(navigator, "share", {
        value: undefined,
        configurable: true,
        writable: true,
      });
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (navigator as any).clipboard;
    } catch {
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
        writable: true,
      });
    }
  });

  test("returns 'cancelled' and does NOT call clipboard.writeText", async () => {
    const shareMock = vi.fn().mockRejectedValue(new DOMException("x", "AbortError"));
    Object.defineProperty(navigator, "share", {
      value: shareMock,
      configurable: true,
      writable: true,
    });

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    const result = await shareVenue({ venueId: "v1", title: "Test Venue" });

    expect(result).toBe("cancelled");
    expect(writeTextMock).not.toHaveBeenCalled();
  });
});

// ─── shareVenue — clipboard fallback ─────────────────────────────────────────

describe("shareVenue — no navigator.share, clipboard available", () => {
  afterEach(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (navigator as any).clipboard;
    } catch {
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
        writable: true,
      });
    }
  });

  test("returns 'copied' and calls writeText with venue URL", async () => {
    // Ensure navigator.share is absent
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    const result = await shareVenue({ venueId: "v1", title: "Test Venue" });

    expect(result).toBe("copied");
    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const calledWith = writeTextMock.mock.calls[0][0] as string;
    expect(calledWith.endsWith("/venue/v1")).toBe(true);
  });
});
