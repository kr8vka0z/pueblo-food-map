/**
 * ReportPageContent bilingual rendering tests (pueblo-food-map#bilingual-static-pages).
 *
 * Proves the extracted client component (heading + venue context header +
 * ReportForm, all now reading useLocale() — #289) renders EN by default and
 * ES when wrapped in a LocaleProvider set to "es". Turnstile is mocked the
 * same way the dedicated ReportForm test suite does.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "@/lib/LocaleContext";
import { t } from "@/lib/i18n";
import ReportPageContent from "@/components/ReportPageContent";
import type { Venue } from "@/types/venue";

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

const FIXTURE_VENUE: Venue = {
  id: "garden-rmser",
  name: "RMSER Community Garden",
  category: "garden",
  lat: 38.27,
  lng: -104.6,
  address: "330 Lake Ave, Pueblo, CO 81004",
  source: "test",
  last_verified: "2026-01-01",
};

// report.issueType.label ends in "?" in both locales — a trailing "?" is a
// valid (if imprecise) regex quantifier, but stripping it keeps the match exact.
function labelPattern(key: string, locale: "en" | "es"): RegExp {
  return new RegExp(t(key, locale).replace(/[?¿]/g, ""));
}

describe("ReportPageContent — locale", () => {
  test("renders English heading and form labels with no provider (default locale)", () => {
    render(<ReportPageContent venue={FIXTURE_VENUE} />);
    expect(
      screen.getByRole("heading", { level: 1, name: t("report.title", "en") }),
    ).toBeDefined();
    expect(screen.getByLabelText(labelPattern("report.issueType.label", "en"))).toBeDefined();
    // Venue name/address are real data, not translated — always visible.
    expect(screen.getByText(FIXTURE_VENUE.name)).toBeDefined();
  });

  test("renders Spanish heading and form labels when locale='es'", () => {
    render(
      <LocaleProvider initialLocale="es">
        <ReportPageContent venue={FIXTURE_VENUE} />
      </LocaleProvider>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: t("report.title", "es") }),
    ).toBeDefined();
    expect(screen.getByLabelText(labelPattern("report.issueType.label", "es"))).toBeDefined();
    expect(screen.getByText(FIXTURE_VENUE.name)).toBeDefined();
  });
});
