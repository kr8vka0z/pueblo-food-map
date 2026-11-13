/**
 * BottomSheet.boxGrabBar.test.tsx — a blessing box card always draws the grab
 * bar (#917 round 3). On a real phone a box's first view (name, status,
 * address, most needed, the whole check-in panel) fills the sheet, so the
 * sheet measures ONE resting height; the bar used to go `invisible` then, and
 * Kyle saw box cards with no bar while places had one. jsdom has no layout,
 * so the geometry is stubbed the same way BottomSheet.snap.test.tsx does it.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render } from "@testing-library/react";
import BottomSheet from "@/components/BottomSheet";
import type { Venue } from "@/types/venue";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";
import { waitForBoxCard } from "@/lib/testing/waitForBoxCard.testutil";

const rootProps = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("vaul", () => {
  const passthrough = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return {
    Drawer: {
      Root: ({ children, ...rest }: { children: React.ReactNode; [key: string]: unknown }) => {
        rootProps.current = rest;
        return <div>{children}</div>;
      },
      Portal: passthrough,
      Content: ({ children, ref, ...rest }: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) => (
        <div ref={ref} {...rest}>{children}</div>
      ),
      Title: passthrough,
      Description: passthrough,
    },
  };
});

const boxVenue: Venue = {
  id: "box-1",
  name: "Elm Street Blessing Box",
  category: "blessing_box",
  lat: 38.27,
  lng: -104.61,
  address: "300 Example Ln, Pueblo, CO 81001",
  source: "manual",
  last_verified: "2026-09-01",
};

const box: PublicBlessingBox = {
  id: "box-1",
  name: "Elm Street Blessing Box",
  category: "blessing_box",
  lat: 38.27,
  lng: -104.61,
  address: "300 Example Ln, Pueblo, CO 81001",
  source: "manual",
  last_verified: "2026-09-01T00:00:00.000Z",
  box: {
    hostName: null,
    hostNote: null,
    mostNeeded: "Canned food, Diapers",
    installedOn: "2026-01-01",
    removedOn: null,
    status: "stocked",
    lastFilledAt: "2026-09-17T09:00:00.000Z",
    recentCheckins: [],
    latestPhoto: null,
    adopters: [],
  },
};

// Window 740 tall, sheet 640 with its top at 100. The box's detail section
// starts at 650, so first view + 96px peek runs past the card's own bottom:
// one resting height, the case a real phone hits.
function rectOf(el: HTMLElement): { top: number; bottom: number } {
  if (el.hasAttribute("data-bottom-sheet")) return { top: 100, bottom: 740 };
  if (el.hasAttribute("data-sheet-scroller")) return { top: 160, bottom: 740 };
  if (el.hasAttribute("data-sheet-content")) return { top: 160, bottom: 160 + 600 };
  if (el.id === "bottomsheet-detail") return { top: 650, bottom: 650 };
  return { top: 0, bottom: 0 };
}

class FakeResizeObserver {
  constructor(private cb: ResizeObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  vi.stubGlobal("turnstile", { render: vi.fn(() => "widget-id-1"), reset: vi.fn(), remove: vi.fn() });
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.spyOn(window, "innerHeight", "get").mockReturnValue(740);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const r = rectOf(this);
    return { top: r.top, bottom: r.bottom, height: r.bottom - r.top } as DOMRect;
  });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute("data-bottom-sheet") ? 640 : 0;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("BottomSheet box card grab bar", () => {
  test("a box card whose first view fills the sheet still draws the grab bar", async () => {
    render(<BottomSheet venue={boxVenue} box={box} onClose={() => {}} />);
    await waitForBoxCard();

    // One resting height, so the bar has nothing to toggle...
    expect((rootProps.current.snapPoints as unknown[]).length).toBe(1);
    const bar = document.querySelector<HTMLButtonElement>("[data-bottom-sheet] button[aria-controls='bottomsheet-detail']");
    expect(bar).not.toBeNull();
    expect(bar!.disabled).toBe(true);
    // A touch on it falls through to the sheet, so a swipe down still drags.
    expect(bar!.className).toContain("pointer-events-none");
    // ...but it is still drawn: nothing above it hides it.
    for (let el: HTMLElement | null = bar; el && !el.hasAttribute("data-bottom-sheet"); el = el.parentElement) {
      expect(el.className).not.toMatch(/\b(invisible|hidden|sr-only|opacity-0)\b/);
    }
    expect(bar!.querySelector("span")!.className).toContain("bg-[var(--color-bone-300)]");
  });
});
