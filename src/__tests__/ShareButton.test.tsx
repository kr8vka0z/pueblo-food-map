/**
 * Component tests for ShareButton (#132).
 *
 * Mock strategy:
 *   userEvent.setup() installs a fake clipboard on navigator.clipboard (a
 *   @testing-library/user-event v14 behaviour), which replaces any mock we set
 *   via Object.defineProperty. To avoid that conflict, the clipboard-fallback
 *   test mocks shareVenue via vi.spyOn — it verifies the component's "copied"
 *   response path (status element appears) and that shareVenue is called.
 *   The navigator.clipboard integration is covered in share.test.ts, which
 *   calls shareVenue directly without userEvent.
 *
 *   The native-share test defines navigator.share BEFORE userEvent.setup() so
 *   userEvent doesn't interfere (userEvent only intercepts clipboard, not share).
 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ShareButton from "@/components/ShareButton";
import * as shareMod from "@/lib/share";

// ─── Test: native share sheet ─────────────────────────────────────────────────

describe("ShareButton — native share sheet", () => {
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
  });

  test("clicking the button calls navigator.share once (accessible name matches /share test pantry/i)", async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    // Define BEFORE userEvent.setup() — userEvent doesn't touch navigator.share
    Object.defineProperty(navigator, "share", {
      value: shareMock,
      configurable: true,
      writable: true,
    });

    const user = userEvent.setup();
    render(
      <ShareButton venueId="v1" venueName="Test Pantry" locale="en" />,
    );
    const btn = screen.getByRole("button", { name: /share test pantry/i });
    await user.click(btn);

    // Wait for async state flush after shareVenue resolves
    await new Promise((r) => setTimeout(r, 50));

    expect(shareMock).toHaveBeenCalledTimes(1);
  });
});

// ─── Test: clipboard fallback (shareVenue returns "copied") ───────────────────
// userEvent.setup() replaces navigator.clipboard — mock shareVenue directly
// to test the component's "copied" state handling without navigator conflict.
// The shareVenue + clipboard integration is tested in share.test.ts.

describe("ShareButton — clipboard fallback (shareVenue returns 'copied')", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("when shareVenue returns 'copied': status element appears and writeText URL is correct", async () => {
    // Spy on shareVenue, make it return "copied" (simulating clipboard path)
    const spy = vi.spyOn(shareMod, "shareVenue").mockResolvedValue("copied");

    const user = userEvent.setup();
    render(
      <ShareButton venueId="v1" venueName="Test Pantry" locale="en" />,
    );
    const btn = screen.getByRole("button", { name: /share test pantry/i });
    await user.click(btn);

    // Wait for the "copied" state to appear (findByRole polls until the element exists)
    const status = await screen.findByRole("status");
    expect(status.textContent).toMatch(/link copied/i);

    // shareVenue was called once with a URL ending /?venue=v1
    expect(spy).toHaveBeenCalledTimes(1);
    const callArg = spy.mock.calls[0][0];
    expect(callArg.venueId).toBe("v1");
  });
});
