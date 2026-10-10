"use client";

/**
 * EventCardBody — the promotional card for one special event (#759, umbrella
 * #156), rendered INSIDE the map's two existing card shells the way
 * BoxCardBody is: BottomSheet on a phone (`layout="sheet"`) and the desktop
 * side panel (`layout="panel"`, via EventPanel). Loaded lazily by both, so a
 * visitor who never opens an event pays nothing for it.
 *
 * Order, top to bottom (the owner-approved mockup): flyer slot, status badge,
 * name, "Hosted by", When, Where, About, a highlighted "What to bring" box, a
 * large orange Get directions button, Share + Add to calendar, then the
 * optional link. The flyer (#760) is EventFlyer: absent when the event has
 * none or it fails to load, and the card is complete without it. On the phone
 * it shows only once the sheet is expanded (see "Phone"), which also keeps the
 * image from loading until the visitor asks for the whole card.
 *
 * Phone: the sheet's first, always-visible view must show the badge, name,
 * When and Get directions, so in `layout="sheet"` the Where / About / What to
 * bring / Share / Calendar / link sections sit in the clipped "peek" wrapper
 * under it (same grab-bar mechanics as the box card, #666/#667). That moves
 * Get directions above Where on a phone only; the desktop order is the
 * approved one.
 *
 * Badge: the countdown re-renders off the map's shared once-a-minute clock
 * (useMinuteClock — one timer for pins and card). It is plain text with no
 * live region on purpose: a minute-by-minute change must not be announced.
 * Its words carry the meaning, so it is not color-only.
 *
 * Ended or cancelled (a shared link opened late): "This event has ended" or
 * "Cancelled" + the admin's note, a way to see places open now, and NO Get
 * directions / Share / Add to calendar.
 *
 * Plain text only: every event string is rendered as a React text node (never
 * HTML), and the optional link only renders if safeUrl() says http(s).
 *
 * Directions reuse DirectionButtons' googleMapsUrl (one URL builder, no travel
 * mode so the visitor picks); distance reuses haversineMiles/formatMiles.
 * Orange + navy on the button is the same owner approval as the event pin
 * (DESIGN.md) and clears contrast (7.8:1).
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CalendarPlus, Check, ExternalLink, MapPin, Navigation, Share2, X } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { googleMapsUrl } from "@/components/DirectionButtons";
import { formatMiles, haversineMiles } from "@/lib/distance";
import { eventBadge, eventText, eventWhen, localizeEvent } from "@/lib/eventCard";
import { downloadEventCalendar } from "@/lib/eventCalendar";
import EventFlyer from "@/components/EventFlyer";
import type { PublicEventDetail } from "@/lib/events";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";
import { safeUrl } from "@/lib/safeUrl";
import { eventShareUrl, shareLink } from "@/lib/share";
import { useMinuteClock } from "@/lib/useMinuteClock";

export interface EventCardBodyProps {
  event: PublicEventDetail;
  locale: Locale;
  /** The visitor's real position, or null (never the Pueblo-center fallback): distance only shows when known. */
  userLocation: { lat: number; lng: number } | null;
  /** DOM id of the name heading (a focus target, tabIndex -1). */
  headingId: string;
  onClose: () => void;
  /** Ended/cancelled: switch to the existing "Open now" filter and close the card. */
  onSeeOpenNow: () => void;
  /** "sheet" = phone bottom sheet (clipped peek under the first view); "panel" = desktop side panel. */
  layout?: "sheet" | "panel";
  /** "sheet" only — whether the below-the-fold section is fully shown (BottomSheet's grab-bar state). */
  expanded?: boolean;
  /** "sheet" only — tapping the clipped preview expands, same action as the grab bar. */
  onRequestExpand?: () => void;
  /** "sheet" only — id of the below-the-fold wrapper, for the grab bar's aria-controls. */
  detailSectionId?: string;
  className?: string;
}

const SECONDARY_BUTTON =
  "inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] " +
  "border border-[var(--color-bone-300)] bg-[var(--color-bone-50)] px-3 text-sm font-semibold " +
  "text-[var(--color-ink-700)] transition-colors hover:bg-[var(--color-bone-100)] touch-manipulation " +
  PRESS_FEEDBACK +
  " focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]";

const SECTION_HEADING = "mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]";

export default function EventCardBody({
  event,
  locale,
  userLocation,
  headingId,
  onClose,
  onSeeOpenNow,
  layout = "panel",
  expanded = true,
  onRequestExpand,
  detailSectionId,
  className = "",
}: EventCardBodyProps) {
  const now = useMinuteClock();
  const text = localizeEvent(event, locale);
  const cancelled = event.status === "cancelled";
  const badge = eventBadge(event, now, locale);
  const active = !cancelled && badge.phase !== "ended";
  const when = eventWhen(event, locale);
  const moreInfo = safeUrl(event.link_url);
  const isSheet = layout === "sheet";
  // Alt: the admin's text in the page's language, else their English text, else the event name.
  const flyer = event.flyer ? (
    <EventFlyer key={event.flyer.src} flyer={event.flyer} alt={eventText(event.flyer.alt, event.flyer.alt_es, locale) || text.name} />
  ) : null;

  // ── Focus (sheet only; DesktopSidePanel does this itself for the panel) ────
  // On open, move focus to the heading so a keyboard / screen-reader user lands
  // in the card; on close, return it to the pin that opened it. The pin is read
  // BEFORE focus moves (layout effect) and, because Safari doesn't focus a
  // tapped <button>, falls back to the currently selected pin.
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!isSheet) return;
    const focused = document.activeElement;
    returnFocusRef.current =
      focused instanceof HTMLElement && focused !== document.body
        ? focused
        : document.querySelector<HTMLElement>('.pfm-event-pin[aria-pressed="true"]');
  }, [isSheet]);
  useEffect(() => {
    if (!isSheet) return;
    document.getElementById(headingId)?.focus({ preventScroll: true });
    return () => {
      const el = returnFocusRef.current;
      if (el?.isConnected) queueMicrotask(() => el.focus({ preventScroll: true }));
    };
  }, [isSheet, headingId]);

  // ── Share ─────────────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);
  const [manualLink, setManualLink] = useState<string | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
  }, []);
  async function handleShare() {
    const url = eventShareUrl(event.id, locale);
    const result = await shareLink({ url, title: text.name, text: `${text.name} — Pueblo Food Map` });
    // Neither a share sheet nor a clipboard: show the link to copy by hand
    // instead of a button that silently does nothing.
    if (result === "unsupported") setManualLink(url);
    if (result !== "copied") return;
    if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
    setCopied(true);
    copiedTimer.current = setTimeout(() => {
      setCopied(false);
      copiedTimer.current = null;
    }, 2000);
  }

  // ── Add to calendar ────────────────────────────────────────────────────────
  function handleCalendar() {
    downloadEventCalendar(event, locale);
  }

  // ── Pieces ─────────────────────────────────────────────────────────────────
  const badgeClass = cancelled
    ? "border-[var(--color-clay-500)] bg-[var(--color-clay-100)] text-[var(--color-clay-700)]"
    : badge.phase === "live"
      ? // Louder than upcoming: filled navy, like the live pin label.
        "border-[var(--color-event-pin)] bg-[var(--color-event-outline)] text-[var(--color-bone-50)] font-bold"
      : badge.phase === "upcoming"
        ? "border-[var(--color-event-outline)] bg-[var(--color-bone-50)] text-[var(--color-event-outline)]"
        : "border-[var(--color-bone-300)] bg-[var(--color-bone-200)] text-[var(--color-ink-700)]";

  const topRow = (
    <div className="flex items-start justify-between gap-3">
      <p
        data-testid="event-badge"
        data-phase={cancelled ? "cancelled" : badge.phase}
        className={`inline-flex items-center gap-2 rounded-full border-2 px-3 py-1 text-sm font-semibold ${badgeClass}`}
      >
        {badge.phase === "live" && !cancelled && (
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-event-pin)]" />
        )}
        {cancelled ? t("events.card.cancelled", locale) : badge.text}
      </p>
      <button
        type="button"
        onClick={onClose}
        aria-label={t("events.card.closeAria", locale)}
        className={
          "-mr-3 -mt-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-md " +
          "text-[var(--color-ink-500)] transition-colors hover:bg-[var(--color-bone-100)] touch-manipulation " +
          PRESS_FEEDBACK +
          " focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
        }
      >
        <X size={18} aria-hidden />
      </button>
    </div>
  );

  const heading = (
    <div>
      <h2
        id={headingId}
        tabIndex={-1}
        className="text-2xl font-normal leading-tight text-[var(--color-ink-900)] outline-none"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {text.name}
      </h2>
      {text.host && (
        <p className="mt-1 text-sm text-[var(--color-ink-500)]">{t("events.card.hostedBy", locale, { host: text.host })}</p>
      )}
    </div>
  );

  // Ended / cancelled: the note (cancelled) or help text (ended) right under the name.
  const statusNote = cancelled ? (
    <p className="whitespace-pre-line text-sm font-medium text-[var(--color-clay-700)]">
      {text.cancelNote || t("events.card.cancelledNoNote", locale)}
    </p>
  ) : !active ? (
    <p className="text-sm text-[var(--color-ink-700)]">{t("events.card.endedHelp", locale)}</p>
  ) : null;

  const whenBlock = (
    <section aria-labelledby={`${headingId}-when`}>
      <h3 id={`${headingId}-when`} className={SECTION_HEADING}>{t("events.card.when", locale)}</h3>
      <p className="text-base font-semibold text-[var(--color-ink-900)]">{when.day}</p>
      <p className="text-sm text-[var(--color-ink-700)]">{when.time}</p>
    </section>
  );

  const distance =
    active && userLocation
      ? `${formatMiles(haversineMiles(userLocation, { lat: event.lat, lng: event.lng }))} ${t("distance.fromYou", locale)}`
      : null;
  const whereBlock = (
    <section aria-labelledby={`${headingId}-where`}>
      <h3 id={`${headingId}-where`} className={SECTION_HEADING}>{t("events.card.where", locale)}</h3>
      <div className="flex gap-2">
        <MapPin size={16} aria-hidden className="mt-0.5 shrink-0 text-[var(--color-ink-400)]" />
        <div>
          <p className="text-sm text-[var(--color-ink-700)]">{event.address}</p>
          {distance && <p className="mt-0.5 font-mono text-xs text-[var(--color-ink-500)]">{distance}</p>}
        </div>
      </div>
    </section>
  );

  const aboutBlock = text.description ? (
    <section aria-labelledby={`${headingId}-about`}>
      <h3 id={`${headingId}-about`} className={SECTION_HEADING}>{t("events.card.about", locale)}</h3>
      <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--color-ink-700)]">{text.description}</p>
    </section>
  ) : null;

  const bringBlock = text.whatToBring ? (
    <section
      aria-labelledby={`${headingId}-bring`}
      className="rounded-[var(--radius-md)] border border-[var(--color-sage-500)] bg-[var(--color-sage-50)] p-3"
    >
      <h3 id={`${headingId}-bring`} className="mb-1 text-sm font-semibold text-[var(--color-sage-700)]">
        {t("events.card.bring", locale)}
      </h3>
      <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--color-ink-900)]">{text.whatToBring}</p>
    </section>
  ) : null;

  const directionsButton = active ? (
    <a
      href={googleMapsUrl(event.lat, event.lng)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("events.card.directionsAria", locale, { name: text.name })}
      className={
        // Orange + navy: the owner-approved event exception (DESIGN.md), 7.8:1.
        "flex min-h-14 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] " +
        "bg-[var(--color-event-pin)] px-4 py-3 text-base font-bold text-[var(--color-event-outline)] " +
        "transition-colors touch-manipulation " +
        PRESS_FEEDBACK +
        " focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-event-outline)] focus-visible:ring-offset-2"
      }
    >
      <Navigation size={18} aria-hidden />
      {t("events.card.directions", locale)}
    </a>
  ) : null;

  const secondaryButtons = active ? (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button type="button" onClick={handleShare} className={SECONDARY_BUTTON}>
          {copied ? <Check size={16} aria-hidden /> : <Share2 size={16} aria-hidden />}
          {copied ? t("events.card.shareCopied", locale) : t("events.card.share", locale)}
        </button>
        <button type="button" onClick={handleCalendar} className={SECONDARY_BUTTON}>
          <CalendarPlus size={16} aria-hidden />
          {t("events.card.calendar", locale)}
        </button>
      </div>
      {/* Always mounted, outside the button: a live region that appears together
          with its text is announced unreliably; one whose text changes is not. */}
      <span className="sr-only" role="status">{copied ? t("events.card.shareCopied", locale) : ""}</span>
      {manualLink && (
        <p className="text-sm text-[var(--color-ink-700)]">
          {t("events.card.shareManual", locale)}{" "}
          <span className="break-all font-mono text-xs select-all">{manualLink}</span>
        </p>
      )}
    </div>
  ) : null;

  const openNowButton = !active ? (
    <button
      type="button"
      onClick={onSeeOpenNow}
      className={
        "flex min-h-12 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-sage-600)] " +
        "px-4 text-base font-semibold text-[var(--color-bone-50)] transition-colors hover:bg-[var(--color-sage-700)] " +
        "touch-manipulation " + PRESS_FEEDBACK +
        " focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2"
      }
    >
      {t("events.card.seeOpenNow", locale)}
    </button>
  ) : null;

  const linkBlock = moreInfo ? (
    <a
      href={moreInfo}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-12 items-center gap-1.5 self-start text-sm font-medium text-[var(--color-sage-600)] underline underline-offset-2 hover:text-[var(--color-sage-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
    >
      {t("events.card.moreInfo", locale)}
      <ExternalLink size={14} aria-hidden />
    </a>
  ) : null;

  // ── Layouts ────────────────────────────────────────────────────────────────
  if (isSheet) {
    return (
      <div className={`flex flex-col ${className}`}>
        {/* First view (always visible): badge, name, When, Get directions. The flyer joins
            above the badge only once expanded, so it can never push those four out of
            the collapsed sheet. */}
        <div className="flex flex-col gap-3 px-5 pt-2">
          {expanded && flyer}
          {topRow}
          {heading}
          {statusNote}
          {whenBlock}
          {directionsButton}
          {openNowButton}
        </div>
        {/* Below the fold: clipped to a faded peek until expanded. `inert`
            while clipped so Tab and screen readers can't reach hidden buttons;
            a tap still falls through to the wrapper's expand handler. */}
        <div
          id={detailSectionId}
          onClick={!expanded ? onRequestExpand : undefined}
          className={"relative px-5 pt-3 " + (expanded ? "" : "max-h-24 cursor-pointer overflow-hidden")}
        >
          <div className="flex flex-col gap-4" inert={!expanded}>
            {whereBlock}
            {aboutBlock}
            {bringBlock}
            {secondaryButtons}
            {linkBlock}
          </div>
          {!expanded && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-[var(--color-bone-50)]"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 p-4 ${className}`}>
      {flyer}
      {topRow}
      {heading}
      {statusNote}
      {whenBlock}
      {whereBlock}
      {aboutBlock}
      {bringBlock}
      {directionsButton}
      {openNowButton}
      {secondaryButtons}
      {linkBlock}
    </div>
  );
}
