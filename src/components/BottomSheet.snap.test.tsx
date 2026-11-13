/**
 * BottomSheet.snap.test.tsx — how the phone sheet measures its resting
 * heights (native scroll sheet, #923; #882 rules kept). jsdom has no layout,
 * so the geometry is stubbed per element, and a fake ResizeObserver reports
 * only elements whose size really changed, the way a browser does. Track 640
 * tall; the sheet's own top is at 100 with a 60px grab-bar row above the card,
 * so a detent (= visible height) is the distance from the sheet's top.
 *
 * Covers:
 * - the collapsed height is read only while collapsed (iOS simulator: after
 *   "Read more" the first view outgrew the sheet and a flick down sprang back);
 * - fully open stops at a short card's own height (PR #884 review);
 * - a lazily loaded card that arrives after the first measurement still
 *   re-measures (PR #884 review: nothing observed resized);
 * - a box "Loading…" placeholder that rests fully open before the box loads
 *   does not freeze its missing first view (PR #925 review: one height);
 * - one resting height lays the card out as expanded (PR #884 review: the
 *   lower controls stayed `inert` and the bar toggled nothing).
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import BottomSheet from "@/components/BottomSheet";
import type { Venue } from "@/types/venue";
import type { PublicEventDetail } from "@/lib/events";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";
import { waitForBoxCard } from "@/lib/testing/waitForBoxCard.testutil";

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
    mostNeeded: "Canned food",
    installedOn: "2026-01-01",
    removedOn: null,
    status: "stocked",
    lastFilledAt: "2026-09-17T09:00:00.000Z",
    recentCheckins: [],
    latestPhoto: null,
    adopters: [],
  },
};

// Geometry (viewport px). `contentHeight` is the card's own height, or 0 for
// the wrapper while a lazy card hasn't arrived (no heading inside yet).
let detailTop = 400;
let contentHeight = 1000;
function rectOf(el: HTMLElement): { top: number; bottom: number } {
  if (el.hasAttribute("data-scroll-sheet")) return { top: 100, bottom: 740 };
  if (el.hasAttribute("data-sheet")) {
    const h = el.querySelector("h2") ? contentHeight : 0;
    return { top: 100, bottom: 160 + h };
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
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const r = rectOf(this);
    return { top: r.top, bottom: r.bottom, height: r.bottom - r.top } as DOMRect;
  });
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute("data-scroll-sheet") ? 640 : 0;
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** The detents as rendered: the 1px snap markers' scrollTops, closed (0) left out. */
const detents = () =>
  Array.from(document.querySelectorAll<HTMLElement>("[data-snap]"))
    .map((m) => parseFloat(m.style.top))
    .filter((top) => top > 0);

const fireResize = () => act(() => FakeResizeObserver.all.forEach((ro) => ro.fireChanged()));

describe("BottomSheet resting heights", () => {
  test("a first view that grows while fully open does not move the collapsed snap point", () => {
    const view = render(<BottomSheet venue={venue} onClose={() => {}} />);
    // Collapsed: detail top 400 - sheet top 100 + 64px peek. Fully open: the whole 640 track.
    expect(detents()).toEqual([364, 640]);

    fireEvent.click(screen.getByRole("button", { name: /show details/i }));
    detailTop = 900; // e.g. About opened with "Read more"
    view.rerender(<BottomSheet venue={venue} onClose={() => {}} />);

    expect(detents()).toEqual([364, 640]);
  });

  test("a card first measured while expanded keeps reading its first view until it has been collapsed", () => {
    // A card that mounts already expanded (Clear walking route on the route card) is measured
    // expanded first; here: expand, then show a different card in the same sheet.
    const view = render(<BottomSheet venue={venue} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /show details/i }));
    detailTop = 300;
    view.rerender(<BottomSheet venue={{ ...venue, id: "v2" }} onClose={() => {}} />);
    expect(detents()).toEqual([264, 640]);

    detailTop = 400; // e.g. a box's check-in panel finishes drawing
    view.rerender(<BottomSheet venue={{ ...venue, id: "v2" }} onClose={() => {}} />);
    expect(detents()).toEqual([364, 640]);
  });

  test("a lazily loaded short card re-measures when it arrives, and fully open stops at its own height", async () => {
    contentHeight = 540; // short card: 60px grab-bar row + 540 = 600 of the 640px track
    render(<BottomSheet venue={null} event={event} onClose={() => {}} locale="en" />);
    await screen.findByTestId("event-badge"); // the lazy chunk has mounted, with no BottomSheet render

    fireResize();

    // Collapsed: 400 - 100 + 96px event peek. Fully open: the card's own 600, not the track's 640.
    expect(detents()).toEqual([396, 600]);
  });

  test("a box placeholder that rests before the box loads does not freeze a missing first view (PR #925 review)", async () => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("turnstile", { render: vi.fn(() => "widget-id-1"), reset: vi.fn(), remove: vi.fn() });
    const boxVenue: Venue = { ...venue, id: "box-1", category: "blessing_box" };
    const onExpandedChange = vi.fn();
    vi.useFakeTimers();
    const view = render(<BottomSheet venue={boxVenue} box={null} onClose={() => {}} onExpandedChange={onExpandedChange} />);
    // The "Loading…" line: no detail section, no heading, so the sheet is just the 60px grab-bar row.
    expect(detents()).toEqual([60]);
    const track = document.querySelector<HTMLElement>("[data-scroll-sheet]")!;
    let top = 0;
    Object.defineProperty(track, "scrollTop", { get: () => top, set: (v: number) => (top = v), configurable: true });
    track.scrollTo = vi.fn() as unknown as typeof track.scrollTo;
    top = 60;
    fireEvent.scroll(track);
    act(() => vi.advanceTimersByTime(200));
    expect(onExpandedChange).toHaveBeenLastCalledWith(true); // the placeholder rested "full"
    vi.useRealTimers();

    view.rerender(<BottomSheet venue={boxVenue} box={box} onClose={() => {}} onExpandedChange={onExpandedChange} />);
    await waitForBoxCard();
    fireResize();

    // Collapsed: 400 - 100 + 96px box peek. Fully open: the whole 640 track.
    expect(detents()).toEqual([396, 640]);
  });

  test("one resting height: the card is laid out expanded (no inert controls, content scrolls, grab bar drawn but not a control)", () => {
    contentHeight = 320; // 60 + 320 = 380; detail at 400 - 100 + 64 = 364 → under 24px apart
    render(<BottomSheet venue={venue} onClose={() => {}} />);

    expect(detents()).toEqual([380]);
    expect(screen.queryByRole("button", { name: /show details/i })).toBeNull();
    const detail = document.getElementById("bottomsheet-detail")!;
    expect(detail.querySelector("[inert]")).toBeNull();
    // The track scrolls (moving the sheet, then the card); the inner wrapper must not, or the hand-off is lost.
    expect(document.querySelector("[data-scroll-sheet]")!.className).toContain("overflow-y-scroll");
    expect(document.querySelector("[data-sheet-scroller]")!.className).not.toContain("overflow");
  });
});

// Swipes: the browser does the moving; these drive scrollTop and the touch
// and scroll events by hand, then let the 150 ms settle timer fire.
describe("BottomSheet swipes (native scroll sheet)", () => {
  function setup() {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<BottomSheet venue={venue} onClose={onClose} />);
    const track = document.querySelector<HTMLElement>("[data-scroll-sheet]")!;
    let top = 0;
    Object.defineProperty(track, "scrollTop", { get: () => top, set: (v: number) => (top = v), configurable: true });
    const scrollTo = vi.fn();
    track.scrollTo = scrollTo as unknown as typeof track.scrollTo;
    const scrollToTop = (t: number) => {
      top = t;
      fireEvent.scroll(track);
    };
    const settle = () => act(() => vi.advanceTimersByTime(200));
    const touch = (type: "touchStart" | "touchEnd") => fireEvent[type](track);
    return { onClose, scrollTo, scrollToTop, settle, touch };
  }
  afterEach(() => vi.useRealTimers());

  test("a slow pull down from collapsed past 100px closes", () => {
    const { onClose, scrollTo, scrollToTop, settle, touch } = setup();
    scrollToTop(364); // at rest, collapsed
    settle();
    touch("touchStart");
    scrollToTop(200); // 164px down, slowly: snap alone would spring back
    touch("touchEnd");
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "smooth" });
    scrollToTop(0);
    settle();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("a short pull does not close", () => {
    const { onClose, scrollTo, scrollToTop, settle, touch } = setup();
    scrollToTop(364);
    settle();
    scrollTo.mockClear();
    touch("touchStart");
    scrollToTop(324);
    touch("touchEnd");
    scrollToTop(364); // snap springs back
    settle();
    expect(scrollTo).not.toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(onClose).not.toHaveBeenCalled();
  });

  test("one swipe from fully open rests at collapsed, never closed", () => {
    const { onClose, scrollTo, scrollToTop, settle, touch } = setup();
    scrollToTop(640); // fully open
    settle();
    touch("touchStart");
    scrollToTop(300); // pulled past collapsed (364)
    touch("touchEnd");
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 364, behavior: "smooth" });
    scrollToTop(0); // momentum carried it all the way anyway
    settle();
    expect(onClose).not.toHaveBeenCalled();
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 364, behavior: "smooth" });
  });

  test("a sheet that never rested open is not closed by its first scroll event", () => {
    const { onClose, scrollToTop, settle } = setup();
    scrollToTop(0);
    settle();
    expect(onClose).not.toHaveBeenCalled();
  });

  test("the top edge outside the track is shown only once the sheet's top reaches the track's top", () => {
    const { scrollToTop } = setup();
    const track = document.querySelector<HTMLElement>("[data-scroll-sheet]")!;
    // The edge is the track's next sibling, so the CSS `+` rule can reach it.
    expect(track.nextElementSibling!.hasAttribute("data-sheet-edge")).toBe(true);
    scrollToTop(364); // collapsed: the sheet's own shadow shows
    expect(track.hasAttribute("data-at-top")).toBe(false);
    scrollToTop(640); // fully open: the sheet's top is the track's top, which clips its shadow
    expect(track.hasAttribute("data-at-top")).toBe(true);
    scrollToTop(900); // scrolled into the details
    expect(track.hasAttribute("data-at-top")).toBe(true);
    scrollToTop(600);
    expect(track.hasAttribute("data-at-top")).toBe(false);
  });
});
