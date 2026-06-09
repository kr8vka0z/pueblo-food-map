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
import { LocaleProvider } from "@/lib/LocaleContext";

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

function renderMenuWithWelcome(onShowWelcome = vi.fn(), locale: "en" | "es" = "en") {
  return { onShowWelcome, ...render(<HamburgerMenu locale={locale} onShowWelcome={onShowWelcome} />) };
}

function renderMenuWithLocaleProvider(locale: "en" | "es" = "en", initialLocale: "en" | "es" = "en") {
  return render(
    <LocaleProvider initialLocale={initialLocale}>
      <HamburgerMenu locale={locale} />
    </LocaleProvider>,
  );
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

  test("Get help section renders the four assistance links (#131)", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      const co211 = screen.getByRole("link", { name: /2-1-1 Colorado/i }) as HTMLAnchorElement;
      const snap = screen.getByRole("link", { name: /Apply for SNAP/i }) as HTMLAnchorElement;
      const wic = screen.getByRole("link", { name: /Apply for WIC/i }) as HTMLAnchorElement;
      const hotline = screen.getByRole("link", { name: /Food hotline/i }) as HTMLAnchorElement;

      expect(co211.href).toContain("211colorado.org");
      expect(snap.href).toContain("cdhs.colorado.gov/snap");
      expect(wic.href).toContain("coloradowic.gov");
      expect(hotline.href).toContain("tel:");
      expect(hotline.href).toContain("8558554626");

      // Web resources open in a new tab; the hotline is a tap-to-call link.
      expect(co211.target).toBe("_blank");
      expect(snap.target).toBe("_blank");
      expect(wic.target).toBe("_blank");
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

// ─── #96: About Pueblo Food Project ──────────────────────────────────────────

describe("#96 — About Pueblo Food Project menu item", () => {
  test("'About' item renders in the open panel (EN)", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      expect(screen.getByText("About Pueblo Food Project")).toBeDefined();
    });
  });

  test("'About' link href is correct", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /About Pueblo Food Project/i });
      expect((link as HTMLAnchorElement).href).toContain("pueblofoodproject.org/about/");
    });
  });

  test("'About' link has target='_blank'", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /About Pueblo Food Project/i });
      expect((link as HTMLAnchorElement).target).toBe("_blank");
    });
  });

  test("'About' link has rel containing noopener and noreferrer", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /About Pueblo Food Project/i });
      const rel = (link as HTMLAnchorElement).rel;
      expect(rel).toContain("noopener");
      expect(rel).toContain("noreferrer");
    });
  });

  test("'About' item renders in ES locale too (proper noun stays English)", async () => {
    const user = userEvent.setup();
    renderMenu("es");
    await user.click(screen.getByRole("button", { name: /Abrir menú/i }));
    await waitFor(() => {
      // "Pueblo Food Project" stays in English per spec
      expect(screen.getByText("About Pueblo Food Project")).toBeDefined();
    });
  });
});

// ─── #99: Show welcome screen ─────────────────────────────────────────────────

describe("#99 — Show welcome screen menu item", () => {
  test("item does NOT render when onShowWelcome is not passed", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      expect(screen.queryByText("Show welcome screen")).toBeNull();
    });
  });

  test("item renders when onShowWelcome is passed (EN)", async () => {
    const user = userEvent.setup();
    renderMenuWithWelcome();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      expect(screen.getByText("Show welcome screen")).toBeDefined();
    });
  });

  test("item renders in ES locale", async () => {
    const user = userEvent.setup();
    renderMenuWithWelcome(vi.fn(), "es");
    await user.click(screen.getByRole("button", { name: /Abrir menú/i }));
    await waitFor(() => {
      expect(screen.getByText("Mostrar pantalla de bienvenida")).toBeDefined();
    });
  });

  test("clicking the item calls onShowWelcome", async () => {
    const user = userEvent.setup();
    const { onShowWelcome } = renderMenuWithWelcome();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      expect(screen.getByText("Show welcome screen")).toBeDefined();
    });
    await user.click(screen.getByText("Show welcome screen"));
    await waitFor(() => {
      expect(onShowWelcome).toHaveBeenCalledTimes(1);
    });
  });

  test("menu closes after clicking 'Show welcome screen'", async () => {
    const user = userEvent.setup();
    renderMenuWithWelcome();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeDefined();
    });
    await user.click(screen.getByText("Show welcome screen"));
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
  });

  test("clicking 'Show welcome screen' does NOT mutate localStorage", async () => {
    const user = userEvent.setup();
    const GATE_KEY = "pfm.splash.seen.v2";
    // Pre-set the gate key (simulating a returning user)
    localStorage.setItem(GATE_KEY, "1");

    renderMenuWithWelcome();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => expect(screen.getByText("Show welcome screen")).toBeDefined());

    await user.click(screen.getByText("Show welcome screen"));

    // Gate key must still be '1' — not cleared
    expect(localStorage.getItem(GATE_KEY)).toBe("1");

    // Cleanup
    localStorage.removeItem(GATE_KEY);
  });
});

// ─── #109: Language toggle in hamburger menu ──────────────────────────────────

describe("#109 — Language toggle as last menu item", () => {
  test("language row renders 'Language / Idioma' label when menu is open", async () => {
    const user = userEvent.setup();
    renderMenuWithLocaleProvider();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      expect(screen.getByText("Language / Idioma")).toBeDefined();
    });
  });

  test("EN button is present in the language row", async () => {
    const user = userEvent.setup();
    renderMenuWithLocaleProvider();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Language: English/i })).toBeDefined();
    });
  });

  test("ES button is present in the language row", async () => {
    const user = userEvent.setup();
    renderMenuWithLocaleProvider();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Language: Spanish/i })).toBeDefined();
    });
  });

  test("clicking ES button in the menu updates locale (ES becomes active)", async () => {
    const user = userEvent.setup();
    renderMenuWithLocaleProvider();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Language: Spanish/i })).toBeDefined();
    });
    const esBtn = screen.getByRole("button", { name: /Language: Spanish/i });
    await user.click(esBtn);
    await waitFor(() => {
      expect(esBtn.getAttribute("aria-pressed")).toBe("true");
    });
  });

  test("clicking EN button in the menu keeps EN active", async () => {
    const user = userEvent.setup();
    renderMenuWithLocaleProvider();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Language: English/i })).toBeDefined();
    });
    const enBtn = screen.getByRole("button", { name: /Language: English/i });
    await user.click(enBtn);
    await waitFor(() => {
      expect(enBtn.getAttribute("aria-pressed")).toBe("true");
    });
  });

  test("language row has role=menuitem", async () => {
    const user = userEvent.setup();
    const { container } = renderMenuWithLocaleProvider();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      expect(screen.getByText("Language / Idioma")).toBeDefined();
    });
    // Find the li that contains the language label
    const langLabel = screen.getByText("Language / Idioma");
    const li = langLabel.closest("li");
    expect(li).not.toBeNull();
    expect(li!.getAttribute("role")).toBe("menuitem");
    void container; // suppress unused warning
  });

  test("language row is the last item in the menu list", async () => {
    const user = userEvent.setup();
    renderMenuWithLocaleProvider();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      expect(screen.getByText("Language / Idioma")).toBeDefined();
    });
    const menuItems = screen.getAllByRole("menuitem");
    const lastItem = menuItems[menuItems.length - 1];
    expect(lastItem.textContent).toContain("Language / Idioma");
  });
});
