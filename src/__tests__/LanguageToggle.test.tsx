/**
 * LanguageToggle + LocaleContext tests — issue #68.
 *
 * Verifies:
 *   1. Toggle renders EN and ES buttons.
 *   2. EN is active by default (aria-pressed="true").
 *   3. Clicking ES makes ES active.
 *   4. Clicking EN makes EN active.
 *   5. Each button has the correct aria-label for screen readers.
 *   6. Keyboard: Enter activates the button (tab focus + enter key).
 *   7. LocaleProvider: a component using useLocale() re-renders with ES strings
 *      when locale flips to "es".
 *   8. LocaleProvider: initialLocale prop seeds the initial state.
 *   9. writeLocaleCookie / readLocaleCookie helpers round-trip in jsdom.
 */

import { describe, test, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocaleProvider, useLocale, readLocaleCookie, writeLocaleCookie } from "@/lib/LocaleContext";
import LanguageToggle from "@/components/LanguageToggle";
import { t } from "@/lib/i18n";

// ─── Helper: wrap in LocaleProvider ──────────────────────────────────────────

function renderWithProvider(
  ui: React.ReactNode,
  initialLocale?: "en" | "es",
) {
  return render(
    <LocaleProvider initialLocale={initialLocale}>{ui}</LocaleProvider>,
  );
}

// ─── LanguageToggle — rendering ───────────────────────────────────────────────

describe("LanguageToggle — rendering", () => {
  test("renders EN and ES buttons", () => {
    renderWithProvider(<LanguageToggle />);
    expect(screen.getByRole("button", { name: /english/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /spanish/i })).toBeDefined();
  });

  test("EN is active by default (aria-pressed=true)", () => {
    renderWithProvider(<LanguageToggle />);
    const enBtn = screen.getByRole("button", { name: /english/i });
    expect(enBtn.getAttribute("aria-pressed")).toBe("true");
  });

  test("ES is not active by default (aria-pressed=false)", () => {
    renderWithProvider(<LanguageToggle />);
    const esBtn = screen.getByRole("button", { name: /spanish/i });
    expect(esBtn.getAttribute("aria-pressed")).toBe("false");
  });

  test("role=group with aria-label=Language selection on wrapper", () => {
    renderWithProvider(<LanguageToggle />);
    const group = screen.getByRole("group", { name: /language selection/i });
    expect(group).toBeDefined();
  });
});

// ─── LanguageToggle — interaction ─────────────────────────────────────────────

describe("LanguageToggle — interaction", () => {
  test("clicking ES makes ES active and EN inactive", async () => {
    const user = userEvent.setup();
    renderWithProvider(<LanguageToggle />);
    const esBtn = screen.getByRole("button", { name: /spanish/i });
    await user.click(esBtn);
    expect(esBtn.getAttribute("aria-pressed")).toBe("true");
    const enBtn = screen.getByRole("button", { name: /english/i });
    expect(enBtn.getAttribute("aria-pressed")).toBe("false");
  });

  test("clicking EN after ES resets EN to active", async () => {
    const user = userEvent.setup();
    renderWithProvider(<LanguageToggle />);
    await user.click(screen.getByRole("button", { name: /spanish/i }));
    await user.click(screen.getByRole("button", { name: /english/i }));
    const enBtn = screen.getByRole("button", { name: /english/i });
    expect(enBtn.getAttribute("aria-pressed")).toBe("true");
  });
});

// ─── LanguageToggle — keyboard accessibility ──────────────────────────────────

describe("LanguageToggle — keyboard", () => {
  test("Enter key activates focused ES button", async () => {
    const user = userEvent.setup();
    renderWithProvider(<LanguageToggle />);
    const esBtn = screen.getByRole("button", { name: /spanish/i });
    esBtn.focus();
    await user.keyboard("{Enter}");
    expect(esBtn.getAttribute("aria-pressed")).toBe("true");
  });

  test("Space key activates focused ES button", async () => {
    const user = userEvent.setup();
    renderWithProvider(<LanguageToggle />);
    const esBtn = screen.getByRole("button", { name: /spanish/i });
    esBtn.focus();
    await user.keyboard(" ");
    expect(esBtn.getAttribute("aria-pressed")).toBe("true");
  });
});

// ─── LanguageToggle — initialLocale prop ──────────────────────────────────────

describe("LanguageToggle — initialLocale", () => {
  test("initialLocale='es' makes ES active on first render", () => {
    renderWithProvider(<LanguageToggle />, "es");
    const esBtn = screen.getByRole("button", { name: /spanish/i });
    expect(esBtn.getAttribute("aria-pressed")).toBe("true");
    const enBtn = screen.getByRole("button", { name: /english/i });
    expect(enBtn.getAttribute("aria-pressed")).toBe("false");
  });
});

// ─── Locale string propagation — sample component ────────────────────────────
// Verifies that a component consuming useLocale() re-renders with ES strings
// when the locale flips to "es". Uses SponsorCredit as the sample component.

import SponsorCredit from "@/components/SponsorCredit";

describe("Locale string propagation — SponsorCredit re-renders on locale flip", () => {
  test("shows EN sponsor text by default", () => {
    renderWithProvider(<SponsorCredit locale="en" />);
    expect(screen.getByText(t("sponsor.text", "en"))).toBeDefined();
  });

  test("shows ES sponsor text when locale='es'", () => {
    renderWithProvider(<SponsorCredit locale="es" />);
    expect(screen.getByText(t("sponsor.text", "es"))).toBeDefined();
  });

  test("toggle flip causes re-render with ES strings in a consumer", async () => {
    // Renders the toggle + a locale-aware consumer in the same provider tree.
    // When toggle flips to ES, the consumer should show ES text.
    function TestConsumer() {
      const { locale } = useLocale();
      return (
        <div>
          <LanguageToggle />
          <span data-testid="sponsor">{t("sponsor.text", locale)}</span>
        </div>
      );
    }

    const user = userEvent.setup();
    renderWithProvider(<TestConsumer />);

    // Initially EN
    expect(screen.getByTestId("sponsor").textContent).toBe(t("sponsor.text", "en"));

    // Flip to ES via toggle
    await user.click(screen.getByRole("button", { name: /spanish/i }));

    // Should now show ES text
    expect(screen.getByTestId("sponsor").textContent).toBe(t("sponsor.text", "es"));

    // Flip back to EN
    await user.click(screen.getByRole("button", { name: /english/i }));
    expect(screen.getByTestId("sponsor").textContent).toBe(t("sponsor.text", "en"));
  });
});

// ─── Cookie helpers ───────────────────────────────────────────────────────────

describe("Cookie helpers", () => {
  beforeEach(() => {
    // Clear pfm-locale cookie before each test
    document.cookie = "pfm-locale=; max-age=0; path=/";
  });

  test("writeLocaleCookie writes 'es' and readLocaleCookie reads it back", () => {
    writeLocaleCookie("es");
    expect(readLocaleCookie()).toBe("es");
  });

  test("writeLocaleCookie writes 'en' and readLocaleCookie reads it back", () => {
    writeLocaleCookie("en");
    expect(readLocaleCookie()).toBe("en");
  });

  test("readLocaleCookie returns null when no cookie is set", () => {
    expect(readLocaleCookie()).toBeNull();
  });
});

// ─── LocaleProvider — setLocale writes cookie ─────────────────────────────────

describe("LocaleProvider — setLocale writes cookie", () => {
  beforeEach(() => {
    document.cookie = "pfm-locale=; max-age=0; path=/";
  });

  test("flipping toggle to ES writes pfm-locale=es cookie", async () => {
    const user = userEvent.setup();
    renderWithProvider(<LanguageToggle />);
    await user.click(screen.getByRole("button", { name: /spanish/i }));
    expect(readLocaleCookie()).toBe("es");
  });

  test("flipping toggle back to EN writes pfm-locale=en cookie", async () => {
    const user = userEvent.setup();
    renderWithProvider(<LanguageToggle />, "es");
    await user.click(screen.getByRole("button", { name: /english/i }));
    expect(readLocaleCookie()).toBe("en");
  });
});
