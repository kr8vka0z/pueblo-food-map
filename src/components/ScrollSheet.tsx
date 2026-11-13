"use client";

/**
 * ScrollSheet — the phone card sheet whose movement is the browser's own
 * scrolling (#923, 2026-11).
 *
 * WHY: the vaul drawer moved the sheet with JS transforms and stopped the
 * gesture at the top, so a second swipe was needed to scroll the details.
 * Apple's sheets grow with one swipe and keep going into the content with
 * native momentum. Here the sheet sits inside a fixed, transparent scroll
 * container (the "track"); scrolling the track moves the sheet up, CSS scroll
 * snap gives the resting heights, and past fully open the same scroll simply
 * carries on through the card. The technique is pure-web-bottom-sheet's
 * (https://viliket.github.io/posts/native-like-bottom-sheets-on-the-web/),
 * hand-built rather than used as the package: its swipe-to-dismiss needs the
 * Popover API (iOS 17+) or a <dialog>, its shadow DOM sits between our
 * focus / inert / Escape handling and the card, and we need the held card,
 * route hand-off and overlay-stack Escape rules that live in BottomSheet.
 *
 * Geometry: the track is the sheet's maximum height (100dvh - map peek -
 * safe area). A spacer as tall as the track sits above the sheet, so
 * scrollTop 0 is closed and scrollTop N shows N pixels of sheet. Detents are
 * 1px markers at scrollTop 0 / collapsed / full (sheetSnap.ts). The track is
 * `pointer-events: none` so the map behind stays usable (no scrim); only the
 * sheet takes touches, and a touch on it still scrolls the track.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { restingAt, sheetDetents, type Resting, type SheetDetents } from "@/lib/sheetSnap";
import { prefersReducedMotion } from "@/lib/useMediaQuery";

/** Map left showing above the fully open sheet (#549). */
export const MAP_PEEK_PX = 100;
/** No scroll event for this long and no finger down: the sheet has come to rest. */
const SETTLE_MS = 150;
/** A slow pull this far down from collapsed closes (snap alone would spring back). */
const SLOW_CLOSE_PX = 100;

interface ScrollSheetProps {
  open: boolean;
  /** Parent's state; a change here (grab bar, Read more, the tour) scrolls to that height. */
  expanded: boolean;
  /** The sheet came to rest at a height the person scrolled it to. "closed" = swiped away. */
  onRest: (resting: Resting) => void;
  /** Reports whether there is only one resting height (the grab bar is then drawn but disabled). */
  onSingleChange?: (single: boolean) => void;
  /** Escape while open (document capture phase, where Radix listened before). */
  onEscape: (event: KeyboardEvent) => void;
  /** The card's detail section id; its top plus its `data-peek-px` is the collapsed height. */
  detailId: string;
  /** Changes when a different card is shown: re-measure from scratch and move focus to its name. */
  contentKey: string;
  /** Move focus to the card's name on open (the event card does this itself). */
  focusName: boolean;
  inert?: boolean;
  label: string;
  description: string;
  /** The grab bar row; pinned to the top while the content scrolls. */
  header: ReactNode;
  children: ReactNode;
}

function scrollTrack(el: HTMLElement, top: number) {
  const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
  if (typeof el.scrollTo === "function") el.scrollTo({ top, behavior });
  else el.scrollTop = top;
}

export default function ScrollSheet({
  open,
  expanded,
  onRest,
  onSingleChange,
  onEscape,
  detailId,
  contentKey,
  focusName,
  inert,
  label,
  description,
  header,
  children,
}: ScrollSheetProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [detents, setDetents] = useState<SheetDetents>({ collapsed: 0, full: 0, single: false, measured: false });
  const detentsRef = useRef(detents);
  const openRef = useRef(open);
  const expandedRef = useRef(expanded);
  const onRestRef = useRef(onRest);
  useLayoutEffect(() => {
    detentsRef.current = detents;
    openRef.current = open;
    expandedRef.current = expanded;
    onRestRef.current = onRest;
  });
  const fingerDown = useRef(false);
  // Only a sheet that has rested open can be swiped closed: scrollTop starts
  // at 0 (closed) on every open, and jsdom's scrollTop is always 0.
  const armed = useRef(false);
  const lastRest = useRef<Resting>("closed");
  const measurePending = useRef(false);
  // null = the card has no detail section (or none read yet).
  const firstView = useRef<number | null>(null);
  // Whether `firstView` was read while collapsed. A card that opens already
  // expanded (the route card's Clear walking route, the tour) has no collapsed
  // reading yet, so it keeps re-reading until it has one: frozen at its first
  // frame, a box measured before its check-in panel finished drawing kept a
  // collapsed height its full layout doesn't have (agent-browser, 360 wide).
  const firstViewCollapsed = useRef(false);

  // ── The top edge's shadow at full height ───────────────────────────────
  // The track is the scroll container, so it clips everything inside it: once
  // the sheet's top reaches the track's top (a card at least as tall as the
  // track, fully open or scrolled into the details), the sheet's own shadow
  // and hairline above that edge are cut off and the card runs straight into
  // the map. `[data-sheet-edge]`, a sibling outside the track, draws that edge
  // instead, only while the sheet's top is at the track's top (globals.css).
  // Called from scroll and from measure: a resize moves no scroll position.
  const syncEdge = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const h = track.clientHeight;
    track.toggleAttribute("data-at-top", openRef.current && h > 0 && track.scrollTop >= h - 1);
  }, []);

  // ── Measure the detents ────────────────────────────────────────────────
  const measure = useCallback(() => {
    const track = trackRef.current;
    const sheet = sheetRef.current;
    if (!track || !sheet) return;
    syncEdge();
    if (fingerDown.current) {
      // Moving the detents under the finger would fight it; measure on release.
      measurePending.current = true;
      return;
    }
    const top = sheet.getBoundingClientRect().top;
    const detail = sheet.querySelector<HTMLElement>(`#${detailId}`);
    // Read only while collapsed (#882): opened, "Read more" can make the first
    // view taller than it will be once collapsed again.
    if (!expandedRef.current || !firstViewCollapsed.current) {
      firstView.current = detail ? detail.getBoundingClientRect().top - top + Number(detail.dataset.peekPx ?? 64) : null;
      firstViewCollapsed.current = !expandedRef.current;
    }
    const next = sheetDetents({
      trackHeight: track.clientHeight,
      firstView: firstView.current,
      content: sheet.getBoundingClientRect().height,
    });
    setDetents((prev) =>
      prev.collapsed === next.collapsed && prev.full === next.full && prev.single === next.single && prev.measured === next.measured
        ? prev
        : next,
    );
  }, [detailId, syncEdge]);

  useLayoutEffect(() => {
    firstView.current = null;
    firstViewCollapsed.current = false;
    measure();
  }, [contentKey, measure]);
  useLayoutEffect(() => {
    measure();
  });
  useEffect(() => {
    const track = trackRef.current;
    const sheet = sheetRef.current;
    if (!track || !sheet || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(track);
    ro.observe(sheet);
    return () => ro.disconnect();
  }, [measure]);

  const singleRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!detents.measured || singleRef.current === detents.single) return;
    singleRef.current = detents.single;
    onSingleChange?.(detents.single);
  }, [detents, onSingleChange]);

  // ── Follow the parent's state: open, close, expand, collapse ───────────
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    syncEdge();
    if (!open) {
      armed.current = false;
      lastRest.current = "closed";
      if (track.scrollTop > 0) scrollTrack(track, 0);
      return;
    }
    if (!detents.measured || fingerDown.current) return;
    const cur = track.scrollTop;
    // Fully open or scrolled into the details: leave it where the person put it.
    if (expanded && cur >= detents.full - 2) return;
    const target = expanded ? detents.full : detents.collapsed;
    if (Math.abs(cur - target) > 1) scrollTrack(track, target);
  }, [open, expanded, detents, syncEdge]);

  // ── Watch the scroll: rest, swipe-to-close, snap off inside the content ─
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let deep = false;
    function settle() {
      if (!track || fingerDown.current || !openRef.current) return;
      const d = detentsRef.current;
      if (!d.measured) return;
      const r = restingAt(track.scrollTop, d);
      if (r === "closed") {
        if (!armed.current) return;
        const floor = swipeFloor(d);
        if (floor !== null) {
          scrollTrack(track, floor);
          return;
        }
        armed.current = false;
        lastRest.current = "closed";
        onRestRef.current("closed");
        return;
      }
      armed.current = true;
      lastRest.current = r;
      onRestRef.current(r);
    }
    function onScroll() {
      if (!track) return;
      syncEdge();
      // Scrolled into the content: snap alignment off, so a layout change in
      // the card (a lazy chunk, Read more, the check-in panel) can't make
      // Safari re-snap to the sheet's top (the article's "re-snapping" note).
      const nowDeep = track.scrollTop > detentsRef.current.full + 1;
      if (nowDeep !== deep) {
        deep = nowDeep;
        track.toggleAttribute("data-deep", deep);
      }
      clearTimeout(timer);
      timer = setTimeout(settle, SETTLE_MS);
    }
    // One step per swipe, as before: a swipe that starts fully open rests at
    // collapsed, never closed; on a one-height card, a swipe that starts in
    // the details rests at the card's top rather than closing in the same move.
    let startedDeep = false;
    function swipeFloor(d: SheetDetents): number | null {
      if (lastRest.current !== "full") return null;
      if (!d.single) return d.collapsed;
      return startedDeep ? d.full : null;
    }
    function onTouchStart() {
      fingerDown.current = true;
      startedDeep = !!track && track.scrollTop > detentsRef.current.full + 1;
    }
    function onTouchEnd() {
      fingerDown.current = false;
      if (!track) return;
      const d = detentsRef.current;
      if (lastRest.current === "collapsed" && !d.single && track.scrollTop < d.collapsed - SLOW_CLOSE_PX) {
        scrollTrack(track, 0);
      } else {
        const floor = swipeFloor(d);
        if (floor !== null && track.scrollTop < floor - 1) scrollTrack(track, floor);
      }
      if (measurePending.current) {
        measurePending.current = false;
        measure();
      }
      clearTimeout(timer);
      timer = setTimeout(settle, SETTLE_MS);
    }
    track.addEventListener("scroll", onScroll, { passive: true });
    track.addEventListener("touchstart", onTouchStart, { passive: true });
    track.addEventListener("touchend", onTouchEnd, { passive: true });
    track.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      clearTimeout(timer);
      track.removeEventListener("scroll", onScroll);
      track.removeEventListener("touchstart", onTouchStart);
      track.removeEventListener("touchend", onTouchEnd);
      track.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [measure, syncEdge]);

  // ── Escape (document capture, where Radix's listener sat) ──────────────
  const onEscapeRef = useRef(onEscape);
  useLayoutEffect(() => {
    onEscapeRef.current = onEscape;
  });
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onEscapeRef.current(e);
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open]);

  // ── Focus: to the card's name on open, back where it was on close ──────
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body && !trackRef.current?.contains(active)) {
      returnFocus.current = active;
    }
    if (focusName) {
      const name = sheetRef.current?.querySelector<HTMLElement>("h2");
      if (name) {
        if (!name.hasAttribute("tabindex")) name.tabIndex = -1;
        // preventScroll: focusing inside a scroll-snap track would scroll it.
        name.focus({ preventScroll: true });
      }
    }
  }, [open, contentKey, focusName]);
  useEffect(() => {
    if (open) return;
    const el = returnFocus.current;
    returnFocus.current = null;
    if (el?.isConnected) el.focus({ preventScroll: true });
  }, [open]);

  if (typeof document === "undefined") return null;
  const descId = `scroll-sheet-desc-${contentKey}`;
  const height = `calc(100dvh - ${MAP_PEEK_PX}px - env(safe-area-inset-bottom))`;
  return createPortal(
    <>
      <div
        ref={trackRef}
        // #530: the safe-area bottom comes from globals.css's [data-bottom-sheet] rule.
        data-bottom-sheet=""
        data-scroll-sheet=""
        role="dialog"
        aria-modal="false"
        aria-label={label}
        aria-describedby={descId}
        // Closing (`!open`): the held card is still sliding away; nothing on it may take focus or be read.
        inert={inert || !open || undefined}
        className={
          "fixed left-0 right-0 z-[800] overflow-y-scroll overscroll-contain " +
          "snap-y snap-mandatory pointer-events-none rounded-t-[var(--radius-xl)] focus:outline-none"
        }
        style={{ height }}
      >
        <p id={descId} className="sr-only">
          {description}
        </p>
        {/* Detents: 1px markers (Safari needs a height to snap). */}
        <div data-snap="" aria-hidden style={{ top: 0 }} />
        {detents.measured && !detents.single && (
          // snap-stop: from fully open a fast flick down rests here, never straight to closed.
          <div data-snap="" data-snap-stop="" aria-hidden style={{ top: detents.collapsed }} />
        )}
        {detents.measured && <div data-snap="" aria-hidden style={{ top: detents.full }} />}
        {/* The track: as tall as the sheet's maximum, so scrollTop 0 hides the sheet. */}
        <div aria-hidden className="h-full" />
        <div
          ref={sheetRef}
          data-sheet=""
          data-sheet-surface=""
          className="pointer-events-auto relative flex flex-col bg-[var(--color-bone-50)] rounded-t-[var(--radius-xl)] elevation-2"
        >
          <div data-sheet-part="" className="sticky top-0 z-10 bg-[var(--color-bone-50)] rounded-t-[var(--radius-xl)]">
            {header}
          </div>
          <div data-sheet-part="">{children}</div>
          <div data-snap-end="" aria-hidden />
        </div>
      </div>
      {/* The sheet's top edge at full height, drawn outside the clipping track (see syncEdge). */}
      <div
        data-sheet-edge=""
        aria-hidden
        className="fixed left-0 right-0 z-[800] pointer-events-none rounded-t-[var(--radius-xl)] elevation-2"
        style={{ height, bottom: "env(safe-area-inset-bottom)" }}
      />
    </>,
    document.body,
  );
}
