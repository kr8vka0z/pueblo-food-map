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
 * see MapWrapper's pan-on-select effect. This component owns only that
 * fixed position, size and chrome (inset, radius, shadow, scroll); it has no
 * opinion on what's inside.
 *
 * `open` is a plain unmount gate, not an animated show/hide — same as the
 * DesktopVenueWindow it replaces positioning for. Content owns its own
 * dialog semantics (role="dialog", Escape, focus-on-mount) — see
 * DesktopVenueWindow's own header for why that logic stayed there rather
 * than moving up here for this slice (#682 8a is venue/box cards only; a
 * later slice adding Saved/Menu as panel views will need the same
 * Escape/focus wiring for THOSE views too, at which point lifting it here
 * stops being premature).
 */

import type { ReactNode } from "react";

interface DesktopSidePanelProps {
  /** Renders the panel when true; unmounts (returns null) when false. */
  open: boolean;
  children: ReactNode;
}

/** Panel width (#682 mockup: "at least 340px" — fixed here, so the floor is trivially met). */
export const DESKTOP_PANEL_WIDTH_PX = 380;
/** Inset from the viewport edge on all three open sides (top/right/bottom). */
export const DESKTOP_PANEL_INSET_PX = 12;
/**
 * How far the map/search bar/bottom bar must clear the panel's LEFT edge —
 * the panel's own footprint (width + its right inset) plus a small breathing
 * gap so a pin or bar doesn't sit flush against the panel. Shared by
 * MapWrapper's bar-shift props, fit-bounds padding and pan-on-select math so
 * all three agree on where the panel actually is.
 */
export const DESKTOP_PANEL_RIGHT_CLEARANCE_PX = DESKTOP_PANEL_WIDTH_PX + DESKTOP_PANEL_INSET_PX + 12;

export default function DesktopSidePanel({ open, children }: DesktopSidePanelProps) {
  if (!open) return null;

  return (
    <div
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
      {children}
    </div>
  );
}
