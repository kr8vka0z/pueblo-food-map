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
 *   pageBodyClass                  the page body under the menu: 16 px sides on a phone, 32 from 640, 24 between parts
 *   formPageBodyClass              the same on a form page, its content stopping at 672 (max-w-2xl)
 *   sectionDividerClass            a section with a hairline above it on a form page (24 under the line)
 *   pageTitleClass                 a page's h2 (Fraunces 20); the menu's name is the one h1
 *   sectionTitleClass              a section title, h3 (Fraunces 18)
 *   groupTitleClass                a small group heading inside a section, h4 (Public Sans 14 semibold ink 700)
 *   adminNameClass                 "Pueblo Food Map Admin", the admin's one h1 (menu and sign-in page)
 *   cardNameClass                  the name of the thing a card is about (Public Sans 16 semibold ink 700)
 *   cardClass                      white card, elevation 1, 16 padding (24 from 640)
 *   cardSlimClass                  the same card at 12 by 16 padding (summary boxes)
 *   tileCardClass                  a Dashboard number tile: the card at 16 padding at every width
 *   tileLabelClass                 the tile's 12 px ink 500 capitals label
 *   signInCardClass                the sign-in box: lifted (elevation 2)
 *   clayNoticeClass                the clay notice box (Waiting to publish, a dead link, the test site line)
 *   failureBoxClass                the red-edged box at the top of a form or list when something failed
 *   failureLineClass               a red failure line (says what did not happen, then what to do)
 *   loadingLineClass               the quiet pulsing "Loading…" line
 *   emptyStateClass                the centred box a list shows when it has nothing in it
 *   tableWrapClass                 the scroll box around a table (scrolls sideways inside, never the page)
 *   tableHeadRowClass              a table's heading row: 11 px ink 400 capitals over a bone 200 line
 *   tableRowClass                  a table body row: a bone 200 line under it
 *   tableLinkRowClass              the same row tinted sage 100 under the pointer, pointer cursor: only a row that
 *                                  links somewhere, with onClick={openRowLink} (src/lib/rowLinkClick.ts)
 *   tableCellClass                 a td: 12 by 16
 *   tableHeadCellClass             a th: the same, medium weight
 *   fieldLabelClass                11 px capitals label inside cards
 *   controlLabelClass              fieldLabelClass as a block above a filter control, a slider or a reason box
 *   primaryButtonClass             green filled, 14 px words, 48 tall
 *   secondaryButtonClass           outline (bone 300 edge, ink 700 words), 48 tall
 *   dangerButtonClass              red outline, fills red under the pointer, rings red, 48 tall
 *   buttonClass(look, size)        the three above built from one base; formClasses.ts's form buttons use size "text-base"
 *   pickerOptionClass              a full-width, left-aligned outline option in a picker list (a place or address match)
 *   linkClass                      inline link (in a sentence or a table cell), sage 100 under the pointer
 *   bannerLinkClass                linkClass without its colour: takes the banner's own (Publish bot banner)
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

// One page body for every admin page (sm:px-6 is 32 px in this theme, the
// menu's own side padding). Parts sit 24 apart through the gap (gap-5 is
// 24 px here), so a part never carries its own outer margin, and a part that
// hides (an empty summary box) leaves no gap behind.
export const pageBodyClass = "flex flex-col gap-5 px-4 py-6 sm:px-6";
// WHY box-content: the 672 limit is on the content, so the side padding
// stays the same as on a list page instead of eating into the form.
export const formPageBodyClass = pageBodyClass + " box-content max-w-2xl";

// A section set off by a hairline above it, on a form page (Check-ins,
// Host alert emails, Danger zone). Its h3 sits 12 above what follows (mb-3).
export const sectionDividerClass = "border-t border-[var(--color-bone-200)] pt-5";

export const pageTitleClass = "wordmark text-xl text-[var(--color-ink-900)]";
export const sectionTitleClass = "wordmark text-lg text-[var(--color-ink-900)]";
export const groupTitleClass = "text-sm font-semibold text-[var(--color-ink-700)]";
export const adminNameClass = "wordmark text-2xl text-[var(--color-ink-900)]";
// Never Fraunces at 16 (#926 decision 5); the design page's .pa-name.
export const cardNameClass = "text-base font-semibold text-[var(--color-ink-700)]";

export const cardClass =
  "elevation-1 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-4 sm:p-5";

export const cardSlimClass =
  "elevation-1 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white px-4 py-3";

// WHY 16 at every width: cardClass steps to 24 from 640, which squeezes four
// tiles across inside a section card (the design page's .pa-kpi and .pa-need).
export const tileCardClass =
  "elevation-1 min-w-0 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-4";
export const tileLabelClass = "text-xs font-medium uppercase tracking-wide text-[var(--color-ink-500)]";

// The design page pictures the sign-in box lifted (#926 decision 14).
export const signInCardClass = "elevation-2 rounded-[var(--radius-lg)] bg-white p-6 sm:p-8";

export const clayNoticeClass =
  "rounded-[var(--radius-lg)] border border-[var(--color-clay-500)] bg-[var(--color-clay-100)] px-4 py-3 text-sm text-[var(--color-clay-700)]";

// Its own string, not cardClass plus a red edge: an appended border colour
// would fight cardClass's bone 200 edge in stylesheet order.
export const failureBoxClass = "rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-white px-4 py-3";
export const failureLineClass = "text-sm text-[var(--color-danger)]";

// "Loading…" while a page or a list reloads.
export const loadingLineClass = "text-sm text-[var(--color-ink-400)] motion-safe:animate-pulse";

// The design page's "Nothing matches" box, 48 by 16. Lifted like the cards
// around it (#926 decision 14), so it does not read as a different kind of box.
export const emptyStateClass =
  "elevation-1 flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white px-4 py-12 " +
  "text-center text-sm text-[var(--color-ink-500)]";

// WHY relative: an absolutely positioned child (an sr-only column heading)
// is placed against its nearest positioned ancestor. Without one here it
// escaped the scroll box and widened the whole page on a phone (Events, 360).
export const tableWrapClass =
  "elevation-1 relative overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white";

export const fieldLabelClass = "text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)]";
export const controlLabelClass = fieldLabelClass + " mb-1 block";

export const tableHeadRowClass = "border-b border-[var(--color-bone-200)] " + fieldLabelClass;
export const tableRowClass = "border-b border-[var(--color-bone-200)] last:border-b-0";
// cursor-pointer: the whole row opens its link (src/lib/rowLinkClick.ts).
export const tableLinkRowClass =
  tableRowClass + " cursor-pointer transition-colors duration-150 hover:bg-[var(--color-sage-100)]";
export const tableCellClass = "px-4 py-3";
// font-medium on the th itself: a browser draws th bold by default.
// whitespace-nowrap: a column heading stays on one line; the table scrolls
// inside tableWrapClass instead.
export const tableHeadCellClass = tableCellClass + " whitespace-nowrap font-medium";

// Shared by every admin button: one height, centred words that may wrap on a
// narrow phone, the press dim, and the off look, both for disabled and for
// aria-disabled (a working button that must keep keyboard focus).
const buttonBase =
  "inline-flex min-h-12 items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-center " +
  "transition-colors duration-150 " +
  PRESS_FEEDBACK +
  " disabled:opacity-50 disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:cursor-not-allowed ";

// WHY the red fill on hover and a red ring: the design page pictures the red
// outline filling red under the pointer (#926 decision 1), and a sage ring
// beside red words reads as a different control.
const BUTTON_LOOKS = {
  primary: "bg-[var(--color-sage-600)] font-semibold text-[var(--color-bone-50)] hover:bg-[var(--color-sage-700)] " + focusRingClass,
  secondary:
    "border border-[var(--color-bone-300)] bg-transparent font-medium text-[var(--color-ink-700)] " +
    "hover:bg-[var(--color-sage-100)] " +
    focusRingClass,
  danger:
    "border border-[var(--color-danger)] bg-transparent font-medium text-[var(--color-danger)] " +
    "hover:bg-[var(--color-danger)] hover:text-[var(--color-bone-50)] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)] focus-visible:ring-offset-2",
};

/** One button string: a look and a word size (14 px here, 16 px for a form's Save row in formClasses.ts). */
export function buttonClass(look: keyof typeof BUTTON_LOOKS, size: "text-sm" | "text-base" = "text-sm"): string {
  return buttonBase + size + " " + BUTTON_LOOKS[look];
}

export const primaryButtonClass = buttonClass("primary");
export const secondaryButtonClass = buttonClass("secondary");
export const dangerButtonClass = buttonClass("danger");

// Full width and left-aligned on purpose: secondaryButtonClass centres its
// words, and appending text-left to it would fight it in stylesheet order.
export const pickerOptionClass =
  "block w-full min-h-12 rounded-[var(--radius-md)] border border-[var(--color-bone-300)] bg-white px-4 py-2 text-left text-sm " +
  "text-[var(--color-ink-700)] transition-colors duration-150 hover:bg-[var(--color-sage-100)] " +
  PRESS_FEEDBACK +
  " " +
  focusRingClass;

// box-decoration-clone: a link that wraps draws its ring and hover tint
// whole on every line, not in ragged pieces.
export const bannerLinkClass =
  "rounded-[var(--radius-sm)] font-medium underline underline-offset-2 box-decoration-clone " + focusRingClass;

// The sage 100 tint under the pointer (#926 decision 1); sage 700 words on it stay readable.
export const linkClass =
  bannerLinkClass + " text-[var(--color-sage-700)] transition-colors duration-150 hover:bg-[var(--color-sage-100)]";

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
