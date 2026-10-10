/**
 * Tests for the pure logic behind the "happening today" strip and the events
 * list (#761): which event the strip picks, the Pueblo-day rule (never the
 * phone's own clock), list ordering including far-out events, and the
 * per-event-per-day dismissal store with storage that may be unavailable.
 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { denverDayKey, listOrder, stripAt } from "@/lib/eventPins";
import { dismissEvent, readEventDismissals } from "@/lib/eventStripDismissals";
import type { PublicEvent } from "@/lib/events";

const MIN = 60_000;
const HOUR = 60 * MIN;
// 2026-10-10 12:00 in Pueblo (MDT, UTC-6).
const NOW = Date.parse("2026-10-10T18:00:00.000Z");

function ev(id: string, startMs: number, endMs: number): PublicEvent {
  return {
    id, name: `Event ${id}`, name_es: null, host: null, host_es: null, description: null,
    description_es: null, what_to_bring: null, what_to_bring_es: null,
    starts_at: new Date(startMs).toISOString(), ends_at: new Date(endMs).toISOString(),
    lat: 38.26, lng: -104.61, address: "1 Main St", venue_id: null, link_url: null,
  };
}
const none = () => false;

describe("stripAt", () => {
  test("an event going on now beats one that starts sooner in the feed order", () => {
    const events = [ev("later", NOW + 2 * HOUR, NOW + 3 * HOUR), ev("live", NOW - HOUR, NOW + HOUR)];
    const pick = stripAt(events, NOW, none);
    expect(pick?.pin.event.id).toBe("live");
    expect(pick?.pin.live).toBe(true);
    expect(pick?.more).toBe(1);
  });

  test("with nothing live, the next to start today is named and the rest are counted", () => {
    const events = [ev("a", NOW + HOUR, NOW + 2 * HOUR), ev("b", NOW + 3 * HOUR, NOW + 4 * HOUR), ev("c", NOW + 5 * HOUR, NOW + 6 * HOUR)];
    const pick = stripAt(events, NOW, none);
    expect(pick?.pin.event.id).toBe("a");
    expect(pick?.more).toBe(2);
  });

  test("no event today, none live: no strip (an event in three days is not 'today')", () => {
    expect(stripAt([ev("far", NOW + 72 * HOUR, NOW + 73 * HOUR)], NOW, none)).toBeNull();
    expect(stripAt([], NOW, none)).toBeNull();
  });

  test("an event that is tomorrow in Pueblo is not shown, however the phone's date reads", () => {
    // 11:30 PM Oct 10 in Pueblo; an event at 7 AM Oct 11 Pueblo is tomorrow there,
    // though a phone in a zone ahead of Denver already reads Oct 11 for both.
    const lateNight = Date.parse("2026-10-11T05:30:00.000Z");
    const tomorrow = ev("t", Date.parse("2026-10-11T13:00:00.000Z"), Date.parse("2026-10-11T15:00:00.000Z"));
    expect(denverDayKey(lateNight)).toBe("2026-10-10");
    expect(stripAt([tomorrow], lateNight, none)).toBeNull();
  });

  test("an event that is today in Pueblo is shown even when it is already the next date elsewhere", () => {
    // 5:30 PM Oct 10 Pueblo is 00:30 Oct 11 UTC: a phone set to UTC or Tokyo calls it tomorrow.
    const now = Date.parse("2026-10-10T20:00:00.000Z");
    const tonight = ev("n", Date.parse("2026-10-11T00:30:00.000Z"), Date.parse("2026-10-11T02:00:00.000Z"));
    expect(stripAt([tonight], now, none)?.pin.event.id).toBe("n");
  });

  test("an event that started yesterday and is still on shows; one that ended does not", () => {
    const overnight = ev("o", NOW - 20 * HOUR, NOW + HOUR);
    const over = ev("e", NOW - 5 * HOUR, NOW - HOUR);
    expect(stripAt([overnight], NOW, none)?.pin.live).toBe(true);
    expect(stripAt([over], NOW, none)).toBeNull();
  });

  test("a dismissed event is skipped and not counted; the next takes its place", () => {
    const events = [ev("a", NOW - HOUR, NOW + HOUR), ev("b", NOW + 2 * HOUR, NOW + 3 * HOUR), ev("c", NOW + 4 * HOUR, NOW + 5 * HOUR)];
    const pick = stripAt(events, NOW, (id) => id === "a");
    expect(pick?.pin.event.id).toBe("b");
    expect(pick?.more).toBe(1);
    expect(stripAt(events, NOW, (id) => id !== "none")).toBeNull();
  });

  test("a row with an unparseable date is dropped, not thrown", () => {
    const bad = { ...ev("bad", NOW, NOW), starts_at: "soon" };
    expect(stripAt([bad, ev("ok", NOW + HOUR, NOW + 2 * HOUR)], NOW, none)?.pin.event.id).toBe("ok");
  });
});

describe("listOrder", () => {
  test("going-on-now first, then soonest, and events more than 7 days out are included", () => {
    const events = [
      ev("three-weeks", NOW + 21 * 24 * HOUR, NOW + 21 * 24 * HOUR + HOUR),
      ev("tonight", NOW + 6 * HOUR, NOW + 7 * HOUR),
      ev("live", NOW - HOUR, NOW + HOUR),
      ev("in-3-days", NOW + 72 * HOUR, NOW + 73 * HOUR),
    ];
    expect(listOrder(events, NOW).map((i) => i.event.id)).toEqual(["live", "tonight", "in-3-days", "three-weeks"]);
    expect(listOrder(events, NOW)[0]!.live).toBe(true);
  });

  test("an event that has ended is gone, at its exact end", () => {
    const e = ev("a", NOW - HOUR, NOW);
    expect(listOrder([e], NOW - 1)).toHaveLength(1);
    expect(listOrder([e], NOW)).toHaveLength(0);
  });
});

describe("dismissals store", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  test("a dismissal is kept for its day, survives a reload, and is forgotten the next day", () => {
    const after = dismissEvent(readEventDismissals(), "a", "2026-10-10");
    expect(after).toEqual({ a: "2026-10-10" });
    expect(readEventDismissals()).toEqual({ a: "2026-10-10" }); // "reload": read back from storage
    // Writing on another day drops yesterday's entries so the key cannot grow.
    expect(dismissEvent(readEventDismissals(), "b", "2026-10-11")).toEqual({ b: "2026-10-11" });
    expect(readEventDismissals()).toEqual({ b: "2026-10-11" });
  });

  test("unavailable storage fails soft: reads empty, and the in-memory record still carries the dismissal", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(readEventDismissals()).toEqual({});
    expect(dismissEvent({}, "a", "2026-10-10")).toEqual({ a: "2026-10-10" });
  });

  test("garbage in storage reads as no dismissals", () => {
    window.localStorage.setItem("pfm.eventStrip.dismissed.v1", "[1,2");
    expect(readEventDismissals()).toEqual({});
    window.localStorage.setItem("pfm.eventStrip.dismissed.v1", '["a"]');
    expect(readEventDismissals()).toEqual({});
  });
});
