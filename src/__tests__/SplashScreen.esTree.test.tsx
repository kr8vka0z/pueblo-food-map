/**
 * SplashScreen — cross-tree CTA navigation (#689 PR 2 review fix, item 3).
 *
 * The splash mounts on /es too (shared HomePageClient). Picking a language
 * that differs from the CURRENT tree must not just flip `locale` client-side
 * — that would leave an English (or Spanish) body sitting under the wrong
 * tree's URL, with the server title/metadata/JSON-LD still saying the other
 * language. handleCtaClick must instead write the cookie and do a full
 * navigation to the other tree's home.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as LocaleContext from "@/lib/LocaleContext";
import SplashScreen from "@/components/SplashScreen";

function renderSplash(opts: { locale: "en" | "es"; tree: "en" | "es" }) {
  const setLocale = vi.fn();
  vi.spyOn(LocaleContext, "useLocale").mockReturnValue({
    locale: opts.locale,
    setLocale,
    tree: opts.tree,
  });
  return { setLocale, ...render(<SplashScreen onPrimary={vi.fn()} />) };
}

describe("SplashScreen cross-tree CTA navigation", () => {
  let assign: ReturnType<typeof vi.fn>;
  const originalLocation = window.location;
  const writeLocaleCookieSpy = vi.spyOn(LocaleContext, "writeLocaleCookie");

  beforeEach(() => {
    Object.defineProperty(navigator, "permissions", {
      value: { query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }) },
      configurable: true,
      writable: true,
    });
    assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, assign },
    });
    writeLocaleCookieSpy.mockClear();
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    vi.restoreAllMocks();
  });

  test("on the /es tree, picking English navigates to / instead of calling setLocale", () => {
    const { setLocale } = renderSplash({ locale: "es", tree: "es" });
    fireEvent.click(screen.getByRole("button", { name: /find food near me/i }));

    expect(setLocale).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith("/");
  });

  test("on the EN tree, picking Spanish navigates to /es instead of calling setLocale", () => {
    const { setLocale } = renderSplash({ locale: "en", tree: "en" });
    fireEvent.click(screen.getByRole("button", { name: /encuentra comida/i }));

    expect(setLocale).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith("/es");
  });

  test("picking the language that MATCHES the current tree still uses the in-place setLocale flow (unchanged)", () => {
    const { setLocale } = renderSplash({ locale: "en", tree: "en" });
    fireEvent.click(screen.getByRole("button", { name: /find food near me/i }));

    expect(setLocale).toHaveBeenCalledWith("en");
    expect(assign).not.toHaveBeenCalled();
  });
});
