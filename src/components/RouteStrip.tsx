"use client";

/**
 * RouteStrip — the collapsed bottom-sheet state shown on phone while a
 * walking route is active (#509). Kyle, 2026-09-19: starting a walking route
 * from ANY venue card (a blessing box's address tap or an ordinary place's
 * Walk button) used to leave the full-height card covering the map, with no
 * way to see the route or get back to the card. This strip replaces the full
 * card's content while a route is drawn: place name, distance/time, "Clear
 * route", "Steps" (#531, see below), and "Show card" (which restores the
 * full card).
 *
 * BottomSheet.tsx owns the vaul mechanics that make this reachable three
 * ways (starting a route, dragging the full card down, or the Show card
 * button) — see that file's own header for the snapPoints/dismissible
 * wiring. This component is otherwise presentation-only (no vaul awareness)
 * — the one piece of local state it owns is whether its own Steps sheet
 * (below) is open, which never needs to reach BottomSheet.
 *
 * #531 (Kyle, 2026-09-19): the written turn-by-turn steps already exist
 * end to end (MapWrapper.tsx fetches+parses them, DirectionButtons.tsx
 * renders them) but only inside the FULL card — from the strip, reaching
 * them was "Show card" then "Show steps", two taps. "Steps" here opens them
 * directly as a sheet over the map, reusing DirectionButtons.tsx's own
 * `WalkStepsList` (same `<ol>` markup, not a second copy — see that
 * component's own header). Built as a native `<dialog>` + `showModal()`,
 * the same primitive PhotoViewer.tsx (#508) already established for this
 * repo's one other ad-hoc overlay — see that file's own header for why
 * (Escape/focus-trap/back-gesture for free, no library). That choice also
 * satisfies this issue's "must not fight the existing Escape/overlay
 * handling" risk for free: `dialogGuard.ts`'s `isNativeDialogOpen()` (which
 * BottomSheet.tsx's own Escape handler already checks first) tests for ANY
 * open `dialog[open]` in the document, not specifically PhotoViewer's — so
 * this sheet is already covered without touching BottomSheet.tsx's Escape
 * wiring at all.
 *
 * #537 (Kyle, 2026-09-19): Kyle saw no Steps control at all on a real
 * walking route. Evidence gathered before touching this file: a real Mapbox
 * Directions API walking response captured for a short Pueblo route
 * (test/fixture data, see RouteStripStepsEvidence.test.tsx) returned 7 usable steps —
 * `parseWalkSteps` (MapWrapper.tsx) keeps all 7 — and the prop chain from
 * there (MapWrapper's `walkingRouteSteps` -> BottomSheet's `walkRouteSteps`
 * -> here) has no additional gate beyond `walkingRouteVenueId ===
 * selectedVenueId`, the same one that already has to pass for the strip
 * itself to render. So `hasSteps` being false is not the normal case; the
 * real bug was candidate 2 from the issue — the control DID render, but as
 * a small underlined text link squeezed between "Clear route" and "Show
 * card" (three identical-looking links in one row), easy to miss on a
 * phone. Fixed here by promoting it to a filled `sage-600`/white pill — the
 * same fill/text-color pairing DESIGN.md's `filtersButton` token already
 * uses for an active-state pill, so no new token — placed first in the
 * right-hand group so it reads as the strip's primary action, not a third
 * peer link. When a route genuinely has no steps, the button's slot shows a
 * muted line instead of silently having nothing there (the issue's proof
 * criterion) — a resident should never wonder if the control is just
 * missing.
 */

import { useEffect, useRef, useState } from "react";
import { ChevronUp, ListOrdered, X } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";
import { useOverlayRegistration } from "@/lib/overlayRegistry";
import { WalkStepper, type RouteInfo, type WalkStep } from "@/components/DirectionButtons";

/**
 * Fixed pixel height of the strip. vaul's snapPoints accept a CSS px string
 * ("112px") but NOT calc() — so this can't include env(safe-area-inset-bottom)
 * the way the rest of the app pads for the home-indicator area. A fixed
 * buffer is baked in below instead.
 *
 * BottomSheet.tsx imports this SAME constant as part of its snap point (its
 * ROUTE_STRIP_SNAP = this + its own MAP_PEEK_PX — see that file's `style`
 * prop comment for why the map peek has to be added back in) so this
 * number and the strip's own rendered height can never drift apart (a strip
 * taller/shorter than its share of the snap point would either clip content
 * or leave a dead gap above the strip).
 *
 * ponytail: not exact on notched phones (the safe-area buffer is a fixed
 * guess, not the real inset) — tune during live review if the strip ever
 * visibly crowds the home indicator on a real device.
 */
export const ROUTE_STRIP_HEIGHT_PX = 112;

interface RouteStripProps {
  venueName: string;
  routeInfo: RouteInfo | null;
  locale: Locale;
  /** "Show card" — restores the full card. Drag-up does the same via vaul; this is the tap affordance. */
  onShowCard: () => void;
  /** "Clear route" — same callback DirectionButtons/BoxCardBody's own clear control uses. */
  onClearRoute?: () => void;
  /**
   * Turn-by-turn steps (#531) — pre-localized by Mapbox, same shape
   * DirectionButtons/BottomSheet already thread through; mirrors
   * DirectionButtons' own `hasSteps` guard so the two surfaces agree on
   * when steps "exist." #537: when this is missing/empty, the Steps
   * button's slot renders a muted "no steps for this route" line instead
   * of nothing — a real Mapbox route reliably carries steps (see this
   * file's own header), so an empty state here is the exception, not the
   * norm, and should read as one rather than as a missing control.
   *
   */
  walkSteps?: WalkStep[] | null;
  /** Which turn WalkStepper shows inside the Steps sheet (#555). */
  activeStepIndex?: number;
  /** Moves the stepper to a different turn (#555) — Back/Next or an "All turns" row tap. */
  onStepChange?: (index: number) => void;
}

const linkClass =
  "py-1.5 text-sm font-medium text-[var(--color-sage-600)] " +
  "hover:text-[var(--color-sage-700)] underline-offset-2 hover:underline " +
  PRESS_FEEDBACK + " " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] rounded";

// #537 — the strip's one primary action, so it reads as a real button
// rather than a third peer text link. Fill/text pairing matches DESIGN.md's
// `filtersButton` token (sage-600 bg, white text, rounded-full) — an
// existing "filled pill" precedent, not a new one.
const stepsButtonClass =
  "flex items-center gap-1.5 rounded-full bg-[var(--color-sage-600)] px-3.5 py-2 " +
  "text-sm font-semibold text-white hover:bg-[var(--color-sage-700)] " +
  PRESS_FEEDBACK + " " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2";

export default function RouteStrip({
  venueName,
  routeInfo,
  locale,
  onShowCard,
  onClearRoute,
  walkSteps,
  activeStepIndex = 0,
  onStepChange = () => {},
}: RouteStripProps) {
  const stepperSteps = walkSteps ?? [];
  const hasSteps = stepperSteps.length > 0;

  // ── Steps sheet (#531) ──────────────────────────────────────────────────
  const [stepsOpen, setStepsOpen] = useState(false);
  // #542: the steps sheet is its own full-surface overlay on top of the
  // strip, so it registers independently while open. The strip itself
  // doesn't register here: #547 (Kyle, 2026-09-20) reversed #531's "nav
  // stays visible under the strip" carve-out by removing MapWrapper.tsx's
  // `!stripVisible` term from `venueSheetOpen` instead of adding a second,
  // strip-local registration alongside it. Not a lag concern — a
  // `useOverlayRegistration(true)` here would itself be synchronous
  // (`useLayoutEffect`, same commit as mount/unmount, just like this one).
  // The actual hazard was the two mechanisms coexisting: if `!stripVisible`
  // had stayed in `venueSheetOpen` while this component also registered
  // itself, then on "Show card" this component's unmount (removing its id,
  // same commit) and MapWrapper's registration (still gated on a
  // `stripVisible` that hasn't caught up yet — `onStripVisibleChange` is a
  // passive effect, one render behind) would BOTH have the registry empty
  // for one frame, showing the nav before the next render hid it again.
  // Deleting the `!stripVisible` term — what actually shipped — removes
  // that race outright, so there is nothing left for a second registration
  // here to coordinate with.
  useOverlayRegistration(stepsOpen);
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Explicit focus restore, not relied-on-native — same reasoning as
  // PhotoViewer.tsx's own header: this repo's jsdom test environment has no
  // real <dialog> implementation (see vitest.setup.ts's polyfill), so
  // "native behavior" here would be untested by construction.
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Drive the dialog's open/closed state imperatively — <dialog> has no
  // declarative `open`-via-attribute path that also gets the modal
  // backdrop/focus-trap/Escape behavior; only showModal()/close() do.
  // Same pattern as PhotoViewer.tsx.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (stepsOpen && !dialog.open) {
      previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!stepsOpen && dialog.open) {
      dialog.close();
    }
  }, [stepsOpen]);

  // The dialog's native `close` event fires however it closed — the × button,
  // a tap on the backdrop (see the dialog's own onClick below), or Escape
  // (via the CloseWatcher API in real browsers / vitest.setup.ts's polyfill
  // in tests) — so this is the single place that syncs `stepsOpen` back to
  // false and restores focus. Mount-once, same as PhotoViewer.tsx.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function handleClose() {
      setStepsOpen(false);
      previouslyFocusedRef.current?.focus();
    }
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  return (
    <div
      data-testid="route-strip"
      style={{ height: ROUTE_STRIP_HEIGHT_PX }}
      className="flex flex-col justify-center gap-2 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p
          className="min-w-0 flex-1 truncate text-base font-medium text-[var(--color-ink-900)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {venueName}
        </p>
        {routeInfo && (
          <p data-testid="route-strip-info" className="shrink-0 text-sm font-semibold text-[var(--color-sage-700)]">
            {t("directions.routeDistance", locale, { distance: routeInfo.distance })}
            {" · "}
            {t("directions.routeDuration", locale, { duration: routeInfo.duration })}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        {onClearRoute ? (
          <button type="button" data-testid="route-strip-clear" onClick={onClearRoute} className={linkClass}>
            {t("directions.clearRoute", locale)}
          </button>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-3">
          {hasSteps ? (
            <button
              type="button"
              data-testid="route-strip-steps"
              onClick={() => setStepsOpen(true)}
              className={stepsButtonClass}
            >
              <ListOrdered size={16} aria-hidden />
              {t("directions.steps", locale)}
            </button>
          ) : (
            // #537 Proof: a route with genuinely no steps says so rather
            // than silently omitting the control.
            <span data-testid="route-strip-no-steps" className="text-sm text-[var(--color-ink-500)]">
              {t("directions.noStepsForRoute", locale)}
            </span>
          )}

          <button
            type="button"
            data-testid="route-strip-show-card"
            onClick={onShowCard}
            className={`flex items-center gap-1 ${linkClass}`}
          >
            {t("directions.showCard", locale)}
            <ChevronUp size={16} aria-hidden />
          </button>
        </div>
      </div>

      {/* Steps sheet (#531) — see this file's own header for why a native
          <dialog> and why that alone keeps it out of BottomSheet.tsx's
          Escape handling. Bottom-anchored (not full-screen like
          PhotoViewer): `bottom-[env(safe-area-inset-bottom)]` (#541 — see
          globals.css's `[data-bottom-nav]` comment for the real-iPhone
          measurement behind dropping the old toolbar-height reserve)
          matches the same offset BottomSheet/BottomNav use, rather than a
          bare `bottom-0`, which a notched phone's home-indicator would
          slice into. `m-0`/`top-auto` override the UA's own centered-dialog
          default. */}
      {hasSteps && (
        <dialog
          ref={dialogRef}
          aria-label={t("directions.stepsListLabel", locale)}
          // A click landing on the dialog element ITSELF (never a child —
          // the content div below fills the dialog's own box) is a tap on
          // the ::backdrop area above the sheet, i.e. "outside the panel" —
          // the standard <dialog> light-dismiss idiom (no library equivalent
          // exists for a plain <dialog>, unlike vaul's own scrim tap).
          onClick={(e) => {
            if (e.target === dialogRef.current) setStepsOpen(false);
          }}
          className={
            "fixed inset-x-0 bottom-[env(safe-area-inset-bottom)] top-auto z-[900] " +
            "m-0 max-h-[70vh] w-full max-w-none border-0 bg-transparent p-0 " +
            "backdrop:bg-black/40"
          }
        >
          {/* Only mounted while open — same jsdom-visibility reasoning as
              PhotoViewer.tsx's own comment on this exact pattern. */}
          {stepsOpen && (
            <div className="flex flex-col rounded-t-[var(--radius-xl)] bg-[var(--color-bone-50)] elevation-2 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p
                  className="min-w-0 flex-1 truncate text-base font-medium text-[var(--color-ink-900)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {venueName}
                </p>
                <button
                  type="button"
                  data-testid="route-strip-steps-close"
                  onClick={() => setStepsOpen(false)}
                  aria-label={t("detail.close", locale)}
                  className={
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md " +
                    "text-[var(--color-ink-500)] hover:bg-[var(--color-bone-100)] transition-colors " +
                    PRESS_FEEDBACK + " " +
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)]"
                  }
                >
                  <X size={18} aria-hidden />
                </button>
              </div>
              {/* #555: the sheet now shows the same step-through stepper as
                  the in-card readout — MapWrapper's activeStepIndex/
                  onStepChange keep this sheet, the map's camera focus, and
                  BottomSheet's own DirectionButtons in agreement on which
                  turn is current, so opening this sheet mid-walk lands on
                  the same turn instead of resetting to the first one.
                  `max-h-[70vh]` moved from this inner div to the dialog
                  element itself (unchanged above) — WalkStepper's own "All
                  turns" list has its own internal scroll (max-h-48), so the
                  outer dialog is the only element that still needs a height
                  cap. */}
              {/* WHY no `key` here, unlike WalkRouteStatus's own mount (#555):
                  that one keys on venue.id because it stays mounted across a
                  venue change, so its WalkStepper's local "All turns" state
                  would bleed from one venue's route to the next. This mount
                  cannot: the `{stepsOpen && ...}` guard above unmounts the
                  whole subtree on every close, so the disclosure is always
                  freshly collapsed when the sheet reopens, and the native
                  <dialog>'s showModal() makes every other venue's Walk
                  trigger inert while it's open.
                  THAT IS LOAD-BEARING, not incidental: keeping this content
                  mounted across close/reopen (say, to animate it) would
                  silently reintroduce the bleed. RouteStrip.test.tsx pins the
                  reset so such a change fails a test rather than shipping. */}
              <WalkStepper
                steps={stepperSteps}
                activeIndex={activeStepIndex}
                onStepChange={onStepChange}
                locale={locale}
              />
            </div>
          )}
        </dialog>
      )}
    </div>
  );
}
