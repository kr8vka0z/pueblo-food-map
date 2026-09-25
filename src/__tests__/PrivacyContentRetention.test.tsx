/**
 * PrivacyContent — #594 additions (email retention period, per-browser
 * check-in ID, third-party naming). New test file, kept separate from
 * PrivacyContent.test.tsx (existing file, not edited here) — same
 * "one file per slice of new copy" convention that file's own history
 * already follows.
 */

import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "@/lib/LocaleContext";
import { t } from "@/lib/i18n";
import PrivacyContent from "@/components/PrivacyContent";

describe("PrivacyContent — #594 retention + third-party sections", () => {
  test("renders the check-in ID paragraph, retention section, and other-services section (EN)", () => {
    render(<PrivacyContent />);
    expect(screen.getByText(t("privacy.checkins.body2", "en"))).toBeDefined();
    expect(screen.getByRole("heading", { name: t("privacy.retention.heading", "en") })).toBeDefined();
    expect(screen.getByText(t("privacy.retention.body", "en"))).toBeDefined();
    expect(screen.getByRole("heading", { name: t("privacy.other.heading", "en") })).toBeDefined();
    expect(screen.getByText(t("privacy.other.body", "en"))).toBeDefined();
  });

  test("renders the same sections in Spanish", () => {
    render(
      <LocaleProvider initialLocale="es">
        <PrivacyContent />
      </LocaleProvider>,
    );
    expect(screen.getByText(t("privacy.checkins.body2", "es"))).toBeDefined();
    expect(screen.getByRole("heading", { name: t("privacy.retention.heading", "es") })).toBeDefined();
    expect(screen.getByRole("heading", { name: t("privacy.other.heading", "es") })).toBeDefined();
  });

  test("the 90-day figure appears in the retention copy (EN and ES)", () => {
    expect(t("privacy.retention.body", "en")).toMatch(/90 days/);
    expect(t("privacy.retention.body", "es")).toMatch(/90 días/);
  });

  test("Mapbox and Cloudflare Turnstile are named as third parties (EN and ES)", () => {
    expect(t("privacy.other.body", "en")).toMatch(/Mapbox/);
    expect(t("privacy.other.body", "en")).toMatch(/Turnstile/);
    expect(t("privacy.other.body", "es")).toMatch(/Mapbox/);
    expect(t("privacy.other.body", "es")).toMatch(/Turnstile/);
  });
});
