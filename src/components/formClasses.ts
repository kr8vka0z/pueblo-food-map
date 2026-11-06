/**
 * formClasses.ts — the field, label and error class strings shared by the
 * admin forms (AddVenueForm, EventForm, AdminLoginForm), plus the admin
 * primary button. One copy so the forms cannot drift apart.
 */

// text-base on mobile: iOS Safari auto-zooms on focusing a field under 16px.
export const inputBase =
  "w-full rounded-[var(--radius-md)] border px-3 py-2 text-base md:text-sm text-[var(--color-ink-900)] " +
  // #534: --color-ink-300 undefined — DESIGN.md documents ink-400 as the
  // placeholder-text token.
  "bg-white placeholder:text-[var(--color-ink-400)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
  "focus-visible:border-[var(--color-sage-500)]";
export const inputBorder = (hasError: boolean) =>
  hasError ? "border-[var(--color-danger)]" : "border-[var(--color-bone-300)]";
export const errorClass = "mt-1 text-xs text-[var(--color-danger)]";
export const labelClass = "block text-sm font-medium text-[var(--color-ink-700)] mb-1";

/** Sage-filled primary action button (EventForm, EventSubmissionsList). */
export const ADMIN_PRIMARY_BUTTON =
  "inline-flex min-h-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-sage-600)] px-4 " +
  "text-base font-semibold text-[var(--color-bone-50)] transition-colors duration-150 hover:bg-[var(--color-sage-700)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
  "disabled:opacity-60 disabled:cursor-not-allowed";
