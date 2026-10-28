/**
 * useWalkingRoute — the two behaviors #726 had to carry over exactly:
 * latest-request-wins (#207's seq guard: a slower, older response never
 * commits) and the walk-without-location resume (#207: a Walk tap with no
 * location asks for it, then fetches on grant or shows the hint on denial).
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useWalkingRoute } from "@/lib/useWalkingRoute";
import type { GeoState } from "@/lib/useGeolocation";
import type { Venue } from "@/types/venue";

const venue = (id: string, lng: number): Venue =>
  ({ id, name: id, category: "pantry", lat: 38.27, lng, address: "x", source: "t", last_verified: "2026-10-27" }) as Venue;
const A = venue("a", -104.61);
const B = venue("b", -104.62);
const HERE = { lat: 38.25, lng: -104.6 };

/** A Directions response whose route ends at `lng`, so a test can tell which request committed. */
const routeTo = (lng: number) => ({
  ok: true,
  json: async () => ({
    routes: [{ geometry: { type: "LineString", coordinates: [[-104.6, 38.25], [lng, 38.27]] }, distance: 800, duration: 600 }],
  }),
});

let pending: Array<(r: unknown) => void>;
beforeEach(() => {
  pending = [];
  vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", "pk.test");
  vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => pending.push(resolve))));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function setup(initial: { userLocation: { lat: number; lng: number } | null; geoState: GeoState; selectedVenueId: string | null }) {
  const requestLocation = vi.fn();
  const hook = renderHook((p: typeof initial) =>
    useWalkingRoute({
      locale: "en",
      ...p,
      requestLocation,
      refreshLocation: () => {},
      findVenue: (id) => [A, B].find((v) => v.id === id),
    }),
  { initialProps: initial });
  return { ...hook, requestLocation };
}

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe("useWalkingRoute — latest request wins (#207)", () => {
  test.each([
    ["A then B, A answers last", false],
    ["A then a clear, A answers after", true],
  ])("%s: the superseded response never commits", async (_name, clearInstead) => {
    const { result } = setup({ userLocation: HERE, geoState: { permission: "granted", position: HERE }, selectedVenueId: "a" });

    act(() => result.current.walkFor("a").onWalk(A));
    if (clearInstead) act(() => result.current.walkFor("a").onClear());
    else act(() => result.current.walkFor("b").onWalk(B));

    // B (if any) answers first, then A's slower answer arrives.
    if (!clearInstead) await act(async () => pending[1](routeTo(B.lng)));
    await act(async () => pending[0](routeTo(A.lng)));
    await flush();

    expect(result.current.routeVenueId).toBe(clearInstead ? null : "b");
    expect(result.current.route?.geometry.coordinates.at(-1)?.[0] ?? null).toBe(clearInstead ? null : B.lng);
  });
});

describe("useWalkingRoute — Walk with no location yet (#207)", () => {
  test("asks for location instead of fetching, then fetches once it is granted", async () => {
    const { result, rerender, requestLocation } = setup({ userLocation: null, geoState: { permission: "prompt", position: null }, selectedVenueId: "a" });

    act(() => result.current.walkFor("a").onWalk(A));
    expect(requestLocation).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();

    rerender({ userLocation: HERE, geoState: { permission: "granted", position: HERE }, selectedVenueId: "a" });
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => pending[0](routeTo(A.lng)));
    await flush();
    expect(result.current.walkFor("a").isActive).toBe(true);
  });

  test("shows the share-your-location hint on that venue's card when location is refused", async () => {
    const { result, rerender } = setup({ userLocation: null, geoState: { permission: "prompt", position: null }, selectedVenueId: "a" });
    await flush(); // let the mount-time selection effect settle, as it has long before a real tap

    act(() => result.current.walkFor("a").onWalk(A));
    rerender({ userLocation: null, geoState: { permission: "denied", position: null }, selectedVenueId: "a" });
    await flush();

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.walkFor("a").showLocationHint).toBe(true);
    expect(result.current.walkFor("b").showLocationHint).toBe(false);
  });
});
