/**
 * PrivacyContent bilingual rendering tests (pueblo-food-map#bilingual-static-pages).
 *
 * Proves the extracted client component renders EN by default and ES when
 * wrapped in a LocaleProvider set to "es" (#289).
 */

import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "@/lib/LocaleContext";
import { t } from "@/lib/i18n";
import PrivacyContent from "@/components/PrivacyContent";

describe("PrivacyContent — locale", () => {
  test("renders English heading and body with no provider (default locale)", () => {
    render(<PrivacyContent />);
    expect(
      screen.getByRole("heading", { level: 1, name: t("privacy.heading", "en") }),
    ).toBeDefined();
    expect(screen.getByText(t("privacy.body", "en"))).toBeDefined();
  });

  test("renders Spanish heading and body when locale='es'", () => {
    render(
      <LocaleProvider initialLocale="es">
        <PrivacyContent />
      </LocaleProvider>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: t("privacy.heading", "es") }),
    ).toBeDefined();
    expect(screen.getByText(t("privacy.body", "es"))).toBeDefined();
  });
});
