"use client";

/**
 * usePresence — keeps a side panel mounted while it slides out (#917 round 3:
 * Filters and the Menu appeared and vanished with no slide). Returns true
 * while `open`, and for `exitMs` after it turns false, so the panel can play
 * its closing transition before it unmounts. The opening slide needs nothing
 * here: the panel's `starting:` classes (CSS @starting-style) give it a first
 * frame off screen.
 *
 * WHY only when the browser says motion is welcome (`no-preference` matches
 * and `reduce` doesn't), not merely "not reduce": a reduced-motion visitor
 * gets no slide, so holding the panel would just leave it on screen for a
 * beat. A real browser answers exactly one of the two. jsdom has no
 * matchMedia, and the test stubs either answer only the breakpoints they know
 * or answer every query alike (both true reads as reduced), so the existing
 * suites keep the close-then-gone behavior they assert.
 */

import { useEffect, useState } from "react";

/** True only when the browser positively reports no reduced-motion preference. */
function motionWelcome(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: no-preference)")?.matches === true &&
    window.matchMedia("(prefers-reduced-motion: reduce)")?.matches !== true
  );
}

export function usePresence(open: boolean, exitMs: number, animate = true): boolean {
  const [held, setHeld] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  // Adjust state when the prop changes (React's render-time pattern, as
  // BottomSheet's route strip does), so the first closed render is already held.
  if (open !== prevOpen) {
    setPrevOpen(open);
    setHeld(!open && animate && motionWelcome());
  }
  useEffect(() => {
    if (!held) return;
    const id = setTimeout(() => setHeld(false), exitMs);
    return () => clearTimeout(id);
  }, [held, exitMs]);
  return open || held;
}

/**
 * The value as it was while `open`, kept after `open` turns false, so a panel
 * sliding out shows what it showed when it closed (the BottomSheet `held`
 * pattern). The parents reset state on close: Saved's section goes back to
 * null (so the view falls back to the Menu) and MapWrapper's events count
 * drops to 0; without this the closing panel changed under the slide (#922
 * review). The render-time update re-runs with the same `value`, so it
 * settles after one retry. A closing panel is inert, so its held callbacks
 * are never called.
 */
export function useLastOpen<T>(open: boolean, value: T): T {
  const [last, setLast] = useState(value);
  if (open && !Object.is(last, value)) setLast(value);
  return open ? value : last;
}
