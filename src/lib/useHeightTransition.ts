/**
 * useHeightTransition.ts — animates an element's height from what it was to
 * what it becomes whenever `trigger` changes, then hands the height back to
 * CSS (#882 preview feedback). Used by the event card's About section ("Read
 * more"); the phone sheet itself moves on vaul snap points (BottomSheet.tsx)
 * and reads the final layout through measureWithInnerAnimationsFinished.
 *
 * WHY measure-and-animate instead of a CSS transition: the section hugs its
 * content, and CSS cannot transition to or from `auto`. So the layout effect
 * reads the height before the change (the last size the ResizeObserver saw,
 * or the live animated height when a toggle lands mid-animation) and after it
 * (the new natural layout), and plays a Web Animations API keyframe between
 * the two. With fill "none" the animation leaves no inline height behind, so
 * the element hugs its content again the moment it ends.
 *
 * WHY a callback ref (returned) rather than a ref object: a node mounted in a
 * render of its own (inside a portal) is only noticed by a ref object on the
 * component's next render, which can be the first toggle itself, so that
 * toggle had no "before" height and snapped (seen in the browser).
 *
 * Instant (no animation) under prefers-reduced-motion, when `enabled` is
 * false, where the browser has no `Element.animate` (jsdom), and when the
 * element first appears. Overflow is clipped only while an animation runs.
 */

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/useMediaQuery";

/** Tags this hook's animations so a parent can tell an inner part is already animating. */
export const HEIGHT_ANIMATION_ID = "pfm-height";
export const HEIGHT_ANIMATION_MS = 280;
/** Ease-out: fast start, gentle settle. */
export const HEIGHT_ANIMATION_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export interface HeightTransitionOptions {
  /** false = always instant (e.g. the sheet while a walk route is active). */
  enabled?: boolean;
}

interface HeightState {
  el: HTMLElement | null;
  ro: ResizeObserver | null;
  last: number | null;
  trigger: unknown;
  anim: Animation | null;
  /** The element's own inline overflow, restored when an animation ends. */
  overflow: string;
}

const heightOf = (el: HTMLElement) => el.getBoundingClientRect().height;

/** Cancels a running animation synchronously (its cancel event fires later, after a replacement may have started). */
function stop(st: HeightState): void {
  if (!st.anim) return;
  const anim = st.anim;
  st.anim = null;
  anim.cancel();
  if (st.el) st.el.style.overflow = st.overflow;
}

/**
 * Keeps `last` current through size changes that never re-render (an image
 * loading, a font swapping). Ignored while animating: those sizes are ours.
 */
function observe(st: HeightState): void {
  const el = st.el;
  if (!el || st.ro || typeof ResizeObserver === "undefined") return;
  st.ro = new ResizeObserver(() => {
    if (!st.anim && st.el === el) st.last = heightOf(el);
  });
  st.ro.observe(el);
}

/** This hook's height animations running on elements inside `el` (not `el` itself). */
function innerAnimations(el: HTMLElement): Animation[] {
  if (typeof el.getAnimations !== "function") return [];
  return el
    .getAnimations({ subtree: true })
    .filter((a) => a.id === HEIGHT_ANIMATION_ID && (a.effect as KeyframeEffect | null)?.target !== el);
}

/**
 * Runs `measure` with every height animation inside `el` seeked to its end
 * and put back, so a measurement taken mid-animation reads the final layout.
 * The phone sheet uses it to pick its fully-open height once, when About
 * starts growing, rather than chasing it frame by frame. Seeking to the end
 * (fill "none") removes the effect; seeking straight back within the same
 * task means no frame ever shows it, and the finish notification is dropped
 * because the animation is running again by the time it would fire (Web
 * Animations "update the finished state").
 */
export function measureWithInnerAnimationsFinished<T>(el: HTMLElement, measure: () => T): T {
  const anims = innerAnimations(el);
  if (anims.length === 0) return measure();
  const times = anims.map((a) => a.currentTime);
  for (const a of anims) a.currentTime = HEIGHT_ANIMATION_MS;
  const result = measure();
  anims.forEach((a, i) => {
    a.currentTime = times[i] ?? 0;
  });
  return result;
}

/** Returns a stable callback ref for the element whose height should animate when `trigger` changes. */
export function useHeightTransition(
  trigger: unknown,
  { enabled = true }: HeightTransitionOptions = {},
): (el: HTMLElement | null) => void {
  const s = useRef<HeightState>({ el: null, ro: null, last: null, trigger, anim: null, overflow: "" });

  const ref = useCallback((el: HTMLElement | null) => {
    const st = s.current;
    // Ignore null: a parent that composes refs with a fresh function each
    // render (Radix inside vaul does) makes React call ref(null) then
    // ref(sameNode) on EVERY commit. Re-measuring there would overwrite the
    // "before" height with the new one just before the layout effect reads
    // it (seen in the browser: from === to, no animation). A node that really
    // went away is replaced when the next one arrives, or dropped on unmount.
    if (el === null || el === st.el) return;
    st.ro?.disconnect();
    st.ro = null;
    stop(st);
    st.el = el;
    st.last = el ? heightOf(el) : null;
    observe(st);
  }, []);

  // No deps on purpose: it compares `trigger` with the last one itself.
  useLayoutEffect(() => {
    const st = s.current;
    if (Object.is(trigger, st.trigger)) return;
    st.trigger = trigger;
    const el = st.el;
    if (!el) return;

    // Mid-animation the live height is what is on screen; otherwise the DOM
    // already holds the new layout, so the old height is the last one seen.
    const from = st.anim ? heightOf(el) : st.last;
    stop(st);
    const to = heightOf(el);
    st.last = to;
    if (from === null || !enabled || Math.abs(to - from) < 1) return;
    if (prefersReducedMotion() || typeof el.animate !== "function") return;

    st.overflow = el.style.overflow;
    el.style.overflow = "hidden";
    // maxHeight "none" for the duration: a section that collapses by gaining a
    // max-height class (the peek's max-h-24) would otherwise clamp the
    // animated height and still snap shut in one frame. Both ends were
    // measured under the real max-height, so nothing grows past it.
    const anim = el.animate([{ height: `${from}px`, maxHeight: "none" }, { height: `${to}px`, maxHeight: "none" }], {
      duration: HEIGHT_ANIMATION_MS,
      easing: HEIGHT_ANIMATION_EASE,
      id: HEIGHT_ANIMATION_ID,
    });
    st.anim = anim;
    anim.addEventListener("finish", () => {
      // playState: belt and braces for measureWithInnerAnimationsFinished's seek-and-return.
      if (st.anim !== anim || anim.playState !== "finished") return;
      st.anim = null;
      el.style.overflow = st.overflow;
      st.last = heightOf(el);
    });
  });

  useEffect(() => {
    const st = s.current;
    // Re-attaches after StrictMode's simulated unmount (dev) disconnected it.
    observe(st);
    return () => {
      st.ro?.disconnect();
      st.ro = null;
      stop(st);
    };
  }, []);

  return ref;
}
