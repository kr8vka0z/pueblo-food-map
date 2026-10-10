/**
 * EventPage — the visible body (and structured data) of /event/[id] and
 * /es/event/[id] (#762, umbrella #156).
 *
 * A plain SERVER component taking `locale`, like HubPages: on these routes the
 * tree IS the language, so the whole page is server HTML with no client fetch
 * and reads fine with JavaScript off. The only client code is the "Add to
 * calendar" button (EventAddToCalendar). The page is rendered per request, so
 * `nowMs` is the request time and nothing here ticks: the status is a word
 * ("Coming up", "Happening now", "This event has ended"), never a countdown
 * that a cached or back-navigated copy would leave wrong.
 *
 * Visual language is the map card's (EventCardBody): same tokens, badge
 * colours, orange Get-directions button (DESIGN.md's owner-approved event
 * exception) and plain-text rule. All event text is a React text node, never
 * HTML; the optional link renders only if safeUrl() says http(s).
 *
 * An ended or cancelled event keeps its page but loses Get directions and Add
 * to calendar, the same as the card, and offers a way back to finding food.
 */

import { Navigation } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { eventBadge, eventText, eventWhen, localizeEvent } from "@/lib/eventCard";
import {
  buildEventBreadcrumbJsonLd,
  buildEventJsonLd,
  eventPagePath,
  puebloZoneAbbr,
} from "@/lib/eventSeo";
import type { PublicEventDetail } from "@/lib/events";
import { googleMapsUrl } from "@/lib/googleMapsUrl";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";
import { localizedHref } from "@/lib/localizedHref";
import { safeUrl } from "@/lib/safeUrl";
import { serializeJsonLd } from "@/lib/venueSchema";
import EventAddToCalendar from "@/components/EventAddToCalendar";
import SiteFooter from "@/components/SiteFooter";

const SECTION_HEADING = "mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]";
const CRUMB_LINK =
  "inline-flex items-center min-h-11 font-medium text-[var(--color-sage-600)] hover:text-[var(--color-sage-700)] " +
  "transition-colors rounded " + FOCUS;

export default function EventPage({
  event,
  locale,
  nowMs,
}: {
  event: PublicEventDetail;
  locale: Locale;
  /** Request time, from the page file (this component stays pure and testable). */
  nowMs: number;
}) {
  const text = localizeEvent(event, locale);
  const cancelled = event.status === "cancelled";
  const phase = eventBadge(event, nowMs, locale).phase;
  const active = !cancelled && phase !== "ended";
  const when = eventWhen(event, locale);
  const moreInfo = safeUrl(event.link_url);
  const otherLocale: Locale = locale === "es" ? "en" : "es";
  // The map link keeps its ?event= form: it is the one HomePageClient reads.
  const mapHref = localizedHref(`/?event=${encodeURIComponent(event.id)}`, locale);
  const homeHref = localizedHref("/", locale);

  const badgeText = cancelled
    ? t("events.card.cancelled", locale)
    : phase === "ended"
      ? t("events.card.ended", locale)
      : phase === "live"
        ? t("events.page.statusLive", locale)
        : t("events.page.statusUpcoming", locale);
  const badgeClass = cancelled
    ? "border-[var(--color-clay-500)] bg-[var(--color-clay-100)] text-[var(--color-clay-700)]"
    : phase === "live"
      ? "border-[var(--color-event-pin)] bg-[var(--color-event-outline)] text-[var(--color-bone-50)] font-bold"
      : phase === "upcoming"
        ? "border-[var(--color-event-outline)] bg-[var(--color-bone-50)] text-[var(--color-event-outline)]"
        : "border-[var(--color-bone-300)] bg-[var(--color-bone-200)] text-[var(--color-ink-700)]";

  const flyerAlt = event.flyer ? eventText(event.flyer.alt, event.flyer.alt_es, locale) || text.name : "";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildEventJsonLd(event, locale)) }} />
      {/* Mirrors the visible breadcrumb below, which is what makes it eligible for Google's breadcrumb display. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildEventBreadcrumbJsonLd(event, locale)) }}
      />
      <main className="flex min-h-screen flex-col bg-[var(--color-bone-50)]">
        <nav
          aria-label={t("breadcrumb.label", locale)}
          className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-[var(--color-bone-200)] px-4"
        >
          <ol className="flex min-w-0 items-center gap-x-2 text-sm">
            <li>
              <a href={homeHref} className={CRUMB_LINK}>{t("breadcrumb.map", locale)}</a>
            </li>
            <li aria-hidden className="text-[var(--color-ink-400)]">›</li>
            <li aria-current="page" className="max-w-[10rem] truncate text-[var(--color-ink-500)] sm:max-w-[16rem]">
              {text.name}
            </li>
          </ol>
          <a
            href={eventPagePath(event.id, otherLocale)}
            lang={otherLocale}
            hrefLang={otherLocale}
            className={"inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-[var(--color-sage-600)] underline underline-offset-2 " + FOCUS}
          >
            {t("events.page.otherLanguage", locale)}
          </a>
        </nav>

        <div className="mx-auto w-full max-w-lg flex-1 space-y-5 px-4 py-6">
          {event.flyer && (
            // The Worker serves the flyer already shrunk; fixed width/height reserve the space (no layout shift),
            // the height cap keeps a tall portrait flyer from filling a phone screen, and it is the page's main
            // image so it loads eagerly. A plain <img> (not next/image) for the same reason as EventFlyer.
            <a
              href={event.flyer.src}
              target="_blank"
              rel="noopener noreferrer"
              className={"block w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-bone-200)] bg-[var(--color-bone-100)] " + FOCUS}
              style={{ aspectRatio: `${event.flyer.width} / ${event.flyer.height}`, maxHeight: "min(70vh, 32rem)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- see comment above */}
              <img
                src={event.flyer.src}
                alt={flyerAlt}
                width={event.flyer.width}
                height={event.flyer.height}
                fetchPriority="high"
                decoding="async"
                className="h-full w-full object-contain"
              />
            </a>
          )}

          <header className="space-y-3">
            <p
              data-testid="event-status"
              data-phase={cancelled ? "cancelled" : phase}
              className={`inline-flex items-center gap-2 rounded-full border-2 px-3 py-1 text-sm font-semibold ${badgeClass}`}
            >
              {badgeText}
            </p>
            <h1
              className="text-2xl font-normal leading-tight text-[var(--color-ink-900)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {text.name}
            </h1>
            {text.host && (
              <p className="text-sm text-[var(--color-ink-500)]">{t("events.card.hostedBy", locale, { host: text.host })}</p>
            )}
            {cancelled ? (
              <p className="whitespace-pre-line text-sm font-medium text-[var(--color-clay-700)]">
                {text.cancelNote || t("events.card.cancelledNoNote", locale)}
              </p>
            ) : (
              !active && <p className="text-sm text-[var(--color-ink-700)]">{t("events.card.endedHelp", locale)}</p>
            )}
          </header>

          <section aria-labelledby="event-when">
            <h2 id="event-when" className={SECTION_HEADING}>{t("events.card.when", locale)}</h2>
            <p className="text-base font-semibold text-[var(--color-ink-900)]">{when.day}</p>
            <p className="text-sm text-[var(--color-ink-700)]">
              {when.time} · {t("events.page.timeZoneNote", locale, { abbr: puebloZoneAbbr(event.starts_at) })}
            </p>
          </section>

          <section aria-labelledby="event-where">
            <h2 id="event-where" className={SECTION_HEADING}>{t("events.card.where", locale)}</h2>
            <p className="text-sm text-[var(--color-ink-700)]">{event.address}</p>
          </section>

          {text.description && (
            <section aria-labelledby="event-about">
              <h2 id="event-about" className={SECTION_HEADING}>{t("events.card.about", locale)}</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--color-ink-700)]">{text.description}</p>
            </section>
          )}

          {text.whatToBring && (
            <section
              aria-labelledby="event-bring"
              className="rounded-[var(--radius-md)] border border-[var(--color-sage-500)] bg-[var(--color-sage-50)] p-3"
            >
              <h2 id="event-bring" className="mb-1 text-sm font-semibold text-[var(--color-sage-700)]">
                {t("events.card.bring", locale)}
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--color-ink-900)]">{text.whatToBring}</p>
            </section>
          )}

          <div className="flex flex-col gap-3">
            {active && (
              <a
                href={googleMapsUrl(event.lat, event.lng)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("events.card.directionsAria", locale, { name: text.name })}
                className={
                  // Orange + navy: the owner-approved event exception (DESIGN.md), 7.8:1.
                  "flex min-h-14 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] " +
                  "bg-[var(--color-event-pin)] px-4 py-3 text-base font-bold text-[var(--color-event-outline)] " +
                  "transition-colors touch-manipulation " + PRESS_FEEDBACK +
                  " focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-event-outline)] focus-visible:ring-offset-2"
                }
              >
                <Navigation size={18} aria-hidden />
                {t("events.card.directions", locale)}
              </a>
            )}
            <a
              href={mapHref}
              className={
                "flex min-h-12 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-sage-600)] " +
                "px-4 text-base font-semibold text-[var(--color-bone-50)] transition-colors hover:bg-[var(--color-sage-700)] " +
                "touch-manipulation " + PRESS_FEEDBACK + " " + FOCUS + " focus-visible:ring-offset-2"
              }
            >
              {t("events.page.openOnMap", locale)}
            </a>
            {active ? (
              <EventAddToCalendar event={event} locale={locale} />
            ) : (
              // Ended or cancelled: the map is still the way to find food today, and its card for this
              // event carries the "See places open now" button.
              <a
                href={homeHref}
                className={
                  "flex min-h-12 w-full items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-bone-300)] " +
                  "bg-[var(--color-bone-50)] px-3 text-sm font-semibold text-[var(--color-ink-700)] transition-colors " +
                  "hover:bg-[var(--color-bone-100)] touch-manipulation " + PRESS_FEEDBACK + " " + FOCUS
                }
              >
                {t("events.page.findFood", locale)}
              </a>
            )}
            {moreInfo && (
              <a
                href={moreInfo}
                target="_blank"
                rel="noopener noreferrer"
                className={"inline-flex min-h-12 items-center self-start text-sm font-medium text-[var(--color-sage-600)] underline underline-offset-2 hover:text-[var(--color-sage-700)] " + FOCUS}
              >
                {t("events.card.moreInfo", locale)}
              </a>
            )}
          </div>
        </div>
        <SiteFooter />
      </main>
    </>
  );
}
