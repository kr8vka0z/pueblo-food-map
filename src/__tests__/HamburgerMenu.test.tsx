/**
 * HamburgerMenu tests — #71
 *
 * The drawer is controlled and has no trigger of its own since the bottom nav
 * (docs/bottom-nav-spec.md §7) — BottomNav opens it. `Harness` below stands in
 * for that opener: a plain button toggling `open`, passed as ignoreOutsideRef
 * exactly as MapWrapper passes the nav.
 *
 * Covers:
 *   1. Panel is absent while closed.
 *   2. Panel has role="menu" and contains "Suggest a venue" link.
 *   3. Closes on X button click / outside click / Escape; panel unmounts.
 *   4. Focus returns to the opener after Escape / X-button close.
 *   5. ES locale: labels show Spanish strings.
 *   6. No Map/List row (spec §4.4) and initialSection scrolling (spec §7).
 */

import { useRef, useState, type ComponentProps } from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HamburgerMenu from "@/components/HamburgerMenu";
import { LocaleProvider } from "@/lib/LocaleContext";

// Mock next/link — renders a plain <a> in tests.
// WHY spread rest: HamburgerMenuItem now places role="menuitem" on the <Link>;
// the mock must pass it through or ARIA role tests and axe both miss it.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest as React.AnchorHTMLAttributes<HTMLAnchorElement>}>
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

type HarnessProps = Omit<ComponentProps<typeof HamburgerMenu>, "open" | "onClose" | "ignoreOutsideRef">;

function Harness(props: HarnessProps) {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={props.locale === "es" ? "Abrir menú" : "Open menu"}
      />
      <HamburgerMenu {...props} open={open} onClose={() => setOpen(false)} ignoreOutsideRef={openerRef} />
    </>
  );
}

function renderMenu(locale: "en" | "es" = "en") {
  return render(<Harness locale={locale} />);
}

function renderMenuWithWelcome(onShowWelcome = vi.fn(), locale: "en" | "es" = "en") {
  return { onShowWelcome, ...render(<Harness locale={locale} onShowWelcome={onShowWelcome} />) };
}

function renderMenuWithLocaleProvider(locale: "en" | "es" = "en", initialLocale: "en" | "es" = "en") {
  return render(
    <LocaleProvider initialLocale={initialLocale}>
      <Harness locale={locale} />
    </LocaleProvider>,
  );
}

describe("HamburgerMenu — collapsed state", () => {
  test("renders no trigger button of its own (the bottom nav opens it)", () => {
    render(<HamburgerMenu locale="en" open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("panel is not in DOM when closed", () => {
    renderMenu();
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("HamburgerMenu — open state", () => {
  test("panel appears after the opener is clicked", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeDefined();
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

  test("Get help section renders the five assistance links (#131)", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      const co211 = screen.getByRole("link", { name: /2-1-1 Colorado/i }) as HTMLAnchorElement;
      const snap = screen.getByRole("link", { name: /Apply for SNAP/i }) as HTMLAnchorElement;
      const wic = screen.getByRole("link", { name: /Apply for WIC/i }) as HTMLAnchorElement;
      const doubleup = screen.getByRole("link", { name: /Double Up Food Bucks/i }) as HTMLAnchorElement;
      const hotline = screen.getByRole("link", { name: /Food hotline/i }) as HTMLAnchorElement;

      expect(co211.href).toContain("211colorado.org");
      expect(snap.href).toContain("cdhs.colorado.gov/snap");
      expect(wic.href).toContain("coloradowic.gov");
      expect(doubleup.href).toContain("doubleupcolorado.org");
      expect(hotline.href).toContain("tel:");
      expect(hotline.href).toContain("8558554626");

      // Web resources open in a new tab; the hotline is a tap-to-call link.
      expect(co211.target).toBe("_blank");
      expect(snap.target).toBe("_blank");
      expect(wic.target).toBe("_blank");
      expect(doubleup.target).toBe("_blank");
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

  test("'About' item renders in ES locale with Spanish label", async () => {
    const user = userEvent.setup();
    renderMenu("es");
    await user.click(screen.getByRole("button", { name: /Abrir menú/i }));
    await waitFor(() => {
      expect(screen.getByText("Acerca de Pueblo Food Project")).toBeDefined();
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

// ─── #132 9c: Saved places section ───────────────────────────────────────────

describe("HamburgerMenu — Saved places (#132)", () => {
  const savedVenueFixtures = [
    {
      id: "saved-v1",
      name: "Eastside Food Pantry",
      category: "pantry" as const,
      lat: 38.26,
      lng: -104.6,
      address: "100 Main St, Pueblo, CO 81001",
      source: "test",
      last_verified: "2025-01-01",
      distanceMiles: 0.5,
    },
    {
      id: "saved-v2",
      name: "Community Garden",
      category: "garden" as const,
      lat: 38.27,
      lng: -104.61,
      address: "200 Oak Ave, Pueblo, CO 81001",
      source: "test",
      last_verified: "2025-01-01",
      distanceMiles: 1.2,
    },
  ];

  test("saved places heading does NOT appear when savedVenues is omitted", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      // menu is open — confirm by checking a known item
      expect(screen.getByRole("link", { name: /Suggest a venue/i })).toBeDefined();
      // heading must not be present
      expect(screen.queryByText(/saved places/i)).toBeNull();
    });
  });

  test("saved places heading does NOT appear when savedVenues is empty", async () => {
    const user = userEvent.setup();
    render(<Harness locale="en" savedVenues={[]} />);
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Suggest a venue/i })).toBeDefined();
      expect(screen.queryByText(/saved places/i)).toBeNull();
    });
  });

  test("saved places heading and venue names visible when savedVenues has entries", async () => {
    const user = userEvent.setup();
    render(<Harness locale="en" savedVenues={savedVenueFixtures} onSelectVenue={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      expect(screen.getByText(/saved places/i)).toBeDefined();
      expect(screen.getByText("Eastside Food Pantry")).toBeDefined();
      expect(screen.getByText("Community Garden")).toBeDefined();
    });
  });

  test("clicking a saved venue row calls onSelectVenue with that venue id exactly once", async () => {
    const user = userEvent.setup();
    const onSelectVenue = vi.fn();
    render(<Harness locale="en" savedVenues={savedVenueFixtures} onSelectVenue={onSelectVenue} />);
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      expect(screen.getByText("Eastside Food Pantry")).toBeDefined();
    });
    await user.click(screen.getByText("Eastside Food Pantry"));
    await waitFor(() => {
      expect(onSelectVenue).toHaveBeenCalledTimes(1);
      expect(onSelectVenue).toHaveBeenCalledWith("saved-v1");
    });
  });
});

// ─── docs/bottom-nav-spec.md §4.4 + §7 ───────────────────────────────────────

describe("HamburgerMenu — bottom nav entry points", () => {
  test("renders no Map/List row (the switch lives in the search box, §4.4)", () => {
    render(<HamburgerMenu locale="en" open onClose={vi.fn()} />);
    expect(screen.getByRole("menu")).toBeDefined();
    expect(screen.queryByText("View")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Map$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^List$/i })).toBeNull();
  });

  test("initialSection='help' scrolls the Get help heading into view", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<HamburgerMenu locale="en" open onClose={vi.fn()} initialSection="help" />);
    const heading = screen.getByText("Get help");
    expect(heading.id).toBe("menu-section-help");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(heading);
  });

  test("a tap inside ignoreOutsideRef does not close the drawer", () => {
    const onClose = vi.fn();
    const nav = document.createElement("nav");
    document.body.appendChild(nav);
    render(<HamburgerMenu locale="en" open onClose={onClose} ignoreOutsideRef={{ current: nav }} />);
    fireEvent.pointerDown(nav);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
    nav.remove();
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

  test("language row is visible after menu opens", async () => {
    // WHY updated: the language toggle is now rendered in a <div> OUTSIDE role="menu"
    // (below the <ul>) because LanguageToggle contains a role="group" with plain
    // buttons — not menuitems. Placing a group-without-menuitems inside role="menu"
    // triggers an axe aria-required-children violation (#166 8.5).
    // The label still appears visually as the last row in the panel.
    const user = userEvent.setup();
    const { container } = renderMenuWithLocaleProvider();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      expect(screen.getByText("Language / Idioma")).toBeDefined();
    });
    // Language label is in a <div>, not a <li role="menuitem">
    const langLabel = screen.getByText("Language / Idioma");
    expect(langLabel.closest("div")).not.toBeNull();
    void container; // suppress unused warning
  });

  test("language row appears after the About link in the panel", async () => {
    // WHY: language toggle moved outside role="menu" ul — verify it still renders
    // after all menuitem links (last visually in the panel).
    const user = userEvent.setup();
    renderMenuWithLocaleProvider();
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      expect(screen.getByText("Language / Idioma")).toBeDefined();
    });
    // The "About" link text appears before "Language / Idioma" in the DOM
    const panel = screen.getByText("Language / Idioma").closest('[id="hamburger-panel"]');
    const panelText = panel?.textContent ?? "";
    const aboutIdx = panelText.indexOf("About Pueblo Food Project");
    const langIdx = panelText.indexOf("Language / Idioma");
    expect(aboutIdx).toBeGreaterThan(-1);
    expect(langIdx).toBeGreaterThan(aboutIdx);
  });
});
