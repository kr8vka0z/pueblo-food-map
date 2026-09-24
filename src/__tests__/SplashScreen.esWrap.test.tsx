/**
 * Spanish CTA wrap-fix tests (#600).
 *
 * jsdom has no real layout engine, so line-wrap itself can't be asserted
 * here (verified manually with device-sweep / Playwright at 360-375px,
 * see PR description). These tests instead pin the two structural
 * guarantees the issue's acceptance criteria require:
 *   1. The English CTA's classes are byte-identical to before the fix
 *      ("the English button must look the same").
 *   2. The Spanish CTA keeps the same vertical padding (tap-target height)
 *      as English, while gaining `text-balance` (fixes the lone-word wrap
 *      by balancing the break point) and reduced horizontal padding below
 *      `sm` (more room for the longer ES string) as the only diffs.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import SplashScreen from "@/components/SplashScreen";
import * as LocaleContext from "@/lib/LocaleContext";

beforeEach(() => {
  Object.defineProperty(navigator, "permissions", {
    value: {
      query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }),
    },
    configurable: true,
    writable: true,
  });
});

function renderSplash(locale: "en" | "es" = "en") {
  vi.spyOn(LocaleContext, "useLocale").mockReturnValue({
    locale,
    setLocale: vi.fn(),
  });
  return render(<SplashScreen onPrimary={vi.fn()} />);
}

// Baseline className, byte-for-byte, from SplashScreen.tsx before #600 (the
// English button is not part of the reported bug and must not change).
const EN_BASELINE_CLASSNAME =
  "w-full rounded-[var(--radius-md)] px-6 py-4 md:py-5 text-lg md:text-xl font-semibold leading-none bg-[var(--color-brand-orange)] text-[var(--color-brand-navy)] hover:brightness-105 active:brightness-95 transition-[filter] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-orange)]";

describe("Spanish CTA wrap fix (#600)", () => {
  test("English CTA classes are unchanged (button must look the same)", () => {
    renderSplash("en");
    const enCta = screen.getByRole("button", { name: /find food near me/i });
    expect(enCta.className).toBe(EN_BASELINE_CLASSNAME);
  });

  test("Spanish CTA keeps the same vertical padding as English (tap target not shrunk)", () => {
    renderSplash("en");
    const esCta = screen.getByRole("button", { name: /encuentra comida/i });
    expect(esCta.className).toContain("py-4");
    expect(esCta.className).toContain("md:py-5");
  });

  test("Spanish CTA gains text-balance to avoid a lone wrapped word", () => {
    renderSplash("en");
    const esCta = screen.getByRole("button", { name: /encuentra comida/i });
    expect(esCta.className).toContain("text-balance");
  });

  test("English CTA does not get text-balance (unaffected, single line already)", () => {
    renderSplash("en");
    const enCta = screen.getByRole("button", { name: /find food near me/i });
    expect(enCta.className).not.toContain("text-balance");
  });

  test("Spanish CTA has less horizontal padding than English below sm (more room for the longer label)", () => {
    renderSplash("en");
    const esCta = screen.getByRole("button", { name: /encuentra comida/i });
    // Base (mobile) horizontal padding class must differ from the shared
    // px-6 used at rest by both buttons in the old markup — regains px-6
    // at sm and above so desktop is unaffected.
    expect(esCta.className).not.toMatch(/(?<!sm:)px-6(?!\S)/);
    expect(esCta.className).toContain("sm:px-6");
  });
});
