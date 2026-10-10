/**
 * MapWrapper wiring for the "happening today" strip, the Events filter and the
 * events list (#761). The behaviors that matter: an empty or failed feed leaves
 * the screen exactly as before (no strip, no filter row, no list section); the
 * strip opens its event and "and N more" opens the list; the Events filter
 * empties the places handed to the map; the list puts events above places,
 * going-on-now first, far-out events included, and says "No events coming up"
 * when the filter is on and the last event has ended. Same sentinel-Map recipe
 * as MapWrapperEvents.test.tsx; only Date is faked so real timers still run.
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
    onMapReady,
  }: {
    venues?: unknown[];
    events?: unknown[];
    selectedEventId?: string | null;
    onMapReady?: (map: unknown) => void;
  }) {
    React.useEffect(() => {
      onMapReady?.({ fitBounds: vi.fn(), flyTo: vi.fn(), jumpTo: vi.fn() });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return React.createElement("div", {
      "data-testid": "map-canvas",
      "data-venue-count": venues?.length ?? 0,
      "data-event-count": events?.length ?? 0,
      "data-selected-event-id": selectedEventId ?? "",
    });
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

const stripButton = () => screen.queryByRole("button", { name: /Event live$/ });
const eventsHeading = () => screen.queryByRole("heading", { name: /^Events/ });
const moreButton = () => screen.queryByRole("button", { name: /and \d+ more/ });

async function openFilters() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
  });
}
const eventsSwitch = () => screen.queryByRole("switch", { name: "Events" });

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
    expect(screen.queryByRole("button", { name: /for today$/ })).toBeNull();
    await openFilters();
    expect(eventsSwitch()).toBeNull();
    expect(eventsHeading()).toBeNull();
    expect(screen.queryByText("No events coming up")).toBeNull();
  });
});

describe("the strip", () => {
  test("names the live event, opens it like a pin tap, and 'and 2 more' opens the list", async () => {
    stubFeed(feedOf(FEED));
    await mount();
    expect(screen.getByRole("button", { name: /Happening now.*Event live$/ })).toBeInTheDocument();

    fireEvent.click(stripButton()!);
    expect(screen.getByTestId("map-canvas")).toHaveAttribute("data-selected-event-id", "live");
    expect(window.location.search).toBe("?event=live");

    expect(moreButton()).toHaveTextContent("and 2 more");
    await act(async () => { fireEvent.click(moreButton()!); });
    expect(eventsHeading()).toBeInTheDocument();
    // In list view the strip steps aside: the list is showing the same events.
    expect(stripButton()).toBeNull();
  });

  test("it is gone for a feed with only far-out events (nothing today)", async () => {
    stubFeed(feedOf([FEED[3]!, FEED[4]!]));
    await mount();
    expect(screen.queryByRole("button", { name: /for today$/ })).toBeNull();
  });
});

describe("the Events filter and the list", () => {
  async function toList() {
    await act(async () => { fireEvent.click(moreButton()!); });
  }

  test("lists events above places, going-on-now first then soonest, including the one three weeks out", async () => {
    stubFeed(feedOf(FEED));
    await mount();
    await toList();

    const rows = screen.getAllByRole("button", { name: /^Event / }).map((b) => b.textContent ?? "");
    expect(rows.map((r) => /Event (live|t1|t2|d3|w3)/.exec(r)![1])).toEqual(["live", "t1", "t2", "d3", "w3"]);

    // Events sit above the first place card in the document.
    const firstPlace = document.querySelector("ul li:not(:has(button[class*='min-h-16']))");
    const heading = eventsHeading()!;
    expect(firstPlace).not.toBeNull();
    expect(heading.compareDocumentPosition(firstPlace!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("an event row opens that event's card over the map", async () => {
    stubFeed(feedOf(FEED));
    await mount();
    await toList();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Event w3/ })); });
    expect(screen.getByTestId("map-canvas")).toHaveAttribute("data-selected-event-id", "w3");
  });

  test("the Events filter hides every place and box from the map, leaves the event pins, and turns off again", async () => {
    stubFeed(feedOf(FEED));
    await mount();
    const placesBefore = Number(screen.getByTestId("map-canvas").getAttribute("data-venue-count"));
    expect(placesBefore).toBeGreaterThan(0);

    await openFilters();
    fireEvent.click(eventsSwitch()!);
    expect(screen.getByTestId("map-canvas")).toHaveAttribute("data-venue-count", "0");
    expect(screen.getByTestId("map-canvas")).toHaveAttribute("data-event-count", String(FEED.length));

    fireEvent.click(eventsSwitch()!);
    expect(Number(screen.getByTestId("map-canvas").getAttribute("data-venue-count"))).toBe(placesBefore);
  });

  test("with the filter on the list shows only events, and says 'No events coming up' once the last one has ended", async () => {
    stubFeed(feedOf([FEED[0]!, FEED[1]!]));
    await mount();
    await openFilters();
    fireEvent.click(eventsSwitch()!);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Close filters" })); });
    await toList();

    expect(screen.getAllByRole("button", { name: /^Event / })).toHaveLength(2);
    expect(screen.queryByText("No events coming up")).toBeNull();

    // The event ends while the list is open; the shared minute tick drops it.
    await act(async () => {
      vi.setSystemTime(NOW + 4 * HOUR);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByText("No events coming up")).toBeInTheDocument();
    expect(screen.queryByText(/places? match/i)).toBeNull();
  });
});
