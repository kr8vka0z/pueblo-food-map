/**
 * overlayRegistry — unit tests for the shared "is any full-surface overlay
 * open" registry (#542). Proof that each REAL overlay component (Menu,
 * Filters, PhotoViewer, the route steps sheet) wires into this and actually
 * hides BottomNav lives in OverlayHidesBottomNav.test.tsx and
 * RouteNavVisibility.test.tsx; this file only proves the registry's own
 * counting logic in isolation.
 */
import { describe, test, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOverlayRegistration, useAnyOverlayOpen } from "./overlayRegistry";

describe("overlayRegistry", () => {
  test("no overlays open by default", () => {
    const { result } = renderHook(() => useAnyOverlayOpen());
    expect(result.current).toBe(false);
  });

  test("registering an open overlay flips the shared flag true; unmounting flips it back", () => {
    const flag = renderHook(() => useAnyOverlayOpen());
    expect(flag.result.current).toBe(false);

    const overlay = renderHook(() => useOverlayRegistration(true));
    expect(flag.result.current).toBe(true);

    overlay.unmount();
    expect(flag.result.current).toBe(false);
  });

  test("an overlay registered with isOpen=false never sets the flag", () => {
    const flag = renderHook(() => useAnyOverlayOpen());
    const overlay = renderHook(({ open }) => useOverlayRegistration(open), {
      initialProps: { open: false },
    });
    expect(flag.result.current).toBe(false);
    overlay.unmount();
    expect(flag.result.current).toBe(false);
  });

  test("toggling isOpen on an existing registration flips the flag without unmounting", () => {
    const flag = renderHook(() => useAnyOverlayOpen());
    const overlay = renderHook(({ open }) => useOverlayRegistration(open), {
      initialProps: { open: false },
    });
    expect(flag.result.current).toBe(false);

    act(() => overlay.rerender({ open: true }));
    expect(flag.result.current).toBe(true);

    act(() => overlay.rerender({ open: false }));
    expect(flag.result.current).toBe(false);
  });

  // The exact shape #542's acceptance criteria ask for: "two overlays open
  // then one closed keeps it hidden."
  test("two overlays open, closing one leaves the flag true; closing both clears it", () => {
    const flag = renderHook(() => useAnyOverlayOpen());
    const overlayA = renderHook(() => useOverlayRegistration(true));
    const overlayB = renderHook(() => useOverlayRegistration(true));
    expect(flag.result.current).toBe(true);

    overlayA.unmount();
    expect(flag.result.current).toBe(true);

    overlayB.unmount();
    expect(flag.result.current).toBe(false);
  });
});
