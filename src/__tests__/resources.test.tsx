/**
 * /resources page tests.
 *
 * Covers:
 *   1. Sitemap includes /resources.
 *   2. Every program renders a heading plus both sub-headings, in EN and ES,
 *      with no raw i18n keys leaking through (a missing key renders the key).
 *   3. Call / text / website buttons point where the copy says they do.
 *   4. Website buttons open a new tab and say so to screen readers.
 *   5. Cards start collapsed; only the name is in the <summary>.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { SITE_URL } from "@/lib/site";
import sitemap from "@/app/sitemap";
import ResourcesContent, { PROGRAMS } from "@/components/ResourcesContent";
import { LocaleProvider } from "@/lib/LocaleContext";
import { t, type Locale } from "@/lib/i18n";

// PageNav (bottom nav + drawer) has its own test; stub it so this page test
// doesn't need next/navigation or matchMedia.
vi.mock("@/components/PageNav", () => ({ default: () => null, PAGE_NAV_CLEARANCE: "" }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
}));

function renderPage(locale: Locale) {
  return render(
    <LocaleProvider initialLocale={locale}>
      <ResourcesContent />
    </LocaleProvider>,
  );
}

describe("/resources", () => {
  test("is in the sitemap", () => {
    expect(sitemap().map((e) => e.url)).toContain(`${SITE_URL}/resources`);
  });

  test.each(["en", "es"] as const)("renders every program card in %s with no missing keys", (locale) => {
    const { container } = renderPage(locale);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(t("resources.heading", locale));
    for (const { key } of PROGRAMS) {
      const card = screen.getByRole("region", { name: t(`resources.${key}.name`, locale) });
      within(card).getByText(t(`resources.${key}.what`, locale));
      within(card).getByText(t(`resources.${key}.how`, locale));
    }
    expect(container.textContent).not.toMatch(/resources\.[a-z0-9]+\./);
  });

  test("every card starts collapsed, showing only its name (Kyle, 2026-09-16)", () => {
    renderPage("en");
    for (const { key } of PROGRAMS) {
      const card = screen.getByRole("region", { name: t(`resources.${key}.name`, "en") });
      const details = card.querySelector("details")!;
      expect(details.open).toBe(false);
      const summary = details.querySelector("summary")!;
      expect(summary.textContent).toContain(t(`resources.${key}.name`, "en"));
      expect(summary.textContent).not.toContain(t(`resources.${key}.what`, "en"));
      expect(summary.textContent).not.toContain(t(`resources.${key}.how`, "en"));
    }
  });

  test("phone, text and website buttons carry the right targets", () => {
    renderPage("en");
    const hotline = screen.getByRole("region", { name: "Food Resource Hotline" });
    expect(within(hotline).getByRole("link", { name: /Call 855-855-4626/ }).getAttribute("href")).toBe("tel:+18558554626");

    const co211 = screen.getByRole("region", { name: "2-1-1 Colorado" });
    expect(within(co211).getByRole("link", { name: /Text 898-211/ }).getAttribute("href")).toBe("sms:898211");

    const eats = screen.getByRole("region", { name: /Everyday Eats/ });
    expect(within(eats).getByRole("link", { name: /Text 1-877-644-3663/ }).getAttribute("href")).toBe(
      "sms:+18776443663?&body=FOOD",
    );

    const peak = screen.getByRole("link", { name: /Apply on PEAK/ }) as HTMLAnchorElement;
    expect(peak.getAttribute("href")).toBe("https://www.colorado.gov/PEAK");
    expect(peak.target).toBe("_blank");
    expect(peak.rel).toContain("noopener");
    expect(peak.textContent).toContain(t("menu.opensInNewTab", "en"));
  });
});
