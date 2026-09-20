"use client";

/**
 * BoxCardBody — the blessing-box body content rendered INSIDE the map's own
 * card family (BottomSheet on mobile, DesktopVenueWindow on desktop), not a
 * standalone page. Replaces the old full-page BoxContent.tsx (deleted) —
 * Kyle, 2026-09-18: "I want ... check in, submit a picture, all that stuff
 * ... to just happen on the map ... like a venue card, not take you to a
 * different page."
 *
 * Card redesign (2026-09-19, mockups v1-v3 in atlas-kb — see the atlas-kb
 * note "PFM AGENTS History — Blessing Boxes" for the as-built record;
 * AGENTS.md itself was cut to a 150-line cap on 2026-09-19 (#504) and no
 * longer carries this history inline).
 * `BoxCardBody` now owns the WHOLE card top to bottom — photo, status pill,
 * sponsor band, category badge, name, address-as-directions-link,
 * most-needed, host note, check-in panel, and a two-link footer — where it
 * previously started below a header the caller (BottomSheet/
 * DesktopVenueWindow) rendered. Consolidating ownership here (rather than
 * splitting name/badge/address between caller and component) is what lets
 * the photo sit truly full-bleed against each caller's own edge/corner
 * radius: `className` is an outer-wrapper passthrough (e.g. BottomSheet's
 * safe-area bottom padding) and `photoRadiusClassName` puts the top corner
 * radius on the `<img>` itself rather than adding `overflow-hidden` to a
 * caller's container (vaul's `Drawer.Content` deliberately has none — see
 * that component's own note on the drag-to-dismiss risk).
 *
 * `headingLevel` (default "h2") lets `BoxHistoryContent` ask for this card's
 * own name to render as the page's `<h1>` instead of duplicating a second
 * heading above it — see that component for the caller-side half of this.
 *
 * No orange "Directions" button, no Walk/Bus/Drive row — deviation from a
 * literal reading of the original task brief, resolved via `advisor()`
 * mid-build (2026-09-19). `DirectionButtons.tsx` (Walk/Bus/Drive) has
 * existed since PR #134, predating the Blessing Boxes epic; the atlas-kb
 * note above documents it being DELIBERATELY extended to box cards on
 * 2026-09-18. Mockup v3's own lede — "The orange button is gone in all
 * three [directions options]" — and Kyle's pick of option B (the address
 * text itself IS the link, no icon, no button) made clear the approved
 * design has no three-button row on a box card. Kyle then walked the
 * result and asked to KEEP the in-app walking route (2026-09-19, walk
 * restore pass): the address stays the one visible control (no icon, no
 * extra row) but now DOUBLES as that Walk trigger when a map is present.
 * `onWalkRoute` presence is the switch: absent (BoxHistoryContent, no map
 * to draw a route on) → the address is a plain external `<a>` to Google
 * Maps, unchanged from before. Present (BottomSheet/DesktopVenueWindow,
 * always forwarded from MapWrapper's own `handleWalkRoute`) → the address
 * is a `<button>` that fires the SAME callback, geolocation-request, and
 * location-hint behavior DirectionButtons' own Walk button uses for every
 * other venue, and the active-route readout (distance/duration, steps,
 * Clear route, Open in Google Maps) renders below it via
 * `DirectionButtons.tsx`'s exported `WalkRouteStatus` — extracted from that
 * file's own JSX (not duplicated) specifically so this restore could reuse
 * it byte-for-byte. The address `<a>`/`<button>` both build their href/
 * click target via `DirectionButtons.tsx`'s own exported `googleMapsUrl()`
 * (its `travelmode` param optional since the fix pass, item 4) — one URL
 * builder either way; the inactive/link form still omits travel mode
 * entirely (many visitors walk or ride the bus and Google Maps lets them
 * pick once it opens), while the active-route "Open in Google Maps" link
 * inside `WalkRouteStatus` uses "walking" (same as every ordinary venue's
 * own walk handoff). `MapWrapper.tsx`'s Walk-resume effect reading
 * `boxVenues` as a fallback target (previously dead code — see that
 * file's own comment) is live again now that a box can be the target of a
 * Walk tap that's still waiting on geolocation.
 *
 * Shows ONLY the box's current snapshot, never a list (Kyle, 2026-09-18
 * scope addition to the map-first rework): status + last filled, the single
 * MOST RECENT check-in text folded into the pill's "· filled {time}"
 * segment, most-needed, the host's public note, and the check-in panel. A
 * "History" link goes to /box/<id>/history for the full timeline.
 *
 * Two extension points from the map-first rework, both built:
 *   - the most-recent-PHOTO slot (slice 5, box_photos): renders
 *     box.box.latestPhoto when set, full-bleed with the status pill and a
 *     caption chip overlaid; falls back to an inline (non-overlaid) pill
 *     when there's no photo. "Report this photo" now lives in the check-in
 *     panel's quiet-links row (BoxCheckinPanel.tsx), not here.
 *   - a current-SPONSOR band (slice 6, box_adopters): ALWAYS renders,
 *     directly under the photo — "This box needs a sponsor" (no adopters
 *     yet) or "Sponsored by A[, B[, +N more]]" (one or more), each state
 *     carrying a "Want to help too?" / adopt link that expands
 *     AdoptBoxForm in place, controlled by this component's own
 *     `adoptOpen` state.
 */

import { useId, useState } from "react";
import Link from "next/link";
import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { formatRelativeTime } from "@/lib/relativeTime";
import BoxCheckinPanel from "@/components/BoxCheckinPanel";
import AdoptBoxForm from "@/components/AdoptBoxForm";
import BoxAlertSignupForm from "@/components/BoxAlertSignupForm";
import PhotoViewer from "@/components/PhotoViewer";
import { googleMapsUrl, WalkRouteStatus, type RouteInfo, type WalkStep } from "@/components/DirectionButtons";
import { categoryColors } from "@/data/venues";
import {
  STATUS_DOT_CLASS,
  STATUS_TEXT_CLASS,
  type BoxStatus,
  type CheckinKind,
  type PublicBlessingBox,
} from "@/lib/blessingBoxes";

interface BoxCardBodyProps {
  box: PublicBlessingBox;
  onCheckinSuccess?: (result: { status: BoxStatus; lastFilledAt: string | null; kind: CheckinKind }) => void;
  /** See this file's own header. Default true — hidden only where a caller already provides an equivalent link elsewhere (DesktopVenueWindow's header, the history page itself). */
  showHistoryLink?: boolean;
  /** Default "h2" — BoxHistoryContent passes "h1" so the card's own name serves as that page's page-level heading instead of a duplicate. */
  headingLevel?: "h1" | "h2";
  /** Outer-wrapper passthrough (e.g. BottomSheet's safe-area bottom padding). */
  className?: string;
  /** Corner-radius classes for the photo's own top edge — put on the <img> itself rather than a caller's overflow-hidden wrapper. Default "" (DesktopVenueWindow's container already clips via its own overflow-hidden). */
  photoRadiusClassName?: string;
  /** Rendered to the right of the name (Share/Favorite/Close, owned by the caller — different per caller, see BottomSheet/DesktopVenueWindow). */
  actions?: React.ReactNode;
  /** DOM id for the name heading (fix pass, 2026-09-19, BLOCKER). DesktopVenueWindow's outer `role="dialog"` points `aria-labelledby` at `venue-window-title-<id>` — before BoxCardBody owned the whole card, that id lived on a header-rendered heading; now it has to live on THIS component's own name heading, or the dialog's accessible name dangles (points at no element) for every box. Optional/undefined elsewhere (BottomSheet uses a Drawer.Title instead, and BoxHistoryContent's page has no such dialog role to satisfy). */
  nameId?: string;
  /**
   * In-app walking directions (walk restore pass, 2026-09-19) — see this
   * file's own header for the full rationale. Absent (default): the address
   * renders as a plain external `<a>` to Google Maps, exactly as before
   * (BoxHistoryContent's use — no map on that page to draw a route on).
   * Present: the address becomes a `<button>` that calls this on tap,
   * mirroring DirectionButtons' own Walk button (same callback contract the
   * caller already wires for ordinary venues — MapWrapper's
   * `handleWalkRoute`, which self-toggles off on a second tap for the same
   * venue, so this needs no separate "already active" branch here).
   */
  onWalkRoute?: () => void;
  /** True when a walking route for this box is currently drawn on the map. Drives the active-route readout below the address and the address's own aria-label. */
  isWalkRouteActive?: boolean;
  /** Renders the readout's standalone "Clear route" control (see WalkRouteStatus's own `onClearRoute` doc for why the box card needs this while ordinary venues don't — the address stays labeled as the address, never relabels to "Clear route"). */
  onClearWalkRoute?: () => void;
  /** Walking route distance + duration for the in-card readout (threaded from MapWrapper via BottomSheet/DesktopVenueWindow, same as DirectionButtons' own prop). */
  walkRouteInfo?: RouteInfo | null;
  /**
   * Turn-by-turn steps from Mapbox (pre-localized), same as DirectionButtons'
   * own prop — passed straight through to WalkRouteStatus below.
   */
  walkRouteSteps?: WalkStep[] | null;
  /** True when this box's Walk tap requested geolocation and it was denied or is unavailable (#207) — same as DirectionButtons' own prop. */
  showWalkLocationHint?: boolean;
  /** Which turn the step-through stepper is showing (#555) — same as WalkRouteStatus's own prop. */
  activeStepIndex?: number;
  /** Moves the stepper to a different turn (#555) — same as WalkRouteStatus's own prop. */
  onStepChange?: (index: number) => void;
}

/**
 * The status pill — a colored dot + the status word in its own semantic
 * color, then a neutral "· filled {time}" detail. Overlaid on the photo
 * (bone-50 chip, bottom-left) when there's a photo; a plain inline pill
 * (bone-100 background) otherwise.
 *
 * Fix pass (2026-09-19, item 2): the overlaid pill used to collide with the
 * caption chip (also bottom-right at the time) at 360-420px, worse with
 * longer Spanish/never-filled strings — two chips both trying to occupy the
 * photo's bottom edge with no shared width budget. The caption chip moved to
 * top-right (this component's photo block, below) so the two never compete
 * for the same corner; this pill ALSO gets its own width ceiling
 * (`max-w-[calc(100%-1.5rem)]`, leaving the photo's 12px side insets) so an
 * unusually long detail string can't push the pill past the photo's edge —
 * only the detail segment truncates (`truncate min-w-0`), never the status
 * word itself (`shrink-0` on the dot + word keeps them at their natural
 * width).
 */
function StatusPill({ box, locale, overlay }: { box: PublicBlessingBox; locale: Locale; overlay: boolean }) {
  const status = box.box.status;
  // "unknown" always shows the "no recent check-ins" detail, even if
  // lastFilledAt is set — computeLastFilledAt has no 7-day window, so a box
  // last filled weeks ago can still read "unknown" today; pairing that
  // stale timestamp with an "Unknown" status word would read as a
  // contradiction ("Unknown · filled 3 weeks ago").
  const detail =
    status === "unknown"
      ? t("box.status.unknown.detail", locale)
      : box.box.lastFilledAt
        ? t("box.lastFilled", locale, { time: formatRelativeTime(box.box.lastFilledAt, locale) })
        : t("box.lastFilled.never", locale);
  return (
    <div
      data-testid="box-status-badge"
      className={
        overlay
          // pointer-events-none (#508): this badge is non-interactive text
          // sitting on top of the photo's own "view full size" button —
          // without it, a tap landing on the pill's bounding box would hit
          // this div instead of the button underneath.
          ? "pointer-events-none absolute left-3 bottom-3 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full bg-[var(--color-bone-50)] px-3 py-1.5 text-sm font-semibold shadow-sm"
          : "inline-flex w-fit items-center gap-2 rounded-full bg-[var(--color-bone-100)] px-3 py-1.5 text-sm font-semibold"
      }
    >
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT_CLASS[status]}`} aria-hidden="true" />
      <span className={`shrink-0 ${STATUS_TEXT_CLASS[status]}`}>{t(`box.status.${status}`, locale)}</span>
      <span className="min-w-0 truncate font-normal text-[var(--color-ink-500)]">· {detail}</span>
    </div>
  );
}

/** "Sponsored by A", "A and B", or "A, B +N more" — mockup v2/v3's own three states, always paired with a "Want to help too?" / adopt-application link. */
function formatSponsorNames(names: string[], locale: Locale): React.ReactNode {
  if (names.length === 1) return <strong className="font-semibold">{names[0]}</strong>;
  if (names.length === 2) {
    return (
      <>
        <strong className="font-semibold">{names[0]}</strong> {t("box.sponsor.and", locale)}{" "}
        <strong className="font-semibold">{names[1]}</strong>
      </>
    );
  }
  return (
    <>
      <strong className="font-semibold">{names[0]}</strong>, <strong className="font-semibold">{names[1]}</strong>{" "}
      {t("box.sponsor.moreCount", locale, { count: String(names.length - 2) })}
    </>
  );
}

export default function BoxCardBody({
  box,
  onCheckinSuccess,
  showHistoryLink = true,
  headingLevel = "h2",
  className = "",
  photoRadiusClassName = "",
  actions,
  nameId,
  onWalkRoute,
  isWalkRouteActive = false,
  onClearWalkRoute,
  walkRouteInfo = null,
  walkRouteSteps = null,
  showWalkLocationHint = false,
  activeStepIndex = 0,
  onStepChange = () => {},
}: BoxCardBodyProps) {
  const { locale } = useLocale();
  const [adoptOpen, setAdoptOpen] = useState(false);
  // #508: full-size photo lightbox, opened from the card photo button below.
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  // Per-instance id for the "share your location" hint (#207) — shared with
  // WalkRouteStatus's own <p id>, same reasoning as DirectionButtons' own
  // identical field. Always called (Rules of Hooks) even in link mode
  // (onWalkRoute absent); unused in that branch.
  const walkLocationHintId = useId();
  const hasPhoto = box.box.latestPhoto != null;
  const hasSponsors = box.box.adopters.length > 0;
  const mostNeededChips = box.box.mostNeeded
    ? box.box.mostNeeded
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  // Needs ask (migration 0012) — the admin-typed line above always wins
  // when set; the self-filling visitor-sourced list only ever shows when
  // there's no admin text at all (task spec: "if the box's admin-typed
  // most_needed is set — show it exactly as today (admin wins)").
  const neededFromVisitors = mostNeededChips.length === 0 ? (box.box.neededFromVisitors ?? []) : [];
  const NameTag = headingLevel;

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Photo, full-bleed, with the status pill and (when there's a photo)
          a caption chip overlaid. No photo -> a plain inline pill instead —
          never a placeholder image. */}
      {hasPhoto ? (
        <div className="relative">
          {/* #508: the photo is a button that opens PhotoViewer full-screen
              — the alt text (name + relative time) IS the photo's
              accessible description; the button's own label just states
              the action ("View photo full size"), same separation of
              concerns as any other icon-only trigger on this card. */}
          <button
            type="button"
            onClick={() => setPhotoViewerOpen(true)}
            aria-label={t("box.photo.viewFullSize", locale)}
            className="block w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a runtime, R2-backed image via our own serve route, not a build-time/static asset next/image can optimize */}
            <img
              src={`/api/public/box-photos/${box.box.latestPhoto!.id}`}
              alt={t("box.photo.altText", locale, {
                name: box.name,
                time: formatRelativeTime(box.box.latestPhoto!.createdAt, locale),
              })}
              className={`block h-[170px] w-full object-cover bg-[var(--color-bone-200)] ${photoRadiusClassName}`}
            />
          </button>
          <StatusPill box={box} locale={locale} overlay />
          {/* Caption chip moved to top-right (fix pass, item 2) — see
              StatusPill's own header for why it used to collide with the
              status pill sharing the bottom edge. pointer-events-none: the
              chip overlays the photo BUTTON above, and per #508's own risk
              note this chip must not block the tap that opens the viewer. */}
          <div className="pointer-events-none absolute right-3 top-3 max-w-[calc(100%-1.5rem)] rounded-full bg-[var(--color-bone-50)] px-3 py-1.5 shadow-sm">
            <span className="block truncate text-xs font-medium text-[var(--color-ink-500)]">
              {t("box.photo.caption", locale, { time: formatRelativeTime(box.box.latestPhoto!.createdAt, locale) })}
            </span>
          </div>
          <PhotoViewer
            src={`/api/public/box-photos/${box.box.latestPhoto!.id}`}
            alt={t("box.photo.altText", locale, {
              name: box.name,
              time: formatRelativeTime(box.box.latestPhoto!.createdAt, locale),
            })}
            caption={t("box.photo.caption", locale, { time: formatRelativeTime(box.box.latestPhoto!.createdAt, locale) })}
            open={photoViewerOpen}
            onClose={() => setPhotoViewerOpen(false)}
            locale={locale}
          />
        </div>
      ) : (
        <div className="px-4 pt-3">
          <StatusPill box={box} locale={locale} overlay={false} />
        </div>
      )}

      <div className="flex flex-col gap-3 px-4 pb-1">
        {/* Sponsor band — always present, one of two states, always carrying
            the adopt-application link. */}
        <div
          className={`-mx-4 px-4 py-2.5 text-sm ${
            hasSponsors
              ? "bg-[var(--color-sage-50)] text-[var(--color-sage-700)]"
              : "bg-[var(--color-clay-100)] text-[var(--color-clay-700)]"
          }`}
        >
          <p>
            {hasSponsors ? (
              <>
                {t("box.sponsor.sponsoredByPrefix", locale)}
                {formatSponsorNames(box.box.adopters, locale)}
              </>
            ) : (
              t("box.sponsor.needsSponsor", locale)
            )}
          </p>
          <p className="mt-0.5 text-xs">
            {t("box.sponsor.wantToHelp", locale)}
            <button
              type="button"
              aria-expanded={adoptOpen}
              onClick={() => setAdoptOpen((open) => !open)}
              className="inline-flex min-h-[44px] items-center font-medium underline underline-offset-2"
            >
              {t("box.adopt.linkLabel", locale)}
            </button>
          </p>
        </div>
        <AdoptBoxForm boxId={box.id} open={adoptOpen} onOpenChange={setAdoptOpen} />

        {/* Badge + actions, then name (#515 fix pass, 2026-09-19): the name
            used to share ONE flex row with the actions (badge+name stacked
            in a `min-w-0` column, actions `shrink-0` beside it), which
            capped the name's wrap width at that column's flex-computed
            width — roughly two-thirds of the card — even though the space
            under the actions sat empty. Splitting into two rows lets the
            name run the card's full width; the badge stays visually
            anchored to the same line as the actions (`items-center`) since
            that pairing was never the problem. */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className="inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold text-[var(--color-bone-50)]"
              style={{ backgroundColor: categoryColors[box.category] }}
            >
              {t("category.full.blessing_box", locale)}
            </span>
            {actions && <div className="flex shrink-0 items-center gap-0.5">{actions}</div>}
          </div>
          <NameTag
            id={nameId}
            className="text-xl font-normal leading-tight text-[var(--color-ink-900)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {box.name}
          </NameTag>
        </div>

        {/* Address — the text itself is the directions link/trigger (mockup
            v3, option B — Kyle's pick, no icon, no button row). See this
            file's own header for the full walk-restore rationale.
            `onWalkRoute` absent (BoxHistoryContent, no map on that page):
            plain external `<a>` to Google Maps, NO preset travelmode (fix
            pass, item 4) — many box visitors walk or ride the bus, so
            Google Maps itself lets the person pick a mode once it opens.
            `onWalkRoute` present (BottomSheet/DesktopVenueWindow): a
            `<button>` that starts the SAME in-app walking route
            DirectionButtons' own Walk button does — same style as the link
            (underlined sage text, no icon, min-h 44px) so the card looks
            identical either way; the visible text always stays the address
            itself (never relabels to "Clear route" — see WalkRouteStatus's
            own `onClearRoute` doc for why a box needs a separate clear
            control instead of DirectionButtons' relabel-the-trigger
            pattern). Both forms prefix the aria-label with the visible
            address text (WCAG 2.5.3 label-in-name) — a screen-reader/
            voice-control user saying "click <the address>" must find a
            match inside the accessible name. */}
        <div className="-mt-2 flex flex-col items-start">
          {onWalkRoute ? (
            <button
              type="button"
              onClick={onWalkRoute}
              aria-describedby={showWalkLocationHint ? walkLocationHintId : undefined}
              aria-label={`${box.address} — ${t("directions.walkAriaLabel", locale, { name: box.name })}`}
              className="inline-flex min-h-[44px] w-fit items-center text-sm font-medium text-[var(--color-sage-600)] underline underline-offset-2 hover:text-[var(--color-sage-700)]"
            >
              {box.address}
            </button>
          ) : (
            <a
              href={googleMapsUrl(box.lat, box.lng)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${box.address} — ${t("directions.boxAriaLabel", locale, { name: box.name })}`}
              className="inline-flex min-h-[44px] w-fit items-center text-sm font-medium text-[var(--color-sage-600)] underline underline-offset-2 hover:text-[var(--color-sage-700)]"
            >
              {box.address}
            </a>
          )}
          {onWalkRoute && (
            <WalkRouteStatus
              venue={box}
              locale={locale}
              isRouteActive={isWalkRouteActive}
              routeInfo={walkRouteInfo}
              walkSteps={walkRouteSteps}
              showLocationHint={showWalkLocationHint}
              locationHintId={walkLocationHintId}
              onClearRoute={onClearWalkRoute}
              activeStepIndex={activeStepIndex}
              onStepChange={onStepChange}
            />
          )}
        </div>

        {/* Most needed — admin-typed text wins when set; the self-filling
            visitor-sourced list (migration 0012) only renders when it
            isn't (see neededFromVisitors' own computation above). */}
        {mostNeededChips.length > 0 && (
          <div>
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">
              {t("box.mostNeeded", locale)}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {mostNeededChips.map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-[var(--color-bone-100)] px-2.5 py-1 text-sm text-[var(--color-ink-700)]"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
        {neededFromVisitors.length > 0 && (
          <div>
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">
              {t("box.mostNeeded.fromVisitors", locale)}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {neededFromVisitors.map(({ key, count }) => (
                <span
                  key={key}
                  className="rounded-full bg-[var(--color-bone-100)] px-2.5 py-1 text-sm text-[var(--color-ink-700)]"
                >
                  {t(`box.needs.${key}`, locale)} <span className="text-[var(--color-ink-400)]">· {count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Host's public note only — no host NAME, no "Host" heading (item 4
            of the card redesign spec: the public host name and heading are
            removed entirely; the note, when set, is a plain quiet line). */}
        {box.box.hostNote && <p className="text-sm text-[var(--color-ink-500)]">{box.box.hostNote}</p>}

        {/* Check-in panel — status trio, took/photo row, quiet report links */}
        <BoxCheckinPanel
          boxId={box.id}
          onCheckinSuccess={(result) => onCheckinSuccess?.(result)}
          latestPhotoId={box.box.latestPhoto?.id ?? null}
        />

        <div className="h-px bg-[var(--color-bone-200)]" />

        {/* Footer — ONLY History + email-me-when-it-needs-filling */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium">
          {showHistoryLink && (
            <Link
              href={`/box/${encodeURIComponent(box.id)}/history`}
              className="inline-flex min-h-[44px] items-center text-[var(--color-sage-600)] underline underline-offset-2 hover:text-[var(--color-sage-700)]"
            >
              {t("box.history.link", locale)}
            </Link>
          )}
          <BoxAlertSignupForm boxId={box.id} />
        </div>
      </div>
    </div>
  );
}
