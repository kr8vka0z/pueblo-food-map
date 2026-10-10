/**
 * MapWrapper wiring for the "happening today" strip, the Events filter and the
 * events list (#761). The behaviors that matter: an empty or failed feed leaves
 * the screen exactly as before (no strip, no filter row, no list section); the
 * strip opens its event, "and N more" opens the list, and the strip steps aside
 * while a card is open; the Events filter empties the places handed to the map
 * and tells the map to pin every upcoming event (so the count and the map
 * agree); the list puts events above places, going-on-now first, far-out
 * events included; with the filter on and nothing left, both the list and the
 * map say so and offer a way out. Same sentinel-Map recipe as
 * MapWrapperEvents.test.tsx; only Date is faked so real timers still run.
 * Elements are found by test id or role, not by UI copy.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import React from "react";
import MapWrapper from "@/components/MapWrapper";
import { LocaleProvider } from "@/lib/LocaleContext";

vi.mock("@/lib/webgl", () => ({ isWebGLAvailable: () => true }));

vi.mock("next/dynamic", () => ({
  default: (factory: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>) => {
    let ResolvedComponent: React.ComponentType<Record<string, unknown>> | null = null;
    factory().then((mod) => { ResolvedComponent = mod.default; });
    function DynamicWrapper(props: Record<string, unknown>) {
      return ResolvedComponent ? React.createElement(ResolvedComponent, props) : null;
    }
    DynamicWrapper.displayName = "DynamicWrapper";
    return DynamicWrapper;
  },
}));

vi.mock("@/components/Map", async () => {
  const React = await import("react");
  function MapMock({
    venues,
    events,
    selectedEventId,
    allUpcomingEvents,
    onSelectEvent,
    onMapReady,
  }: {
    venues?: unknown[];
    events?: unknown[];
    selectedEventId?: string | null;
    allUpcomingEvents?: boolean;
    onSelectEvent?: (id: string | null) => void;
    onMapReady?: (map: unknown) => void;
  }) {
    React.useEffect(() => {
      onMapReady?.({ fitBounds: vi.fn(), flyTo: vi.fn(), jumpTo: vi.fn() });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return React.createElement(
      "div",
      {
        "data-testid": "map-canvas",
        "data-venue-count": venues?.length ?? 0,
        "data-event-count": events?.length ?? 0,
        "data-selected-event-id": selectedEventId ?? "",
        "data-all-upcoming": allUpcomingEvents ? "true" : "false",
      },
      React.createElement("button", { "data-testid": "map-deselect", onClick: () => onSelectEvent?.(null) }),
    );
  }
  return { default: MapMock };
});

vi.mock("@/components/DesktopVenueWindow", () => ({ default: () => null }));

const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = Date.parse("2026-10-10T18:00:00.000Z"); // 12:00 in Pueblo

function ev(id: string, startMs: number, endMs: number) {
  return {
    id, name: `Event ${id}`, name_es: null, host: null, host_es: null, description: null,
    description_es: null, what_to_bring: null, what_to_bring_es: null,
    starts_at: new Date(startMs).toISOString(), ends_at: new Date(endMs).toISOString(),
    lat: 38.26, lng: -104.61, address: `${id} Main St`, venue_id: null, link_url: null,
  };
}

// Live now; two more later today; one in three days; one in three weeks.
const FEED = [
  ev("live", NOW - HOUR, NOW + HOUR),
  ev("t1", NOW + 2 * HOUR, NOW + 3 * HOUR),
  ev("t2", NOW + 4 * HOUR, NOW + 5 * HOUR),
  ev("d3", NOW + 72 * HOUR, NOW + 73 * HOUR),
  ev("w3", NOW + 21 * 24 * HOUR, NOW + 21 * 24 * HOUR + HOUR),
];
const FAR_ONLY = [ev("far10", NOW + 10 * 24 * HOUR, NOW + 10 * 24 * HOUR + HOUR)];

function stubFeed(feed: () => Promise<unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      url === "/api/public/events" ? feed() : Promise.resolve({ ok: true, json: async () => ({ boxes: [] }) }),
    ),
  );
}
const feedOf = (events: unknown[]) => () => Promise.resolve({ ok: true, json: async () => ({ events }) });

async function mount() {
  await act(async () => {
    render(
      <LocaleProvider>
        <MapWrapper />
      </LocaleProvider>,
    );
    await new Promise<void>((r) => setTimeout(r, 0));
  });
  // The map loads on the first interaction, like for any visitor.
  await act(async () => {
    window.dispatchEvent(new Event("pointerdown"));
    await new Promise<void>((r) => setTimeout(r, 0));
  });
}

const strip = () => screen.queryByTestId("event-strip");
const moreButton = () => screen.queryByTestId("event-strip-more");
const eventList = () => screen.queryByTestId("event-list");
const map = () => screen.getByTestId("map-canvas");

async function openFilters() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
  });
}
const eventsSwitch = () => screen.queryByTestId("filter-events-switch");
async function closeFilters() {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Close filters" })); });
}
async function toList() {
  await act(async () => { fireEvent.click(moreButton()!); });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  window.history.replaceState(null, "", "/");
  window.localStorage.clear();
  Object.defineProperty(navigator, "permissions", {
    value: { query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }) },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("no events: nothing new on screen", () => {
  test.each([
    ["an empty feed", feedOf([])],
    ["a failed feed", () => Promise.reject(new Error("offline"))],
    ["a non-OK feed", () => Promise.resolve({ ok: false, json: async () => ({}) })],
  ])("%s shows no strip, no Events filter row and no events section", async (_name, feed) => {
    stubFeed(feed);
    await mount();
    expect(strip()).toBeNull();
    await openFilters();
    expect(eventsSwitch()).toBeNull();
    expect(eventList()).toBeNull();
    expect(screen.queryByTestId("events-empty")).toBeNull();
    expect(screen.queryByTestId("events-empty-notice")).toBeNull();
  });
});

describe("the strip", () => {
  test("opens the event like a pin tap, 'and 2 more' opens the list, and it steps aside while a card is open", async () => {
    stubFeed(feedOf(FEED));
    await mount();
    expect(strip()).not.toBeNull();
    expect(moreButton()).not.toBeNull();

    fireEvent.click(screen.getByTestId("event-strip-open"));
    expect(map()).toHaveAttribute("data-selected-event-id", "live");
    expect(window.location.search).toBe("?event=live");
    // The card is open: the strip is out of the way...
    expect(strip()).toBeNull();

    // ...and comes back when the card closes.
    fireEvent.click(screen.getByTestId("map-deselect"));
    expect(map()).toHaveAttribute("data-selected-event-id", "");
    expect(strip()).not.toBeNull();

    await toList();
    expect(eventList()).not.toBeNull();
    // In list view the strip steps aside: the list is showing the same events.
    expect(strip()).toBeNull();
  });

  test("it is gone for a feed with only far-out events (nothing today)", async () => {
    stubFeed(feedOf([FEED[3]!, FEED[4]!]));
    await mount();
    expect(strip()).toBeNull();
  });
});

describe("the Events filter and the list", () => {
  test("lists events above places, going-on-now first then soonest, including the one three weeks out", async () => {
    stubFeed(feedOf(FEED));
    await mount();
    await toList();

    const rowIds = Array.from(document.querySelectorAll("[data-testid^='event-row-']")).map((n) =>
      n.getAttribute("data-testid")!.replace("event-row-", ""),
    );
    expect(rowIds).toEqual(["live", "t1", "t2", "d3", "w3"]);

    // The events section sits above the first place card in the document.
    const firstPlace = document.querySelector("ul li:not(:has([data-testid^='event-row-']))");
    expect(firstPlace).not.toBeNull();
    expect(eventList()!.compareDocumentPosition(firstPlace!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("an event row opens that event's card over the map", async () => {
    stubFeed(feedOf(FEED));
    await mount();
    await toList();
    await act(async () => { fireEvent.click(screen.getByTestId("event-row-w3")); });
    expect(map()).toHaveAttribute("data-selected-event-id", "w3");
  });

  test("the Events filter hides every place and box, pins every upcoming event, and turns off again", async () => {
    stubFeed(feedOf(FEED));
    await mount();
    const placesBefore = Number(map().getAttribute("data-venue-count"));
    expect(placesBefore).toBeGreaterThan(0);
    expect(map()).toHaveAttribute("data-all-upcoming", "false");

    await openFilters();
    fireEvent.click(eventsSwitch()!);
    expect(map()).toHaveAttribute("data-venue-count", "0");
    expect(map()).toHaveAttribute("data-event-count", String(FEED.length));
    // The filter's count includes events beyond the 7-day pin window, so the map must draw them too.
    expect(map()).toHaveAttribute("data-all-upcoming", "true");

    fireEvent.click(eventsSwitch()!);
    expect(Number(map().getAttribute("data-venue-count"))).toBe(placesBefore);
    expect(map()).toHaveAttribute("data-all-upcoming", "false");
  });

  test("with the filter on the list shows only events, and says so once the last one has ended", async () => {
    stubFeed(feedOf([FEED[0]!, FEED[1]!]));
    await mount();
    await openFilters();
    fireEvent.click(eventsSwitch()!);
    await closeFilters();
    await toList();

    expect(document.querySelectorAll("[data-testid^='event-row-']")).toHaveLength(2);
    expect(screen.queryByTestId("events-empty")).toBeNull();

    // Both events end while the list is open; the shared minute tick drops them.
    await act(async () => {
      vi.setSystemTime(NOW + 4 * HOUR);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByTestId("events-empty")).toBeInTheDocument();
  });
});

describe("Events filter on, nothing to show on the map", () => {
  test("the map says so with a way out; the button turns the filter off", async () => {
    stubFeed(feedOf([FEED[0]!]));
    await mount();
    await openFilters();
    fireEvent.click(eventsSwitch()!);
    await closeFilters();
    expect(screen.queryByTestId("events-empty-notice")).toBeNull(); // the live event is still there

    await act(async () => {
      vi.setSystemTime(NOW + 2 * HOUR);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByTestId("events-empty-notice")).toBeInTheDocument();
    expect(map()).toHaveAttribute("data-venue-count", "0");

    await act(async () => { fireEvent.click(screen.getByTestId("events-empty-show-places")); });
    expect(screen.queryByTestId("events-empty-notice")).toBeNull();
    expect(Number(map().getAttribute("data-venue-count"))).toBeGreaterThan(0);
  });

  test("a far-out event alone is enough: no notice, and the map is told to pin it", async () => {
    stubFeed(feedOf(FAR_ONLY));
    await mount();
    await openFilters();
    fireEvent.click(eventsSwitch()!);
    await closeFilters();
    expect(screen.queryByTestId("events-empty-notice")).toBeNull();
    expect(map()).toHaveAttribute("data-all-upcoming", "true");
    expect(map()).toHaveAttribute("data-event-count", "1");
  });
});
