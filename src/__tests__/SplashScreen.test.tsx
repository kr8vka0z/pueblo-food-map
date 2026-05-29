/**
 * SplashScreen tests — issue #100 splash refresh.
 *
 * Covers:
 *   - Renders purpose line in EN and ES
 *   - Sponsor credit has correct href, target, and rel
 *   - "How it works" element is absent
 *   - Category list (mobile swatches) is absent
 *   - Primary and secondary CTAs still present
 *   - Tagline, microcopy still present
 *   - Sponsor link accessible label includes "opens in new tab"
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import SplashScreen from "@/components/SplashScreen";
import * as LocaleContext from "@/lib/LocaleContext";

// ── Mock navigator.permissions ────────────────────────────────────────────────
beforeEach(() => {
  Object.defineProperty(navigator, "permissions", {
    value: {
      query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }),
    },
    configurable: true,
    writable: true,
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderSplash(locale: "en" | "es" = "en") {
  vi.spyOn(LocaleContext, "useLocale").mockReturnValue({
    locale,
    setLocale: vi.fn(),
  });
  return render(<SplashScreen onPrimary={vi.fn()} onSecondary={vi.fn()} />);
}

// ── Purpose line ──────────────────────────────────────────────────────────────

describe("purpose line", () => {
  test("renders EN purpose line", () => {
    renderSplash("en");
    expect(
      screen.getByText(
        "A free, community-built map of food resources across Pueblo County.",
      ),
    ).toBeTruthy();
  });

  test("renders ES purpose line", () => {
    renderSplash("es");
    expect(
      screen.getByText(
        "Un mapa comunitario y gratuito de recursos alimentarios en el condado de Pueblo.",
      ),
    ).toBeTruthy();
  });
});

// ── Sponsor credit ────────────────────────────────────────────────────────────

describe("sponsor credit link", () => {
  test("link points to pueblofoodproject.org", () => {
    renderSplash("en");
    const link = screen.getByRole("link", { name: /pueblo food project/i });
    expect(link).toBeTruthy();
    expect((link as HTMLAnchorElement).href).toContain("pueblofoodproject.org");
  });

  test("link opens in new tab (target=_blank)", () => {
    renderSplash("en");
    const link = screen.getByRole("link", { name: /pueblo food project/i });
    expect((link as HTMLAnchorElement).target).toBe("_blank");
  });

  test("link has rel=noopener noreferrer", () => {
    renderSplash("en");
    const link = screen.getByRole("link", { name: /pueblo food project/i });
    expect((link as HTMLAnchorElement).rel).toContain("noopener");
    expect((link as HTMLAnchorElement).rel).toContain("noreferrer");
  });

  test("aria-label includes 'opens in new tab'", () => {
    renderSplash("en");
    const link = screen.getByRole("link", { name: /opens in new tab/i });
    expect(link).toBeTruthy();
  });

  test("renders EN sponsor prefix", () => {
    renderSplash("en");
    // "Sponsored by" prefix text should be in the DOM
    expect(screen.getByText(/sponsored by/i)).toBeTruthy();
  });

  test("renders ES sponsor prefix", () => {
    renderSplash("es");
    expect(screen.getByText(/patrocinado por/i)).toBeTruthy();
  });
});

// ── Removed elements ──────────────────────────────────────────────────────────

describe("removed elements", () => {
  test("'How it works' tile is not rendered", () => {
    renderSplash("en");
    expect(screen.queryByText(/how it works/i)).toBeNull();
  });

  test("'How it works' ES variant is not rendered", () => {
    renderSplash("es");
    expect(screen.queryByText(/cómo funciona/i)).toBeNull();
  });

  test("'What you'll find' header is not rendered", () => {
    renderSplash("en");
    expect(screen.queryByText(/what you'll find/i)).toBeNull();
  });

  test("'Coming soon' toast is not rendered", () => {
    renderSplash("en");
    // The toast element itself should not be in the DOM at all
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  test("mobile category list is not rendered (Food pantry swatch absent)", () => {
    renderSplash("en");
    // Category swatches would show these labels; they should be absent
    expect(screen.queryByText("Food pantry")).toBeNull();
    expect(screen.queryByText("Grocery store")).toBeNull();
  });
});

// ── Preserved elements ────────────────────────────────────────────────────────

describe("preserved elements", () => {
  test("tagline is present (EN)", () => {
    renderSplash("en");
    expect(
      screen.getByText(
        /find food close to home/i,
      ),
    ).toBeTruthy();
  });

  test("primary CTA is present (EN)", () => {
    renderSplash("en");
    expect(
      screen.getByRole("button", { name: /find food near me/i }),
    ).toBeTruthy();
  });

  test("secondary CTA is present (EN)", () => {
    renderSplash("en");
    expect(
      screen.getByRole("button", {
        name: /show the pueblo map without using my location/i,
      }),
    ).toBeTruthy();
  });

  test("microcopy is present (EN)", () => {
    renderSplash("en");
    expect(
      screen.getByText(/we only use your location/i),
    ).toBeTruthy();
  });
});
