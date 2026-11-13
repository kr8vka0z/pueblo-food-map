"use client";

/**
 * BottomSheet v6 (#923) — the phone card
 * sheet, Maps-style (#666 grab bar).
 *
 * Two containers:
 *   - every card, no route: ScrollSheet.tsx, whose movement is the browser's
 *     own scrolling with CSS scroll snap at the resting heights, so one swipe
 *     grows the sheet and then keeps scrolling the details with native
 *     momentum (see that file's header for why and how);
 *   - a walking route on (#509): the vaul drawer as before, strip / full card.
 *
 * A boolean `expanded` with two resting heights plus closed:
 *   collapsed: the card's first view plus the top of the detail section at
 *              the screen edge (the "peek": 64px for a place, 96 for a box or
 *              event, the detail section's `data-peek-px`)
 *   expanded:  fully open, leaving MAP_PEEK_PX of map above it
 *
 * The grab bar is a real 48×48 `<button>` named Show details / Hide details
 * with `aria-expanded`. The sheet coming to rest, a tap on the bar, a tap on
 * the peek, "Read more" and the tour's `forceExpanded` all drive the SAME
 * `expanded` state. The detail section is ALWAYS mounted (`inert` while
 * collapsed), so the tests assert `aria-expanded` rather than visibility.
 *
 * A blessing-box card gets the SAME bar, but its own reordered layout (#667),
 * `layout="sheet"` on `BoxCardBody` below.
 *
 * Three dismissal paths:
 *   1. Escape key (ScrollSheet's document capture listener; vaul's
 *      `onEscapeKeyDown` in route mode) — #527: gated on
 *      `claimEscape()`, so Escape with a
 *      higher overlay open on top of this sheet (Filters, the Menu) no
 *      longer ALSO closes the card underneath — see overlayRegistry.ts.
 *      `claimEscape`, not a plain `isTopmostOverlay` check: real-browser
 *      review of #604 found that a same-keydown microtask checkpoint between
 *      listeners can pop the true topmost overlay off the stack (its own
 *      close committing) BEFORE a lower listener for the SAME event runs —
 *      `claimEscape` marks the Event object itself as spoken for, so a
 *      later listener is rejected regardless of what the stack looks like
 *      by then. See overlayRegistry.ts's own header on `claimEscape`.
 *   2. Swipe down from the collapsed card (ScrollSheet: the sheet scrolled
 *      to its closed position, or a slow pull past 100px). There is no scrim,
 *      and a tap on the map behind the sheet does not close it.
 *   3. The close button: since #882 hidden on the phone until it gets keyboard
 *      focus (HIDDEN_UNTIL_FOCUS), so keyboard and screen-reader users keep it
 *      as a dismiss path.
 *
 * Route strip (#509, walk-route standard for every venue card): starting a
 * walking route (a box's address tap, or an ordinary place's Walk button —
 * both call the SAME `walk.onWalk`) shrinks this sheet to a short `RouteStrip`
 * instead of leaving the full card covering the map. It has its own two snap
 * points (full card / strip), never v2's three-point content-swapping drag.
 * `dismissible={false}` while a route is active is what makes vaul rest at the strip instead of closing on
 * a drag-down (vaul's own contract: with snapPoints + dismissible=false,
 * dragging down from the lowest snap point is a no-op — see vaul's
 * `onDrag`/`noCloseSnapPointsPreCondition`); the same flag also blocks
 * Escape/scrim from fully dismissing while a route is active (vaul's
 * `onOpenChange` short-circuits on `!dismissible && !open` before it ever
 * reaches OUR `handleOpenChange`) — handled below by collapsing to the
 * strip instead of doing nothing on Escape, so it isn't a dead key. Only the
 * explicit × button (an imperative `onClose()` call, never routed through
 * vaul's dismissible gate) still closes everything, unchanged.
 *
 * Starting or clearing a route swaps the container (ScrollSheet ⇄ vaul), so
 * each mode mounts fresh: the shrink-to-strip transition is a fresh open (a
 * slide-in), not a morph of the outgoing full card.
 */

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Drawer } from "vaul";
import { X } from "lucide-react";
import type { Venue } from "@/types/venue";
import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";
import { HIDDEN_UNTIL_FOCUS } from "@/lib/interactionStyles";
import { isNativeDialogOpen } from "@/lib/dialogGuard";
import { claimEscape, useOverlayStackId } from "@/lib/overlayRegistry";
import type { Resting } from "@/lib/sheetSnap";
import ScrollSheet, { MAP_PEEK_PX } from "@/components/ScrollSheet";
import FavoriteButton from "@/components/FavoriteButton";
import ShareButton from "@/components/ShareButton";
import VenueCardBody from "@/components/VenueCardBody";
import { displayAddress } from "@/lib/venueSummary";
import type { Walk } from "@/lib/useWalkingRoute";
import RouteStrip, { ROUTE_STRIP_HEIGHT_PX } from "@/components/RouteStrip";
import type { BoxStatus, CheckinKind, PublicBlessingBox } from "@/lib/blessingBoxes";
import type { PublicEventDetail } from "@/lib/events";
import { eventText } from "@/lib/eventCard";
import type { EventHere } from "@/components/EventHereLine";

// The special-event card (#759) loads only when an event is opened, so a
// visitor who never taps an event pin downloads none of it.
const EventCardBody = dynamic(() => import("@/components/EventCardBody"), { ssr: false });

/** "Loading…" line shown while the box record or the box card's code is on its way. */
function BoxCardLoading({ locale: localeProp }: { locale?: Locale }) {
  // The dynamic() fallback below gets no props, so it reads the context locale
  // (the same value MapWrapper passes down as BottomSheet's `locale`).
  const { locale: ctxLocale } = useLocale();
  const locale = localeProp ?? ctxLocale;
  return (
    <div className="px-5 pt-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <p className="text-sm text-[var(--color-ink-500)]">{t("box.cardLoading", locale)}</p>
    </div>
  );
}

// #721: the box card (check-in, adopt, photo resize, Turnstile) loads only
// when a box is opened, so a visitor who never taps a box downloads none of
// it. Module-level on purpose: a dynamic() made inside render would be a new
// component each render and remount the card, wiping a half-typed check-in.
// No `ssr: false`: this sheet only ever renders inside the client-only
// MapWrapper, and ssr:false would show "Loading…" for a frame on EVERY box
// open (it waits for a mount effect), not just the first.
const BoxCardBody = dynamic(() => import("@/components/BoxCardBody"), {
  loading: () => <BoxCardLoading />,
});

// MAP_PEEK_PX (#549, ScrollSheet.tsx): the map left showing above the fully
// open sheet; the route strip's snap point below must add it back in.
// The close slide (smooth scroll, or vaul's 0.5s in route mode); the held card is dropped a little after.
const SHEET_CLOSE_MS = 600;
// vaul's px snapPoints can't use calc() — a literal string, computed once.
// #549: this is ROUTE_STRIP_HEIGHT_PX + MAP_PEEK_PX, not ROUTE_STRIP_HEIGHT_PX
// alone — see the `style` prop below for why the map peek has to be added
// back in on top of the strip's own height for vaul's snap math to land on
// a strip that's actually ROUTE_STRIP_HEIGHT_PX tall on screen.
const ROUTE_STRIP_SNAP = `${ROUTE_STRIP_HEIGHT_PX + MAP_PEEK_PX}px`;
// The "full card" snap point — 100% of the drawer's own (fixed, see the
// `height` style swap below) height.
const FULL_CARD_SNAP = 1;

// ─── Props ───────────────────────────────────────────────────────────────────

interface BottomSheetProps {
  venue: (Venue & { distanceMiles?: number }) | null;
  /**
   * A special event's card (#759) instead of a place's: mutually exclusive with
   * `venue` (MapWrapper keeps one selection at a time). Same sheet, grab bar
   * and dismissal paths; only the body differs.
   */
  event?: PublicEventDetail | null;
  /** The visitor's real position for the event card's distance line, or null. */
  userLocation?: { lat: number; lng: number } | null;
  /** Event card, ended/cancelled: "See places open now". */
  onSeeOpenNow?: () => void;
  /** An upcoming/live event tied to this place (#759): one line that opens its card. */
  eventHere?: EventHere | null;
  /**
   * Full blessing-box record when `venue.category === "blessing_box"` —
   * `venue` itself only carries the plain-Venue fields every marker uses
   * (see toVenue in useBoxesList.ts), so the box-specific card body
   * (status, host note, most-needed, check-ins) needs this separately.
   * `null`/`undefined` while MapWrapper's box fetch hasn't resolved yet —
   * BoxCardBody isn't rendered until it has (see the render below).
   */
  box?: PublicBlessingBox | null;
  /** Forwarded to BoxCardBody's check-in panel — MapWrapper patches its cached box record so the card stays current after close/reopen. */
  onCheckinSuccess?: (result: { status: BoxStatus; lastFilledAt: string | null; kind: CheckinKind }) => void;
  onClose: () => void;
  /** Called when expanded state changes — e.g. to hide overlapping UI when expanded. */
  onExpandedChange?: (expanded: boolean) => void;
  /**
   * Guided tour (#159) only: while set, the card is held expanded (true) or
   * collapsed (false) so the tour can point at a box's below-the-fold
   * buttons. Undefined (the normal case) leaves the grab bar in charge.
   */
  forceExpanded?: boolean;
  /**
   * Guided tour (#159): the tour shows a card here but nothing on it may be
   * pressed, by any means. `inert` also stops a screen reader's double-tap,
   * which reaches the button directly: the tour's tap-catching layer only
   * blocks hit-tested taps, and vaul never passes modal={false} to Radix.
   */
  inert?: boolean;
  /** Override locale for testing. If omitted, reads from LocaleContext. */
  locale?: Locale;
  /** Walking directions for this card (useWalkingRoute's walkFor). Absent: no Walk route (Walk does nothing, a box address stays a plain link). */
  walk?: Walk;
}

// ─── BottomSheet ─────────────────────────────────────────────────────────────

export default function BottomSheet({
  venue: venueProp,
  event: eventProp = null,
  userLocation = null,
  onSeeOpenNow = () => {},
  eventHere: eventHereProp = null,
  box: boxProp,
  onCheckinSuccess,
  onClose,
  onExpandedChange,
  forceExpanded,
  inert,
  locale: localeProp,
  walk,
}: BottomSheetProps) {
  const { locale: ctxLocale } = useLocale();
  const locale = localeProp ?? ctxLocale;
  const isWalkRouteActive = walk?.isActive ?? false;
  const [expanded, setExpanded] = useState(false);

  // ── Hold the last card while vaul animates closed (#882 preview feedback) ──
  // Closing clears the selection, so venue/event arrive null the moment a
  // close starts. Rendering that null emptied the card in one frame (and the
  // parent used to remount the sheet), so the swipe-down/×/Escape close had
  // nothing to slide away and "disappeared super fast". `open` follows the
  // props; what the card SHOWS is the last non-null selection, held until
  // vaul's onAnimationEnd(false) says the slide-off has finished, then
  // dropped so nothing closed stays in the tree.
  const open = venueProp !== null || eventProp !== null;
  const [held, setHeld] = useState({ venue: venueProp, event: eventProp, box: boxProp, eventHere: eventHereProp });
  if (
    open &&
    (held.venue !== venueProp || held.event !== eventProp || held.box !== boxProp || held.eventHere !== eventHereProp)
  ) {
    // React's "adjust state while rendering" pattern: tracks the live selection, never lags it.
    setHeld({ venue: venueProp, event: eventProp, box: boxProp, eventHere: eventHereProp });
  }
  const shown = open ? { venue: venueProp, event: eventProp, box: boxProp, eventHere: eventHereProp } : held;
  const venue = shown.venue;
  const event = shown.event ?? null;
  const box = shown.box;
  const eventHere = shown.eventHere ?? null;
  function handleAnimationEnd(isOpen: boolean) {
    if (!isOpen) setHeld({ venue: null, event: null, box: undefined, eventHere: null });
  }
  // vaul only reports onAnimationEnd for closes IT starts (a swipe, Escape);
  // a close from the parent (the × button, the tour) changes the `open` prop
  // and never reaches it. So also drop the held card once vaul's 0.5s slide
  // is surely over.
  useEffect(() => {
    if (open) return;
    const timer = setTimeout(() => setHeld({ venue: null, event: null, box: undefined, eventHere: null }), SHEET_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [open]);

  // ── Expanded state ───────────────────────────────────────────────────────
  // One function, one state — vaul settling on a snap point, the grab bar's
  // tap, the peek's tap and "Read more" all funnel through this so
  // `expanded`/`onExpandedChange` never have a second writer.
  function setExpandedState(next: boolean) {
    setExpanded((prev) => {
      if (next === prev) return prev;
      onExpandedChange?.(next);
      return next;
    });
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a prop-driven override, applied when it changes
    if (forceExpanded !== undefined) setExpandedState(forceExpanded);
    // setExpandedState is a plain function re-made per render; the override is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceExpanded]);
  // Shared by the grab bar's aria-controls and the detail section it points
  // at — one literal id, not two, because box and ordinary-venue detail
  // sections are mutually exclusive within a single BottomSheet instance
  // (never both rendered at once), so there's no real collision risk in
  // reusing it as BoxCardBody's own below-the-fold section id too.
  const DETAIL_SECTION_ID = "bottomsheet-detail";

  // ── Card mode: the native scroll sheet (ScrollSheet.tsx, #923) ──────────
  // The sheet's movement is the browser's own scrolling; ScrollSheet reports
  // where it came to rest and follows `expanded` when the grab bar, the peek,
  // "Read more" or the tour change it. One measured resting height (a short
  // card, or a first view taller than the sheet): every card body is laid out
  // as expanded and the grab bar, which would toggle nothing, is drawn but
  // disabled (see the bar below).
  const [singleSnap, setSingleSnap] = useState(false);
  function handleRest(resting: Resting) {
    if (resting === "closed") onClose();
    else setExpandedState(resting === "full");
  }
  function requestExpand() {
    setExpandedState(true);
  }
  function toggleExpanded() {
    setExpandedState(!expanded);
  }
  const cardExpanded = expanded || singleSnap;
  // Route mode (vaul) scrolls its own inner scroller; in card mode the whole
  // track scrolls, so the inner wrapper must NOT be a scroll container or the
  // hand-off from moving the sheet into scrolling the card is lost.
  const scrollerClass = isWalkRouteActive ? "flex-1 overscroll-contain overflow-y-auto" : "";

  // ── Route strip (#509) ──────────────────────────────────────────────────
  // cardRevealed: true = full card showing, false = strip. Defaults to the
  // OPPOSITE of isWalkRouteActive at first render — if a BottomSheet ever
  // mounts with a route already active (deep link, or this exact prop
  // combination in a test), it should open straight to the strip, matching
  // "starting a route shows the strip" instead of needing a follow-up render
  // to catch up.
  //
  // prevRouteActive + the render-time comparison below is React's own
  // "adjusting state when a prop changes" pattern (not a useEffect) — it
  // reacts ONLY on an actual isWalkRouteActive transition, not every
  // re-render, so tapping "Show card" isn't immediately fought by a
  // re-render that still sees isWalkRouteActive=true. Doing this as a
  // useEffect (setState inside an effect body) is exactly what
  // MapWrapper.tsx's own walking-route-clear effect works around with
  // queueMicrotask (see that file's own comment) — the render-time variant
  // has no such rule to satisfy since it isn't in an effect at all.
  const [cardRevealed, setCardRevealed] = useState(!isWalkRouteActive);
  const [prevRouteActive, setPrevRouteActive] = useState(isWalkRouteActive);
  if (isWalkRouteActive !== prevRouteActive) {
    setPrevRouteActive(isWalkRouteActive);
    // Route just started -> strip (cardRevealed=false). Route just cleared
    // -> always back to the full card (cardRevealed=true), regardless of
    // whether the strip or the full card was showing when it cleared.
    setCardRevealed(!isWalkRouteActive);
  }

  // #527: registers this sheet into the shared overlay-escape stack (see
  // overlayRegistry.ts's own header) so `onEscapeKeyDown` below can tell
  // whether a higher overlay (Filters, the Menu) is open on top of it.
  // Vaul/Radix routes Escape through this prop rather than a `document`
  // listener this file could add itself — `useOverlayEscape` isn't usable
  // here for that reason; `claimEscape` is called directly instead.
  const overlayId = useOverlayStackId(open);
  const isBox = venue?.category === "blessing_box";
  const showStrip = isWalkRouteActive && !cardRevealed;
  // #666/#667: the grab bar needs SOMETHING to expand into. An ordinary
  // venue always has a detail section; a box only once its record has
  // actually loaded (the `box.cardLoading` fallback below has no content to
  // peek at, so it keeps today's no-bar behavior rather than a bar that
  // toggles nothing).
  const showGrabBar = (venue !== null || event !== null) && !showStrip && (!isBox || box != null);

  // ── Pieces shared by both containers ─────────────────────────────────────
  // Grab bar (#666): a real 48×48 button. A tap toggles; in card mode a drag
  // that starts on it is just the sheet's own scroll (no click fires). Sits
  // OUTSIDE the card body so it never scrolls away (ScrollSheet pins it).
  const grabBar = showGrabBar && (
          // One resting height (a card whose first view fills the sheet, which a
          // blessing box's check-in does on a real phone): the bar toggles
          // nothing, so the button is disabled and hidden from screen readers,
          // but it stays DRAWN. It is still the handle a swipe down closes the
          // sheet from, and Kyle saw box cards without it while places had it
          // (#917 round 3). It keeps its space either way: removing it moved
          // the content up, which changed the measurement back to two heights,
          // which brought the bar back: a render loop ("Maximum update depth",
          // iOS simulator). `pointer-events-none` while disabled: a touch on the
          // bar then lands on the sheet itself, so the swipe down still scrolls
          // the track (a disabled control may swallow touch events in some
          // browsers, and ScrollSheet needs the touchstart/touchend).
          <div className="flex shrink-0 justify-center pt-2 pb-1" aria-hidden={singleSnap || undefined}>
            <button
              type="button"
              disabled={singleSnap}
              aria-expanded={expanded}
              aria-controls={DETAIL_SECTION_ID}
              aria-label={t(expanded ? "detail.hideDetails" : "detail.showDetails", locale)}
              onClick={toggleExpanded}
              className={
                "flex h-12 w-12 items-center justify-center rounded-md " +
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
                PRESS_FEEDBACK +
                (singleSnap ? " pointer-events-none" : "")
              }
            >
              <span aria-hidden className="h-[5px] w-10 rounded-full bg-[var(--color-bone-300)]" />
            </button>
          </div>
        );

  const cardBody = (
    <>
          {venue && showStrip && (
            // #509: strip replaces the full card entirely while a route is
            // active and not revealed — same `walk` object (onWalk /
            // onClear) contract every card branch below
            // already wires, so RouteStrip needs no knowledge of box vs
            // ordinary venue.
            <RouteStrip
              venueName={venue.name}
              routeInfo={walk?.info ?? null}
              locale={locale}
              onShowCard={() => setCardRevealed(true)}
              onClearRoute={walk?.onClear}
              walkSteps={walk?.steps}
              activeStepIndex={walk?.activeStepIndex}
              onStepChange={walk?.onStepChange}
            />
          )}
    
          {event && !venue && (
            // Special-event card (#759). Same scroller as the place card
            // below, so the swipe/overscroll behavior (#553) is identical.
            <div data-sheet-scroller="" className={scrollerClass}>
              {/* data-sheet-content: see "Maps-style sheet" — the persistent, measured wrapper. */}
              <div data-sheet-content="">
                <EventCardBody
                  event={event}
                  locale={locale}
                  userLocation={userLocation}
                  headingId={`event-card-title-${event.id}`}
                  onClose={onClose}
                  onSeeOpenNow={onSeeOpenNow}
                  layout="sheet"
                  expanded={cardExpanded}
                  onRequestExpand={requestExpand}
                  detailSectionId={DETAIL_SECTION_ID}
                  closing={!open}
                  className="pb-[max(1rem,env(safe-area-inset-bottom))]"
                />
              </div>
            </div>
          )}
    
          {venue && !showStrip && (
            // `overscroll-contain` (#553): without it, a downward drag that
            // starts inside this scroller while it is already at scrollTop 0
            // CHAINS to the document, and iOS Safari rubber-bands the entire
            // page — measured off Kyle's 2026-09-20 screen recording as the
            // header, map and card all translating down together by ~104 CSS
            // px and springing back, four times in four swipe-down attempts.
            // `modal={false}` on Drawer.Root above means vaul never applies
            // its body scroll-lock, so nothing else stops that chain.
            // ListView's own scroller has carried this since it was written.
            //
            // NOT the toolbar-resize residual documented on `snapPoints`
            // above. The structural tell is that the MAP moved too, and that
            // residual can only re-animate the sheet, never the map behind
            // it. Corroborating but secondary, and true of one recording on
            // one device rather than proven in general: Safari's bottom
            // toolbar held a constant screen position in every frame of that
            // clip, so no resize appears to have fired.
            <div data-sheet-scroller="" className={scrollerClass}>
              <div data-sheet-content="">
              {isBox ? (
                box ? (
                  // Card-redesign (2026-09-19): BoxCardBody now owns the
                  // WHOLE box card — photo, sponsor band, badge, name,
                  // address-as-directions-link, most-needed, host note,
                  // check-in panel, footer — not just the content below a
                  // caller-rendered header (see that component's own
                  // header). No px-5/pt-5 padding wrapper here: the photo
                  // needs to sit flush against the sheet's own
                  // rounded-t-xl top edge, so BoxCardBody pads its own body
                  // internally and only the photo itself stays full-bleed.
                  <BoxCardBody
                    box={box}
                    onCheckinSuccess={onCheckinSuccess}
                    className="pb-[max(1rem,env(safe-area-inset-bottom))]"
                    photoRadiusClassName="rounded-t-[var(--radius-xl)]"
                    // #667: the mobile-only reordered layout — name/status/
                    // address/most-needed/host-note/check-in first, photo +
                    // sponsor band + footer clipped below the fold. `expanded`
                    // is THIS component's own grab-bar state (single source
                    // of truth); `onRequestExpand` is the preview's own tap-
                    // to-expand affordance (#666 accessibility section:
                    // "tapping the cut-off preview also expands").
                    layout="sheet"
                    expanded={cardExpanded}
                    onRequestExpand={requestExpand}
                    detailSectionId={DETAIL_SECTION_ID}
                    walk={walk}
                    actions={
                      <>
                        <ShareButton venueId={venue.id} venueName={venue.name} locale={locale} size={20} isBox />
                        <FavoriteButton venueId={venue.id} venueName={venue.name} locale={locale} size={20} />
                        <button
                          type="button"
                          onClick={onClose}
                          aria-label={t("detail.close", locale)}
                          className={
                            // #882: hidden on the phone (the sheet closes by swiping
                            // down), shown on keyboard focus; same as the venue header's.
                            HIDDEN_UNTIL_FOCUS + " flex items-center justify-center w-12 h-12 rounded-md " +
                            "text-[var(--color-ink-500)] hover:bg-[var(--color-sage-100)] transition-colors " +
                            PRESS_FEEDBACK + " " +
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
                          }
                        >
                          <X size={18} aria-hidden />
                        </button>
                      </>
                    }
                  />
                ) : (
                  <BoxCardLoading locale={locale} />
                )
              ) : (
                <VenueCardBody
                  venue={venue}
                  variant="sheet"
                  locale={locale}
                  walk={walk}
                  eventHere={eventHere}
                  onClose={onClose}
                  expanded={cardExpanded}
                  onRequestExpand={requestExpand}
                  detailSectionId={DETAIL_SECTION_ID}
                />
              )}
              </div>
            </div>
          )}
        </>
  );

  if (!isWalkRouteActive) {
    return (
      <ScrollSheet
        open={open}
        expanded={expanded}
        onRest={handleRest}
        onSingleChange={setSingleSnap}
        onEscape={(e) => {
          // #508: a box photo open: Escape closes only the photo.
          if (isNativeDialogOpen()) return;
          // #527/#604: a higher overlay (Filters, the Menu) takes this Escape.
          if (!claimEscape(overlayId, e)) return;
          onClose();
        }}
        detailId={DETAIL_SECTION_ID}
        contentKey={venue?.id ?? event?.id ?? "empty"}
        // The event card moves focus to its own heading (EventCardBody).
        focusName={!event || venue !== null}
        inert={inert}
        label={
          venue
            ? `${venue.name} ${t("detail.venueDetails", locale)}`
            : event
              ? eventText(event.name, event.name_es, locale)
              : t("detail.venueDetailsPanel", locale)
        }
        // Same OSM placeholder guard as the visible address line (#590).
        description={
          venue
            ? `${t(`category.full.${venue.category}`, locale)}, ${displayAddress(venue)}`
            : event
              ? event.address
              : t("detail.venueDetailsPanel", locale)
        }
        header={grabBar}
      >
        {cardBody}
      </ScrollSheet>
    );
  }

  function handleOpenChange(isOpen: boolean) {
    // Route mode is not dismissible, so only the × closes; kept for safety.
    if (!isOpen) onClose();
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Drawer.Root
      open={open}
      onOpenChange={handleOpenChange}
      onAnimationEnd={handleAnimationEnd}
      modal={false}
      // #530 review round 3 (BLOCKER, invisible to every test here — every
      // BottomSheet test mocks vaul): vaul defaults `repositionInputs` to
      // true, which listens for visualViewport resize (the keyboard
      // opening/closing) and writes an inline `drawerRef.current.style
      // .bottom` — and never clears it (vaul/dist/index.mjs's own
      // onVisualViewportChange effect, ~line 1153). BoxCheckinPanel (inside
      // this sheet via BoxCardBody) has real input/textarea fields, so
      // focusing one fires that effect; an inline style always outranks
      // globals.css's `[data-bottom-sheet]` rule for the life of the
      // instance, and after the keyboard closes vaul leaves it at literally
      // `bottom: 0px` — reintroducing the exact #530 slice bug in the check-
      // in flow. `repositionInputs={false}` turns the whole effect off at
      // its own early-return guard. Safe here: nothing in this sheet is a
      // bottom-docked input relying on vaul's keyboard-avoidance resize —
      // BoxCheckinPanel's fields sit in the sheet's own normal scrollable
      // flow (`overflow-y-auto`), which the browser's native
      // focus-scroll-into-view already handles.
      repositionInputs={false}
      dismissible={false}
      // #530 review round 3 (IMPORTANT, KNOWN RESIDUAL, not fixed here):
      // vaul's useSnapPoints measures `window.innerHeight` for these two px
      // snap points (unless a `container` prop is passed to Drawer.Root)
      // and re-runs snapToPoint — an ANIMATED transform — on every window
      // resize (vaul/dist/index.mjs ~lines 517-524, 540-548, 608-613). iOS
      // Safari fires a resize event when its toolbar collapses/expands on
      // scroll, so the route strip (or full card, while a route is active)
      // can still visibly re-animate to a new snapped position mid-scroll —
      // in tension with this issue's "must not jump" criterion, though it's
      // a smooth transition rather than an instant cut.
      //
      // Considered passing a `container` element sized from
      // `var(--viewport-small)` to make vaul's own size reference stable.
      // Rejected: `container` is ALSO handed straight to `Drawer.Portal`
      // as its React-portal render target (defaults from context — see
      // vaul's `Portal()`) and flips `data-vaul-custom-container`, which
      // disables vaul's own `::after` background-fill rule for the
      // rubber-band overscroll area. Fixing this one animation would mean
      // relocating where the sheet portals to AND losing its overscroll
      // background fill — both unverifiable here (every BottomSheet test
      // mocks vaul; there's no real Safari touch/drag/overscroll rig on
      // this machine) and each a plausible regression of its own. Left as
      // a known residual rather than trading one unverified bug for two.
      // Route mode: strip / full card (#509).
      snapPoints={[ROUTE_STRIP_SNAP, FULL_CARD_SNAP]}
      activeSnapPoint={cardRevealed ? FULL_CARD_SNAP : ROUTE_STRIP_SNAP}
      setActiveSnapPoint={(point) => setCardRevealed(point === FULL_CARD_SNAP)}
    >
      <Drawer.Portal>
        <Drawer.Content
          key={venue?.id ?? event?.id ?? "empty"}
          // Closing (`!open`): the held card is still sliding away; nothing on it may take focus or be read.
          inert={inert || !open || undefined}
          // #530 review round 2: no `bottom-0` Tailwind class — Safari's own
          // toolbar was slicing the sheet's resting edge off the same way it
          // sliced BottomNav's pill (root cause: a `position:fixed`
          // element's containing block is always sized to the LARGE
          // viewport, as if the toolbar were collapsed, so a literal
          // `bottom: 0` lands under the toolbar once it's actually
          // expanded). `data-bottom-sheet` hooks the real `bottom` value —
          // see globals.css's own comment for the formula and why it never
          // jumps as the toolbar animates.
          data-bottom-sheet=""
          data-sheet-surface=""
          className={
            "fixed left-0 right-0 z-[800] flex flex-col " +
            "bg-[var(--color-bone-50)] " +
            "rounded-t-[var(--radius-xl)] " +
            "elevation-2 " +
            "focus:outline-none"
          }
          // A route-active sheet needs a FIXED height (not maxHeight) for
          // vaul's px snap point math to land where expected — snapPointsOffset
          // is computed against the drawer's actual rendered height (see
          // vaul's useSnapPoints), so a content-hugging maxHeight would put
          // the "104px from the bottom" strip snap partway through whatever
          // content happens to render, not at a real fixed strip. Same numeric
          // value as the non-route maxHeight, so the full-card view (snap
          // FULL_CARD_SNAP) looks the same size as before; the one visible
          // change is that the full-card view is now a fixed height rather
          // than hugging its (usually shorter) content while a route is
          // active — accepted trade-off, only while a route is active.
          // #549: vaul computes a px snap point's transform offset as
          // `offset = window.innerHeight - snapPx` (vaul/dist/index.mjs
          // ~line 540). For a drawer with `bottom: S` and `height: H`, the
          // resulting visible height at that snap is
          //   visible = S + H - window.innerHeight + snapPx
          // — which only equals `snapPx` (the strip's own height) when
          // `S + H === window.innerHeight`. This drawer's `bottom` is
          // `env(safe-area-inset-bottom)` (0 on the test device), so H alone
          // has to equal window.innerHeight, or the strip snap lands short
          // (partly or fully off-screen — this issue's bug).
          // `var(--viewport-small)` (100svh, #530's fix, kept below for the
          // NON-route branch) is deliberately SHORTER than innerHeight — it
          // is pinned to the smallest possible viewport specifically so a
          // bottom-pinned bar never resizes as Safari's toolbar animates —
          // so using it here under-sizes H by however much svh trails
          // innerHeight, and vaul's math pushes the strip that far off the
          // bottom edge. `100dvh` tracks the CURRENT viewport instead, which
          // Kyle measured equal to `window.innerHeight` on the real device
          // in both toolbar states (iOS 26, 2026-09-20: Safari 714/714,
          // Chrome 683/683) — exactly the reference vaul's snap math needs.
          // KNOWN RESIDUAL, honestly stated because an unmeasured claim in a
          // comment here hardens into fact for the next agent: this trades
          // #530's "never jumps" property for correctness at rest, and the
          // trade is not free. `100svh` was chosen in #530 precisely because
          // it is INVARIANT through the toolbar animation, so it could never
          // desync from anything. `100dvh` is the opposite — it tracks the
          // toolbar continuously, while vaul's own `innerHeight` is cached
          // and refreshed only on a `window` resize event (index.mjs
          // ~518-527). If iOS Safari doesn't fire resize continuously through
          // that animation, the two references can drift apart mid-scroll and
          // the strip can visibly move, which is the artifact #530 set out to
          // kill. Kyle's measurement proves the two are EQUAL once the
          // toolbar settles (both states, both browsers) — it says nothing
          // about the frames in between, and jsdom cannot test it.
          //
          // Accepted anyway, because the alternative is strictly worse, not
          // merely different: on `--viewport-small` the strip was wrong AT
          // REST by however far svh trails innerHeight (12px visible instead
          // of 112, or fully off-screen with the toolbar collapsed). A
          // possible transient wobble during a toolbar animation beats a
          // permanently unreachable control. Note also that vaul ALREADY
          // re-animates to a new snapped position on every resize (see the
          // `snapPoints` prop's own comment above) — a mid-scroll transition
          // is pre-existing here, not introduced by this unit change.
          // If a real device shows the strip jumping while scrolling with a
          // route up, the next thing to try is vaul's `container` prop, which
          // replaces `window.innerHeight` as its size reference outright —
          // read that same comment first for the two side effects that
          // carries.
          //
          // The 100px map peek is carved out of H and added back into the
          // snap point instead (MAP_PEEK_PX, folded into ROUTE_STRIP_SNAP
          // above) — that keeps the drawer's resting top edge a constant
          // MAP_PEEK_PX below the window top in both toolbar states, and
          // the strip's own visible height pinned at exactly
          // ROUTE_STRIP_HEIGHT_PX regardless of toolbar collapse.

          style={{ height: `calc(100dvh - ${MAP_PEEK_PX}px - env(safe-area-inset-bottom))` }}
          aria-label={t("detail.venueDetailsPanel", locale)}
          // #508 fix pass: Escape while a box's PhotoViewer is open must
          // close ONLY the photo, not this whole sheet. vaul forwards this
          // prop straight through to Radix's DismissableLayer, which only
          // dismisses `if (!event.defaultPrevented)` — see dialogGuard.ts's
          // own header for why this is the one race-free interception
          // point (Radix's Escape listener is a document-level CAPTURE
          // listener; nothing inside the photo dialog can out-race it).
          onEscapeKeyDown={(event) => {
            if (isNativeDialogOpen()) {
              event.preventDefault();
              return;
            }
            // #527/#604: a higher overlay (Filters, the Menu) is open on top
            // of this sheet — block vaul's own dismiss so Escape doesn't
            // close BOTH; the topmost overlay's own Escape handling (a
            // separate, bubble-phase `document` listener — this prop is
            // Radix's CAPTURE-phase interception point, see dialogGuard.ts's
            // header) still runs for the same keydown and closes itself
            // instead. `claimEscape`, not a bare `isTopmostOverlay` check —
            // see overlayRegistry.ts's own header on why a plain topmost
            // check isn't race-free across a single keydown's multiple
            // listeners in a real browser.
            if (!claimEscape(overlayId, event)) {
              event.preventDefault();
              return;
            }
            // #509: dismissible={false} while a route is active means vaul's
            // own onOpenChange short-circuits Escape (and scrim-tap) before
            // it ever reaches handleOpenChange above — silently blocking
            // BOTH would make Escape a dead key with a route active. Collapse
            // to the strip instead (same outcome as a drag-down), so Escape
            // still does something; only the full card can be collapsed —
            // pressing it again while the strip is already showing is a
            // no-op (nothing further to collapse to except closing, which
            // stays × ‑only per the issue's "unchanged" close behavior).
            if (cardRevealed) {
              event.preventDefault();
              setCardRevealed(false);
            }
          }}
        >
          {/* Drawer.Title — required by Radix to fix a11y missing-title violation */}
          <Drawer.Title className="sr-only">
            {venue
              ? `${venue.name} ${t("detail.venueDetails", locale)}`
              : event
              ? eventText(event.name, event.name_es, locale)
              : t("detail.venueDetailsPanel", locale)}
          </Drawer.Title>

          {/* Drawer.Description (#590 follow-up): vaul's Drawer.Content forwards
              straight to Radix's Dialog.Content, which logs "Missing
              `Description` or `aria-describedby={undefined}` for {DialogContent}"
              whenever one isn't wired via context — confirmed live (agent-browser
              console) firing here, not on the splash, when a venue card opens.
              Reuses the category badge's own existing copy (`category.full.*`,
              already EN+ES, rendered visibly below at the badge) rather than
              adding new strings — same principle as #590's splash fix: point at
              real content, don't invent hidden copy. Rendered unconditionally
              (like Drawer.Title above) so every branch — box, ordinary venue,
              route-strip-only, no venue yet — has SOME description, never a
              dangling reference.
              Same OSM placeholder guard as the visible address line
              (venueSummary.ts's displayAddress) — a screen reader must never hear the literal "Address not in
              OpenStreetMap" string either. */}
          <Drawer.Description className="sr-only">
            {venue
              ? `${t(`category.full.${venue.category}`, locale)}, ${displayAddress(venue)}`
              : event
              ? event.address
              : t("detail.venueDetailsPanel", locale)}
          </Drawer.Description>

          {/* Grab bar (#666): a real 48×48 button. Since #882 a drag that
              starts on it is vaul's snap-point drag like anywhere else on the
              sheet (it used to be `data-vaul-no-drag` with its own swipe
              handler); a tap toggles, unless it ends a drag (`justDragged`).
              Sits OUTSIDE the scrollable body below so it never scrolls away, matching every
              iOS/Android sheet's own fixed-handle convention. #122's old
              "no drag handle, a grabber wrongly implies swipe" note is
              exactly what #666 reverses — Kyle's own comparison of four
              mockups picked the Maps-app bar specifically because the cut-off
              preview (rendered inside the scrollable body below) now tells
              people there's more, so a real handle no longer lies about what
              it does. */}
          {grabBar}
          {cardBody}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
