/**
 * BottomSheet.snap.test.tsx — how the phone sheet measures its two resting
 * heights (#882 Maps-style sheet). jsdom has no layout, so the geometry is
 * stubbed per element; vaul is mocked to capture its snap points, and a fake
 * ResizeObserver reports only elements whose size really changed, the way a
 * browser does. Window 740 tall, sheet 640 tall with its top at 100, so every
 * px snap point carries a 100px base offset (sheetSnap.ts).
 *
 * Covers:
 * - the collapsed height is read only while collapsed (iOS simulator: after
 *   "Read more" the first view outgrew the sheet and a flick down sprang back);
 * - the content height is the card's own, not the scroller's (PR #884 review:
 *   the flex-1 scroller fills the sheet, so short cards opened to full height);
 * - a lazily loaded card that arrives after the first measurement still
 *   re-measures (PR #884 review: nothing observed resized, points stayed [1]);
 * - one resting height lays the card out as expanded (PR #884 review: the
 *   lower controls stayed `inert` and the bar toggled nothing).
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import BottomSheet from "@/components/BottomSheet";
import type { Venue } from "@/types/venue";
import type { PublicEventDetail } from "@/lib/events";

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

const venue: Venue = {
  id: "v1",
  name: "Pueblo Test Pantry",
  category: "pantry",
  lat: 38.25,
  lng: -104.6,
  address: "123 Main St, Pueblo, CO 81003",
  hours_weekly: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
  source: "test",
  last_verified: "2026-01-01",
};

const event: PublicEventDetail = {
  id: "evt-1",
  name: "Turkey drive",
  name_es: null,
  host: null,
  host_es: null,
  description: null,
  description_es: null,
  what_to_bring: null,
  what_to_bring_es: null,
  starts_at: "2099-11-21T17:00:00.000Z",
  ends_at: "2099-11-21T21:00:00.000Z",
  lat: 38.25,
  lng: -104.6,
  address: "1 Main St, Pueblo, CO",
  venue_id: null,
  link_url: null,
  status: "published",
  cancel_note: null,
  cancel_note_es: null,
};

// Geometry (viewport px). `contentHeight` is the card's own height, or 0 for
// the wrapper while a lazy card hasn't arrived (no heading inside yet).
let detailTop = 400;
let contentHeight = 1000;
function rectOf(el: HTMLElement): { top: number; bottom: number } {
  if (el.hasAttribute("data-bottom-sheet")) return { top: 100, bottom: 740 };
  if (el.hasAttribute("data-sheet-scroller")) return { top: 160, bottom: 740 };
  if (el.hasAttribute("data-sheet-content")) {
    const h = el.querySelector("h2") ? contentHeight : 0;
    return { top: 160, bottom: 160 + h };
  }
  if (el.id === "bottomsheet-detail") return { top: detailTop, bottom: detailTop };
  return { top: 0, bottom: 0 };
}

// A ResizeObserver that, like a browser, only reports elements whose size changed.
class FakeResizeObserver {
  static all: FakeResizeObserver[] = [];
  private seen = new Map<Element, number>();
  constructor(private cb: ResizeObserverCallback) {
    FakeResizeObserver.all.push(this);
  }
  observe(el: Element) {
    const r = rectOf(el as HTMLElement);
    this.seen.set(el, r.bottom - r.top);
  }
  disconnect() {
    this.seen.clear();
  }
  unobserve() {}
  fireChanged() {
    let changed = false;
    for (const [el, h] of this.seen) {
      const r = rectOf(el as HTMLElement);
      if (r.bottom - r.top !== h) {
        this.seen.set(el, r.bottom - r.top);
        changed = true;
      }
    }
    if (changed) this.cb([], this as unknown as ResizeObserver);
  }
}

beforeEach(() => {
  detailTop = 400;
  contentHeight = 1000;
  FakeResizeObserver.all = [];
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

const fireResize = () => act(() => FakeResizeObserver.all.forEach((ro) => ro.fireChanged()));

describe("BottomSheet snap points", () => {
  test("a first view that grows while fully open does not move the collapsed snap point", () => {
    const view = render(<BottomSheet venue={venue} onClose={() => {}} />);
    // Collapsed: detail top 400 - sheet top 100 + 64px peek, plus the 100px base offset.
    expect(rootProps.current.snapPoints).toEqual(["464px", 1]);

    fireEvent.click(screen.getByRole("button", { name: /show details/i }));
    detailTop = 900; // e.g. About opened with "Read more"
    view.rerender(<BottomSheet venue={venue} onClose={() => {}} />);

    expect(rootProps.current.snapPoints).toEqual(["464px", 1]);
  });

  test("a lazily loaded short card re-measures when it arrives, and fully open stops at its own height", async () => {
    contentHeight = 540; // short card: 60px above the scroller + 540 = 600 of the 640px sheet
    render(<BottomSheet venue={null} event={event} onClose={() => {}} locale="en" />);
    await screen.findByTestId("event-badge"); // the lazy chunk has mounted, with no BottomSheet render

    fireResize();

    // Collapsed: 400 - 100 + 96px event peek + 100. Fully open: 600 + 100, not `1`.
    expect(rootProps.current.snapPoints).toEqual(["496px", "700px"]);
  });

  test("one resting height: the card is laid out expanded (no inert controls, content scrolls, no grab bar)", () => {
    contentHeight = 320; // 60 + 320 = 380 visible; detail at 400 - 100 + 64 = 364 → under 24px apart
    render(<BottomSheet venue={venue} onClose={() => {}} />);

    expect(rootProps.current.snapPoints).toEqual(["480px"]);
    expect(screen.queryByRole("button", { name: /show details/i })).toBeNull();
    const detail = document.getElementById("bottomsheet-detail")!;
    expect(detail.querySelector("[inert]")).toBeNull();
    expect(document.querySelector("[data-sheet-scroller]")!.className).toContain("overflow-y-auto");
  });
});
