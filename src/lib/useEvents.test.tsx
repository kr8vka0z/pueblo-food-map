/**
 * useEvents tests (#758) — the fail-soft contract: a failed, non-OK or
 * malformed feed leaves the list empty (the map then looks exactly as it did
 * before events existed), and one bad row never hides the good ones.
 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useEvents } from "@/lib/useEvents";

const good = {
  id: "e1", name: "Turkey drive", name_es: null, host: null, host_es: null, description: null,
  description_es: null, what_to_bring: null, what_to_bring_es: null,
  starts_at: "2026-10-10T18:00:00.000Z", ends_at: "2026-10-10T20:00:00.000Z",
  lat: 38.26, lng: -104.61, address: "1 Main St", venue_id: null, link_url: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

async function settle() {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, 0));
  });
}

describe("useEvents", () => {
  test("returns the feed's events", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ events: [good] }) }));
    const { result } = renderHook(() => useEvents());
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(fetch).toHaveBeenCalledWith("/api/public/events");
  });

  test.each([
    ["a network failure", () => vi.fn().mockRejectedValue(new Error("offline"))],
    ["a non-OK response", () => vi.fn().mockResolvedValue({ ok: false, json: async () => ({ events: [good] }) })],
    ["an unparseable body", () => vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error("bad json"); } })],
    ["a body without an events list", () => vi.fn().mockResolvedValue({ ok: true, json: async () => ({ boxes: [] }) })],
    ["an empty feed", () => vi.fn().mockResolvedValue({ ok: true, json: async () => ({ events: [] }) })],
  ])("%s leaves the list empty, no error", async (_name, makeFetch) => {
    vi.stubGlobal("fetch", makeFetch());
    const { result } = renderHook(() => useEvents());
    await settle();
    expect(result.current).toEqual([]);
  });

  test("drops a row the map cannot draw and keeps the rest", async () => {
    const noCoords = { ...good, id: "e2", lat: null };
    const noDates = { ...good, id: "e3", starts_at: undefined };
    const badLat = { ...good, id: "e4", lat: 91 };
    const badLng = { ...good, id: "e5", lng: -181 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ events: [noCoords, good, noDates, badLat, badLng, null] }) }));
    const { result } = renderHook(() => useEvents());
    await waitFor(() => expect(result.current.map((e) => e.id)).toEqual(["e1"]));
  });
});
