/**
 * overlayStack — unit tests for the #527 additions to overlayRegistry.ts:
 * `useOverlayStackId`/`isTopmostOverlay` (Escape-ordering), `claimEscape`
 * (#604 review — see its own describe block below), and `useScrollLock`
 * (shared body-scroll lock). Proof against the REAL overlay components
 * (FilterPanel, HamburgerMenu, DesktopVenueWindow, BottomSheet) lives in
 * OverlayEscapeStack.test.tsx; this file only proves the shared primitives'
 * own logic in isolation, the same split overlayRegistry.test.ts already
 * uses for #542's registry.
 */
import { describe, test, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { claimEscape, isTopmostOverlay, useOverlayEscape, useOverlayStackId, useScrollLock } from "./overlayRegistry";

describe("useOverlayStackId / isTopmostOverlay", () => {
  test("a single open overlay is topmost", () => {
    const { result } = renderHook(() => useOverlayStackId(true));
    expect(isTopmostOverlay(result.current)).toBe(true);
  });

  test("an overlay registered with isOpen=false is never topmost", () => {
    const { result } = renderHook(() => useOverlayStackId(false));
    expect(isTopmostOverlay(result.current)).toBe(false);
  });

  test("the SECOND overlay opened is topmost; the first is not", () => {
    const first = renderHook(() => useOverlayStackId(true));
    const second = renderHook(() => useOverlayStackId(true));
    expect(isTopmostOverlay(first.result.current)).toBe(false);
    expect(isTopmostOverlay(second.result.current)).toBe(true);
  });

  test("closing the topmost overlay promotes the one under it", () => {
    const first = renderHook(() => useOverlayStackId(true));
    const second = renderHook(() => useOverlayStackId(true));
    expect(isTopmostOverlay(second.result.current)).toBe(true);

    second.unmount();
    expect(isTopmostOverlay(first.result.current)).toBe(true);
  });

  test("closing a NON-topmost overlay leaves the topmost one unchanged", () => {
    const first = renderHook(() => useOverlayStackId(true));
    const second = renderHook(() => useOverlayStackId(true));
    expect(isTopmostOverlay(second.result.current)).toBe(true);

    first.unmount();
    expect(isTopmostOverlay(second.result.current)).toBe(true);
  });

  test("toggling isOpen on an existing registration moves it on/off the stack without unmounting", () => {
    const overlay = renderHook(({ open }) => useOverlayStackId(open), {
      initialProps: { open: false },
    });
    expect(isTopmostOverlay(overlay.result.current)).toBe(false);

    act(() => overlay.rerender({ open: true }));
    expect(isTopmostOverlay(overlay.result.current)).toBe(true);

    act(() => overlay.rerender({ open: false }));
    expect(isTopmostOverlay(overlay.result.current)).toBe(false);
  });
});

// PR #604 review — the real-browser hole a plain `isTopmostOverlay` check
// (jsdom's synchronous, checkpoint-free dispatchEvent can't reproduce) left
// open: a microtask checkpoint between individual listener invocations in a
// real browser lets the FIRST listener's close commit (popping the stack)
// BEFORE a later listener for the SAME keydown runs, so that later listener
// wrongly reads itself as topmost too. See overlayRegistry.ts's own header
// on `claimEscape` for the full mechanism.
describe("claimEscape (#604 — one Escape event claimable exactly once)", () => {
  test("the topmost id claims a fresh event", () => {
    const top = renderHook(() => useOverlayStackId(true));
    const event = new Event("keydown");
    expect(claimEscape(top.result.current, event)).toBe(true);
  });

  test("a non-topmost id cannot claim, and does NOT consume the event — the real topmost can still claim it after", () => {
    const bottom = renderHook(() => useOverlayStackId(true));
    const top = renderHook(() => useOverlayStackId(true));
    const event = new Event("keydown");

    expect(claimEscape(bottom.result.current, event)).toBe(false);
    // Still unclaimed — the topmost's own (later-running, e.g. bubble-phase)
    // check must still be able to win it.
    expect(claimEscape(top.result.current, event)).toBe(true);
  });

  test("a second claim attempt on the SAME event fails, even for the id that legitimately won it", () => {
    const top = renderHook(() => useOverlayStackId(true));
    const event = new Event("keydown");
    expect(claimEscape(top.result.current, event)).toBe(true);
    expect(claimEscape(top.result.current, event)).toBe(false);
  });

  test("two DIFFERENT event objects are independent — claiming one doesn't block the other", () => {
    const top = renderHook(() => useOverlayStackId(true));
    const eventA = new Event("keydown");
    const eventB = new Event("keydown");
    expect(claimEscape(top.result.current, eventA)).toBe(true);
    expect(claimEscape(top.result.current, eventB)).toBe(true);
  });

  // The exact real-browser race #604 flagged: FilterPanel open, then a
  // BottomSheet on top. Radix's Escape handling is a document CAPTURE-phase
  // listener (always invoked before any bubble-phase listener, regardless of
  // registration/open order — see dialogGuard.ts's header) — so the sheet's
  // own claim-and-close runs FIRST for a real Escape keydown. This test
  // forces the same observable effect a real browser's microtask checkpoint
  // between listeners would produce (the topmost overlay's close
  // synchronously popping the stack) directly, via a real capture-phase
  // listener plus a synchronous `unmount()` inside it, rather than relying
  // on jsdom to reproduce that browser timing quirk (it doesn't — jsdom's
  // dispatchEvent runs every listener back-to-back with no checkpoint
  // between them, which is exactly why this bug shipped past the #527 tests
  // undetected).
  test("real DOM dispatch: topmost overlay's synchronous close (capture phase) must not let the overlay underneath ALSO close for the SAME Escape", () => {
    const bottomOnEscape = vi.fn();
    const bottom = renderHook(() => useOverlayEscape(true, bottomOnEscape));

    const top = renderHook(() => useOverlayStackId(true));
    const topId = top.result.current;
    expect(isTopmostOverlay(topId)).toBe(true);

    // Stands in for BottomSheet.tsx's real onEscapeKeyDown: claims the event,
    // then closes synchronously (a real close's React commit, flushed via a
    // real browser's between-listener microtask checkpoint, would pop `topId`
    // off the stack by this same point — `unmount()` reproduces that pop
    // directly and synchronously, matching the review's "act() inside the
    // handler" suggestion).
    function captureListener(event: Event) {
      if ((event as KeyboardEvent).key !== "Escape") return;
      if (!claimEscape(topId, event)) {
        event.preventDefault();
        return;
      }
      top.unmount();
    }
    document.addEventListener("keydown", captureListener, { capture: true });

    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    document.dispatchEvent(event);

    // The overlay underneath must NOT also close for the same keydown, even
    // though it reads as topmost BY THE TIME its own bubble-phase listener
    // runs (the capture-phase close above already popped `topId`).
    expect(bottomOnEscape).not.toHaveBeenCalled();

    document.removeEventListener("keydown", captureListener, { capture: true });
    bottom.unmount();
  });
});

describe("useScrollLock", () => {
  test("locks body scroll while isLocked is true, restores it on unmount", () => {
    expect(document.body.style.overflow).toBe("");
    const overlay = renderHook(() => useScrollLock(true));
    expect(document.body.style.overflow).toBe("hidden");

    overlay.unmount();
    expect(document.body.style.overflow).toBe("");
  });

  test("isLocked=false never locks", () => {
    const overlay = renderHook(() => useScrollLock(false));
    expect(document.body.style.overflow).toBe("");
    overlay.unmount();
    expect(document.body.style.overflow).toBe("");
  });

  // The exact shape #527 exists to fix: two lockers, closing one must not
  // unlock scroll out from under the other.
  test("two overlays locked, releasing one leaves scroll locked; releasing both clears it", () => {
    const a = renderHook(() => useScrollLock(true));
    const b = renderHook(() => useScrollLock(true));
    expect(document.body.style.overflow).toBe("hidden");

    a.unmount();
    expect(document.body.style.overflow).toBe("hidden");

    b.unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
