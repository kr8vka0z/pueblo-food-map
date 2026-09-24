/**
 * HamburgerMenuFocusLateRemount — #545 follow-up.
 *
 * The first fix re-found the rebuilt bottom-bar item one microtask after
 * close. On a slow phone (and on a busy CI runner) the item can reappear a
 * frame or more later, so that single attempt missed and focus fell to
 * <body>. This harness brings the nav item back only after a delay and
 * proves focus still lands on it.
 */
import { useState } from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HamburgerMenu from "@/components/HamburgerMenu";

function LateNavHarness() {
  const [open, setOpen] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const openMenu = () => {
    setOpen(true);
    setNavVisible(false);
  };
  const closeMenu = () => {
    setOpen(false);
    // Bring the nav back two frames-plus after close, like a slow commit.
    setTimeout(() => setNavVisible(true), 40);
  };
  return (
    <>
      <HamburgerMenu locale="en" open={open} onClose={closeMenu} view="top" />
      {navVisible && (
        <button data-testid="nav-top" onClick={openMenu}>
          Menu
        </button>
      )}
    </>
  );
}

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

describe("#545 — focus returns even when the nav item remounts late", () => {
  test("close → nav reappears ~40ms later → focus lands on it, not <body>", async () => {
    render(<LateNavHarness />);
    fireEvent.click(screen.getByTestId("nav-top"));
    await waitFor(() => expect(screen.getByRole("menu")).toBeDefined());
    expect(screen.queryByTestId("nav-top")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /close menu/i }));

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId("nav-top"));
    });
  });
});
