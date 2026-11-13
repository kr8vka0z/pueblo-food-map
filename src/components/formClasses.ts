/**
 * formClasses.ts — the field, label, error, tick-box and form-button class
 * strings shared by every admin form (#926). One copy so the forms cannot
 * drift apart; never re-type these in a page. Card, title, link, tag and
 * the 14 px button strings live in src/lib/adminCardStyles.ts.
 *
 * Exports:
 *   inputBase                text box / select / textarea: 48 tall, 16 px words on phones (14 from md)
 *   inputBorder(hasError)    its edge: ink 400 at rest (3:1 on white), danger red on error
 *   labelClass, errorClass   the label above a field and the red line under it
 *   checkboxRowClass         a 48 tall <label> row around a tick box and its words
 *   checkboxClass            the tick box <input type="checkbox"> itself, 20 px
 *   ADMIN_PRIMARY_BUTTON     the form-level green button (Save), 16 px words, 48 tall
 *   ADMIN_SECONDARY_BUTTON   its outline partner (Cancel beside Save)
 *   saveRowClass             the Cancel (a third) + Save (two thirds) row
 */

import { PRESS_FEEDBACK } from "@/lib/interactionStyles";

// text-base on mobile: iOS Safari auto-zooms on focusing a field under 16px.
export const inputBase =
  "w-full min-h-12 rounded-[var(--radius-md)] border px-3 py-2 text-base md:text-sm text-[var(--color-ink-900)] " +
  // #534: --color-ink-300 undefined — DESIGN.md documents ink-400 as the
  // placeholder-text token.
  "bg-white placeholder:text-[var(--color-ink-400)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
  "focus-visible:border-[var(--color-sage-500)]";
// WHY ink 400 and not bone 300: a text box's edge is the only thing that
// shows where to type, so it needs the 3:1 non-text floor (ink 400 is 5.8:1
// on white; bone 300 was 1.6:1). Outline BUTTON edges stay bone 300.
export const inputBorder = (hasError: boolean) =>
  hasError ? "border-[var(--color-danger)]" : "border-[var(--color-ink-400)]";
export const errorClass = "mt-1 text-xs text-[var(--color-danger)]";
export const labelClass = "block text-sm font-medium text-[var(--color-ink-700)] mb-1";

export const checkboxRowClass = "flex min-h-12 cursor-pointer items-center gap-2 text-sm text-[var(--color-ink-700)]";
// size-[20px], not size-5: this theme remaps --spacing-5 to 24 px.
// WHY an outline, not a ring: a native tick box does not reliably paint a
// box-shadow ring in every browser, an outline it always does.
export const checkboxClass =
  "size-[20px] shrink-0 cursor-pointer accent-[var(--color-sage-600)] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-sage-500)]";

/** Sage-filled form-level primary button (Save, Send code, Add event). */
export const ADMIN_PRIMARY_BUTTON =
  "inline-flex min-h-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-sage-600)] px-4 " +
  "text-base font-semibold text-[var(--color-bone-50)] transition-colors duration-150 hover:bg-[var(--color-sage-700)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
  "disabled:opacity-60 disabled:cursor-not-allowed " +
  PRESS_FEEDBACK;

/** Outline partner of ADMIN_PRIMARY_BUTTON: Cancel beside Save. */
export const ADMIN_SECONDARY_BUTTON =
  "inline-flex min-h-12 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-bone-300)] " +
  "bg-transparent px-4 text-base font-medium text-[var(--color-ink-700)] transition-colors duration-150 " +
  "hover:bg-[var(--color-sage-100)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
  "disabled:opacity-60 disabled:cursor-not-allowed " +
  PRESS_FEEDBACK;

/** Cancel (a third) then Save (two thirds). Keep Save the form's first submit button. */
export const saveRowClass = "grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2";
