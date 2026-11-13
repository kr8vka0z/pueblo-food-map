"use client";

/**
 * usePresence — keeps a side panel mounted while it slides out (#917 round 3:
 * Filters and the Menu appeared and vanished with no slide). Returns true
 * while `open`, and for `exitMs` after it turns false, so the panel can play
 * its closing transition before it unmounts. The opening slide needs nothing
 * here: the panel's `starting:` classes (CSS @starting-style) give it a first
 * frame off screen.
 *
 * WHY only when the browser says motion is welcome (`no-preference`), not
 * merely "not reduce": a reduced-motion visitor gets no slide, so holding the
 * panel would just leave it on screen for a beat; and jsdom (no matchMedia,
 * or a test stub that answers only the breakpoints it knows) keeps the old
 * close-then-gone behavior the existing panel tests assert.
 */

import { useEffect, useState } from "react";

/** True only when the browser positively reports no reduced-motion preference. */
function motionWelcome(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: no-preference)")?.matches === true
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
