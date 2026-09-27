"use client";

/**
 * DesktopSidePanel — the floating right-hand panel shell for desktop (#682).
 *
 * WHY this exists: DesktopVenueWindow used to anchor itself beside the
 * clicked marker with hand-rolled edge-flip math (top-right of the pin,
 * flip left/above if it would clip an edge). Whenever the pin sat near the
 * search bar or the bottom bar, the card still landed under one of them —
 * edge-flipping avoids the viewport edge, not the app's own floating chrome.
 * Kyle's fix (option B, mockups 2026-09-26): ONE floating panel, always in
 * the same place, and the map pans the SELECTED PIN clear of it instead —
 * see MapWrapper's pan-on-select effect.
 *
 * 8b (Saved/Menu as panel views): this shell now owns Escape handling and
 * focus management for WHATEVER view is showing (venue card, Saved list, or
 * Menu) — 8a left that inside DesktopVenueWindow itself, which worked while
 * the venue card was the only thing the panel could ever show, but Saved/
 * Menu content (HamburgerMenuContent) has none of its own. A single
 * registration point here means Saved/Menu don't need to duplicate it.
 *
 *   - Escape: the same isNativeDialogOpen()/typing-guard DesktopVenueWindow
 *     used to run itself (see dialogGuard.ts, and the #508/box-check-in
 *     comment this used to carry) — verbatim, just generalized to "is focus
 *     on a form control INSIDE THIS PANEL" instead of "inside this venue
 *     window" specifically. Registers via the shared overlay-escape stack
 *     (overlayRegistry.ts), so Filters opened on top of this panel still
 *     closes Filters first (#527/#604).
 *   - Focus-to-heading on view change: `headingId` names the CURRENT view's
 *     own focusable `<h2 tabIndex={-1}>` (DesktopVenueWindow's venue-name
 *     heading, or HamburgerMenuContent's title when given a headingId) —
 *     focused whenever it changes, so switching Saved -> a venue -> back
 *     always lands focus somewhere sane for a keyboard/screen-reader user.
 *   - Focus-return-to-trigger: captured in an effect keyed on `headingId`,
 *     but ONLY when focus is currently OUTSIDE this panel — a pin click or a
 *     bar-item click (both outside) recaptures the trigger; a click INSIDE
 *     the panel that changes the view (a saved row, the "← Saved" link)
 *     does NOT, so closing still returns focus to whatever opened the panel
 *     from outside, not to whichever inside row happened to be clicked last.
 *     This effect must run BEFORE the focus-to-heading one below (React
 *     runs effects in declaration order), since focus-to-heading moves
 *     `document.activeElement` INSIDE the panel — reversed, every view
 *     change would look like an "inside click" to the capture check.
 *
 * "Overlay registration" here means the Escape STACK (`useOverlayEscape`,
 * `overlayRegistry.ts`) — deliberately NOT `useOverlayRegistration` (the
 * "hide BottomNav while any full-surface overlay is open" registry). This
 * panel is not full-surface: the bar stays visible and shifts left instead
 * (MapWrapper's `rightInset`), and re-clicking the lit bar item is how one
 * of the ways to close the panel — hiding the bar would break that.
 *
 * No Tab trap, no outside-click-to-close: `aria-modal="false"`, same as the
 * DesktopVenueWindow this replaces (which never had either either) — a
 * deliberate, non-modal panel, not a dialog overlay.
 *
 * `react-hooks/refs` on the `children(handleClose)` render call below is a
 * false positive: `handleClose` closes over `triggerRef`/`onClose` but only
 * DEREFERENCES the ref when actually invoked (a click or Escape), never
 * during this render — the rule can't tell "invoked now" from "passed as a
 * value for later" and flags every ref-closing callback threaded through a
 * render prop.
 */

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { isNativeDialogOpen } from "@/lib/dialogGuard";
import { useOverlayEscape } from "@/lib/overlayRegistry";

interface DesktopSidePanelProps {
  /** Renders the panel when true; unmounts (returns null) when false. */
  open: boolean;
  /** Called on Escape, or when a view's own close control fires the render-prop below. */
  onClose: () => void;
  /** id of the CURRENT view's own focusable heading — focused on mount and on every change. */
  headingId: string;
  /** Render prop: receives the wrapped closer (onClose + focus-restore) — see file header. */
  children: (close: () => void) => ReactNode;
}

export const DESKTOP_PANEL_WIDTH_PX = 380;
export const DESKTOP_PANEL_INSET_PX = 12;
export const DESKTOP_PANEL_RIGHT_CLEARANCE_PX = DESKTOP_PANEL_WIDTH_PX + DESKTOP_PANEL_INSET_PX + 12;

export default function DesktopSidePanel({ open, onClose, headingId, children }: DesktopSidePanelProps) {
  // Rules-of-hooks: every hook below only makes sense while mounted, and
  // this component only mounts while `open` — so the early return has to
  // happen in THIS component, before any hook runs, not inside the one that
  // holds them (see DesktopSidePanelShell).
  if (!open) return null;
  return (
    <DesktopSidePanelShell onClose={onClose} headingId={headingId}>
      {children}
    </DesktopSidePanelShell>
  );
}

function DesktopSidePanelShell({
  onClose,
  headingId,
  children,
}: Omit<DesktopSidePanelProps, "open">) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const handleClose = useCallback(() => {
    onClose();
    const el = triggerRef.current;
    if (el?.isConnected) queueMicrotask(() => el.focus());
  }, [onClose]);

  const handleEscape = useCallback(() => {
    // #508 (moved from DesktopVenueWindow, 8b): Escape while a box's
    // PhotoViewer is open must close ONLY the photo, not this whole panel.
    if (isNativeDialogOpen()) return;
    // A box's check-in panel (BoxCardBody -> BoxCheckinPanel) has a note
    // textarea living inside whatever view is showing. Without this guard,
    // Escape while typing a note both loses focus AND closes the whole
    // panel — the browser's own "Escape clears an input" behavior competing
    // with this panel's own Escape-to-dismiss. Only global-dismiss when
    // focus is on the panel shell itself, not on a form control inside it.
    const active = document.activeElement;
    const typing = active instanceof HTMLElement && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");
    if (typing && panelRef.current?.contains(active)) return;
    handleClose();
  }, [handleClose]);
  // This shell is mounted only while the panel is open — i.e. always "open"
  // for the life of the instance — so it registers unconditionally (`true`),
  // same reasoning DesktopVenueWindow's own registration used to give.
  // `useOverlayEscape` only invokes the callback while THIS panel is the
  // TOPMOST overlay, so Filters opened on top no longer also closes this.
  useOverlayEscape(true, handleEscape);

  // Capture the return-focus target — see this file's header for the full
  // "outside click only" reasoning. MUST run before the focus-to-heading
  // effect below (declaration order = effect order).
  useEffect(() => {
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      active !== document.body &&
      !panelRef.current?.contains(active)
    ) {
      triggerRef.current = active;
    }
  }, [headingId]);

  // Focus the current view's heading whenever it changes (including mount).
  useEffect(() => {
    const heading = document.getElementById(headingId);
    if (heading?.isConnected) heading.focus();
  }, [headingId]);

  return (
    <div
      ref={panelRef}
      data-testid="desktop-side-panel"
      className={
        // Absolute within MapWrapper's full-viewport `relative` root (same
        // containing block DesktopVenueWindow used to position itself
        // against) — full height via top/bottom insets rather than a
        // measured height, so no ResizeObserver/layout math is needed.
        "absolute z-[900] flex flex-col " +
        "bg-[var(--color-bone-50)] " +
        "rounded-[var(--radius-lg)] " +
        "border border-[var(--color-bone-200)] " +
        // Same heavy hand-written shadow DesktopVenueWindow used to lift a
        // floating card off the map surface (DESIGN.md).
        "shadow-[0_8px_32px_rgba(0,0,0,0.18)] " +
        "overflow-hidden"
      }
      style={{
        top: DESKTOP_PANEL_INSET_PX,
        right: DESKTOP_PANEL_INSET_PX,
        bottom: DESKTOP_PANEL_INSET_PX,
        width: DESKTOP_PANEL_WIDTH_PX,
      }}
    >
      {/* eslint-disable-next-line react-hooks/refs -- false positive, see file header. */}
      {children(handleClose)}
    </div>
  );
}
