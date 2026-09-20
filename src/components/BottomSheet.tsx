"use client";

/**
 * BottomSheet v3 — vaul-based mobile-only sheet with boolean expanded toggle.
 *
 * Replaces the fragile three-snap-point model (v2) with desktop-parity:
 *   collapsed: venue summary — name, category badge, distance, hours-today,
 *              SNAP/WIC pills, two-line notes, Get directions, "Show details"
 *   expanded:  collapsed content + address, full hours table, phone, report
 *
 * vaul is kept as the drawer container for drag-to-dismiss, scrim, Escape,
 * and a11y Dialog.Title — but WITHOUT snapPoints.
 *
 * Three dismissal paths:
 *   1. Escape key (vaul handles natively via onOpenChange)
 *   2. Tap on scrim (vaul handles by default)
 *   3. Explicit close X button
 *
 * Route strip (#509, walk-route standard for every venue card): starting a
 * walking route (a box's address tap, or an ordinary place's Walk button —
 * both call the SAME `onWalkRoute`) shrinks this sheet to a short `RouteStrip`
 * instead of leaving the full card covering the map. This is the one place
 * v2's retired snap-point model comes back — but scoped ONLY to while a
 * route is active, and only ever between two points (full card / strip), not
 * v2's ambient three-point drag everywhere. `dismissible={false}` while a
 * route is active is what makes vaul rest at the strip instead of closing on
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
 * `key={isWalkRouteActive ? "route" : "card"}` on `Drawer.Root` remounts vaul
 * fresh across that transition rather than mutating `snapPoints`/`dismissible`
 * on a live instance — vaul's internal transform/offset state from the
 * pre-transition mode isn't guaranteed to reset otherwise (advisor()-reviewed
 * 2026-09-19). The trade-off: the shrink-to-strip transition is a fresh open
 * (a slide-in), not a morph of the outgoing full card — acceptable, and
 * simpler than vaul's snap-point internals to get provably right.
 */

import { useState } from "react";
import { Drawer } from "vaul";
import { X, ChevronUp, ChevronDown, MapPin, Phone, Clock, CircleHelp, ExternalLink } from "lucide-react";
import type { Venue } from "@/types/venue";
import { categoryColors } from "@/data/venues";
import { formatMiles } from "@/lib/distance";
import { computeOpenStatus } from "@/lib/hours";
import { getDisplayNotes } from "@/lib/venueNotes";
import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { safeUrl } from "@/lib/safeUrl";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";
import { isNativeDialogOpen } from "@/lib/dialogGuard";
import ReportVenueButton from "@/components/ReportVenueButton";
import FavoriteButton from "@/components/FavoriteButton";
import ShareButton from "@/components/ShareButton";
import HoursList from "@/components/HoursList";
import DirectionButtons, { type RouteInfo, type WalkStep } from "@/components/DirectionButtons";
import BoxCardBody from "@/components/BoxCardBody";
import RouteStrip, { ROUTE_STRIP_HEIGHT_PX } from "@/components/RouteStrip";
import type { BoxStatus, CheckinKind, PublicBlessingBox } from "@/lib/blessingBoxes";

// vaul's px snapPoints can't use calc() — a literal string, computed once.
const ROUTE_STRIP_SNAP = `${ROUTE_STRIP_HEIGHT_PX}px`;
// The "full card" snap point — 100% of the drawer's own (fixed, see the
// `height` style swap below) height.
const FULL_CARD_SNAP = 1;

// ─── Props ───────────────────────────────────────────────────────────────────

interface BottomSheetProps {
  venue: (Venue & { distanceMiles?: number }) | null;
  /**
   * Full blessing-box record when `venue.category === "blessing_box"` —
   * `venue` itself only carries the plain-Venue fields every marker uses
   * (see useBoxVenues.ts's own header), so the box-specific card body
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
  /** Override locale for testing. If omitted, reads from LocaleContext. */
  locale?: Locale;
  /** Called when the user taps the Walk direction button. MapWrapper fetches the route. */
  onWalkRoute?: (venue: Venue) => void;
  /** True when a walking route for this venue is currently drawn on the map. */
  isWalkRouteActive?: boolean;
  /** Called when the user taps Walk while a route is active (clears it). */
  onClearWalkRoute?: () => void;
  /** Walking route distance + duration for the in-card readout (threaded from MapWrapper). */
  walkRouteInfo?: RouteInfo | null;
  /** Turn-by-turn steps from Mapbox (pre-localized). Shown as a collapsible list in DirectionButtons. */
  walkRouteSteps?: WalkStep[] | null;
  /**
   * True when this venue's Walk tap requested geolocation and it was denied
   * or is unavailable (#207). Tells DirectionButtons to show the localized
   * "share your location" hint instead of silently doing nothing.
   */
  showWalkLocationHint?: boolean;
}

// ─── BottomSheet ─────────────────────────────────────────────────────────────

export default function BottomSheet({
  venue,
  box,
  onCheckinSuccess,
  onClose,
  onExpandedChange,
  locale: localeProp,
  onWalkRoute,
  isWalkRouteActive = false,
  onClearWalkRoute,
  walkRouteInfo,
  walkRouteSteps,
  showWalkLocationHint = false,
}: BottomSheetProps) {
  const { locale: ctxLocale } = useLocale();
  const locale = localeProp ?? ctxLocale;
  const [expanded, setExpanded] = useState(false);

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

  const open = venue !== null;
  const isBox = venue?.category === "blessing_box";
  const status = venue ? computeOpenStatus(venue.hours_weekly) : null;
  const displayNotes = venue ? getDisplayNotes(venue) : undefined;
  const showStrip = isWalkRouteActive && !cardRevealed;

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) onClose();
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Drawer.Root
      key={isWalkRouteActive ? "route" : "card"}
      open={open}
      onOpenChange={handleOpenChange}
      modal={false}
      dismissible={!isWalkRouteActive}
      snapPoints={isWalkRouteActive ? [ROUTE_STRIP_SNAP, FULL_CARD_SNAP] : undefined}
      activeSnapPoint={isWalkRouteActive ? (cardRevealed ? FULL_CARD_SNAP : ROUTE_STRIP_SNAP) : undefined}
      setActiveSnapPoint={(snap) => {
        if (!isWalkRouteActive) return;
        setCardRevealed(snap === FULL_CARD_SNAP);
      }}
    >
      <Drawer.Portal>
        <Drawer.Content
          key={venue?.id ?? "empty"}
          className={
            "fixed bottom-0 left-0 right-0 z-[800] flex flex-col " +
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
          // #530: `var(--viewport-small)` (globals.css), not the dynamic
          // viewport-height unit — that one tracks Safari's toolbar live as
          // it collapses/expands on scroll, so the sheet's own height would
          // resize (jump) mid-drag/scroll. The small viewport is invariant
          // across that animation.
          style={
            isWalkRouteActive
              ? { height: "calc(var(--viewport-small) - 100px)" }
              : { maxHeight: "calc(var(--viewport-small) - 100px)" }
          }
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
            // #509: dismissible={false} while a route is active means vaul's
            // own onOpenChange short-circuits Escape (and scrim-tap) before
            // it ever reaches handleOpenChange above — silently blocking
            // BOTH would make Escape a dead key with a route active. Collapse
            // to the strip instead (same outcome as a drag-down), so Escape
            // still does something; only the full card can be collapsed —
            // pressing it again while the strip is already showing is a
            // no-op (nothing further to collapse to except closing, which
            // stays × ‑only per the issue's "unchanged" close behavior).
            if (isWalkRouteActive && cardRevealed) {
              event.preventDefault();
              setCardRevealed(false);
            }
          }}
        >
          {/* Drawer.Title — required by Radix to fix a11y missing-title violation */}
          <Drawer.Title className="sr-only">
            {venue ? `${venue.name} ${t("detail.venueDetails", locale)}` : t("detail.venueDetailsPanel", locale)}
          </Drawer.Title>

          {/* Single scrollable body.
              No drag handle: the "Show details" button is the one expand
              affordance — a grabber bar wrongly implied swipe-to-expand (#122
              follow-up). vaul still allows swipe-down-to-dismiss on the content. */}
          {/* Card-redesign box actions slot (Share/Fav/Close) — one JSX
              constant so it's built once and handed to BoxCardBody's
              `actions` prop below, rather than duplicating this markup
              between the box and non-box branches. Same visual weight/
              position as the ordinary header row's own trio. */}
          {venue && showStrip && (
            // #509: strip replaces the full card entirely while a route is
            // active and not revealed — same trigger (onWalkRoute) and
            // onClearWalkRoute callback contract every card branch below
            // already wires, so RouteStrip needs no knowledge of box vs
            // ordinary venue.
            <RouteStrip
              venueName={venue.name}
              routeInfo={walkRouteInfo ?? null}
              locale={locale}
              onShowCard={() => setCardRevealed(true)}
              onClearRoute={onClearWalkRoute}
            />
          )}

          {venue && !showStrip && (
            <div className="flex-1 overflow-y-auto">
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
                    onWalkRoute={onWalkRoute ? () => onWalkRoute(box) : undefined}
                    isWalkRouteActive={isWalkRouteActive}
                    onClearWalkRoute={onClearWalkRoute}
                    walkRouteInfo={isWalkRouteActive ? walkRouteInfo : null}
                    walkRouteSteps={isWalkRouteActive ? walkRouteSteps : null}
                    showWalkLocationHint={showWalkLocationHint}
                    actions={
                      <>
                        <ShareButton venueId={venue.id} venueName={venue.name} locale={locale} size={20} isBox />
                        <FavoriteButton venueId={venue.id} venueName={venue.name} locale={locale} size={20} />
                        <button
                          type="button"
                          onClick={onClose}
                          aria-label={t("detail.close", locale)}
                          className={
                            "flex items-center justify-center w-11 h-11 " +
                            "-mt-1.5 -mb-1.5 -ml-1.5 -mr-[10px] rounded-md " +
                            "text-[var(--color-ink-500)] hover:bg-[var(--color-bone-100)] transition-colors " +
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
                  <div className="px-5 pt-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <p className="text-sm text-[var(--color-ink-500)]">{t("box.cardLoading", locale)}</p>
                  </div>
                )
              ) : (
              <div className="flex flex-col px-5 pt-5 pb-[max(1rem,env(safe-area-inset-bottom))] gap-3">
                {/* Header row: title + close */}
                <div className="flex items-start gap-2">
                  <h2
                    className="flex-1 text-xl font-normal text-[var(--color-ink-900)] leading-tight"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {venue.name}
                  </h2>
                  <ShareButton venueId={venue.id} venueName={venue.name} locale={locale} size={20} isBox={isBox} />
                  <FavoriteButton venueId={venue.id} venueName={venue.name} locale={locale} size={20} />
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label={t("detail.close", locale)}
                    className={
                      // 32px -> 44px hit area: box grows via width/height, negative
                      // margin on every side cancels the growth for flex-flow
                      // purposes (the -mr-1 that existed before is folded into the
                      // new -mr value), so the row's layout and the icon's visible
                      // position are unchanged (mobile review #11).
                      "flex items-center justify-center w-11 h-11 " +
                      "-mt-1.5 -mb-1.5 -ml-1.5 -mr-[10px] rounded-md " +
                      "text-[var(--color-ink-500)] hover:bg-[var(--color-bone-100)] transition-colors " +
                      PRESS_FEEDBACK + " " +
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
                    }
                  >
                    <X size={18} aria-hidden />
                  </button>
                </div>

                {/* Operator attribution */}
                {venue.operator && (
                  <p className="text-xs text-[var(--color-ink-500)] -mt-1">
                    {t("operator.operated_by", locale)}{" "}
                    <a
                      href="https://pueblofoodproject.org/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[var(--color-ink-700)] hover:text-[var(--color-sage-600)] transition-colors"
                    >
                      {venue.operator}
                    </a>
                  </p>
                )}

                {/* Category badge + SNAP/WIC pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium text-[var(--color-bone-50)]"
                    style={{ backgroundColor: categoryColors[venue.category] }}
                  >
                    <span className="w-2 h-2 rounded-full bg-white/40 shrink-0" aria-hidden />
                    {t(`category.full.${venue.category}`, locale)}
                  </span>
                  {venue.accepts_snap && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-sage-100)] text-[var(--color-sage-700)]">
                      {t("badge.snap", locale)}
                    </span>
                  )}
                  {venue.accepts_wic && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-sage-100)] text-[var(--color-sage-700)]">
                      {t("badge.wic", locale)}
                    </span>
                  )}
                </div>

                {/* Distance + hours today */}
                <div className="flex items-center gap-4 text-sm text-[var(--color-ink-500)]">
                  {venue.distanceMiles !== undefined && (
                    <span className="flex items-center gap-1.5">
                      <MapPin size={14} aria-hidden className="text-[var(--color-ink-400)]" />
                      {formatMiles(venue.distanceMiles)} {t("distance.fromYou", locale)}
                    </span>
                  )}
                  {/* Hours badges don't apply to a blessing box (it has no
                      hours_weekly) — BoxCardBody's own status badge covers
                      the equivalent "is it usable right now" read. */}
                  {!isBox && status && status.state !== "no_hours" && (
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} aria-hidden className="text-[var(--color-ink-400)]" />
                      {status.state === "open"
                        ? `${t("badge.openNow", locale)} · ${t("badge.closesAt", locale, { time: status.time })}`
                        : status.state === "opens_at"
                        ? t("badge.opensAt", locale, { time: status.time })
                        : t("badge.closedToday", locale)}
                    </span>
                  )}
                  {/* Board review finding #1: a "no_hours" venue now survives the
                      "Open now" filter instead of vanishing — this label is what
                      tells the user why there's no open/closed read, using a
                      different icon (not Clock) + explicit text so it's never
                      mistaken for "open" by shape alone, not just color. */}
                  {!isBox && status && status.state === "no_hours" && (
                    <span className="flex items-center gap-1.5 text-[var(--color-ink-700)] font-medium">
                      <CircleHelp size={14} aria-hidden className="text-[var(--color-ink-700)]" />
                      {t("badge.hoursUnknown", locale)}
                    </span>
                  )}
                </div>

                {/* Notes (2 lines max) — suppressed for OSM artifacts and
                    Plentiful's auto-generated boilerplate (src/lib/venueNotes.ts).
                    Also suppressed for a box — its host note renders inside
                    BoxCardBody instead, alongside the rest of the box-specific
                    content. */}
                {!isBox && displayNotes && (
                  <p className="text-sm text-[var(--color-ink-700)] leading-relaxed line-clamp-2">
                    {displayNotes}
                  </p>
                )}

                {/* Direction buttons (#134) — Walk (in-app route) / Bus / Drive.
                    routeInfo threads distance+duration down for the in-card readout.
                    walkSteps provides the collapsible turn-by-turn list.
                    Ordinary venues only as of the card redesign (2026-09-19)
                    — a box's own Walk trigger is the address text
                    BoxCardBody renders (walk restore pass, same day; see
                    that component's own header), not this three-button row,
                    so this branch is guaranteed non-box already. */}
                <DirectionButtons
                  venue={venue}
                  onWalk={onWalkRoute ?? (() => {})}
                  locale={locale}
                  isRouteActive={isWalkRouteActive}
                  onClearRoute={onClearWalkRoute}
                  routeInfo={isWalkRouteActive ? walkRouteInfo : null}
                  walkSteps={isWalkRouteActive ? walkRouteSteps : null}
                  showLocationHint={showWalkLocationHint}
                />

                {/* Show/Hide details toggle */}
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls="bottomsheet-detail"
                  onClick={() => {
                    setExpanded((v) => {
                      const n = !v;
                      onExpandedChange?.(n);
                      return n;
                    });
                  }}
                  className={
                    // ~20px tall -> real padding growth (mobile review #8: this is
                    // the ONLY way to expand the sheet). Type size/color untouched.
                    "flex items-center gap-1.5 py-1.5 text-sm font-medium text-[var(--color-sage-600)] " +
                    "hover:text-[var(--color-sage-700)] " +
                    PRESS_FEEDBACK + " " +
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
                    "rounded text-left"
                  }
                >
                  {expanded ? (
                    <>
                      {t("detail.hideDetails", locale)}
                      <ChevronUp size={16} aria-hidden />
                    </>
                  ) : (
                    <>
                      {t("detail.showDetails", locale)}
                      <ChevronDown size={16} aria-hidden />
                    </>
                  )}
                </button>

                {/* Expanded detail section */}
                <div id="bottomsheet-detail">
                  {expanded && (
                    <div className="flex flex-col gap-4 pt-1">
                      {/* Address — guard: never render "Address not in OpenStreetMap" placeholder */}
                      <div className="flex gap-2.5">
                        <MapPin size={16} className="text-[var(--color-ink-400)] shrink-0 mt-0.5" aria-hidden />
                        <div>
                          <p className="text-sm text-[var(--color-ink-700)]">
                            {venue.address === "Address not in OpenStreetMap"
                              ? `${venue.lat}, ${venue.lng}`
                              : venue.address}
                          </p>
                          {venue.distanceMiles !== undefined && (
                            <p className="text-sm text-[var(--color-ink-400)] font-mono mt-0.5">
                              {formatMiles(venue.distanceMiles)} {t("distance.fromYou", locale)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* SNAP/WIC detail badges */}
                      {(venue.accepts_snap || venue.accepts_wic) && (
                        <div className="flex flex-wrap gap-2">
                          {venue.accepts_snap && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-[var(--color-sage-100)] text-[var(--color-sage-700)]">
                              {t("detail.acceptsSnap", locale)}
                            </span>
                          )}
                          {venue.accepts_wic && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-[var(--color-sage-100)] text-[var(--color-sage-700)]">
                              {t("detail.acceptsWic", locale)}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Full weekly hours table — today highlighted + aria-current */}
                      {venue.hours_weekly && (
                        <section aria-label={t("detail.hours", locale)}>
                          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-2">
                            {t("detail.hours", locale)}
                          </h3>
                          <HoursList
                            hours_weekly={venue.hours_weekly}
                            compact={false}
                          />
                        </section>
                      )}

                      {/* Phone / Contact */}
                      {venue.phone && (
                        <section aria-label={t("detail.contact", locale)}>
                          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)] mb-2">
                            {t("detail.contact", locale)}
                          </h3>
                          <a
                            href={`tel:${venue.phone}`}
                            className="flex items-center gap-2.5 text-sm text-[var(--color-ink-700)] hover:text-[var(--color-sage-600)] transition-colors"
                          >
                            <Phone size={15} className="text-[var(--color-ink-400)]" aria-hidden />
                            {venue.phone}
                          </a>
                        </section>
                      )}

                      {/* See full details on Plentiful (#128) — Plentiful-sourced venues only */}
                      {/* safeUrl: venue.url comes from OSM (anyone can edit); reject non-http(s) */}
                      {venue.source.toLowerCase().includes("plentiful") && safeUrl(venue.url) && (
                        <a
                          href={safeUrl(venue.url)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={
                            "flex items-center justify-between gap-2 w-full px-4 py-3 " +
                            "rounded-[var(--radius-md)] border border-[var(--color-sage-300)] " +
                            "bg-[var(--color-sage-50)] text-sm font-medium text-[var(--color-sage-700)] " +
                            "hover:bg-[var(--color-sage-100)] transition-colors " +
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
                          }
                        >
                          <span>{t("detail.plentifulLink", locale)}</span>
                          <ExternalLink size={15} className="shrink-0" aria-hidden />
                        </a>
                      )}

                      {/* Report venue */}
                      <ReportVenueButton venueId={venue.id} locale={locale} />
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
