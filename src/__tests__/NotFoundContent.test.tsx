/**
 * NotFoundContent bilingual rendering tests (pueblo-food-map#bilingual-static-pages).
 *
 * Proves the extracted client component renders EN by default and ES when
 * wrapped in a LocaleProvider set to "es" — the pattern all eight
 * previously-hardcoded-English static pages now follow (#289).
 */

import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "@/lib/LocaleContext";
import { t } from "@/lib/i18n";
import NotFoundContent from "@/components/NotFoundContent";

describe("NotFoundContent — locale", () => {
  test("renders English text with no provider (default locale)", () => {
    render(<NotFoundContent />);
    expect(
      screen.getByRole("heading", { level: 1, name: t("notfound.title", "en") }),
    ).toBeDefined();
    expect(screen.getByRole("link", { name: new RegExp(t("notfound.backToMap", "en")) })).toBeDefined();
  });

  test("renders Spanish text when locale='es'", () => {
    render(
      <LocaleProvider initialLocale="es">
        <NotFoundContent />
      </LocaleProvider>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: t("notfound.title", "es") }),
    ).toBeDefined();
    expect(screen.getByRole("link", { name: new RegExp(t("notfound.backToMap", "es")) })).toBeDefined();
  });
});
