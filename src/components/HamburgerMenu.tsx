"use client";

/**
 * HamburgerMenu — the app drawer's SHELL. Controlled; it has no trigger of
 * its own. The actual Saved-list/Menu-items markup lives in
 * HamburgerMenuContent.tsx (#682 split) — this file owns only position,
 * backdrop, focus trap/return, Escape, outside-click and scroll lock, so the
 * same content can also render inside MapWrapper's DesktopSidePanel on the
 * map page's desktop layout (which needs a DIFFERENT shell — fixed right
 * panel, no backdrop, no Tab trap/outside-click, since it isn't a modal —
 * see DesktopSidePanel.tsx's own header for why those are deliberately
 * absent there).
 *
 * Still used, UNCHANGED, for:
 *   - Mobile (<768px), every page including the map — full-height slide-in
 *     side sheet from the right, ~80% viewport width.
 *   - Desktop (≥768px) on every NON-map page (PageNav) — ~280px dropdown
 *     top-right, below the search row. There's no map/side-panel context on
 *     those pages, so this dropdown stays the only way in.
 *
 * The map page's OWN desktop case (MapWrapper, ≥768px) does NOT render this
 * component at all — see MapWrapper's `sidePanelView` state (#682).
 *
 * Opened by BottomNav (docs/bottom-nav-spec.md §7) in one of two views:
 *   - "top"   (Menu)  — links (including /resources) and language.
 *   - "saved" (Saved) — ONLY the saved places, or an empty state when there
 *     are none. WHY two views, not one drawer scrolled to a section: with
 *     nothing saved the Saved section didn't render, so Saved opened the
 *     plain menu and looked like the same button as Menu (Kyle, 2026-09-16).
 *
 * Behavior:
 *   - Close on: X-button click, outside-click/tap (taps on the nav don't
 *     count — the nav toggles the drawer itself), Escape key.
 *   - Focus trap inside the panel while open.
 *   - Focus returns to whatever opened it (the nav item) on close.
 *
 * A11y:
 *   - Panel: role="menu", aria-label from i18n "menu.open".
 *   - Menu items: role="menuitem" (delegated to HamburgerMenuItem).
 *   - Mobile backdrop: aria-hidden="true" (decorative overlay).
 */

import { useCallback, useEffect, useRef, type RefObject } from "react";
import HamburgerMenuContent from "./HamburgerMenuContent";
import { BOTTOM_NAV_HEIGHT_PX, type MenuSection } from "./BottomNav";
import { useMediaQuery, MOBILE_QUERY, BELOW_2XL_QUERY } from "@/lib/useMediaQuery";
import type { Locale } from "@/lib/i18n";
import { useOverlayEscape, useOverlayRegistration, useScrollLock } from "@/lib/overlayRegistry";
import type { Venue } from "@/types/venue";
import type { ViewMode } from "@/lib/useMapUI";

interface HamburgerMenuProps {
  locale?: Locale;
  /**
   * Called when the user clicks "Show welcome screen" (#99).
   * Re-shows the splash WITHOUT clearing localStorage.
   */
  onShowWelcome?: () => void;
  /** Favorited venues (nearest-first), shown in the "saved" view (#132). */
  savedVenues?: Array<Venue & { distanceMiles?: number }>;
  /** Called when a saved venue row is tapped — selects it on the map. */
  onSelectVenue?: (id: string) => void;
  /** Whether the drawer is open (controlled by MapWrapper). */
  open: boolean;
  /** Called when the drawer asks to close (X, Escape, outside tap, item picked). */
  onClose: () => void;
  /** Which view the drawer shows: the menu ("top") or the saved places ("saved"). */
  view?: MenuSection;
  /** The nav bar — pointerdowns inside it are not "outside" (it toggles the drawer itself). */
  ignoreOutsideRef?: RefObject<HTMLElement | null>;
  /** Current view mode (#514) — decides the top menu line's label/icon/direction. */
  viewMode?: ViewMode;
  /** Called when the "List view"/"Map view" line is tapped. Omit to hide the line entirely. */
  onToggleView?: () => void;
  /** #165 — true while the map can't mount; hides the line rather than showing a dead action. */
  mapDisabled?: boolean;
}

// All focusable elements inside the panel for tab-trap.
const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function HamburgerMenu({
  locale,
  onShowWelcome,
  savedVenues = [],
  onSelectVenue,
  open,
  onClose,
  view = "top",
  ignoreOutsideRef,
  viewMode,
  onToggleView,
  mapDisabled = false,
}: HamburgerMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Element focused when the drawer opened (the nav item) — focus returns there on close.
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // ── Close helper ────────────────────────────────────────────────────────────

  const close = useCallback(() => {
    onClose();
    const capturedEl = returnFocusRef.current;
    const targetView = view;
    // #545: on mobile, BottomNav (and the item that opened this drawer)
    // unmounts while the drawer is open and remounts as brand-new DOM nodes
    // once it closes (the #542 registration below) — `capturedEl` can be a
    // detached node by the time focus needs to move, and `.focus()` on a
    // detached node silently no-ops, so focus fell to <body>. A still-live
    // trigger (the desktop dropdown variant) is focused directly; otherwise
    // re-find the rebuilt bottom-bar item by its stable data-testid
    // (BottomNav.tsx's `data-testid="nav-${section}"`). React doesn't
    // promise BottomNav has remounted by the next microtask — on a slow
    // phone the commit can land a frame or more later — so retry once per
    // animation frame, up to ~10 frames, instead of giving up after one try.
    const restoreFocus = (framesLeft: number) => {
      if (capturedEl && capturedEl.isConnected) {
        capturedEl.focus();
        return;
      }
      const rebuilt = document.querySelector<HTMLElement>(`[data-testid="nav-${targetView}"]`);
      if (rebuilt) rebuilt.focus();
      else if (framesLeft > 0) requestAnimationFrame(() => restoreFocus(framesLeft - 1));
    };
    queueMicrotask(() => restoreFocus(10));
  }, [onClose, view]);

  // ── Keyboard: Escape closes only the TOPMOST overlay (#527) ─────────────────

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault();
      close();
    },
    [close],
  );
  useOverlayEscape(open, handleEscape);

  // ── Outside click closes ────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !ignoreOutsideRef?.current?.contains(e.target as Node)
      ) {
        close();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, close, ignoreOutsideRef]);

  // ── Focus trap inside the panel ─────────────────────────────────────────────

  useEffect(() => {
    if (!open || !panelRef.current) return;

    // #545: on mobile, opening this drawer unmounts BottomNav (the #542
    // registration below) — that unmount can land BEFORE this passive effect
    // runs (the registration is a `useLayoutEffect`, which flushes ahead of
    // any `useEffect` in the same commit), so the button that triggered the
    // open is sometimes already gone from the DOM by the time this reads
    // `document.activeElement`. A detached element's removal resets
    // `activeElement` to `<body>` — excluding `<body>` here means `close()`
    // below correctly falls back to re-finding the bottom-bar item instead
    // of "capturing" `<body>` as if it were a real, focusable return target.
    if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
      returnFocusRef.current = document.activeElement;
    } else {
      // Nothing meaningful to capture (already reset to <body>) — clear any
      // stale reference from a previous open rather than let `close()` below
      // "successfully" focus a leftover element that has nothing to do with
      // this open.
      returnFocusRef.current = null;
    }

    // Move focus into the panel on open
    const firstFocusable = panelRef.current.querySelector<HTMLElement>(FOCUSABLE);
    firstFocusable?.focus();

    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => !el.hasAttribute("disabled"));

      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      // Re-targeting the open drawer (e.g. Saved -> Menu via the bottom nav,
      // which this effect doesn't re-run for — it only keys on [open]) can
      // leave focus on a bottom-nav button OUTSIDE the panel. The old check
      // only wrapped at first/last, so from outside, Tab escaped into page
      // content instead of re-entering the trap. Pull focus back in first.
      if (!panelRef.current.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleTab);
    return () => document.removeEventListener("keydown", handleTab);
  }, [open]);

  // ── Prevent body scroll while panel is open ──────────────────────────────────
  // #527: shared, ref-counted with every other overlay that wants the lock
  // (see overlayRegistry.ts's own header) — replaces this drawer's own
  // set/reset, which used to unlock scroll on close even while FilterPanel
  // was still open and wanted it locked too.
  useScrollLock(open);

  // Switching views while open (Saved → Menu) starts the new view at the top.
  // The scrollable element is HamburgerMenuContent's own inner body div now
  // (`.overflow-y-auto`), not this panel div itself — see that component's
  // header for why the header row had to move out of the scroll area.
  useEffect(() => {
    const scrollable = panelRef.current?.querySelector<HTMLElement>(".overflow-y-auto");
    if (open && scrollable) scrollable.scrollTop = 0;
  }, [open, view]);

  const isMobile = useMediaQuery(MOBILE_QUERY);
  const isBelow2xl = useMediaQuery(BELOW_2XL_QUERY);

  // #542: on mobile the drawer is a full-height side sheet covering the
  // whole screen — one of the "full-surface overlay hides the bottom bar"
  // cases — so BottomNav unmounts entirely while it's open there (see
  // overlayRegistry.ts). The tablet/desktop dropdown below (`panelStyle`'s
  // else branch: 280px, top-right) is NOT full-surface — its own
  // `maxHeight` already clears the bar via `barClearance` — so it stays out
  // of the registry and the bar stays visible for it, same as before.
  useOverlayRegistration(open && isMobile);

  // The bottom bar (z 1003) still draws over the tablet/desktop DROPDOWN
  // variant below 2xl (isBelow2xl but !isMobile) — keep its last item
  // scrollable clear of it there, same as before #542. On MOBILE this used
  // to reserve the same bar-height space inside the full-sheet's own
  // padding, but #542 now hides the bar outright while that sheet is open —
  // reserving its height inside the sheet is dead padding once the bar it
  // was clearing is never drawn; see `panelStyle`'s mobile branch below.
  const barClearance = isBelow2xl
    ? `calc(${BOTTOM_NAV_HEIGHT_PX}px + env(safe-area-inset-bottom))`
    : "0px";

  // Panel positioning style: fixed side-sheet on mobile, absolute dropdown on
  // desktop. Mobile stays edge-to-edge (top:0/height:100%) for the backdrop;
  // safe-area padding keeps its content clear of the notch, home indicator,
  // and edge. `display: flex, flexDirection: column, overflow: hidden`
  // (#682, both branches) — the scrolling now happens inside
  // HamburgerMenuContent's own body div, so the header row it also renders
  // can stay pinned above it, matching DesktopVenueWindow's own
  // header+scrollable-body split.
  const panelStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        top: 0,
        right: 0,
        height: "100%",
        width: "80vw",
        maxWidth: "384px",
        zIndex: 1002,
        backgroundColor: "white",
        boxShadow: "0 4px 32px rgba(0,0,0,0.22)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        paddingTop: "env(safe-area-inset-top)",
        // #542: BottomNav now unmounts entirely on mobile while this sheet
        // is open (see the registration above), so there's no bar left to
        // clear — only the home-indicator/notch safe area matters here.
        // Previously this reserved `barClearance` (the bar's own height)
        // for a bar that, post-#542, is never drawn underneath it.
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingRight: "env(safe-area-inset-right)",
      }
    : {
        position: "absolute", // inside the fixed wrapper below
        // 52px = the search row height at md+, where the deleted trigger
        // button sat — the dropdown keeps clearing the search box.
        top: "calc(52px + 8px)",
        right: 0,
        width: "280px",
        // Bounded so a long saved list scrolls and the drawer clears the bar below 2xl.
        maxHeight: `calc(100dvh - 92px - ${barClearance})`,
        zIndex: 1002,
        backgroundColor: "white",
        borderRadius: "8px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      };

  return (
    <div
      style={{
        // fixed, not absolute: PageNav mounts this drawer on scrolling pages too.
        position: "fixed",
        // Clears the notch/Dynamic Island (top) and the landscape edge (right).
        top: "max(16px, env(safe-area-inset-top))",
        right: "max(16px, env(safe-area-inset-right))",
        zIndex: 1002,
      }}
    >
      {/* ── Mobile backdrop ─────────────────────────────────────────────────── */}
      {open && isMobile && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(26,24,23,0.4)",
            zIndex: 1001,
          }}
          onClick={close}
        />
      )}

      {/* ── Panel ───────────────────────────────────────────────────────────── */}
      {open && (
        <div id="hamburger-panel" ref={panelRef} style={panelStyle}>
          <HamburgerMenuContent
            view={view}
            locale={locale}
            savedVenues={savedVenues}
            onSelectVenue={(id) => {
              close();
              onSelectVenue?.(id);
            }}
            onShowWelcome={onShowWelcome}
            viewMode={viewMode}
            onToggleView={onToggleView}
            mapDisabled={mapDisabled}
            onClose={close}
          />
        </div>
      )}
    </div>
  );
}
