/**
 * PrivacyContent bilingual rendering tests (pueblo-food-map#bilingual-static-pages).
 *
 * Proves the extracted client component renders EN by default and ES when
 * wrapped in a LocaleProvider set to "es" (#289).
 *
 * Updated for Blessing Boxes slice 6's privacy rewrite: "New i18n keys per
 * paragraph (not overloading privacy.body) ... each paragraph its own
 * i18n key" replaced the single privacy.body paragraph these tests used to
 * assert on with privacy.collect.body (+ the two new sections) — the old
 * key no longer renders anywhere on this page.
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
    expect(screen.getByText(t("privacy.collect.body", "en"))).toBeDefined();
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
    expect(screen.getByText(t("privacy.collect.body", "es"))).toBeDefined();
  });
});

describe("PrivacyContent — slice 6 sections (adopt-a-box + email alerts)", () => {
  test("renders the two new headed sections and the analytics paragraph unchanged", () => {
    render(<PrivacyContent />);
    expect(screen.getByRole("heading", { name: t("privacy.checkins.heading", "en") })).toBeDefined();
    expect(screen.getByText(t("privacy.checkins.body", "en"))).toBeDefined();
    expect(screen.getByRole("heading", { name: t("privacy.alerts.heading", "en") })).toBeDefined();
    expect(screen.getByText(t("privacy.alerts.body1", "en"))).toBeDefined();
    expect(screen.getByText(t("privacy.alerts.body2", "en"))).toBeDefined();
    expect(screen.getByText(t("privacy.alerts.body3", "en"))).toBeDefined();
    expect(screen.getByText(t("privacy.alerts.body4", "en"))).toBeDefined();
    expect(screen.getByText(t("privacy.analytics", "en"))).toBeDefined();
  });
});
