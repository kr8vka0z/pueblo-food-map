/**
 * SplashScreen — cross-tree CTA navigation (#689 PR 2 review, round 2).
 *
 * The splash mounts on /es too (shared HomePageClient). Only the ES-tree
 * + English case needs a cross-tree navigation (there's no way to render
 * an English body under an /es URL — server metadata/hreflang/JSON-LD
 * would still say Spanish). Picking Spanish on the EN splash is Kyle's
 * decision 2 on #689 ("/" with an es cookie keeps today's in-page
 * client-side Spanish) — a plain in-place setLocale, unchanged from
 * before #689 touched this file at all. The first round of this fix
 * wrongly made BOTH cross-language picks navigate; this file now asserts
 * the corrected, asymmetric behavior.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as LocaleContext from "@/lib/LocaleContext";
import * as SplashGate from "@/lib/splashGate";
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
  let callOrder: string[];
  const originalLocation = window.location;
  const writeLocaleCookieSpy = vi.spyOn(LocaleContext, "writeLocaleCookie");
  const markSplashSeenSpy = vi.spyOn(SplashGate, "markSplashSeen");

  beforeEach(() => {
    Object.defineProperty(navigator, "permissions", {
      value: { query: vi.fn().mockResolvedValue({ state: "prompt", onchange: null }) },
      configurable: true,
      writable: true,
    });
    callOrder = [];
    assign = vi.fn(() => callOrder.push("assign"));
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, assign },
    });
    writeLocaleCookieSpy.mockClear();
    markSplashSeenSpy.mockClear();
    markSplashSeenSpy.mockImplementation(() => {
      callOrder.push("markSplashSeen");
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    vi.restoreAllMocks();
  });

  test("on the /es tree, picking English marks the splash seen, writes the cookie, and navigates to /?near=1 (no setLocale)", () => {
    const { setLocale } = renderSplash({ locale: "es", tree: "es" });
    fireEvent.click(screen.getByRole("button", { name: /find food near me/i }));

    expect(setLocale).not.toHaveBeenCalled();
    expect(markSplashSeenSpy).toHaveBeenCalledTimes(1);
    expect(writeLocaleCookieSpy).toHaveBeenCalledWith("en");
    expect(assign).toHaveBeenCalledWith("/?near=1");
    // The gate MUST be marked before navigating away, or a later visit
    // with no ?near=1 in the URL re-shows the EN splash — this fails if
    // the order regresses even though the two calls still individually happen.
    expect(callOrder).toEqual(["markSplashSeen", "assign"]);
  });

  test("on the EN tree, picking Spanish uses the in-place setLocale flow — no navigation (Kyle's decision 2)", () => {
    const { setLocale } = renderSplash({ locale: "en", tree: "en" });
    fireEvent.click(screen.getByRole("button", { name: /encuentra comida/i }));

    expect(setLocale).toHaveBeenCalledWith("es");
    expect(assign).not.toHaveBeenCalled();
    expect(markSplashSeenSpy).not.toHaveBeenCalled();
    expect(writeLocaleCookieSpy).not.toHaveBeenCalled();
  });

  test("picking the language that MATCHES the current tree still uses the in-place setLocale flow (unchanged)", () => {
    const { setLocale } = renderSplash({ locale: "en", tree: "en" });
    fireEvent.click(screen.getByRole("button", { name: /find food near me/i }));

    expect(setLocale).toHaveBeenCalledWith("en");
    expect(assign).not.toHaveBeenCalled();
  });

  test("on the ES tree, picking Spanish (matches tree) also stays in-place — no navigation", () => {
    const { setLocale } = renderSplash({ locale: "es", tree: "es" });
    fireEvent.click(screen.getByRole("button", { name: /encuentra comida/i }));

    expect(setLocale).toHaveBeenCalledWith("es");
    expect(assign).not.toHaveBeenCalled();
  });
});
