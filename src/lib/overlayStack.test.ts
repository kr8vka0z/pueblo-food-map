/**
 * overlayStack — unit tests for the #527 additions to overlayRegistry.ts:
 * `useOverlayStackId`/`isTopmostOverlay` (Escape-ordering) and
 * `useScrollLock` (shared body-scroll lock). Proof against the REAL overlay
 * components (FilterPanel, HamburgerMenu, DesktopVenueWindow, BottomSheet)
 * lives in OverlayEscapeStack.test.tsx; this file only proves the shared
 * primitives' own logic in isolation, the same split overlayRegistry.test.ts
 * already uses for #542's registry.
 */
import { describe, test, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { isTopmostOverlay, useOverlayStackId, useScrollLock } from "./overlayRegistry";

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
