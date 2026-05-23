/**
 * HamburgerMenu tests — #71
 *
 * Covers:
 *   1. Renders the hamburger button with correct aria attributes (collapsed state).
 *   2. Opens panel on button click; aria-expanded becomes true.
 *   3. Panel has role="menu" and contains "Suggest a venue" link.
 *   4. Closes on X button click; panel unmounts.
 *   5. Closes on outside click; panel unmounts.
 *   6. Closes on Escape key; panel unmounts.
 *   7. Focus returns to hamburger button after Escape close.
 *   8. Focus returns to hamburger button after X-button close.
 *   9. "Suggest a venue" link points to /suggest.
 *  10. ES locale: aria-labels show Spanish strings.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HamburgerMenu from "@/components/HamburgerMenu";

// Mock next/link — renders a plain <a> in tests
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// Stub window.matchMedia — not available in jsdom (used for mobile breakpoint detection)
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

function renderMenu(locale: "en" | "es" = "en") {
  return render(<HamburgerMenu locale={locale} />);
}

describe("HamburgerMenu — collapsed state", () => {
  test("renders hamburger trigger button", () => {
    renderMenu();
    const btn = screen.getByRole("button", { name: /Open menu/i });
    expect(btn).toBeDefined();
  });

  test("aria-expanded is false when closed", () => {
    renderMenu();
    const btn = screen.getByRole("button", { name: /Open menu/i }) as HTMLButtonElement;
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  test("aria-haspopup is 'menu'", () => {
    renderMenu();
    const btn = screen.getByRole("button", { name: /Open menu/i }) as HTMLButtonElement;
    expect(btn.getAttribute("aria-haspopup")).toBe("menu");
  });

  test("panel is not in DOM when closed", () => {
    renderMenu();
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("HamburgerMenu — open state", () => {
  test("panel appears after button click", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeDefined();
    });
  });

  test("aria-expanded becomes true after opening", async () => {
    const user = userEvent.setup();
    renderMenu();
    const btn = screen.getByRole("button", { name: /Open menu/i }) as HTMLButtonElement;
    await user.click(btn);
    await waitFor(() => {
      expect(btn.getAttribute("aria-expanded")).toBe("true");
    });
  });

  test("panel contains 'Suggest a venue' link", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /Suggest a venue/i });
      expect(link).toBeDefined();
      expect((link as HTMLAnchorElement).href).toContain("/suggest");
    });
  });

  test("X close button is present in panel", async () => {
    const user = userEvent.setup();
    renderMenu();
    // Open menu first, then find X button by its specific close-panel role
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Close menu/i })).toBeDefined();
    });
  });
});

describe("HamburgerMenu — close behaviors", () => {
  test("closes on X button click", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => expect(screen.getByRole("menu")).toBeDefined());

    await user.click(screen.getByRole("button", { name: /Close menu/i }));
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
  });

  test("closes on Escape key", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => expect(screen.getByRole("menu")).toBeDefined());

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
  });

  test("closes on outside click", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => expect(screen.getByRole("menu")).toBeDefined());

    // Click outside the menu container
    fireEvent.pointerDown(document.body);
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
  });

  test("focus returns to hamburger button after Escape", async () => {
    const user = userEvent.setup();
    renderMenu();
    const triggerBtn = screen.getByRole("button", { name: /Open menu/i });
    await user.click(triggerBtn);
    await waitFor(() => expect(screen.getByRole("menu")).toBeDefined());

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
      expect(document.activeElement).toBe(triggerBtn);
    });
  });

  test("focus returns to hamburger button after X-button close", async () => {
    const user = userEvent.setup();
    renderMenu();
    const triggerBtn = screen.getByRole("button", { name: /Open menu/i });
    await user.click(triggerBtn);
    await waitFor(() => expect(screen.getByRole("menu")).toBeDefined());

    await user.click(screen.getByRole("button", { name: /Close menu/i }));
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
      expect(document.activeElement).toBe(triggerBtn);
    });
  });
});

describe("HamburgerMenu — locale", () => {
  test("ES locale: trigger button shows Spanish aria-label", () => {
    renderMenu("es");
    expect(screen.getByRole("button", { name: /Abrir menú/i })).toBeDefined();
  });

  test("ES locale: X button shows Spanish close label", async () => {
    const user = userEvent.setup();
    renderMenu("es");
    await user.click(screen.getByRole("button", { name: /Abrir menú/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Cerrar menú/i })).toBeDefined();
    });
  });

  test("ES locale: menu item shows Spanish label", async () => {
    const user = userEvent.setup();
    renderMenu("es");
    await user.click(screen.getByRole("button", { name: /Abrir menú/i }));
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Sugerir un lugar/i })).toBeDefined();
    });
  });
});
