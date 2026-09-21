/**
 * BottomSheet Escape-guard test (#508 fix pass review blocker, 2026-09-19)
 * — PhotoViewer nested inside a REAL (unmocked) vaul BottomSheet. Every
 * other BottomSheet test in this repo mocks `vaul` entirely (see
 * `src/__tests__/BottomSheet.test.tsx`'s own header) because vaul's drag-
 * gesture internals don't run cleanly in jsdom — but a mock can't prove
 * anything about a bug that lives INSIDE vaul's real Escape wiring. Empirically
 * confirmed vaul itself renders and dispatches Escape fine in jsdom for this
 * narrow purpose (no drag/pointer gestures triggered by a keydown).
 *
 * Reproduces the actual bug: vaul's `Drawer.Content` renders Radix's
 * `@radix-ui/react-dialog` under the hood, and vaul never forwards its own
 * `modal={false}` down to Radix's `Dialog.Root` — so Radix's
 * `DismissableLayer` always runs with `modal=true` semantics and listens
 * for Escape via a `document`-level CAPTURE-phase handler
 * (`@radix-ui/react-use-escape-keydown`). Opening the box's photo full-size
 * and pressing Escape used to ALSO close the whole sheet, because that
 * capture listener fired (and dismissed) before anything inside the photo
 * dialog could react. Fixed via `Drawer.Content`'s own `onEscapeKeyDown`
 * prop (`src/components/BottomSheet.tsx`), gated on
 * `isNativeDialogOpen()` (`src/lib/dialogGuard.ts` — see that file's own
 * header for the full trace through vaul/Radix's installed source).
 */

import { describe, test, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BottomSheet from "@/components/BottomSheet";
import type { Venue } from "@/types/venue";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";

// jsdom shims required by vaul (same as src/__tests__/OperatorAttribution.test.tsx,
// the repo's existing precedent for exercising a REAL vaul Drawer): vaul's
// Drawer.Content calls event.target.setPointerCapture() in onPointerDown, which
// jsdom doesn't implement. Without these, clicking the photo button dispatches a
// native pointerdown that bubbles into vaul's drag-gesture handler and throws,
// escaping the test boundary as an unhandled exception even though the
// assertions themselves pass.
beforeAll(() => {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn();
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  }
});

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

function makeBoxVenue(overrides: Partial<Venue> = {}): Venue & { distanceMiles?: number } {
  return {
    id: "test-box-1",
    name: "Test Blessing Box",
    category: "blessing_box",
    lat: 38.27,
    lng: -104.61,
    address: "123 Test St, Pueblo, CO",
    phone: undefined,
    hours_weekly: undefined,
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

describe("BottomSheet (real vaul) — Escape closes only the open PhotoViewer, not the sheet", () => {
  test("photo open + Escape: sheet's onClose NOT called, photo closes", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<BottomSheet venue={makeBoxVenue()} box={makeBox()} onClose={onClose} locale="en" />);

    await user.click(screen.getByRole("button", { name: "View photo full size" }));
    const photoDialog = screen.getByRole("dialog", { name: /photo of test blessing box/i }) as HTMLDialogElement;
    expect(photoDialog.open).toBe(true);

    await user.keyboard("{Escape}");

    await waitFor(() => expect(photoDialog.open).toBe(false));
    expect(onClose).not.toHaveBeenCalled();
  });

  test("regression: with no photo open, Escape still closes the sheet as before", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<BottomSheet venue={makeBoxVenue()} box={makeBox()} onClose={onClose} locale="en" />);
    screen.getByRole("button", { name: "View photo full size" }).focus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
