/**
 * focusFirstProblem.ts — after a refused save, puts focus in the first box
 * marked wrong (aria-invalid) and scrolls it to the middle of the screen;
 * when the only problem is a line with no box of its own (a server error
 * such as the place form's hours line or the event form's `_form` line),
 * scrolls to that line instead (#926). Used by the admin place form
 * (AddVenueForm.tsx) and the admin event form (EventForm.tsx).
 */
export function focusFirstProblem(form: HTMLFormElement | null) {
  const target =
    form?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? form?.querySelector<HTMLElement>('[role="alert"]');
  if (!target) return;
  target.focus({ preventScroll: true });
  // Optional call: jsdom has no scrollIntoView.
  target.scrollIntoView?.({ block: "center" });
}
