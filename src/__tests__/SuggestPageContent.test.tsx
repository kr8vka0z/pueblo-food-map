/**
 * SuggestPageContent bilingual rendering tests (pueblo-food-map#bilingual-static-pages).
 *
 * Proves the extracted client component (heading + SuggestForm, both now
 * reading useLocale() — #289) renders EN by default and ES when wrapped in
 * a LocaleProvider set to "es". Turnstile is mocked the same way the
 * dedicated SuggestForm test suite does.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "@/lib/LocaleContext";
import { t } from "@/lib/i18n";
import SuggestPageContent from "@/components/SuggestPageContent";

// PageNav (bottom nav + drawer) has its own test; stub it so this page test
// doesn't need next/navigation or matchMedia.
vi.mock("@/components/PageNav", () => ({ default: () => null, PAGE_NAV_CLEARANCE: "" }));

const mockTurnstile = {
  render: vi.fn((_container: HTMLElement, opts: { callback?: (t: string) => void }) => {
    if (opts.callback) opts.callback("test-token");
    return "widget-id";
  }),
  reset: vi.fn(),
  remove: vi.fn(),
};
vi.stubGlobal("turnstile", mockTurnstile);
vi.stubGlobal("fetch", vi.fn());

describe("SuggestPageContent — locale", () => {
  test("renders English heading and form labels with no provider (default locale)", () => {
    render(<SuggestPageContent />);
    expect(
      screen.getByRole("heading", { level: 1, name: t("suggest.title", "en") }),
    ).toBeDefined();
    expect(screen.getByLabelText(new RegExp(t("suggest.venueName.label", "en")))).toBeDefined();
  });

  test("renders Spanish heading and form labels when locale='es'", () => {
    render(
      <LocaleProvider initialLocale="es">
        <SuggestPageContent />
      </LocaleProvider>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: t("suggest.title", "es") }),
    ).toBeDefined();
    expect(screen.getByLabelText(new RegExp(t("suggest.venueName.label", "es")))).toBeDefined();
  });
});
