/**
 * SplashScreen accessible-description tests (#590).
 *
 * The splash overlay is a hand-rolled `role="dialog"` (no Radix Dialog
 * primitive is installed in this repo — see package.json), but it hit the
 * same class of problem Radix's dev-mode warning flags: a dialog with no
 * `aria-describedby`/accessible description, which screen readers announce
 * as a dialog with no explanation of its purpose. Fix: point
 * `aria-describedby` at the existing purpose paragraph (no new copy).
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import type AxeCore from "axe-core";
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

function describeViolations(results: AxeCore.AxeResults): string {
  if (results.violations.length === 0) return "no violations";
  return results.violations
    .map((v) => `[${v.id}] ${v.help}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)
    .join("\n");
}

describe("dialog accessible description (#590)", () => {
  test("dialog has aria-describedby pointing at a real, non-empty element", () => {
    renderSplash("en");
    const dialog = screen.getByRole("dialog");
    const describedBy = dialog.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();

    const descriptionEl = document.getElementById(describedBy as string);
    expect(descriptionEl).not.toBeNull();
    expect(descriptionEl?.textContent?.trim().length).toBeGreaterThan(0);
  });

  test("described element is the existing purpose intro text, not new copy", () => {
    renderSplash("en");
    const dialog = screen.getByRole("dialog");
    const describedBy = dialog.getAttribute("aria-describedby") as string;
    const descriptionEl = document.getElementById(describedBy);
    const purposeEl = screen.getByTestId("splash-purpose");
    expect(descriptionEl).toBe(purposeEl);
  });

  test("ES locale also wires aria-describedby to the ES purpose text", () => {
    renderSplash("es");
    const dialog = screen.getByRole("dialog");
    const describedBy = dialog.getAttribute("aria-describedby") as string;
    const descriptionEl = document.getElementById(describedBy);
    expect(descriptionEl?.textContent).toMatch(/mapa comunitario/i);
  });

  test("no console warning about a missing dialog description on render", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderSplash("en");
    const allCalls = [...warnSpy.mock.calls, ...errorSpy.mock.calls].map((c) => String(c[0]));
    const describedByWarning = allCalls.find((msg) =>
      /Description.*aria-describedby|aria-describedby.*Description/i.test(msg),
    );
    expect(describedByWarning).toBeUndefined();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe("SplashScreen axe pass with description present (#590)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("has no axe violations, and an accessible description is present", async () => {
    const { container } = renderSplash("en");
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();

    const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations.length, `Violations found:\n${describeViolations(results)}`).toBe(0);
  });
});
