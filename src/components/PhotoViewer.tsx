"use client";

/**
 * PhotoViewer — full-screen lightbox for a single photo (#508).
 *
 * Native `<dialog>` + `showModal()`, no library: this codebase has no
 * existing modal component (ArchiveVenueButton.tsx's own header notes the
 * same gap and reaches for a native primitive too), and `showModal()` gives
 * us three of the four required close paths for free — Escape and the
 * browser/OS back gesture both fire the dialog's native `cancel`/`close`
 * events without any keyboard-listener code here. The dialog is sized to
 * fill the viewport (`w-dvw h-dvh`, no border/padding of its own) so there
 * is no native backdrop to style; a plain child `<div>` supplies the dark
 * scrim instead, and its own onClick is the fourth close path — "tap
 * outside the photo" — while a `stopPropagation` on the `<img>` itself is
 * what keeps a tap ON the photo from bubbling up and closing it.
 *
 * Deliberately generic — `src`/`alt`/`caption`/`open`/`onClose` only, no
 * box-specific types imported — so #511 (photo entries in the box history
 * log) can reuse this unchanged instead of forking a second lightbox.
 * `locale` follows the same required-prop convention DirectionButtons.tsx's
 * `WalkRouteStatus` already uses for a shared display component: the caller
 * always has a locale in scope, so threading it in avoids this component
 * needing its own `useLocale()` import.
 *
 * Escape closing ONLY this dialog (fix pass, 2026-09-19, review blocker):
 * nothing in THIS file handles Escape — that's still correct and
 * deliberate, the native dialog closes itself. The bug it looked like at
 * first was the opposite direction: BottomSheet.tsx (vaul/Radix) and
 * DesktopVenueWindow.tsx each own a document-level Escape-to-dismiss-the-
 * whole-card listener that fired IN ADDITION to this dialog's own close,
 * so opening a photo and pressing Escape closed the card underneath it
 * too. Fixed in those two files (see `dialogGuard.ts`'s own header for the
 * full trace through vaul/Radix's source and why the fix has to live
 * there, not here).
 *
 * Focus restore on close (same fix pass, review item 2): explicit, not
 * relied-on-native — `document.activeElement` at the moment `open` flips
 * true is stored and refocused on close. A real browser's `showModal()`/
 * `close()` already does this automatically, but this repo's jsdom test
 * environment has no native `<dialog>` implementation at all (see
 * vitest.setup.ts's polyfill note) and the polyfill doesn't model focus
 * management — so relying on "native behavior" here would be untested by
 * construction, not just untested in this repo's suite.
 */

import { useEffect, useRef } from "react";
import { t, type Locale } from "@/lib/i18n";
import { useOverlayRegistration } from "@/lib/overlayRegistry";

export interface PhotoViewerProps {
  /** Image URL, passed straight to the <img src>. */
  src: string;
  /** Accessible alt text AND the dialog's own aria-label (there's no separate heading). */
  alt: string;
  /** Optional caption line rendered under the photo (e.g. "Photo · 2 hours ago"). */
  caption?: string;
  open: boolean;
  onClose: () => void;
  locale: Locale;
}

export default function PhotoViewer({ src, alt, caption, open, onClose, locale }: PhotoViewerProps) {
  // #542: full-screen at every width (no desktop variant, unlike
  // HamburgerMenu/FilterPanel) — always hides BottomNav while open.
  useOverlayRegistration(open);

  const dialogRef = useRef<HTMLDialogElement>(null);
  // Whatever had focus right before this opened (the card's "View photo
  // full size" button, in practice) — captured explicitly rather than
  // relied on native restore-focus behavior; see this file's own header.
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  // "Latest ref" for onClose — read inside the close listener below instead
  // of putting `onClose` in that effect's own dependency array. Found via
  // this fix pass's own focus-restore test (nested harness re-rendering
  // PhotoViewer with a fresh inline `onClose` each time, exactly like
  // BoxCardBody does in production): React runs ALL changed effects'
  // CLEANUPS before ANY of their bodies, in declaration order. On the
  // render where `open` flips false, `onClose`'s identity ALSO changes (a
  // new inline arrow every render) — so the old `close` listener was torn
  // down, then this effect's own `dialog.close()` fired the native `close`
  // event, and only THEN did the new listener get attached — one commit
  // too late, silently dropping the event this component depends on for
  // both state sync and focus restore. The ref is updated from an effect
  // (not during render — the repo's `react-hooks/refs` lint rule forbids
  // that, and it's also just wrong: refs aren't render inputs) so it is
  // always current by the time the native `close` event can fire; the
  // listener itself is attached exactly once, on mount, and never
  // re-subscribes on `onClose` identity churn.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Drive the dialog's open/closed state imperatively — <dialog> has no
  // declarative `open`-via-attribute path that also gets the modal
  // backdrop/focus-trap/Escape behavior; only showModal()/close() do.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // The dialog's native `close` event fires however it closed — our own
  // close button, the overlay tap, Escape, or the back gesture — so this is
  // the single place that syncs the parent's `open` state back to false
  // AND restores focus, rather than duplicating both at every close path
  // above. Mount-once (`dialogRef.current` is stable across this
  // component's lifetime) — see the onCloseRef comment above for why.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function handleClose() {
      onCloseRef.current();
      previouslyFocusedRef.current?.focus();
    }
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-label={alt}
      className="m-0 h-dvh max-h-none w-dvw max-w-none border-0 bg-transparent p-0 backdrop:bg-transparent"
    >
      {/* Only mounted while open: a browser hides a <dialog> without the
          `open` attribute via its own UA stylesheet, but jsdom (this repo's
          test environment — see vitest.setup.ts's dialog polyfill note)
          applies no such stylesheet, so an always-rendered subtree would
          stay "visible" to queries even while closed. Gating on `open` here
          keeps test and browser behavior the same rather than relying on a
          CSS rule the test environment doesn't have. */}
      {open && (
        // Dark scrim + centered photo. onClick here (not stopped by a click
        // on the caption or the empty scrim) is the "tap outside the photo"
        // close path; the <img>'s own stopPropagation is what excludes taps
        // on the photo itself.
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-3 p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.92)" }}
          onClick={onClose}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label={t("detail.close", locale)}
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(255,255,255,0.12)] text-2xl leading-none text-[var(--color-bone-50)] hover:bg-[rgba(255,255,255,0.2)]"
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- runtime, arbitrary source; not a build-time asset next/image can optimize */}
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[calc(100dvh-6rem)] max-w-full object-contain"
          />
          {caption && (
            <p className="max-w-full px-4 text-center text-sm text-[var(--color-bone-100)]">{caption}</p>
          )}
        </div>
      )}
    </dialog>
  );
}
