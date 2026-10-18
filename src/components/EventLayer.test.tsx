/**
 * EventLayer tests (#758) — the on-the-minute clock that flips a pin to NOW at
 * its start and removes it at its end with no reload, the tab-visible recheck,
 * the single timer, and tap-to-select. react-map-gl is mocked (jsdom has no
 * WebGL); Marker is a plain div and useMap exposes spies for the camera.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import EventLayer from "@/components/EventLayer";
import type { PublicEvent } from "@/lib/events";

const flyTo = vi.fn();
const jumpTo = vi.fn();
// One stable MapRef, like the real useMap(): react-map-gl hands back the same
// object for the life of the map, so a new object per render would be a fake bug.
const mapRef = { flyTo, jumpTo };
vi.mock("react-map-gl/mapbox", () => ({
  Marker: ({ children }: { children: ReactNode }) => <div data-testid="marker">{children}</div>,
  useMap: () => ({ current: mapRef }),
}));

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

function pin(id: string) {
  return screen.queryByRole("button", { name: new RegExp(`Event ${id}`) });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  flyTo.mockClear();
  jumpTo.mockClear();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
});

afterEach(() => {
  vi.useRealTimers();
});

function renderLayer(events: PublicEvent[], selectedEventId: string | null = null, onSelectEvent = vi.fn()) {
  const view = render(
    <EventLayer events={events} selectedEventId={selectedEventId} onSelectEvent={onSelectEvent} locale="en" />,
  );
  return { ...view, onSelectEvent };
}

describe("EventLayer clock", () => {
  test("a pin flips to live at its start time and is removed at its end, with no reload", () => {
    renderLayer([ev("a", 2, 5)]);
    expect(pin("a")).toHaveAttribute("data-live", "false");

    act(() => { vi.advanceTimersByTime(2 * MIN); }); // now == starts_at
    expect(pin("a")).toHaveAttribute("data-live", "true");

    act(() => { vi.advanceTimersByTime(2 * MIN); }); // one minute before end
    expect(pin("a")).toHaveAttribute("data-live", "true");

    act(() => { vi.advanceTimersByTime(MIN); }); // now == ends_at
    expect(pin("a")).toBeNull();
  });

  test("coming back to the tab re-checks right away, even though the timer never fired", () => {
    renderLayer([ev("a", 3, 10)]);
    expect(pin("a")).toHaveAttribute("data-live", "false");

    // The phone slept: the clock moved on, the interval did not run.
    vi.setSystemTime(START + 4 * MIN);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(pin("a")).toHaveAttribute("data-live", "true");
  });

  test("one timer serves every pin, and unmounting clears it", () => {
    const { unmount } = renderLayer([ev("a", 1, 5), ev("b", 2, 6), ev("c", 3, 7)]);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("EventLayer selection", () => {
  test("tapping a pin selects it; tapping the selected pin deselects", () => {
    const { onSelectEvent, rerender } = renderLayer([ev("a", 5, 9)]);
    fireEvent.click(pin("a")!);
    expect(onSelectEvent).toHaveBeenLastCalledWith("a");

    rerender(<EventLayer events={[ev("a", 5, 9)]} selectedEventId="a" onSelectEvent={onSelectEvent} locale="en" />);
    fireEvent.click(pin("a")!);
    expect(onSelectEvent).toHaveBeenLastCalledWith(null);
  });

  test("a selected pin is centered once, and a clock tick does not re-center a panned map", () => {
    renderLayer([ev("a", 5, 60)], "a");
    expect(flyTo).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(MIN); });
    act(() => { vi.advanceTimersByTime(MIN); });
    expect(flyTo).toHaveBeenCalledTimes(1);
  });

  test("under reduced motion the camera jumps instead of flying", () => {
    (window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({
      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    });
    renderLayer([ev("a", 5, 60)], "a");
    expect(jumpTo).toHaveBeenCalledTimes(1);
    expect(flyTo).not.toHaveBeenCalled();
  });

  test("a selected id that matches no drawn pin (ended, or unknown) selects and centers nothing", () => {
    renderLayer([ev("a", -60, -30)], "a");
    expect(pin("a")).toBeNull();
    expect(flyTo).not.toHaveBeenCalled();
  });
});
