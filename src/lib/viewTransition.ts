/**
 * Runs an in-page state update inside `document.startViewTransition` when the
 * browser supports it and the user has not asked for reduced motion. Falls
 * back to calling `update()` synchronously in older browsers and jsdom.
 */
export function runViewTransition(update: () => void): void {
  if (typeof document === "undefined" || typeof window === "undefined") {
    update();
    return;
  }
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  if (reduced || typeof doc.startViewTransition !== "function") {
    update();
    return;
  }
  doc.startViewTransition(update);
}
