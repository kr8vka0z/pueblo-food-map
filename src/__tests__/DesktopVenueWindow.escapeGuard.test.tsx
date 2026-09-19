/**
 * DesktopVenueWindow Escape-guard test (#508 fix pass review blocker,
 * 2026-09-19) — PhotoViewer nested inside a real DesktopVenueWindow box
 * card. Reproduces the actual bug: opening the box's photo full-size and
 * pressing Escape used to ALSO close the whole window, because
 * DesktopVenueWindow's own document-level Escape listener
 * (src/components/DesktopVenueWindow.tsx, "Keyboard handling") had no idea
 * a modal photo dialog was open above it. Fixed via `isNativeDialogOpen()`
 * (src/lib/dialogGuard.ts) — this test proves the fix against the real
 * component (not a mock of the Escape mechanism).
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DesktopVenueWindow from "@/components/DesktopVenueWindow";
import type { Venue } from "@/types/venue";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";

const mockTurnstile = {
  render: vi.fn((_container: HTMLElement, opts: { callback?: (t: string) => void }) => {
    if (opts.callback) opts.callback("test-turnstile-token");
    return "widget-id-1";
  }),
  reset: vi.fn(),
  remove: vi.fn(),
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  mockTurnstile.render.mockClear();
  vi.stubGlobal("turnstile", mockTurnstile);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const mockMapboxMap = {
  project: vi.fn().mockReturnValue({ x: 0, y: 0 }),
  getContainer: vi.fn().mockReturnValue({ offsetWidth: 1000, offsetHeight: 800 }),
  on: vi.fn().mockReturnThis(),
  off: vi.fn().mockReturnThis(),
};

function makeBoxVenue(overrides: Partial<Venue> = {}): Venue & { distanceMiles?: number } {
  return {
    id: "test-box-1",
    name: "Test Blessing Box",
    category: "blessing_box",
    lat: 38.27,
    lng: -104.61,
    address: "123 Test St, Pueblo, CO",
    hours_weekly: undefined,
    phone: undefined,
    url: undefined,
    operator: undefined,
    accepts_snap: false,
    accepts_wic: false,
    source: "manual",
    last_verified: "2026-01-01",
    ...overrides,
  };
}

function makeBox(overrides: Partial<PublicBlessingBox["box"]> = {}): PublicBlessingBox {
  return {
    id: "test-box-1",
    name: "Test Blessing Box",
    category: "blessing_box",
    lat: 38.27,
    lng: -104.61,
    address: "123 Test St, Pueblo, CO",
    source: "manual",
    last_verified: "2026-09-01T00:00:00.000Z",
    box: {
      hostName: null,
      hostNote: null,
      mostNeeded: null,
      installedOn: "2026-01-01",
      removedOn: null,
      status: "stocked",
      lastFilledAt: "2026-09-17T09:00:00.000Z",
      recentCheckins: [],
      latestPhoto: { id: 42, createdAt: "2026-09-17T09:00:00.000Z" },
      adopters: [],
      ...overrides,
    },
  };
}

describe("DesktopVenueWindow — Escape closes only the open PhotoViewer, not the window", () => {
  test("photo open + Escape: window's onClose NOT called, photo closes", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <DesktopVenueWindow
        venue={makeBoxVenue()}
        box={makeBox()}
        expanded={false}
        mapboxMap={mockMapboxMap}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={onClose}
        locale="en"
      />,
    );

    await user.click(screen.getByRole("button", { name: "View photo full size" }));
    const photoDialog = screen.getByRole("dialog", { name: /photo of test blessing box/i }) as HTMLDialogElement;
    expect(photoDialog.open).toBe(true);

    await user.keyboard("{Escape}");

    await waitFor(() => expect(photoDialog.open).toBe(false));
    expect(onClose).not.toHaveBeenCalled();
  });

  test("regression: with no photo open, Escape still closes the window as before", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <DesktopVenueWindow
        venue={makeBoxVenue()}
        box={makeBox()}
        expanded={false}
        mapboxMap={mockMapboxMap}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={onClose}
        locale="en"
      />,
    );
    screen.getByRole("dialog").focus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
