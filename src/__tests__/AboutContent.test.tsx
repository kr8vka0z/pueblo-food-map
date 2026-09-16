/**
 * AboutContent bilingual rendering tests (pueblo-food-map#bilingual-static-pages).
 *
 * Proves the extracted client component renders EN by default and ES when
 * wrapped in a LocaleProvider set to "es" (#289) — including the FAQ, whose
 * JSON-LD (passed in as `faqJsonLd`) stays English always (#386) regardless
 * of the visible locale.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "@/lib/LocaleContext";
import { t } from "@/lib/i18n";
import AboutContent from "@/components/AboutContent";

// PageNav (bottom nav + drawer) has its own test; stub it so this page test
// doesn't need next/navigation or matchMedia.
vi.mock("@/components/PageNav", () => ({ default: () => null, PAGE_NAV_CLEARANCE: "" }));

const FIXTURE_JSON_LD = '{"@type":"FAQPage"}';

describe("AboutContent — locale", () => {
  test("renders English heading and FAQ with no provider (default locale)", () => {
    render(
      <AboutContent faqJsonLd={FIXTURE_JSON_LD} venueCount={42} publishedAt="2026-01-01T00:00:00.000Z" />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: t("about.heading", "en") }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { level: 3, name: t("about.faq.q1", "en") }),
    ).toBeDefined();
  });

  test("renders Spanish heading and FAQ when locale='es'", () => {
    render(
      <LocaleProvider initialLocale="es">
        <AboutContent
          faqJsonLd={FIXTURE_JSON_LD}
          venueCount={42}
          publishedAt="2026-01-01T00:00:00.000Z"
        />
      </LocaleProvider>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: t("about.heading", "es") }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { level: 3, name: t("about.faq.q1", "es") }),
    ).toBeDefined();
  });

  test("the injected JSON-LD script is exactly the English string passed in, regardless of locale", () => {
    const { container } = render(
      <LocaleProvider initialLocale="es">
        <AboutContent
          faqJsonLd={FIXTURE_JSON_LD}
          venueCount={42}
          publishedAt="2026-01-01T00:00:00.000Z"
        />
      </LocaleProvider>,
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script?.innerHTML).toBe(FIXTURE_JSON_LD);
  });
});
