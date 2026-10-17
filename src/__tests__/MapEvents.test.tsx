/**
 * Map.tsx -> EventLayer mount (#758): the real Map hands events to the real
 * EventLayer, a tap reports the id, and with no events nothing event-related
 * mounts (the existing Map tests' react-map-gl mock has no useMap, which is
 * why EventLayer must stay unmounted then). Only react-map-gl is mocked.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import Map from "@/components/Map";
import type { PublicEvent } from "@/lib/events";

vi.mock("mapbox-gl/dist/mapbox-gl.css", () => ({}));

vi.mock("react-map-gl/mapbox", async () => {
  const React = await import("react");
  const mapRef = { flyTo: vi.fn(), jumpTo: vi.fn(), fitBounds: vi.fn() };
  const MapGLMock = React.forwardRef(function MapGLMock({ children }: { children: React.ReactNode }, ref: React.Ref<unknown>) {
    React.useImperativeHandle(ref, () => mapRef);
    return React.createElement("div", { "data-testid": "mapgl-root" }, children);
  });
  return {
    default: MapGLMock,
    Marker: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
    Popup: () => null,
    AttributionControl: () => null,
    Source: ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children),
    Layer: () => null,
    useMap: () => ({ current: mapRef }),
  };
});

const NOW = Date.parse("2026-10-10T18:00:00.000Z");
function ev(id: string, startMin: number, endMin: number): PublicEvent {
  return {
    id, name: `Event ${id}`, name_es: null, host: null, host_es: null, description: null,
    description_es: null, what_to_bring: null, what_to_bring_es: null,
    starts_at: new Date(NOW + startMin * 60_000).toISOString(),
    ends_at: new Date(NOW + endMin * 60_000).toISOString(),
    lat: 38.26, lng: -104.61, address: "1 Main St", venue_id: null, link_url: null,
  };
}

const baseProps = {
  venues: [],
  selectedVenueId: null,
  userLocation: null,
  userDistances: new globalThis.Map<string, number>(),
  onSelectVenue: vi.fn(),
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Map special-event pins", () => {
  test("draws a pin per drawable event and reports a tap with its id", () => {
    const onSelectEvent = vi.fn();
    render(<Map {...baseProps} events={[ev("a", 60, 120), ev("far", 60 * 24 * 10, 60 * 24 * 10 + 60)]} onSelectEvent={onSelectEvent} />);
    expect(screen.queryByRole("button", { name: /Event far/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Event a/ }));
    expect(onSelectEvent).toHaveBeenCalledWith("a");
  });

  test("with no events nothing event-related is drawn", () => {
    render(<Map {...baseProps} />);
    expect(screen.queryByRole("button", { name: /special event/i })).toBeNull();
  });
});
