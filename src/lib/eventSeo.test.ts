// @vitest-environment node
/**
 * What a search engine or link preview reads about an event (src/lib/eventSeo.ts,
 * #762). vitest.setup.ts pins TZ to America/Denver; this file moves the process
 * clock to Tokyo so only a real America/Denver conversion can pass.
 *
 * Risky behavior only: the Denver offset on both sides of both daylight-saving
 * changes, the cancelled status, hostile text surviving serializeJsonLd, the
 * share image (flyer vs default, absolute), hreflang pairs, and the
 * how-long-after-it-ended indexing rule.
 */

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { OG_IMAGE, SITE_URL, buildPageMetadata } from "@/lib/site";
import { utcIsoToPuebloOffsetIso } from "@/lib/eventTime";
import { serializeJsonLd } from "@/lib/venueSchema";
import type { PublicEventDetail } from "@/lib/events";
import {
  EVENT_INDEX_GRACE_MS,
  buildEventBreadcrumbJsonLd,
  buildEventDescription,
  buildEventJsonLd,
  buildEventTitle,
  eventIndexable,
  eventPageMetadataFields,
  eventPagePath,
} from "@/lib/eventSeo";

const originalTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "Asia/Tokyo";
});
afterAll(() => {
  process.env.TZ = originalTz;
});

function makeEvent(overrides: Partial<PublicEventDetail> = {}): PublicEventDetail {
  return {
    id: "evt-1",
    name: "Turkey drive",
    name_es: "Entrega de pavos",
    host: "Pueblo Food Project",
    host_es: null,
    description: "Free turkeys.",
    description_es: "Pavos gratis.",
    what_to_bring: null,
    what_to_bring_es: null,
    starts_at: "2026-11-21T17:00:00.000Z",
    ends_at: "2026-11-21T21:00:00.000Z",
    lat: 38.25,
    lng: -104.6,
    address: "216 W Routt Ave, Pueblo, CO 81004",
    venue_id: null,
    link_url: null,
    flyer: null,
    status: "published",
    cancel_note: null,
    cancel_note_es: null,
    ...overrides,
  };
}

const FLYER = { src: "/api/public/events/evt-1/flyer/22222222-2222-4222-8222-222222222222.jpg", width: 300, height: 420, alt: "A flyer", alt_es: "Un volante" };

describe("utcIsoToPuebloOffsetIso", () => {
  test("carries -07:00 in winter and -06:00 in summer, on both sides of each daylight-saving change", () => {
    // Spring forward 2026-03-08 02:00 MST -> 03:00 MDT (09:00 UTC).
    expect(utcIsoToPuebloOffsetIso("2026-03-08T08:59:00.000Z")).toBe("2026-03-08T01:59:00-07:00");
    expect(utcIsoToPuebloOffsetIso("2026-03-08T09:00:00.000Z")).toBe("2026-03-08T03:00:00-06:00");
    // Fall back 2026-11-01 02:00 MDT -> 01:00 MST (08:00 UTC).
    expect(utcIsoToPuebloOffsetIso("2026-11-01T07:59:00.000Z")).toBe("2026-11-01T01:59:00-06:00");
    expect(utcIsoToPuebloOffsetIso("2026-11-01T08:00:00.000Z")).toBe("2026-11-01T01:00:00-07:00");
  });

  test("an unreadable instant gives an empty string, not a throw", () => {
    expect(utcIsoToPuebloOffsetIso("not a date")).toBe("");
  });
});

describe("buildEventJsonLd", () => {
  test("start and end carry the Denver offset for THEIR day: an event that straddles spring-forward changes offset", () => {
    const jsonLd = buildEventJsonLd(
      makeEvent({ starts_at: "2026-03-08T07:00:00.000Z", ends_at: "2026-03-08T11:00:00.000Z" }),
      "en",
    );
    expect(jsonLd.startDate).toBe("2026-03-08T00:00:00-07:00");
    expect(jsonLd.endDate).toBe("2026-03-08T05:00:00-06:00");
  });

  test("a November event after fall-back is -07:00, a September one -06:00", () => {
    expect(buildEventJsonLd(makeEvent(), "en").startDate).toBe("2026-11-21T10:00:00-07:00");
    expect(
      buildEventJsonLd(makeEvent({ starts_at: "2026-09-19T16:00:00.000Z", ends_at: "2026-09-19T18:00:00.000Z" }), "en").startDate,
    ).toBe("2026-09-19T10:00:00-06:00");
  });

  test("a cancelled event is EventCancelled and keeps its dates and place; a live one is EventScheduled", () => {
    const cancelled = buildEventJsonLd(makeEvent({ status: "cancelled", cancel_note: "Weather" }), "en");
    expect(cancelled.eventStatus).toBe("https://schema.org/EventCancelled");
    expect(cancelled.startDate).toBe("2026-11-21T10:00:00-07:00");
    expect(cancelled.location).toBeTruthy();
    expect(cancelled).not.toHaveProperty("offers");
    expect(buildEventJsonLd(makeEvent(), "en")).toHaveProperty("offers");
    expect(buildEventJsonLd(makeEvent(), "en").eventStatus).toBe("https://schema.org/EventScheduled");
  });

  test("Google's required and recommended fields are present, with a free offer and an in-person mode", () => {
    const jsonLd = buildEventJsonLd(makeEvent({ flyer: FLYER }), "en");
    expect(jsonLd["@type"]).toBe("Event");
    expect(jsonLd.name).toBe("Turkey drive");
    expect(jsonLd.eventAttendanceMode).toBe("https://schema.org/OfflineEventAttendanceMode");
    expect(jsonLd.location).toMatchObject({
      "@type": "Place",
      name: "216 W Routt Ave",
      address: { "@type": "PostalAddress", streetAddress: "216 W Routt Ave", addressLocality: "Pueblo", addressRegion: "CO", postalCode: "81004", addressCountry: "US" },
      geo: { latitude: 38.25, longitude: -104.6 },
    });
    expect(jsonLd.offers).toMatchObject({ "@type": "Offer", price: "0", priceCurrency: "USD" });
    expect(jsonLd.isAccessibleForFree).toBe(true);
    expect(jsonLd.organizer).toEqual({ "@type": "Organization", name: "Pueblo Food Project" });
    expect(jsonLd.image).toEqual([`${SITE_URL}${FLYER.src}`]);
    expect(jsonLd.description).toBe("Free turkeys.");
  });

  test("no host falls back to the site as organizer; no flyer means no image", () => {
    const jsonLd = buildEventJsonLd(makeEvent({ host: null }), "en");
    expect(jsonLd.organizer).toMatchObject({ name: "Pueblo Food Map" });
    expect(jsonLd).not.toHaveProperty("image");
  });

  test("a Spanish page gets Spanish text, the /es URL and inLanguage es", () => {
    const jsonLd = buildEventJsonLd(makeEvent(), "es");
    expect(jsonLd.name).toBe("Entrega de pavos");
    expect(jsonLd.description).toBe("Pavos gratis.");
    expect(jsonLd.url).toBe(`${SITE_URL}/es/event/evt-1`);
    expect(jsonLd.inLanguage).toBe("es");
  });

  test("hostile event text cannot break out of the script tag once serialized, and round-trips intact", () => {
    const evil = `</script><script>alert(1)</script> "quoted" & <b>`;
    const html = serializeJsonLd(buildEventJsonLd(makeEvent({ name: evil, description: evil, host: evil }), "en"));
    expect(html).not.toContain("</script");
    expect(html).not.toContain("<");
    expect(JSON.parse(html).name).toBe(evil);
  });
});

describe("buildEventBreadcrumbJsonLd", () => {
  test("Map then the event, in the page's own language tree", () => {
    const crumbs = buildEventBreadcrumbJsonLd(makeEvent(), "es") as { itemListElement: { item: string; name: string }[] };
    expect(crumbs.itemListElement.map((c) => c.item)).toEqual([`${SITE_URL}/es`, `${SITE_URL}/es/event/evt-1`]);
    expect(crumbs.itemListElement[1].name).toBe("Entrega de pavos");
  });
});

describe("page metadata", () => {
  test("the share image is the flyer, absolute, with its size and alt, when there is one", () => {
    const meta = buildPageMetadata({ ...eventPageMetadataFields(makeEvent({ flyer: FLYER }), "es"), locale: "es", mirrored: true });
    expect(meta.openGraph?.images).toEqual([{ url: `${SITE_URL}${FLYER.src}`, width: 300, height: 420, alt: "Un volante" }]);
    expect(meta.twitter?.images).toEqual([{ url: `${SITE_URL}${FLYER.src}`, alt: "Un volante" }]);
  });

  test("without a flyer the site's default image is used, unchanged", () => {
    const meta = buildPageMetadata({ ...eventPageMetadataFields(makeEvent(), "en"), mirrored: true });
    expect(meta.openGraph?.images).toEqual([OG_IMAGE]);
  });

  test("flyer alt falls back to the other language, then to the event name", () => {
    const noAlt = { ...FLYER, alt: null, alt_es: null };
    const fields = eventPageMetadataFields(makeEvent({ flyer: noAlt }), "en");
    expect(fields.image?.alt).toBe("Turkey drive");
    const enOnly = eventPageMetadataFields(makeEvent({ flyer: { ...FLYER, alt_es: null } }), "es");
    expect(enOnly.image?.alt).toBe("A flyer");
  });

  test("EN and ES pages point at each other with hreflang and x-default -> EN, each canonical to itself", () => {
    const en = buildPageMetadata({ ...eventPageMetadataFields(makeEvent(), "en"), mirrored: true });
    const es = buildPageMetadata({ ...eventPageMetadataFields(makeEvent(), "es"), locale: "es", mirrored: true });
    const languages = { en: `${SITE_URL}/event/evt-1`, es: `${SITE_URL}/es/event/evt-1`, "x-default": `${SITE_URL}/event/evt-1` };
    expect(en.alternates).toEqual({ canonical: `${SITE_URL}/event/evt-1`, languages });
    expect(es.alternates).toEqual({ canonical: `${SITE_URL}/es/event/evt-1`, languages });
    expect(en.openGraph).toMatchObject({ locale: "en_US" });
    expect(es.openGraph).toMatchObject({ locale: "es_US" });
  });

  test("title and description are built from the event, with a cancelled marker, and stay a sensible length", () => {
    const long = makeEvent({ name: "N".repeat(200), description: "word ".repeat(100) });
    expect(buildEventTitle(long, "en").length).toBeLessThan(70);
    expect(buildEventDescription(long, "en").length).toBeLessThanOrEqual(160);
    expect(buildEventTitle(makeEvent({ status: "cancelled" }), "en")).toMatch(/^Cancelled: /);
    expect(buildEventDescription(makeEvent(), "en")).toContain("216 W Routt Ave");
    expect(buildEventDescription(makeEvent(), "en")).toContain("MST");
  });

  test("page paths are per language tree", () => {
    expect(eventPagePath("a b", "en")).toBe("/event/a%20b");
    expect(eventPagePath("a", "es")).toBe("/es/event/a");
  });
});

describe("eventIndexable", () => {
  const end = Date.parse("2026-11-21T21:00:00.000Z");
  test("indexable before and shortly after it ends, noindex once the grace period has passed", () => {
    const event = makeEvent();
    expect(eventIndexable(event, end - 1)).toBe(true);
    expect(eventIndexable(event, end + EVENT_INDEX_GRACE_MS - 1)).toBe(true);
    expect(eventIndexable(event, end + EVENT_INDEX_GRACE_MS)).toBe(false);
  });

  test("an unreadable end date is not indexable", () => {
    expect(eventIndexable({ ends_at: "garbage" }, 0)).toBe(false);
  });
});
