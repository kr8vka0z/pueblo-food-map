/**
 * sheetSnap.ts — the phone sheet's two resting heights as vaul snap points
 * (#882 preview feedback, Maps-style sheet: it follows the finger between
 * collapsed and fully open and settles to the nearer one).
 *
 * WHY the `base` offset: vaul turns a px snap point S into a translate of
 * `window.innerHeight - S` (vaul useSnapPoints). The sheet's own height H is
 * `100dvh - map peek - safe area` (the #549 formula, already proven for the
 * route strip), so what is visible at that translate is S - (innerHeight - H).
 * Adding `base = innerHeight - H` to the height we want visible cancels it.
 * A card taller than the sheet is fully open at `1` (no translate, the whole
 * sheet showing, content scrolls inside); a shorter one stops at its own height.
 */

/** vaul snap point: a fraction of the window, or an exact "Npx" string. */
export type SnapPoint = number | `${number}px`;

export interface SheetMeasure {
  /** window.innerHeight. */
  innerHeight: number;
  /** The sheet element's own height (fixed). */
  drawerHeight: number;
  /** Height from the sheet's top to the bottom of the collapsed view (first view + peek); null when the card has no detail section. */
  firstView: number | null;
  /** Height from the sheet's top to the end of its content. */
  content: number;
}

export interface SheetSnaps {
  collapsed: SnapPoint;
  full: SnapPoint;
  /** What vaul gets: [collapsed, full], or just [full] when there is nothing to expand into. */
  points: SnapPoint[];
}

const px = (n: number): SnapPoint => `${Math.round(n)}px`;

export function sheetSnapPoints({ innerHeight, drawerHeight, firstView, content }: SheetMeasure): SheetSnaps {
  const base = innerHeight - drawerHeight;
  const fullVisible = Math.min(content, drawerHeight);
  const full: SnapPoint = content >= drawerHeight - 0.5 ? 1 : px(fullVisible + base);
  const collapsedVisible = firstView === null ? fullVisible : Math.min(firstView, fullVisible);
  // Less than ~a finger's nudge between the two: one resting height, nothing to expand.
  if (fullVisible - collapsedVisible < 24) return { collapsed: full, full, points: [full] };
  const collapsed = px(collapsedVisible + base);
  return { collapsed, full, points: [collapsed, full] };
}
