/**
 * adminCardStyles.ts — the ONE home for admin class strings (#926): titles,
 * cards, table boxes, buttons, links, tags and filter chips, plus the
 * submitted-at formatter. Every admin page imports from here (fields come
 * from src/components/formClasses.ts); never re-type one of these strings in
 * a page. If a page needs something missing here, add the smallest option
 * here, not a local copy.
 *
 * Exports:
 *   focusRingClass                 sage 500 keyboard ring with a white gap
 *   pageTitleClass                 a page's h2 (Fraunces 20)
 *   sectionTitleClass              a section title (Fraunces 18)
 *   groupTitleClass                a small group heading (Public Sans 14 semibold ink 700)
 *   cardClass                      white card, elevation 1, 16 padding (24 from 640)
 *   cardSlimClass                  the same card at 12 by 16 padding (summary boxes)
 *   tableWrapClass                 the scroll box around a table (scrolls sideways inside, never the page)
 *   fieldLabelClass                11 px capitals label inside cards
 *   primaryButtonClass             green filled, 14 px words, 48 tall
 *   secondaryButtonClass           outline (bone 300 edge, ink 700 words), 48 tall
 *   dangerButtonClass              red outline, fills red under the pointer, rings red, 48 tall
 *   linkClass                      inline link (in a sentence or a table cell)
 *   tapLinkClass                   standalone link with a 48 tall tap area
 *   tagClass(tone)                 round tag; tone "calm" | "attention" | "quiet" | "neutral" | "caution" | "danger"
 *   chipClass(on)                  48 tall round filter chip; put aria-pressed={on} on the button
 *   formatSubmittedAt(iso)         local date and time for a created_at
 *
 * Rules these strings carry (DESIGN.md, #926 decisions 1-4, 11, 12): one
 * button height (48, min-h-12); non-filled pressables hover sage 100, filled
 * sage hovers sage 700, the red outline fills red; nothing brightens on hover,
 * buttons keep the press dim (PRESS_FEEDBACK); focus-visible rings only.
 * The guard for these rules is src/__tests__/touchTargets.test.tsx.
 *
 * WHY not in adminVenues.ts: that module imports the ~2000-entry
 * published-venues snapshot, and these are used by client components.
 */

import { PRESS_FEEDBACK } from "@/lib/interactionStyles";

export const focusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2";

export const pageTitleClass = "wordmark text-xl text-[var(--color-ink-900)]";
export const sectionTitleClass = "wordmark text-lg text-[var(--color-ink-900)]";
export const groupTitleClass = "text-sm font-semibold text-[var(--color-ink-700)]";

export const cardClass =
  "elevation-1 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-4 sm:p-5";

export const cardSlimClass =
  "elevation-1 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white px-4 py-3";

export const tableWrapClass =
  "elevation-1 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white";

export const fieldLabelClass = "text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)]";

// Shared by the three buttons: one height, centred words that may wrap on a
// narrow phone, the press dim, and the disabled look.
const buttonBase =
  "inline-flex min-h-12 items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-center text-sm " +
  "transition-colors duration-150 " +
  PRESS_FEEDBACK +
  " disabled:opacity-50 disabled:cursor-not-allowed ";

export const primaryButtonClass =
  buttonBase +
  "bg-[var(--color-sage-600)] font-semibold text-[var(--color-bone-50)] hover:bg-[var(--color-sage-700)] " +
  focusRingClass;

export const secondaryButtonClass =
  buttonBase +
  "border border-[var(--color-bone-300)] bg-transparent font-medium text-[var(--color-ink-700)] " +
  "hover:bg-[var(--color-sage-100)] " +
  focusRingClass;

// WHY the red fill on hover and a red ring: the design page pictures the red
// outline filling red under the pointer (#926 decision 1), and a sage ring
// beside red words reads as a different control.
export const dangerButtonClass =
  buttonBase +
  "border border-[var(--color-danger)] bg-transparent font-medium text-[var(--color-danger)] " +
  "hover:bg-[var(--color-danger)] hover:text-[var(--color-bone-50)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)] focus-visible:ring-offset-2";

export const linkClass =
  "rounded-[var(--radius-sm)] font-medium text-[var(--color-sage-700)] underline underline-offset-2 " + focusRingClass;

export const tapLinkClass = "inline-flex min-h-12 items-center " + linkClass;

export type TagTone = "calm" | "attention" | "quiet" | "neutral" | "caution" | "danger";

// Full literals per tone so Tailwind's scanner sees every class.
const TAG_TONES: Record<TagTone, string> = {
  calm: "bg-[var(--color-sage-100)] text-[var(--color-sage-700)]",
  attention: "bg-[var(--color-clay-100)] text-[var(--color-clay-700)]",
  quiet: "bg-[var(--color-bone-100)] text-[var(--color-ink-500)]",
  neutral: "bg-[var(--color-bone-200)] text-[var(--color-ink-700)]",
  caution: "bg-[var(--color-brand-yellow)] text-[var(--color-ink-900)]",
  danger: "bg-[var(--color-clay-100)] text-[var(--color-danger)]",
};

export function tagClass(tone: TagTone): string {
  return "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium " + TAG_TONES[tone];
}

const chipBase =
  "inline-flex min-h-12 items-center rounded-full border px-3.5 text-sm font-medium transition-colors duration-150 " +
  PRESS_FEEDBACK +
  " " +
  focusRingClass +
  " disabled:cursor-not-allowed disabled:opacity-50 ";

export function chipClass(on: boolean): string {
  return (
    chipBase +
    (on
      ? "border-[var(--color-sage-500)] bg-[var(--color-sage-100)] text-[var(--color-sage-700)]"
      : "border-[var(--color-bone-300)] bg-white text-[var(--color-ink-700)] hover:bg-[var(--color-sage-100)]")
  );
}

/**
 * Full date + time, in the viewer's LOCAL timezone (deliberately NOT pinned
 * to UTC like adminVenues.ts's formatLastVerified) — `created_at` is a
 * genuine timestamp an admin reads as "when did this arrive," not a
 * date-only field with an established display convention to match
 * elsewhere, so showing it in the browser's own local time is the more
 * useful reading here.
 */
export function formatSubmittedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso; // defensive: never crash a card on a malformed timestamp
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
