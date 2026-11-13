/**
 * sheetSnap.ts — the phone sheet's resting heights (detents) for the native
 * scroll sheet (ScrollSheet.tsx, #923, 2026-11: the sheet's movement is
 * the browser's own scrolling, with CSS scroll snap for the resting heights).
 *
 * In that model a detent is a scrollTop of the sheet's track, and the
 * scrollTop IS the visible height of the sheet: 0 is closed, `collapsed` is
 * the first view plus the peek, `full` is the whole card or the whole track
 * (whichever is shorter). Past `full` the same scroll carries on into the
 * card's content, which is what makes one swipe grow the sheet and then
 * scroll the details.
 */

export interface SheetMeasure {
  /** The track's own height: the most of the sheet that can show (100dvh - map peek - safe area). */
  trackHeight: number;
  /** Height from the sheet's top to the bottom of the collapsed view (first view + peek); null when the card has no detail section. */
  firstView: number | null;
  /** The sheet's whole height (grab bar + card). */
  content: number;
}

export interface SheetDetents {
  /** scrollTop (= visible height) at rest, collapsed. Equals `full` when `single`. */
  collapsed: number;
  /** scrollTop at rest, fully open. Anything above it is the card's content scrolling. */
  full: number;
  /** One resting height: nothing to expand into, so the grab bar toggles nothing. */
  single: boolean;
  /** False before the track has a laid-out height (the first frame, jsdom). */
  measured: boolean;
}

/** Less than ~a finger's nudge between the two heights: treat it as one. */
const MIN_GAP_PX = 24;

export function sheetDetents({ trackHeight, firstView, content }: SheetMeasure): SheetDetents {
  const measured = trackHeight > 0;
  const full = Math.round(Math.min(content, trackHeight));
  const collapsed = Math.round(firstView === null ? full : Math.min(firstView, full));
  if (full - collapsed < MIN_GAP_PX) return { collapsed: full, full, single: true, measured };
  return { collapsed, full, single: false, measured };
}

export type Resting = "closed" | "collapsed" | "full";

/**
 * Which detent a settled scrollTop is at. Scrolled into the content counts as
 * full. Otherwise the nearest of the three: scroll snap only rests on a
 * detent, so this just absorbs sub-pixel rounding.
 */
export function restingAt(scrollTop: number, d: SheetDetents): Resting {
  if (scrollTop >= d.full - 2) return "full";
  const candidates: [Resting, number][] = [
    ["closed", 0],
    ["collapsed", d.collapsed],
    ["full", d.full],
  ];
  let best = candidates[0];
  for (const c of candidates) if (Math.abs(scrollTop - c[1]) < Math.abs(scrollTop - best[1])) best = c;
  return best[0];
}
