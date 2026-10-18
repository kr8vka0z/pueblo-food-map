/**
 * EventStrip tests (#761) — the strip appears, changes and disappears on the
 * shared minute tick at the exact start and end boundaries with no reload,
 * dismissal is per event and per Pueblo day and survives a remount, storage
 * that throws does not break it, and it never announces itself. Same
 * fake-timer recipe as EventLayer.test.tsx. Elements are found by test id,
 * never by UI copy.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import EventStrip from "@/components/EventStrip";
import type { PublicEvent } from "@/lib/events";

const MIN = 60_000;
const START = Date.parse("2026-10-10T18:00:00.000Z"); // 12:00 in Pueblo

function ev(id: string, startOffsetMin: number, endOffsetMin: number): PublicEvent {
  return {
    id, name: `Event ${id}`, name_es: null, host: null, host_es: null, description: null,
    description_es: null, what_to_bring: null, what_to_bring_es: null,
    starts_at: new Date(START + startOffsetMin * MIN).toISOString(),
    ends_at: new Date(START + endOffsetMin * MIN).toISOString(),
    lat: 38.26, lng: -104.61, address: "1 Main St", venue_id: null, link_url: null,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function renderStrip(events: PublicEvent[], onOpen = vi.fn(), onMore = vi.fn()) {
  return { ...render(<EventStrip events={events} locale="en" onOpen={onOpen} onMore={onMore} />), onOpen, onMore };
}
// Which event the strip names: the event name is test data ("Event a"), so matching its end is not UI copy.
const names = (id: string) => screen.queryByTestId("event-strip-open")?.textContent?.endsWith(`Event ${id}`) ?? false;
const present = () => screen.queryByTestId("event-strip") !== null;
const isLive = () => screen.getByTestId("event-strip").getAttribute("data-live") === "true";
const dismiss = () => fireEvent.click(screen.getByTestId("event-strip-dismiss"));

describe("EventStrip clock", () => {
  test("appears for an event later today, flips to live at its start, and is gone at its end", () => {
    renderStrip([ev("a", 2, 5)]);
    expect(names("a")).toBe(true);
    expect(isLive()).toBe(false);

    act(() => { vi.advanceTimersByTime(2 * MIN); }); // now == starts_at
    expect(isLive()).toBe(true);

    act(() => { vi.advanceTimersByTime(2 * MIN); }); // one minute before the end
    expect(present()).toBe(true);

    act(() => { vi.advanceTimersByTime(MIN); }); // now == ends_at
    expect(present()).toBe(false);
  });

  test("when the live event ends, the strip moves to the next one with no reload", () => {
    renderStrip([ev("a", -10, 2), ev("b", 30, 60)]);
    expect(names("a")).toBe(true);
    expect(screen.getByTestId("event-strip-more")).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(2 * MIN); });
    expect(names("a")).toBe(false);
    expect(names("b")).toBe(true);
    expect(screen.queryByTestId("event-strip-more")).toBeNull();
  });

  test("nothing is rendered when no event is today, and the one shared timer is cleared on unmount", () => {
    const view = renderStrip([ev("far", 3 * 24 * 60, 3 * 24 * 60 + 60)]);
    expect(view.container).toBeEmptyDOMElement();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  test("it is not a live region, so a screen reader is not told about each minute", () => {
    const { container } = renderStrip([ev("a", -10, 60)]);
    expect(container.querySelector("[aria-live], [role=status], [role=alert]")).toBeNull();
  });
});

describe("EventStrip actions", () => {
  test("the main button opens that event; 'and N more' opens the list", () => {
    const { onOpen, onMore } = renderStrip([ev("a", -10, 60), ev("b", 30, 90), ev("c", 40, 90)]);
    fireEvent.click(screen.getByTestId("event-strip-open"));
    expect(onOpen).toHaveBeenCalledWith("a");
    fireEvent.click(screen.getByTestId("event-strip-more"));
    expect(onMore).toHaveBeenCalledTimes(1);
  });
});

describe("EventStrip dismissal", () => {
  test("closing hides that event for the day (and survives a remount), the next event takes over", () => {
    const events = [ev("a", -10, 600), ev("b", 30, 90)];
    const first = renderStrip(events);
    dismiss();
    expect(names("a")).toBe(false);
    expect(names("b")).toBe(true);

    first.unmount();
    renderStrip(events); // "reload": a fresh mount reads storage
    expect(names("a")).toBe(false);
    expect(names("b")).toBe(true);
  });

  test("a dismissed event comes back the next Pueblo day if it is still on", () => {
    // Runs 10 hours past midnight Pueblo: dismissed today, live again tomorrow.
    const overnight = ev("a", -10, 14 * 60);
    const view = renderStrip([overnight]);
    dismiss();
    expect(view.container).toBeEmptyDOMElement();
    view.unmount();

    vi.setSystemTime(START + 13 * 60 * MIN); // 1 AM on Oct 11 in Pueblo
    renderStrip([overnight]);
    expect(names("a")).toBe(true);
  });

  test("storage that throws does not break the strip; the dismissal lasts for the session", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    const view = renderStrip([ev("a", -10, 60)]);
    expect(names("a")).toBe(true);
    dismiss();
    expect(view.container).toBeEmptyDOMElement();
  });
});
