"use client";

/**
 * GuidedTour (#159) — a step-by-step overlay that points at the map's real
 * controls. Started from the splash's "Take a tour" button or the Menu's
 * "Learn how to use this map" item; MapWrapper loads this file with
 * next/dynamic only when a tour starts, so it costs nothing on first load.
 *
 * Hand-rolled rather than Driver.js (the issue's suggestion): the whole
 * overlay is one highlight box + one tooltip, and Driver.js would still need
 * its keyboard handling switched off (its Escape bypasses the claim-once
 * overlay stack below), its styles overridden to DESIGN.md tokens, and our
 * own ES copy — a new dependency for less than it saves.
 *
 * How a step works: the tour asks MapWrapper to put the UI in the step's
 * state (open the sample venue's card, or close it), centers the map on the
 * sample venue for the pin step, then polls for the step's target element
 * each animation frame until its box stops moving (the card slides in, the
 * bottom nav remounts after the card closes) and draws the highlight there.
 * On close it restores the camera; MapWrapper restores the selection and
 * Map/List view it snapshotted at start.
 *
 * A11y: role="dialog" + aria-modal, focus starts on Next and is trapped in
 * the tooltip (DesktopVenueWindow focuses itself when the card step opens it
 * — the focusin trap pulls focus back), Next/Back/Done/Close buttons plus
 * ArrowRight/ArrowLeft, a polite live region that reads each new step, and
 * Escape through overlayRegistry's claimEscape so it closes only the tour.
 * Motion is limited to a short highlight move, which globals.css's
 * prefers-reduced-motion block already collapses.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type mapboxgl from "mapbox-gl";
import { X } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { claimEscape, raiseOverlay, useOverlayStackId } from "@/lib/overlayRegistry";
import { PRESS_FEEDBACK } from "@/lib/interactionStyles";
import { TOUR_COPY, TOUR_STEPS, placeTooltip, tourReducer, type Rect } from "@/lib/guidedTour";

type MapLike = Pick<mapboxgl.Map, "getCenter" | "getZoom" | "jumpTo">;

interface GuidedTourProps {
  locale: Locale;
  /** The venue the pin and card steps show. Null skips straight to a centered tooltip. */
  sampleVenue: { id: string; lng: number; lat: number } | null;
  /** Null while the map hasn't loaded (or can't): the pin step just doesn't move the camera. */
  mapboxMap: MapLike | null;
  /** Open this venue's card (id) or close any open card (null). */
  onShowVenue: (id: string | null) => void;
  /** The tour finished or was dismissed. */
  onClose: () => void;
  /** Where focus goes when the tour ends (the Menu nav button, or the map container). */
  returnFocusSelector: string;
}

const HIGHLIGHT_PAD = 6;
// Keep polling this many frames after the target's box stops changing, or
// this many frames for a target that hasn't appeared yet (a lazy desktop card
// chunk, the nav remounting on a slow phone) before settling on "no target".
const STABLE_FRAMES = 10;
const MISSING_FRAMES = 90;
const FOCUSABLE = "button:not([disabled])";
// Zoom the pin step uses so the sample pin sits alone, clear of neighbours.
const PIN_ZOOM = 15;

function sameRect(a: Rect | null, b: Rect | null) {
  if (!a || !b) return a === b;
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

export default function GuidedTour({
  locale,
  sampleVenue,
  mapboxMap,
  onShowVenue,
  onClose,
  returnFocusSelector,
}: GuidedTourProps) {
  const copy = TOUR_COPY[locale];
  const [index, setIndex] = useState(0);
  const step = TOUR_STEPS[index];
  const stepCopy = copy.steps[step.id];
  const total = TOUR_STEPS.length;
  const isLast = index === total - 1;

  const dialogRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const closedRef = useRef(false);
  const [target, setTarget] = useState<Rect | null>(null);
  const [tipSize, setTipSize] = useState<{ width: number; height: number } | null>(null);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === "undefined" ? 360 : window.innerWidth,
    height: typeof window === "undefined" ? 740 : window.innerHeight,
  }));

  // Camera at tour start, restored on close so the tour leaves the map where it found it.
  const cameraRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
  useEffect(() => {
    if (!mapboxMap || cameraRef.current) return;
    const c = mapboxMap.getCenter();
    cameraRef.current = { center: [c.lng, c.lat], zoom: mapboxMap.getZoom() };
  }, [mapboxMap]);

  // ── Finish ──────────────────────────────────────────────────────────────────
  const finish = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    if (mapboxMap && cameraRef.current) mapboxMap.jumpTo(cameraRef.current);
    onClose();
    // The launcher may not exist yet (BottomNav remounts a frame or more after
    // the card closes on a phone) — retry per frame, same pattern as
    // HamburgerMenu's restoreFocus.
    const restore = (framesLeft: number) => {
      const el = document.querySelector<HTMLElement>(returnFocusSelector);
      if (el) el.focus();
      else if (framesLeft > 0) requestAnimationFrame(() => restore(framesLeft - 1));
    };
    requestAnimationFrame(() => restore(20));
  }, [mapboxMap, onClose, returnFocusSelector]);

  const go = useCallback(
    (action: "next" | "back") => {
      const nextIndex = tourReducer(index, action);
      if (nextIndex === null) finish();
      else setIndex(nextIndex);
    },
    [index, finish],
  );

  // ── Put the UI into this step's state ────────────────────────────────────────
  useEffect(() => {
    onShowVenue(step.showsCard && sampleVenue ? sampleVenue.id : null);
    if (step.id === "pin" && sampleVenue && mapboxMap) {
      mapboxMap.jumpTo({
        center: [sampleVenue.lng, sampleVenue.lat],
        zoom: Math.max(mapboxMap.getZoom(), PIN_ZOOM),
      });
    }
    // onShowVenue/mapboxMap are stable for the tour's life; re-run per step only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // ── Track the target's box ───────────────────────────────────────────────────
  const selector =
    step.id === "pin" && sampleVenue
      ? `[data-venue-id="${CSS.escape(sampleVenue.id)}"]`
      : step.target;

  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let stable = 0;
    let last: Rect | null = null;
    const tick = () => {
      const el = selector ? document.querySelector(selector) : null;
      const r = el?.getBoundingClientRect();
      const rect: Rect | null =
        r && r.width > 0 && r.height > 0
          ? {
              top: Math.round(r.top) - HIGHLIGHT_PAD,
              left: Math.round(r.left) - HIGHLIGHT_PAD,
              width: Math.round(r.width) + HIGHLIGHT_PAD * 2,
              height: Math.round(r.height) + HIGHLIGHT_PAD * 2,
            }
          : null;
      if (sameRect(rect, last)) stable++;
      else {
        stable = 0;
        last = rect;
        setTarget(rect);
      }
      frames++;
      const done = rect ? stable >= STABLE_FRAMES : !selector || frames >= MISSING_FRAMES;
      if (!done) raf = requestAnimationFrame(tick);
    };
    tick();
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      cancelAnimationFrame(raf);
      frames = 0;
      stable = 0;
      tick();
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [selector]);

  // ── Measure the tooltip so it can be placed clear of the target ──────────────
  useLayoutEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const size = { width: el.offsetWidth, height: el.offsetHeight };
    setTipSize((prev) => (prev && prev.width === size.width && prev.height === size.height ? prev : size));
  }, [index, locale, viewport]);

  // ── Focus: start on Next, stay inside the tooltip ────────────────────────────
  useEffect(() => {
    nextRef.current?.focus();
  }, []);

  useEffect(() => {
    function onFocusIn(e: FocusEvent) {
      if (closedRef.current || !dialogRef.current) return;
      if (dialogRef.current.contains(e.target as Node)) return;
      nextRef.current?.focus();
    }
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  // ── Escape: claim-once overlay stack ─────────────────────────────────────────
  // Window CAPTURE phase so this runs before BottomSheet's (Radix, document
  // capture) and every bubble-phase overlay listener. raiseOverlay first: the
  // card this tour opened pushed onto the stack after the tour did, but the
  // tour is still the layer on top (see raiseOverlay's own comment).
  const stackId = useOverlayStackId(true);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      raiseOverlay(stackId);
      if (!claimEscape(stackId, e)) return;
      e.preventDefault();
      finish();
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [stackId, finish]);

  function onDialogKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go("next");
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go("back");
    } else if (e.key === "Tab" && dialogRef.current) {
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  // ── Layout ──────────────────────────────────────────────────────────────────
  const tipWidth = Math.min(340, viewport.width - 24);
  const place = tipSize ? placeTooltip(target, { width: tipWidth, height: tipSize.height }, viewport) : null;
  const counter = copy.counter(index + 1, total);

  return (
    // Full-screen layer: dims the page and swallows taps so the map can't be
    // panned out from under a highlight mid-tour. z above every app layer
    // (splash is 9000, and is always gone before a tour starts).
    <div className="fixed inset-0 z-[9500]" data-testid="guided-tour">
      {target ? (
        <div
          aria-hidden
          data-testid="tour-highlight"
          className="absolute pointer-events-none rounded-[var(--radius-lg)] ring-2 ring-[var(--color-sage-500)] transition-[top,left,width,height] duration-200"
          style={{
            top: target.top,
            left: target.left,
            width: target.width,
            height: target.height,
            boxShadow: "0 0 0 9999px rgba(26,24,23,0.55)",
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-[rgba(26,24,23,0.55)]" />
      )}

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={copy.dialogLabel}
        aria-describedby="tour-step-body"
        onKeyDown={onDialogKeyDown}
        className="absolute flex flex-col gap-2 p-4 bg-[var(--color-bone-50)] border border-[var(--color-bone-200)] rounded-[var(--radius-lg)] elevation-2 text-[var(--color-ink-700)]"
        style={{
          width: tipWidth,
          top: place ? place.top : 0,
          left: place ? place.left : 0,
          // Hidden until measured, so it never flashes in the wrong spot.
          visibility: place ? "visible" : "hidden",
        }}
      >
        <div className="flex items-center justify-between -mt-1 -mr-2">
          <span className="text-sm text-[var(--color-ink-500)]">{counter}</span>
          <button
            type="button"
            onClick={finish}
            aria-label={copy.close}
            className={
              "flex items-center justify-center w-12 h-12 -my-2 rounded-full text-[var(--color-ink-500)] " +
              "hover:bg-[var(--color-bone-100)] hover:text-[var(--color-ink-700)] " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
              PRESS_FEEDBACK
            }
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <h2 className="text-lg font-semibold leading-snug text-[var(--color-ink-900)]">{stepCopy.title}</h2>
        <p id="tour-step-body" className="text-base leading-relaxed">
          {stepCopy.body}
        </p>
        <div className="flex items-center justify-end gap-2 mt-1">
          {index > 0 && (
            <button
              type="button"
              onClick={() => go("back")}
              className={
                "min-h-12 px-4 rounded-[var(--radius-md)] text-base font-semibold text-[var(--color-sage-700)] " +
                "hover:bg-[var(--color-bone-100)] " +
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
                PRESS_FEEDBACK
              }
            >
              {copy.back}
            </button>
          )}
          <button
            ref={nextRef}
            type="button"
            onClick={() => go("next")}
            className={
              "min-h-12 px-5 rounded-[var(--radius-md)] text-base font-semibold " +
              "bg-[var(--color-sage-600)] text-[var(--color-bone-50)] " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-sage-500)] " +
              PRESS_FEEDBACK
            }
          >
            {isLast ? copy.done : copy.next}
          </button>
        </div>
      </div>

      {/* Focus stays on Next as steps change, so the new step is read out here. */}
      <p className="sr-only" aria-live="polite">
        {`${counter}. ${stepCopy.title}. ${stepCopy.body}`}
      </p>
    </div>
  );
}
