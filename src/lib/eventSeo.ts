/**
 * eventSeo.ts — everything a search engine or a link preview reads about one
 * event page (#762, umbrella #156): the page path, title, description, share
 * image, the indexing decision, and the schema.org Event + BreadcrumbList.
 *
 * Pure (no React, no database), clock passed in, so each rule is unit-tested
 * with fixed dates. Like every other event time it is formatted in
 * America/Denver whatever the server's own zone (eventTime.ts).
 *
 * Property choices follow Google's Event guidance (developers.google.com/
 * search/docs/appearance/structured-data/event): required name, startDate,
 * location(Place + name + address); recommended description, endDate,
 * eventStatus, image, organizer, offers. Dates carry the Denver offset in
 * force on that day (daylight saving), and a cancelled event keeps its dates
 * and place, only its status changes (Google: "DON'T remove the startDate").
 */

import { SITE_NAME, SITE_URL } from "@/lib/site";
import { t, type Locale } from "@/lib/i18n";
import { TIME_ZONE, utcIsoToPuebloOffsetIso } from "@/lib/eventTime";
import { eventText, eventWhen, localizeEvent } from "@/lib/eventCard";
import type { PublicEventDetail } from "@/lib/events";
import { extractPostalCode, extractStreetAddress, getVenueById } from "@/lib/venueSchema";
import { parseVenueCityCore } from "@/lib/venueSummary";

/**
 * How long after it ends a page stays indexable. WHY a week: a link shared
 * around the event, or a search result a few days stale, should still land on
 * a page that says "ended" or "cancelled" and lets Google update its listing;
 * after that the page has no search value (Google drops past events anyway),
 * and a permanent pile of old-event pages would only dilute the site. Cancelled
 * events follow the same clock: they stay indexable (with Cancelled status) so
 * a search engine learns about the cancellation, then drop out with the rest.
 */
export const EVENT_INDEX_GRACE_MS = 7 * 86_400_000;

/** The page's own path in its language tree. */
export function eventPagePath(id: string, locale: Locale): string {
  return `${locale === "es" ? "/es" : ""}/event/${encodeURIComponent(id)}`;
}

/** False once the event ended more than EVENT_INDEX_GRACE_MS ago (or its end date is unreadable). */
export function eventIndexable(event: Pick<PublicEventDetail, "ends_at">, nowMs: number): boolean {
  const end = Date.parse(event.ends_at);
  return Number.isFinite(end) && nowMs < end + EVENT_INDEX_GRACE_MS;
}

/** The flyer as an absolute URL (what a crawler or a chat app fetches), or null. */
export function eventFlyerUrl(event: Pick<PublicEventDetail, "flyer">): string | null {
  return event.flyer ? `${SITE_URL}${event.flyer.src}` : null;
}

/** "MDT" / "MST" for the instant, in Pueblo. */
export function puebloZoneAbbr(iso: string): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, timeZoneName: "short" })
    .formatToParts(Date.parse(iso))
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? "";
}

const shortDayFormatters = new Map<Locale, Intl.DateTimeFormat>();
function shortDay(ms: number, locale: Locale): string {
  let f = shortDayFormatters.get(locale);
  if (!f) {
    f = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
      timeZone: TIME_ZONE,
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    shortDayFormatters.set(locale, f);
  }
  return f.format(ms);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

const flat = (s: string) => s.replace(/\s+/g, " ").trim();

/** "Name – Sat, Nov 21" (the brand suffix is added by the layout's title template). */
export function buildEventTitle(event: PublicEventDetail, locale: Locale): string {
  const name = truncate(flat(localizeEvent(event, locale).name), 44);
  const base = `${name} – ${shortDay(Date.parse(event.starts_at), locale)}`;
  return event.status === "cancelled" ? t("events.page.metaCancelledTitle", locale, { name: base }) : base;
}

/** "Sat, Nov 21, 10 AM – 2 PM MDT, at <address>. <about>" cut to about 160 characters. */
export function buildEventDescription(event: PublicEventDetail, locale: Locale): string {
  const text = localizeEvent(event, locale);
  const when = eventWhen(event, locale);
  const day = shortDay(Date.parse(event.starts_at), locale);
  const lead = t("events.page.metaWhen", locale, {
    day,
    time: when.time,
    abbr: puebloZoneAbbr(event.starts_at),
    address: flat(event.address),
  });
  const parts = [event.status === "cancelled" ? t("events.page.metaCancelled", locale) : "", lead, flat(text.description)];
  return truncate(parts.filter(Boolean).join(" "), 160);
}

/** The fields buildPageMetadata needs for this page (the `image` only when there is a flyer). */
export function eventPageMetadataFields(event: PublicEventDetail, locale: Locale) {
  const flyer = event.flyer;
  const name = localizeEvent(event, locale).name;
  return {
    title: buildEventTitle(event, locale),
    description: buildEventDescription(event, locale),
    path: eventPagePath(event.id, locale),
    ...(flyer
      ? {
          image: {
            url: eventFlyerUrl(event) as string,
            width: flyer.width,
            height: flyer.height,
            alt: eventText(flyer.alt, flyer.alt_es, locale) || name,
          },
        }
      : {}),
  };
}

function buildPostalAddress(address: string): Record<string, string> {
  const result: Record<string, string> = {
    "@type": "PostalAddress",
    streetAddress: extractStreetAddress(address),
    addressRegion: "CO",
    addressCountry: "US",
  };
  // Same rule as venue pages: omit a part we cannot read, never invent one.
  const city = parseVenueCityCore(address);
  if (city) result.addressLocality = city;
  const zip = extractPostalCode(address);
  if (zip) result.postalCode = zip;
  return result;
}

/** schema.org Event for the page, in the page's language. */
export function buildEventJsonLd(event: PublicEventDetail, locale: Locale): Record<string, unknown> {
  const text = localizeEvent(event, locale);
  const pageUrl = `${SITE_URL}${eventPagePath(event.id, locale)}`;
  const venue = event.venue_id ? getVenueById(event.venue_id) : undefined;
  const flyerUrl = eventFlyerUrl(event);
  const result: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: text.name,
    url: pageUrl,
    inLanguage: locale,
    startDate: utcIsoToPuebloOffsetIso(event.starts_at),
    endDate: utcIsoToPuebloOffsetIso(event.ends_at),
    eventStatus: event.status === "cancelled" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      // Google: location.name is the venue, never the event title or a city.
      name: venue?.name ?? extractStreetAddress(event.address),
      address: buildPostalAddress(event.address),
      geo: { "@type": "GeoCoordinates", latitude: event.lat, longitude: event.lng },
    },
    description: text.description || buildEventDescription(event, locale),
    organizer: text.host
      ? { "@type": "Organization", name: text.host }
      : { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    // Every event on this site is free to attend; the zero-price Offer is what
    // Google's Event result looks for to show "Free".
    isAccessibleForFree: true,
  };
  // WHY no offer when cancelled: an InStock offer on a cancelled event would
  // tell a search engine admission is still available.
  if (event.status !== "cancelled") {
    result.offers = {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: pageUrl,
    };
  }
  if (flyerUrl) result.image = [flyerUrl];
  return result;
}

/** BreadcrumbList mirroring the visible breadcrumb: Map › event name. */
export function buildEventBreadcrumbJsonLd(event: PublicEventDetail, locale: Locale): Record<string, unknown> {
  const home = locale === "es" ? `${SITE_URL}/es` : SITE_URL;
  const crumbs = [
    { name: SITE_NAME, url: home },
    { name: localizeEvent(event, locale).name, url: `${SITE_URL}${eventPagePath(event.id, locale)}` },
  ];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.url })),
  };
}
