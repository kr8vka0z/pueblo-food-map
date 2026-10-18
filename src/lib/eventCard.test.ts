/**
 * eventCard.test.ts — the countdown badge at its wording edges, the live/ended
 * boundary, and the Spanish-to-English text fallback (#759). Wording is only
 * asserted where the wording IS the behavior (the unit and the number).
 */

import { describe, expect, test } from "vitest";
import { eventBadge, eventText, eventWhen, localizeEvent } from "@/lib/eventCard";
import type { PublicEventDetail } from "@/lib/events";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const START = Date.parse("2026-11-21T17:00:00.000Z");
const END = START + 4 * HOUR;
const ev = { starts_at: new Date(START).toISOString(), ends_at: new Date(END).toISOString() };
const text = (nowMs: number, locale: "en" | "es" = "en") => eventBadge(ev, nowMs, locale).text;

describe("eventBadge: countdown before the start", () => {
  test("minutes, rounded up so it never says 0", () => {
    expect(text(START - 20 * MIN)).toBe("Starts in 20 min");
    expect(text(START - 59_999)).toBe("Starts in 1 min");
    expect(text(START - 1)).toBe("Starts in 1 min");
  });

  test("the minute -> hour edge: 59m59s still rounds up to 1 hour, 60m is 1 hour, 61m stays 1 hour", () => {
    expect(text(START - (59 * MIN + 59_000))).toBe("Starts in 1 hour");
    expect(text(START - 60 * MIN)).toBe("Starts in 1 hour");
    expect(text(START - 61 * MIN)).toBe("Starts in 1 hour");
    expect(text(START - 119 * MIN)).toBe("Starts in 1 hour");
    expect(text(START - 2 * HOUR)).toBe("Starts in 2 hours");
  });

  test("the hour -> day edge: 23h59m is hours, exactly 24h is 1 day, 48h is 2 days", () => {
    expect(text(START - (23 * HOUR + 59 * MIN))).toBe("Starts in 23 hours");
    expect(text(START - DAY)).toBe("Starts in 1 day");
    expect(text(START - 2 * DAY)).toBe("Starts in 2 days");
    expect(text(START - 7 * DAY)).toBe("Starts in 7 days");
  });

  test("more than a week out names the date in Pueblo time instead of a day count", () => {
    const badge = eventBadge(ev, START - 7 * DAY - MIN, "en");
    expect(badge.phase).toBe("upcoming");
    // 17:00Z on Nov 21 is 10 AM in Denver, still Saturday the 21st.
    expect(badge.text).toBe("Starts Sat, Nov 21");
  });

  test("Spanish uses the Spanish wording", () => {
    expect(text(START - 2 * HOUR, "es")).toBe("Empieza en 2 horas");
  });
});

describe("eventBadge: live and ended", () => {
  test("exactly at the start the event is live; exactly at the end it has ended", () => {
    expect(eventBadge(ev, START, "en").phase).toBe("live");
    expect(eventBadge(ev, START - 1, "en").phase).toBe("upcoming");
    expect(eventBadge(ev, END - 1, "en").phase).toBe("live");
    expect(eventBadge(ev, END, "en").phase).toBe("ended");
  });

  test("live counts down to the end with the same rounding", () => {
    expect(text(END - 40 * MIN)).toBe("Happening now, ends in 40 min");
    expect(text(END - 1)).toBe("Happening now, ends in 1 min");
    expect(text(END - 90 * MIN)).toBe("Happening now, ends in 1 hour");
    expect(text(START)).toBe("Happening now, ends in 4 hours");
  });

  test("an unparseable date reads as ended rather than throwing", () => {
    expect(eventBadge({ starts_at: "garbage", ends_at: ev.ends_at }, START, "en").phase).toBe("ended");
  });
});

describe("Spanish-to-English fallback", () => {
  test("uses Spanish only when the page is Spanish and the column is non-blank", () => {
    expect(eventText("Free produce", "Productos gratis", "es")).toBe("Productos gratis");
    expect(eventText("Free produce", "Productos gratis", "en")).toBe("Free produce");
    expect(eventText("Free produce", null, "es")).toBe("Free produce");
    expect(eventText("Free produce", "   ", "es")).toBe("Free produce");
    expect(eventText(null, null, "es")).toBe("");
  });

  test("localizeEvent applies it per field, including the cancel note", () => {
    const e = {
      name: "Turkey drive", name_es: "Colecta de pavos",
      host: "Pueblo Food Project", host_es: null,
      description: "Free turkeys", description_es: "",
      what_to_bring: "Bags", what_to_bring_es: "Bolsas",
      cancel_note: "Weather", cancel_note_es: null,
    } as unknown as PublicEventDetail;
    expect(localizeEvent(e, "es")).toEqual({
      name: "Colecta de pavos",
      host: "Pueblo Food Project",
      description: "Free turkeys",
      whatToBring: "Bolsas",
      cancelNote: "Weather",
    });
  });
});

describe("eventWhen", () => {
  test("is Pueblo time whatever the viewer's timezone, and a range past midnight names the end day", () => {
    expect(eventWhen(ev, "en")).toEqual({ day: "Saturday, November 21", time: "10 AM – 2 PM" });
    const overnight = { starts_at: "2026-11-22T05:00:00.000Z", ends_at: "2026-11-22T09:00:00.000Z" };
    expect(eventWhen(overnight, "en").time).toContain("Sunday, November 22");
  });
});
