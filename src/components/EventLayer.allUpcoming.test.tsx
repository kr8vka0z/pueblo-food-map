/**
 * EventLayer with the Events filter on (#761): every upcoming event gets a pin,
 * including one more than 7 days out that the map normally leaves off, so the
 * filter's count and the map agree. react-map-gl is mocked (jsdom has no WebGL),
 * same as EventLayer.test.tsx.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import EventLayer from "@/components/EventLayer";
import type { PublicEvent } from "@/lib/events";

vi.mock("react-map-gl/mapbox", () => ({
  Marker: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useMap: () => ({ current: { flyTo: vi.fn(), jumpTo: vi.fn() } }),
}));

const DAY = 86_400_000;
const farOut: PublicEvent = {
  id: "far", name: "Far event", name_es: null, host: null, host_es: null, description: null,
  description_es: null, what_to_bring: null, what_to_bring_es: null,
  starts_at: new Date(Date.now() + 10 * DAY).toISOString(),
  ends_at: new Date(Date.now() + 10 * DAY + 3_600_000).toISOString(),
  lat: 38.26, lng: -104.61, address: "1 Main St", venue_id: null, link_url: null,
};

describe("EventLayer allUpcoming", () => {
  test("a 10-day-out event is pinned only when the Events filter lifts the 7-day window", () => {
    const { rerender } = render(<EventLayer events={[farOut]} selectedEventId={null} onSelectEvent={vi.fn()} locale="en" />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    rerender(<EventLayer events={[farOut]} selectedEventId={null} onSelectEvent={vi.fn()} locale="en" allUpcoming />);
    expect(screen.queryAllByRole("button")).toHaveLength(1);
  });
});
