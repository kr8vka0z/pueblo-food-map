/**
 * useEventDetail.test.tsx — which source the card reads (#759): the feed when
 * the event is in it, the single-event route only after the feed has answered
 * without it, and "missing" (map untouched) when nothing can be shown.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useEventDetail } from "@/lib/useEventDetail";
import type { PublicEvent, PublicEventDetail } from "@/lib/events";

const live = { id: "live", name: "Live", starts_at: "2026-11-21T17:00:00.000Z", ends_at: "2026-11-21T21:00:00.000Z" } as PublicEvent;
const finished = { ...live, id: "old", status: "cancelled", cancel_note: "Weather", cancel_note_es: null } as PublicEventDetail;

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useEventDetail", () => {
  test("an event in the feed is used as published, with no request", () => {
    const { result } = renderHook(() => useEventDetail("live", [live], true));

    expect(result.current.event).toMatchObject({ id: "live", status: "published", cancel_note: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("waits for the feed before asking the single-event route", () => {
    renderHook(() => useEventDetail("old", [], false));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("an id the feed lacks is read from the single-event route (cancelled keeps its note)", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ event: finished }) });

    const { result } = renderHook(() => useEventDetail("old", [live], true));

    await waitFor(() => expect(result.current.event?.status).toBe("cancelled"));
    expect(fetchMock).toHaveBeenCalledWith("/api/public/events/old");
    expect(result.current.event?.cancel_note).toBe("Weather");
    expect(result.current.missing).toBe(false);
  });

  test("404 and network failure both end as missing, never a throw", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ event: null }) });
    const notFound = renderHook(() => useEventDetail("nope", [], true));
    await waitFor(() => expect(notFound.result.current.missing).toBe(true));

    fetchMock.mockRejectedValueOnce(new Error("offline"));
    const offline = renderHook(() => useEventDetail("nope2", [], true));
    await waitFor(() => expect(offline.result.current.missing).toBe(true));
    expect(offline.result.current.event).toBeNull();
  });

  test("no selection is neither an event nor missing", () => {
    const { result } = renderHook(() => useEventDetail(null, [live], true));

    expect(result.current).toEqual({ event: null, missing: false });
  });
});
