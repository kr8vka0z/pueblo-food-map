"use client";

/**
 * EventCardBody — the promotional card for one special event (#759, umbrella
 * #156), rendered INSIDE the map's two existing card shells the way
 * BoxCardBody is: BottomSheet on a phone (`layout="sheet"`) and the desktop
 * side panel (`layout="panel"`, via EventPanel). Loaded lazily by both, so a
 * visitor who never opens an event pays nothing for it.
 *
 * Order, top to bottom (owner-approved redesign #882, which replaced #759's
 * order): flyer slot, status badge, name, "Hosted by", When, About (cut to 3
 * lines with "Read more"), the green action button, then Where (venue name in
 * bold above the address), a highlighted "What to bring" box, Share + Add to
 * calendar, and the large orange Get directions button LAST. The flyer (#760)
 * is EventFlyer: absent when the event has none or it fails to load, and the
 * card is complete without it. On the phone it sits at the top of the
 * below-the-fold section (see "Phone").
 *
 * Phone: the sheet's first, always-visible view is the badge, name, When,
 * About (3 lines) and the action button; in `layout="sheet"` the flyer /
 * Where / What to bring / Share / Calendar / Get directions follow in the
 * below-the-fold section, which keeps its full height and sits under the
 * screen edge while collapsed (the sheet slides on vaul snap points, #882;
 * same grab-bar mechanics as the box card, #666/#667). The flyer is the one
 * phone/desktop order difference: above the badge it pushed the badge and
 * name down mid-swipe (#882 preview feedback).
 *
 * About: clamped to 3 lines so the action button stays in the phone's first
 * view at 360px. "Read more" shows only when the text is actually cut, and is
 * the ONLY thing that unclamps it: expanding the sheet (swipe, grab bar) keeps
 * it at 3 lines (#882 preview feedback). On a collapsed sheet "Read more" also
 * expands the sheet; collapsing clamps it again. About unclamps at once and
 * the sheet slides to its new fully-open height (BottomSheet re-measures).
 *
 * Action button (#882, replaces the old "More information" link): full-width
 * sage-600 fill, white label, the site name under it in sage-100 (5.25:1 on
 * the fill), a chevron at the end. Wording, icon key and site name come from
 * eventAction() (eventCard.ts), shared with the event page and calendar file.
 * It renders wherever the old link did, ended or cancelled cards included.
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
 * HTML), and the action button only renders if safeUrl() says http(s).
 *
 * Preview (#883, `preview`): the public "Share an event" page renders this
 * same card from the form's current values, before the event exists. Empty
 * fields show grey placeholder text instead of disappearing; the action
 * button and Get directions show faded and do nothing until there is a link /
 * an address; no close button, badge-less until there are valid times, and
 * none of the things that need a real event (Share, Add to calendar, "See
 * places open now"). Directions never link in a preview: there is no pin yet.
 * Default rendering (preview off) is unchanged.
 *
 * Directions reuse src/lib/googleMapsUrl.ts (one URL builder, no travel
 * mode so the visitor picks); distance reuses haversineMiles/formatMiles.
 * Orange + navy on the button is the same owner approval as the event pin
 * (DESIGN.md) and clears contrast (7.8:1).
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CalendarPlus,
  Check,
  ChevronRight,
  CircleCheck,
  ClipboardCheck,
  Globe,
  HandHelping,
  Heart,
  MapPin,
  Navigation,
  Share2,
  Ticket,
  X,
  type LucideIcon,
} from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { googleMapsUrl } from "@/lib/googleMapsUrl";
import { formatMiles, haversineMiles } from "@/lib/distance";
import { EVENT_LINK_LABELS, type EventLinkLabel } from "@/lib/adminEventValidation";
import { eventAction, eventBadge, eventText, eventWhen, localizeEvent } from "@/lib/eventCard";
import { downloadEventCalendar } from "@/lib/eventCalendar";
import EventFlyer from "@/components/EventFlyer";
import type { PublicEventDetail } from "@/lib/events";
import { eventSecondaryButton, HIDDEN_UNTIL_FOCUS, PRESS_FEEDBACK } from "@/lib/interactionStyles";
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
  /** "sheet" only — the sheet is sliding closed with this card still showing; return focus now. */
  closing?: boolean;
  className?: string;
  /** The public "Share an event" live preview (#883): placeholders for empty fields, see header. */
  preview?: boolean;
}

const SECONDARY_BUTTON = eventSecondaryButton("flex-1");

const SECTION_HEADING = "mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]";

const ACTION_ICONS: Record<EventLinkLabel, LucideIcon> = {
  website: Globe,
  signup: ClipboardCheck,
  tickets: Ticket,
  rsvp: CircleCheck,
  volunteer: HandHelping,
  donate: Heart,
  custom: Globe,
};

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
  closing = false,
  className = "",
  preview = false,
}: EventCardBodyProps) {
  const now = useMinuteClock();
  const text = localizeEvent(event, locale);
  const cancelled = event.status === "cancelled";
  // A preview with no valid times yet has no badge and no When; it still shows as upcoming.
  const timeless = preview && !(Date.parse(event.ends_at) > Date.parse(event.starts_at));
  const badge = eventBadge(event, now, locale);
  const active = !cancelled && (timeless || badge.phase !== "ended");
  const when = timeless ? null : eventWhen(event, locale);
  const action = eventAction(event, locale);
  const placeholder = (key: string) => <span className="italic text-[var(--color-ink-400)]">{t(`events.card.preview.${key}`, locale)}</span>;
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
  // `closing`: the sheet keeps this card on screen while it slides away
  // (#882), so focus goes back when the close STARTS, not when it unmounts.
  useEffect(() => {
    if (!isSheet || closing) return;
    document.getElementById(headingId)?.focus({ preventScroll: true });
    return () => {
      const el = returnFocusRef.current;
      if (el?.isConnected) queueMicrotask(() => el.focus({ preventScroll: true }));
    };
  }, [isSheet, headingId, closing]);

  // ── About clamp ───────────────────────────────────────────────────────────
  // Clamped until "Read more" (sheet and panel alike). "Read more" only
  // appears when the clamp actually cuts text.
  // ponytail: measured once per text/clamp change, not on resize — the card's
  // width is fixed per device; a rotated phone keeps the first answer.
  // Only "Read more" opens it, on the sheet too (#882 preview feedback: a
  // swipe up to see the rest of the card must not also unclamp About).
  // Collapsing the sheet clamps it again, so the next swipe up shows it clamped.
  const [aboutOpen, setAboutOpen] = useState(false);
  const [prevExpanded, setPrevExpanded] = useState(expanded);
  if (expanded !== prevExpanded) {
    setPrevExpanded(expanded);
    if (isSheet && !expanded) setAboutOpen(false);
  }
  const aboutClamped = !aboutOpen;
  const aboutRef = useRef<HTMLParagraphElement | null>(null);
  // Whether the text runs past 3 lines, measured only while clamped and kept
  // while open, so "Read more" appears/disappears in the SAME render as the
  // clamp flips. A second render would change the section's height after the
  // height animation below had already measured it, and end it with a jump.
  const [aboutOverflows, setAboutOverflows] = useState(false);
  useLayoutEffect(() => {
    const el = aboutRef.current;
    if (aboutClamped && el) setAboutOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [aboutClamped, text.description]);
  const aboutCut = aboutClamped && aboutOverflows;

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

  // ── Pieces ─────────────────────────────────────────────────────────────────
  const badgeClass = cancelled
    ? "border-[var(--color-clay-500)] bg-[var(--color-clay-100)] text-[var(--color-clay-700)]"
    : badge.phase === "live"
      ? // Louder than upcoming: filled navy, like the live pin label.
        "border-[var(--color-event-pin)] bg-[var(--color-event-outline)] text-[var(--color-bone-50)] font-bold"
      : badge.phase === "upcoming"
        ? "border-[var(--color-event-outline)] bg-[var(--color-bone-50)] text-[var(--color-event-outline)]"
        : "border-[var(--color-bone-300)] bg-[var(--color-bone-200)] text-[var(--color-ink-700)]";

  const topRow = preview && timeless ? null : (
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
      {!preview && (
        <button
          type="button"
          onClick={onClose}
          aria-label={t("events.card.closeAria", locale)}
          className={
            // #882: on the phone sheet it is hidden until keyboard focus (the sheet
            // closes by swiping down); the desktop panel keeps the visible ×.
            (isSheet ? HIDDEN_UNTIL_FOCUS + " " : "-mr-3 -mt-2 ") +
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-md " +
            "text-[var(--color-ink-500)] transition-colors hover:bg-[var(--color-bone-100)] touch-manipulation " +
            PRESS_FEEDBACK +
            " focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
          }
        >
          <X size={18} aria-hidden />
        </button>
      )}
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
        {text.name || (preview && placeholder("name"))}
      </h2>
      {text.host ? (
        <p className="mt-1 text-sm text-[var(--color-ink-500)]">{t("events.card.hostedBy", locale, { host: text.host })}</p>
      ) : (
        preview && <p className="mt-1 text-sm">{placeholder("host")}</p>
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
      {when ? (
        <>
          <p className="text-base font-semibold text-[var(--color-ink-900)]">{when.day}</p>
          <p className="text-sm text-[var(--color-ink-700)]">{when.time}</p>
        </>
      ) : (
        <p className="text-sm">{placeholder("when")}</p>
      )}
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
          {event.venue_name?.trim() && (
            <p className="text-sm font-semibold text-[var(--color-ink-900)]">{event.venue_name.trim()}</p>
          )}
          <p className="text-sm text-[var(--color-ink-700)]">{event.address || (preview && placeholder("where"))}</p>
          {distance && <p className="mt-0.5 font-mono text-xs text-[var(--color-ink-500)]">{distance}</p>}
        </div>
      </div>
    </section>
  );

  const aboutBlock = preview && !text.description ? (
    <section aria-labelledby={`${headingId}-about`}>
      <h3 id={`${headingId}-about`} className={SECTION_HEADING}>{t("events.card.about", locale)}</h3>
      <p className="text-sm">{placeholder("about")}</p>
    </section>
  ) : text.description ? (
    <section aria-labelledby={`${headingId}-about`}>
      <h3 id={`${headingId}-about`} className={SECTION_HEADING}>{t("events.card.about", locale)}</h3>
      <p
        ref={aboutRef}
        className={
          // pointer-events-none while clamped: on iOS Safari a flick that starts
          // on a box whose overflowing text is clipped never scrolls the sheet's
          // content (iOS simulator: a flick down on the clamped About stayed
          // put, the same flick on the text a line below scrolled). The touch
          // then lands on the section instead, which scrolls normally.
          "whitespace-pre-line text-sm leading-relaxed text-[var(--color-ink-700)]" +
          (aboutClamped ? " line-clamp-3 pointer-events-none" : "")
        }
      >
        {text.description}
      </p>
      {aboutCut && (
        <button
          type="button"
          onClick={() => {
            setAboutOpen(true);
            if (isSheet && !expanded) onRequestExpand?.();
          }}
          className={
            // The ::before strip takes the tap target to 48px without adding height to the first view.
            "relative mt-1 py-1 text-sm font-semibold text-[var(--color-sage-600)] underline underline-offset-2 " +
            "before:absolute before:inset-x-0 before:-inset-y-2.5 hover:text-[var(--color-sage-700)] touch-manipulation " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
          }
        >
          {t("events.card.readMore", locale)}
        </button>
      )}
    </section>
  ) : null;

  const ActionIcon = action ? ACTION_ICONS[action.kind] : null;
  // Ended/cancelled: hidden like Share and Calendar (Kyle, 2026-11-03), so it never stacks on "See places open now".
  // Preview with no link yet: the button's look, faded, with what to add instead of the site name.
  const previewKind = EVENT_LINK_LABELS.find((l) => l === event.link_label && l !== "custom") ?? "website";
  const PreviewIcon = ACTION_ICONS[previewKind];
  const actionButton =
    preview && active && !action ? (
      <div
        data-testid="event-action-placeholder"
        aria-hidden
        className="flex min-h-[60px] w-full items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-sage-600)] px-4 py-2 text-white opacity-45"
      >
        <PreviewIcon size={22} className="shrink-0" />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-base font-bold">
            {t(`events.card.action.${previewKind}`, locale)}
          </span>
          <span className="block truncate text-xs text-[var(--color-sage-100)]">{t("events.card.preview.link", locale)}</span>
        </span>
      </div>
    ) : active && action && ActionIcon ? (
      <a
        data-testid="event-action"
        href={action.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("events.card.actionAria", locale, { label: action.label, site: action.site })}
        className={
          "flex min-h-[60px] w-full items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-sage-600)] px-4 py-2 " +
          "text-white transition-colors hover:bg-[var(--color-sage-700)] touch-manipulation " +
          PRESS_FEEDBACK +
          " focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2"
        }
      >
        <ActionIcon size={22} aria-hidden className="shrink-0" />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-base font-bold">{action.label}</span>
          {/* sage-100 on sage-600 = 5.25:1. */}
          <span className="block truncate text-xs text-[var(--color-sage-100)]">{action.site}</span>
        </span>
        <ChevronRight size={18} aria-hidden className="shrink-0" />
      </a>
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

  const directionsButton = preview ? (
    active ? (
      <div
        data-testid="event-directions-preview"
        aria-hidden
        className={
          "flex min-h-14 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-event-pin)] " +
          "px-4 py-3 text-base font-bold text-[var(--color-event-outline)]" +
          (event.address ? "" : " opacity-45")
        }
      >
        <Navigation size={18} />
        {t("events.card.directions", locale)}
      </div>
    ) : null
  ) : active ? (
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

  const secondaryButtons = active && !preview ? (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button type="button" onClick={handleShare} className={SECONDARY_BUTTON}>
          {copied ? <Check size={16} aria-hidden /> : <Share2 size={16} aria-hidden />}
          {copied ? t("events.card.shareCopied", locale) : t("events.card.share", locale)}
        </button>
        <button type="button" onClick={() => downloadEventCalendar(event, locale)} className={SECONDARY_BUTTON}>
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

  const openNowButton = !active && !preview ? (
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

  // ── Layouts ────────────────────────────────────────────────────────────────
  if (isSheet) {
    return (
      <div className={`flex flex-col ${className}`}>
        {/* First view (always visible): badge, name, When, About (3 lines) and the action
            button. Nothing is inserted above the badge, so expanding never shifts it. */}
        <div className="flex flex-col gap-3 px-5 pt-2">
          {topRow}
          {heading}
          {statusNote}
          {whenBlock}
          {aboutBlock}
          {actionButton}
          {openNowButton}
        </div>
        {/* Below the fold. Since #882 the sheet slides (vaul snap points), so
            this keeps its full height (no clip, no fade) and collapsed just
            means it sits below the screen edge with `data-peek-px` showing.
            `inert` while collapsed so Tab and screen readers can't reach the
            half-shown buttons; a tap still falls through to the expand handler. */}
        <div
          id={detailSectionId}
          data-peek-px="96"
          onClick={!expanded ? onRequestExpand : undefined}
          className={"relative px-5 pt-3 " + (expanded ? "" : "cursor-pointer")}
        >
          <div className="flex flex-col gap-4" inert={!expanded}>
            {/* Phone: the flyer sits at the top of this section, not above the
                badge (#882 preview feedback: there it pushed the badge and
                name down mid-swipe). Always rendered, so nothing appears
                mid-motion; its box reserves the image's aspect ratio. */}
            {flyer}
            {whereBlock}
            {bringBlock}
            {secondaryButtons}
            {directionsButton}
          </div>
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
      {aboutBlock}
      {actionButton}
      {whereBlock}
      {bringBlock}
      {openNowButton}
      {secondaryButtons}
      {directionsButton}
    </div>
  );
}
