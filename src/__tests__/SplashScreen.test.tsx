/**
 * SplashScreen tests — issue #100 splash refresh + review revisions.
 *
 * Covers:
 *   - Renders purpose line in EN and ES
 *   - Sponsor credit has correct href, target, and rel
 *   - "How it works" element is absent
 *   - Category list (mobile swatches) is absent
 *   - Secondary CTA ("Show the Pueblo map") is absent (removed in review)
 *   - Primary CTA still present
 *   - Tagline, microcopy still present
 *   - Sponsor credit renders in bottom-right corner (absolute/fixed position)
 *   - Sponsor link accessible label (sponsor.text contains org name)
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
  return render(<SplashScreen onPrimary={vi.fn()} />);
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

  test("renders EN sponsor text", () => {
    renderSplash("en");
    expect(screen.getByText(/sponsored by pueblo food project/i)).toBeTruthy();
  });

  test("renders ES sponsor text", () => {
    renderSplash("es");
    expect(screen.getByText(/patrocinado por pueblo food project/i)).toBeTruthy();
  });

  test("sponsor credit container is absolutely positioned (bottom-right corner)", () => {
    const { container } = renderSplash("en");
    // SponsorCredit renders a div with position:absolute, bottom:8, right:8
    const creditWrapper = container.querySelector<HTMLElement>(
      'div[style*="position: absolute"][style*="bottom: 8"][style*="right: 8"]',
    );
    expect(creditWrapper).toBeTruthy();
  });
});

// ── Removed elements ──────────────────────────────────────────────────────────

describe("removed elements", () => {
  test("secondary CTA is not rendered (EN)", () => {
    renderSplash("en");
    expect(screen.queryByRole("button", { name: /show the pueblo map/i })).toBeNull();
  });

  test("secondary CTA is not rendered (ES)", () => {
    renderSplash("es");
    expect(screen.queryByRole("button", { name: /ver el mapa de pueblo/i })).toBeNull();
  });

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
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  test("mobile category list is not rendered (Food pantry swatch absent)", () => {
    renderSplash("en");
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

  test("microcopy is present (EN)", () => {
    renderSplash("en");
    expect(
      screen.getByText(/we only use your location/i),
    ).toBeTruthy();
  });
});

// ── Light theme — background and wordmark color ───────────────────────────────

describe("light theme", () => {
  test("root element uses frosted bone-50 background (semi-transparent, not navy)", () => {
    const { container } = renderSplash("en");
    const root = container.firstElementChild as HTMLElement;
    // Background is now a frosted scrim: rgba(bone-50 hex, opacity) for the
    // see-through overlay effect. Check it contains the bone-50 hex value.
    expect(root.style.backgroundColor).toContain("251, 250, 246");
  });

  test("root element is a fixed overlay with dialog role", () => {
    const { container } = renderSplash("en");
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("dialog");
    expect(root.className).toContain("fixed");
    expect(root.className).toContain("inset-0");
  });

  test("wordmark uses navy text class", () => {
    const { container } = renderSplash("en");
    const wordmark = container.querySelector(".wordmark");
    expect(wordmark?.className).toContain("text-[var(--color-brand-navy)]");
  });

  test("orange CTA button retains navy text (navy-on-orange)", () => {
    renderSplash("en");
    const cta = screen.getByRole("button", { name: /find food near me/i });
    expect(cta.className).toContain("text-[var(--color-brand-navy)]");
  });

  test("no dark radial glow overlay rendered", () => {
    const { container } = renderSplash("en");
    // The old dark-era glow was an aria-hidden div with a radial-gradient style
    const glowDivs = Array.from(container.querySelectorAll('[aria-hidden="true"]')).filter(
      (el) => (el as HTMLElement).style.background?.includes("radial-gradient"),
    );
    expect(glowDivs).toHaveLength(0);
  });
});
