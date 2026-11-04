/**
 * useHeightTransition.ts — animates an element's height from what it was to
 * what it becomes whenever `trigger` changes, then hands the height back to
 * CSS (#882 preview feedback: the phone sheet snapped to its new height in one
 * frame on every expand/collapse, which read as a stutter).
 *
 * WHY measure-and-animate instead of a CSS transition: the sheet and the card
 * sections hug their content (auto / max-height), and CSS cannot transition to
 * or from `auto`. So the layout effect reads the height before the change (the
 * last size the ResizeObserver saw, or the live animated height when a toggle
 * lands mid-animation) and after it (the new natural layout), and plays a Web
 * Animations API keyframe between the two. WAAPI, not `style.transition`,
 * because vaul writes `style.transition` / `style.transform` on the sheet
 * during drags; an inline height transition would fight it. With fill "none"
 * the animation leaves no inline height behind, so the element hugs its
 * content again the moment it ends.
 *
 * WHY a callback ref (returned) rather than a ref object: the sheet's node is
 * mounted by vaul's portal in a render of its own, after the hook's component
 * has committed. A ref object would only be noticed on the component's next
 * render, which is the first toggle itself, so that toggle had no "before"
 * height and snapped (seen in the browser on the first expand of a card).
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
  /**
   * true = elements inside may run their own height animations for the same
   * change (the event card's About and below-the-fold sections). React runs
   * their layout effects first, so by the time this element measures its
   * "after" height they sit at their start heights. Their animations are
   * jumped to the end for that one measurement and put back, so this element
   * animates to its real final height in step with them. Needed because the
   * sheet is capped at a max-height: hugging alone made it hit the cap in one
   * frame while the content inside was still growing.
   */
  followInner?: boolean;
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
 * `el`'s height once the inner animations have finished. Seeking an animation
 * to its end (fill "none") removes its effect, so layout is the final one;
 * seeking straight back within the same task means no frame ever shows it,
 * and the finish notification is dropped because the animation is running
 * again by the time it would fire (Web Animations "update the finished state").
 */
function heightAfter(el: HTMLElement, inner: Animation[]): number {
  if (inner.length === 0) return heightOf(el);
  const times = inner.map((a) => a.currentTime);
  for (const a of inner) a.currentTime = HEIGHT_ANIMATION_MS;
  const h = heightOf(el);
  inner.forEach((a, i) => {
    a.currentTime = times[i] ?? 0;
  });
  return h;
}

/** Returns a stable callback ref for the element whose height should animate when `trigger` changes. */
export function useHeightTransition(
  trigger: unknown,
  { enabled = true, followInner = false }: HeightTransitionOptions = {},
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
    const to = heightAfter(el, followInner ? innerAnimations(el) : []);
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
      // playState: belt and braces for heightAfter's seek-and-return above.
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
