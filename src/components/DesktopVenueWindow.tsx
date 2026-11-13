"use client";

/**
 * DesktopVenueWindow — the venue/box card content for desktop (≥768px).
 *
 * One state (#732, Kyle 2026-10-24): on a computer the card always shows
 * the full details — the old Show/Hide details toggle and its collapsed copy
 * of the card are gone. A pinned top, then a scrollable body: VenueCardBody
 * (variant "panel") for an ordinary venue, BoxCardBody for a blessing box.
 *
 * Pinned top (#917, DESIGN.md R4 and "Side panel and sheet"; replaces the
 * old VenuePopupHeader bar and its two rules): for a place, the action row
 * (Call, Website, Share, Save) with the × at its right end. When there is a
 * left link (← Saved for a place opened from Saved, History for a box) that
 * link and the × share one line instead, and the place's row has no ×. No
 * rule under it until the body scrolls, then one hairline, so the × never
 * scrolls away.
 *
 * Positioning (#682): this component used to anchor itself beside the
 * clicked marker (hand-rolled edge-flip math off `map.project()`) — that's
 * what let it land under the search bar or bottom bar whenever a pin was
 * near an edge. It now renders as plain flex content INSIDE
 * `DesktopSidePanel`, which owns the fixed position/size/chrome; the
 * selected pin is kept clear of the panel by MapWrapper panning the map
 * instead (see MapWrapper's pan-on-select effect). No `mapboxMap` prop, no
 * position state, no edge-flip — one fixed layout regardless of where the
 * marker sits.
 *
 * Escape/focus (#682 8b): this component used to register its own Escape
 * handler (with the box-check-in-typing guard below) and focus itself on
 * mount. Both moved to `DesktopSidePanel`, which now wraps non-venue views
 * too (Saved/Menu) and needs the SAME guards for all of them — a single
 * registration point instead of one per view. This component has no
 * Escape/focus logic of its own anymore; its heading (`venue-window-title-
 * ${id}`) is a real `tabIndex={-1}` target DesktopSidePanel focuses directly
 * on view change, and DesktopSidePanel's `handleClose` render-prop (passed
 * in as `onClose`) already restores focus to the trigger on close.
 */

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import FavoriteButton from "@/components/FavoriteButton";
import ShareButton from "@/components/ShareButton";
import type { Walk } from "@/lib/useWalkingRoute";
import type { Venue } from "@/types/venue";
import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/LocaleContext";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";
import VenueCardBody from "@/components/VenueCardBody";
import VenueActionRow from "@/components/VenueActionRow";
import dynamic from "next/dynamic";
import type { EventHere } from "@/components/EventHereLine";
import type { BoxStatus, CheckinKind, PublicBlessingBox } from "@/lib/blessingBoxes";

/** "Loading…" line shown while the box record or the box card's code is on its way. */
function BoxCardLoading({ locale: localeProp }: { locale?: Locale }) {
  // The dynamic() fallback below gets no props, so it reads the context locale.
  const { locale: ctxLocale } = useLocale();
  return (
    <p className="px-4 py-4 text-sm text-[var(--color-ink-500)]">{t("box.cardLoading", localeProp ?? ctxLocale)}</p>
  );
}

// #721: the box card loads only when a box is opened — same split and the
// same module-level rule as BottomSheet's (a dynamic() made in render would
// remount the card and wipe a half-typed check-in).
const BoxCardBody = dynamic(() => import("@/components/BoxCardBody"), {
  loading: () => <BoxCardLoading />,
});

// The × : a 48px box, -m-1 like the row's icons, `ml-auto` so it ends the line.
const CLOSE_CLASS =
  "ml-auto shrink-0 flex items-center justify-center w-12 h-12 -m-1 rounded-md " +
  "text-[var(--color-ink-500)] hover:bg-[var(--color-sage-100)] transition-colors " +
  PRESS_FEEDBACK + " " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]";

// ← Saved and History: 40px drawn, 48px to tap (before:* reaches 4px up and down).
const TOP_LINK_CLASS =
  "relative before:absolute before:inset-x-0 before:-inset-y-1 inline-flex items-center min-h-[40px] -mx-2 px-2 rounded-md " +
  "text-sm font-medium text-[var(--color-sage-700)] hover:text-[var(--color-sage-600)] transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]";

// ─── Props ───────────────────────────────────────────────────────────────────

interface DesktopVenueWindowProps {
  venue: Venue & { distanceMiles?: number };
  /**
   * Full blessing-box record when `venue.category === "blessing_box"` — see
   * BottomSheet's identical prop for the full rationale (`venue` only ever
   * carries plain-Venue fields). `null`/`undefined` while MapWrapper's box
   * fetch hasn't resolved yet — the box body shows a loading line until it
   * has.
   */
  box?: PublicBlessingBox | null;
  /** Forwarded to BoxCardBody's check-in panel — see BottomSheet's identical prop. */
  onCheckinSuccess?: (result: { status: BoxStatus; lastFilledAt: string | null; kind: CheckinKind }) => void;
  onClose: () => void;
  /** Locale forwarded from MapWrapper. Defaults to "en". */
  locale?: Locale;
  /** Walking directions for this card (useWalkingRoute's walkFor). */
  walk?: Walk;
  /**
   * "← Saved" back-link (#682 8b) — present only when this card was opened
   * from the Saved list on desktop. Renders above the persistent header bar;
   * clicking it returns the panel to the Saved view without deselecting the
   * venue's own map state (MapWrapper owns that decision).
   */
  backTo?: { label: string; onClick: () => void };
  /** An upcoming/live event tied to this place (#759): one line that opens its card. */
  eventHere?: EventHere | null;
}

// ─── DesktopVenueWindow ───────────────────────────────────────────────────────

export default function DesktopVenueWindow({
  venue,
  box,
  onCheckinSuccess,
  onClose,
  locale: localeProp,
  walk,
  backTo,
  eventHere = null,
}: DesktopVenueWindowProps) {
  const { locale: ctxLocale } = useLocale();
  const locale = localeProp ?? ctxLocale;

  const isBox = venue.category === "blessing_box";
  // The pinned top's hairline shows only while something has scrolled under it.
  const [scrolled, setScrolled] = useState(false);
  const onBodyScroll = (e: React.UIEvent<HTMLDivElement>) => setScrolled(e.currentTarget.scrollTop > 0);

  const closeButton = (
    <button type="button" onClick={onClose} aria-label={t("detail.close", locale)} className={CLOSE_CLASS}>
      <X size={18} aria-hidden />
    </button>
  );
  // A top line of its own only when there's a link for its left end.
  const hasTopLine = Boolean(backTo) || isBox;

  // ── Blessing-box body ─────────────────────────────────────────────────────
  // BoxCardBody owns the WHOLE box card (photo, sponsor band, label, name,
  // address-as-Walk-trigger, most-needed, host note, check-in, footer);
  // Share/Favorite go in through its `actions` slot. No History link inside
  // it: the top line renders one, so `showHistoryLink={false}`. No photo
  // radius: the photo sits below the top line, not against the window's
  // own corners. `nameId` (fix pass, 2026-09-19) puts the dialog's
  // aria-labelledby target on BoxCardBody's own name heading.
  const boxBody = (
    <div className="flex-1 overflow-y-auto" onScroll={onBodyScroll}>
      {box ? (
        <BoxCardBody
          box={box}
          onCheckinSuccess={onCheckinSuccess}
          showHistoryLink={false}
          nameId={`venue-window-title-${venue.id}`}
          walk={walk}
          actions={
            <>
              <ShareButton venueId={venue.id} venueName={venue.name} locale={locale} size={18} isBox />
              <FavoriteButton venueId={venue.id} venueName={venue.name} locale={locale} size={18} />
            </>
          }
        />
      ) : (
        <BoxCardLoading locale={locale} />
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={`venue-window-title-${venue.id}`}
      // #682: fills DesktopSidePanel's fixed-size shell — no left/top/width
      // of its own anymore (see this file's header for why).
      className="flex flex-col h-full overflow-hidden"
    >
      {/* Pinned top (see this file's header). relative z-10: the links' and
          ×'s tap areas reach 4px past its edge, over the body (BoxPhotoHero's
          positioned wrapper would otherwise paint over them and take the tap). */}
      <div
        className={
          "relative z-10 shrink-0 border-b bg-[var(--color-bone-50)] " +
          (scrolled ? "border-[var(--color-bone-200)]" : "border-transparent")
        }
      >
        {hasTopLine && (
          // "← Saved" (#682 8b, only when opened from the Saved list) and a
          // box's History on the left, the × on the right, one line.
          // gap-[24px]: the links' -mx-2 gives back 8px each side, leaving
          // 8px between ← Saved's and History's tap areas (#233).
          <div className={"flex items-center gap-[24px] px-4 pt-3 " + (isBox ? "pb-3" : "")}>
            {backTo && (
              <button type="button" onClick={backTo.onClick} className={TOP_LINK_CLASS}>
                {backTo.label}
              </button>
            )}
            {isBox && (
              <Link href={`/box/${encodeURIComponent(venue.id)}/history`} className={TOP_LINK_CLASS}>
                {t("box.history.link", locale)}
              </Link>
            )}
            {closeButton}
          </div>
        )}
        {!isBox && (
          // 16px in from the top like the rest of the card (12 under a top
          // line); pb-3 is the 12px down to the name.
          <div className={"px-4 pb-3 " + (hasTopLine ? "pt-3" : "pt-4")}>
            <VenueActionRow venue={venue} locale={locale} compact close={hasTopLine ? undefined : closeButton} />
          </div>
        )}
      </div>

      {/* Body. Box branch at a stable tree position so BoxCardBody (and a
          half-typed check-in note) never remounts. */}
      {isBox ? (
        boxBody
      ) : (
        <div className="flex-1 overflow-y-auto" onScroll={onBodyScroll}>
          <VenueCardBody
            venue={venue}
            variant="panel"
            locale={locale}
            walk={walk}
            eventHere={eventHere}
            nameId={`venue-window-title-${venue.id}`}
          />
        </div>
      )}
    </div>
  );
}
