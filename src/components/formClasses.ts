/**
 * formClasses.ts — the field, label, error, tick-box and form-button class
 * strings shared by every admin form (#926). One copy so the forms cannot
 * drift apart; never re-type these in a page. Card, title, link, tag and
 * the 14 px button strings live in src/lib/adminCardStyles.ts.
 *
 * Exports:
 *   inputBase                text box / select / textarea: 48 tall, 16 px words on phones (14 from md)
 *   inputBorder(hasError)    its edge and focus colour: ink 400 at rest (5.9:1 on white, clears the 3:1 floor) with a sage focus;
 *                            on error red at rest AND in focus. Always pair it with inputBase.
 *   inputClass               inputBase + inputBorder(false), for a box that is never marked wrong
 *   labelClass, errorClass   the label above a field and the red line under it
 *   hintClass                the "(optional)" hint inside a label, ink 400 (DESIGN.md Forms)
 *   requiredMarkClass        the red star after a required field's label (aria-hidden; the field says aria-required)
 *   fieldGroupClass          the hairline box around a <fieldset> of related fields
 *   checkboxRowClass         a 48 tall <label> row around a tick box and its words, sage 100 under the pointer
 *   checkboxClass            the tick box <input type="checkbox"> itself, 20 px
 *   ADMIN_PRIMARY_BUTTON     the form-level green button (Save), 16 px words, 48 tall
 *   ADMIN_SECONDARY_BUTTON   its outline partner (Cancel beside Save); also dims when aria-disabled
 *   saveRowClass             the Cancel (a third) + Save (two thirds) row
 *   busyButtonProps(busy)    spread on a working button: aria-disabled, keeps focus, presses stopped
 *   cancelLinkProps(busy)    spread on the Cancel <Link> so it is off while a save runs
 */

import { buttonClass } from "@/lib/adminCardStyles";

// text-base on mobile: iOS Safari auto-zooms on focusing a field under 16px.
// block: a textarea is inline by default and leaves a gap under it for the
// text descenders. The focus ring's width is here; its colour comes from
// inputBorder, so always use the two together.
export const inputBase =
  "block w-full min-h-12 rounded-[var(--radius-md)] border px-3 py-2 text-base md:text-sm text-[var(--color-ink-900)] " +
  // #534: --color-ink-300 undefined — DESIGN.md documents ink-400 as the
  // placeholder-text token.
  "bg-white placeholder:text-[var(--color-ink-400)] " +
  "focus-visible:outline-none focus-visible:ring-2";
// WHY ink 400 and not bone 300: a text box's edge is the only thing that
// shows where to type, so it needs the 3:1 non-text floor (ink 400 is 5.9:1
// on white; bone 300 was 1.6:1). Outline BUTTON edges stay bone 300.
// WHY the focus colours live here and not in inputBase: a wrong value must
// stay red while its box has focus, and a second focus colour appended to
// inputBase's would win or lose on stylesheet order, not on class order.
export const inputBorder = (hasError: boolean) =>
  hasError
    ? "border-[var(--color-danger)] focus-visible:border-[var(--color-danger)] focus-visible:ring-[var(--color-danger)]"
    : "border-[var(--color-ink-400)] focus-visible:border-[var(--color-sage-500)] focus-visible:ring-[var(--color-sage-500)]";
/** A box that is never marked wrong (a filter, a reason box): inputBase with the resting edge. */
export const inputClass = `${inputBase} ${inputBorder(false)}`;
export const errorClass = "mt-1 text-xs text-[var(--color-danger)]";
export const labelClass = "block text-sm font-medium text-[var(--color-ink-700)] mb-1";
export const hintClass = "font-normal text-[var(--color-ink-400)]";
export const requiredMarkClass = "text-[var(--color-danger)]";

export const fieldGroupClass = "rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] p-4";

// The sage 100 tint under the pointer (#926 decision 1). WHY -mx-2 with px-2:
// the tint gets 8 px of room each side while the tick box stays lined up
// with the fields above it.
export const checkboxRowClass =
  "-mx-2 flex min-h-12 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] px-2 text-sm text-[var(--color-ink-700)] " +
  "transition-colors duration-150 hover:bg-[var(--color-sage-100)]";
// size-[20px], not size-5: this theme remaps --spacing-5 to 24 px.
// WHY an outline, not a ring: a native tick box does not reliably paint a
// box-shadow ring in every browser, an outline it always does.
export const checkboxClass =
  "size-[20px] shrink-0 cursor-pointer accent-[var(--color-sage-600)] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-sage-500)]";

/** Sage-filled form-level primary button (Save, Send code, Add event): primaryButtonClass at 16 px. */
export const ADMIN_PRIMARY_BUTTON = buttonClass("primary", "text-base");

/** Outline partner of ADMIN_PRIMARY_BUTTON: Cancel beside Save. Its aria-disabled dim matters here: Cancel is a link. */
export const ADMIN_SECONDARY_BUTTON = buttonClass("secondary", "text-base");

/** Cancel (a third) then Save (two thirds). Keep Save the form's first submit button. */
export const saveRowClass = "grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2";

/**
 * Spread on the Cancel <Link> beside Save: while the save runs it is off, so
 * nobody leaves the page while the save still lands. A link cannot be
 * disabled natively, so it is marked aria-disabled, taken out of the tab
 * order, and its click is stopped (next/link skips navigating when the
 * click's default is prevented).
 */
/**
 * Spread on a button that stays on the page while its own request runs
 * (Save, Find location, Approve, a confirm's action button). While busy it
 * is marked aria-disabled, dimmed by the shared button strings, instead of
 * natively disabled: a natively disabled button drops keyboard focus to the
 * page body the moment it turns off (#926). A press while busy is stopped
 * in the capture phase, before the button's own onClick runs, and its
 * default is prevented, so a submit button (and Enter in a field) sends
 * nothing either. Keep the button's own onClick as it is:
 *   <button type="button" onClick={save} {...busyButtonProps(busy)} className={primaryButtonClass}>
 */
export function busyButtonProps(busy: boolean) {
  return {
    "aria-disabled": busy || undefined,
    onClickCapture: busy ? stopPress : undefined,
  };
}

function stopPress(e: { preventDefault: () => void; stopPropagation: () => void }) {
  e.preventDefault();
  e.stopPropagation();
}

export function cancelLinkProps(busy: boolean) {
  return busy
    ? { "aria-disabled": true, tabIndex: -1, onClick: (e: { preventDefault: () => void }) => e.preventDefault() }
    : {};
}
