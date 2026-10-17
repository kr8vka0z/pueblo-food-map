/**
 * eventPins tests (#758) — the rules that decide which special events get a
 * pin and what the pin says. Pure functions, so every case is a fixed instant.
 * No wording or CSS assertions beyond the Pueblo-time values the rules produce.
 */

import { describe, test, expect, afterEach, vi } from "vitest";
import type { PublicEvent } from "@/lib/events";
import {
  EVENT_PIN_WINDOW_DAYS,
  eventSearchWith,
  pinAriaLabel,
  pinLabel,
  pinsAt,
  readEventParam,
  syncEventParam,
} from "@/lib/eventPins";

const MIN = 60_000;
const DAY = 86_400_000;

function ev(id: string, startsAt: string, endsAt: string): PublicEvent {
  return {
    id, name: `Event ${id}`, name_es: null, host: null, host_es: null, description: null,
    description_es: null, what_to_bring: null, what_to_bring_es: null,
    starts_at: startsAt, ends_at: endsAt, lat: 38.26, lng: -104.61, address: "1 Main St",
    venue_id: null, link_url: null,
  };
}

// 2026-10-10 12:00 in Pueblo (MDT, UTC-6)
const NOW = Date.parse("2026-10-10T18:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();
// Intl may use a narrow no-break space before AM/PM; compare with plain spaces.
const plain = (s: string) => s.replace(/\s/g, " ");

describe("pinsAt — which events draw", () => {
  test("the window is the named 7-day constant, inclusive of exactly 7 days out", () => {
    expect(EVENT_PIN_WINDOW_DAYS).toBe(7);
    const atEdge = ev("edge", iso(NOW + 7 * DAY), iso(NOW + 7 * DAY + MIN));
    const pastEdge = ev("past", iso(NOW + 7 * DAY + 1), iso(NOW + 8 * DAY));
    expect(pinsAt([atEdge, pastEdge], NOW).map((p) => p.event.id)).toEqual(["edge"]);
  });

  test("live is now >= start and now < end: live exactly at start, gone exactly at end", () => {
    const e = ev("a", iso(NOW), iso(NOW + 30 * MIN));
    expect(pinsAt([e], NOW - 1)[0].live).toBe(false); // 1ms before start: coming up
    expect(pinsAt([e], NOW)[0].live).toBe(true); // exactly at start
    expect(pinsAt([e], NOW + 30 * MIN - 1)[0].live).toBe(true); // last live millisecond
    expect(pinsAt([e], NOW + 30 * MIN)).toEqual([]); // exactly at end: removed
  });

  test("an already-ended event and a far-future event do not draw", () => {
    const ended = ev("ended", iso(NOW - 2 * DAY), iso(NOW - DAY));
    const far = ev("far", iso(NOW + 10 * DAY), iso(NOW + 10 * DAY + 60 * MIN));
    expect(pinsAt([ended, far], NOW)).toEqual([]);
  });

  test("a malformed date drops that event instead of throwing", () => {
    const bad = ev("bad", "not a date", iso(NOW + MIN));
    const good = ev("good", iso(NOW + MIN), iso(NOW + 2 * MIN));
    expect(pinsAt([bad, good], NOW).map((p) => p.event.id)).toEqual(["good"]);
  });
});

describe("labels are Pueblo time whatever the phone's timezone", () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  test("same label on a phone set to Tokyo; 'Today' follows Pueblo's calendar day", () => {
    // 7 PM Pueblo on Oct 10 is already Oct 11 in Tokyo.
    const e = ev("t", "2026-10-11T01:00:00.000Z", "2026-10-11T03:00:00.000Z");
    const [pinHere] = pinsAt([e], NOW);
    const here = plain(pinLabel(pinHere, "en"));
    process.env.TZ = "Asia/Tokyo";
    const [pinTokyo] = pinsAt([e], NOW);
    expect(plain(pinLabel(pinTokyo, "en"))).toBe(here);
    expect(pinTokyo.today).toBe(true);
    expect(here).toBe("Today 7 PM");
  });

  test("live label shows the END time in Pueblo, with minutes only when needed", () => {
    const e = ev("l", iso(NOW - MIN), "2026-10-10T20:30:00.000Z"); // ends 2:30 PM Pueblo
    const [pin] = pinsAt([e], NOW);
    expect(plain(pinLabel(pin, "en"))).toBe("NOW, until 2:30 PM");
    const onTheHour = ev("h", iso(NOW - MIN), "2026-10-10T20:00:00.000Z");
    expect(plain(pinLabel(pinsAt([onTheHour], NOW)[0], "en"))).toBe("NOW, until 2 PM");
  });

  test("a 6 PM event reads 6 PM on both sides of the fall-back change (Nov 1, 2026)", () => {
    // Fri Oct 30 6 PM MDT = 00:00Z Oct 31; Sun Nov 1 6 PM MST = 01:00Z Nov 2.
    const before = ev("b", "2026-10-31T00:00:00.000Z", "2026-10-31T02:00:00.000Z");
    const after = ev("a", "2026-11-02T01:00:00.000Z", "2026-11-02T03:00:00.000Z");
    const now = Date.parse("2026-10-29T18:00:00.000Z");
    const [pb] = pinsAt([before], now);
    expect(plain(pinLabel(pb, "en"))).toBe("Fri 6 PM");
    const [pa] = pinsAt([after], Date.parse("2026-10-30T18:00:00.000Z"));
    expect(plain(pinLabel(pa, "en"))).toBe("Sun 6 PM");
  });

  test("a 10 AM event reads 10 AM on both sides of the spring-forward change (Mar 8, 2026)", () => {
    // Sat Mar 7 10 AM MST = 17:00Z; Sun Mar 8 10 AM MDT = 16:00Z.
    const sat = ev("s", "2026-03-07T17:00:00.000Z", "2026-03-07T19:00:00.000Z");
    const sun = ev("u", "2026-03-08T16:00:00.000Z", "2026-03-08T18:00:00.000Z");
    const now = Date.parse("2026-03-06T18:00:00.000Z");
    expect(plain(pinLabel(pinsAt([sat], now)[0], "en"))).toBe("Sat 10 AM");
    expect(plain(pinLabel(pinsAt([sun], now)[0], "en"))).toBe("Sun 10 AM");
  });

  test("Spanish uses the Spanish name and day words for the accessible name", () => {
    const e = { ...ev("es", "2026-10-12T20:00:00.000Z", "2026-10-12T22:00:00.000Z"), name_es: "Reparto de comida" };
    const [pin] = pinsAt([e], NOW);
    const aria = plain(pinAriaLabel(pin, "es"));
    expect(aria).toContain("Reparto de comida");
    expect(aria).toContain("lunes");
    expect(plain(pinAriaLabel(pin, "en"))).toContain("Event es");
  });
});

describe("?event= URL parameter", () => {
  test("sets, replaces, clears, and keeps other parameters", () => {
    expect(eventSearchWith("", "e1")).toBe("?event=e1");
    expect(eventSearchWith("?near=1", "e1")).toBe("?near=1&event=e1");
    expect(eventSearchWith("?event=e1&x=2", "e2")).toBe("?event=e2&x=2");
    expect(eventSearchWith("?event=e1&x=2", null)).toBe("?x=2");
    expect(eventSearchWith("?event=e1", null)).toBe("");
  });

  test("returns the same string when nothing changes", () => {
    expect(eventSearchWith("?event=e1", "e1")).toBe("?event=e1");
    expect(eventSearchWith("", null)).toBe("");
  });

  test("round trip through the address bar: read on load, set on tap, cleared on deselect", () => {
    window.history.replaceState(null, "", "/?event=e1&x=2#top");
    expect(readEventParam(window.location.search)).toBe("e1");

    syncEventParam("e2");
    expect(window.location.search).toBe("?event=e2&x=2");
    expect(window.location.hash).toBe("#top");

    syncEventParam(null);
    expect(window.location.search).toBe("?x=2");
    expect(readEventParam(window.location.search)).toBeNull();
  });

  test("does not touch history when the URL already agrees (a shared link survives first render)", () => {
    window.history.replaceState(null, "", "/?event=e1");
    const spy = vi.spyOn(window.history, "replaceState");
    syncEventParam("e1");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
