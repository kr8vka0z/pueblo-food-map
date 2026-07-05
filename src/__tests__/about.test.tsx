/**
 * /about page tests — issue #155
 *
 * Covers:
 *   1. Sitemap includes /about URL.
 *   2. buildPageMetadata produces correct canonical + OG for /about.
 *   3. i18n keys for about.* are present and differ EN/ES (parity check).
 *   4. SiteFooter renders an About link (render test).
 *   5. HamburgerMenu contains an About link when open.
 *   6. buildFaqJsonLd produces valid FAQPage structured data (#PR4).
 *   7. about.stat.count is parameterized with a live count, not hardcoded (#PR4).
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SITE_URL } from "@/lib/site";
import { buildPageMetadata } from "@/lib/site";
import sitemap from "@/app/sitemap";
import { I18N_DICTIONARIES, t } from "@/lib/i18n";
import { buildFaqJsonLd } from "@/lib/venueSchema";
import SiteFooter from "@/components/SiteFooter";
import HamburgerMenu from "@/components/HamburgerMenu";
import { LocaleProvider } from "@/lib/LocaleContext";

// ─── next/link mock (same pattern as HamburgerMenu.test.tsx) ─────────────────
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a
      href={href}
      {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
    >
      {children}
    </a>
  ),
}));

// ─── window.matchMedia stub (required by HamburgerMenu for mobile detection) ──
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

// ─── 1. Sitemap ───────────────────────────────────────────────────────────────

describe("sitemap — /about", () => {
  test("/about is present in the sitemap", () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${SITE_URL}/about`);
  });

  test("/about entry has a positive priority", () => {
    const entries = sitemap();
    const aboutEntry = entries.find((e) => e.url === `${SITE_URL}/about`);
    expect(aboutEntry).toBeDefined();
    expect((aboutEntry?.priority ?? 0) > 0).toBe(true);
  });
});

// ─── 2. Page metadata ─────────────────────────────────────────────────────────

describe("buildPageMetadata — /about", () => {
  const m = buildPageMetadata({
    title: "About",
    description: "About Pueblo Food Map — mission, vision, and how venues are sourced.",
    path: "/about",
  });

  test("alternates.canonical is the /about URL", () => {
    expect(m.alternates?.canonical).toBe(`${SITE_URL}/about`);
  });

  test("openGraph.url is the /about URL", () => {
    const og = m.openGraph as { url?: string };
    expect(og.url).toBe(`${SITE_URL}/about`);
  });

  test("openGraph.title is 'About'", () => {
    const og = m.openGraph as { title?: string };
    expect(og.title).toBe("About");
  });
});

// ─── 3. i18n — about.* key parity ────────────────────────────────────────────
//
// WHY: The i18n.test.ts parity check enforces that every EN key exists in ES
// and that non-allowlisted keys differ. These tests confirm the about.* keys
// satisfy that contract before the main parity suite runs.

const { en, es } = I18N_DICTIONARIES;

describe("i18n — about.* keys", () => {
  const ABOUT_KEYS = [
    "about.heading",
    "about.backToMap",
    "about.mission.heading",
    "about.mission.body",
    "about.howWeSource.heading",
    "about.howWeSource.body",
    "about.suggest.heading",
    "about.suggest.body",
    "nav.about",
    "footer.backToMap",
    "footer.about",
    "about.faq.heading",
    "about.faq.q1",
    "about.faq.q2",
    "about.faq.q3",
    "about.faq.q4",
    "about.faq.q5",
    "about.faq.q6",
    "about.faq.a1",
    "about.faq.a2",
    "about.faq.a3",
    "about.faq.a4",
    "about.faq.a5",
    "about.faq.a6",
    "about.stat.insecurity",
    "about.stat.count",
  ] as const;

  test("all about.* keys exist in EN dictionary", () => {
    const missing = ABOUT_KEYS.filter((k) => !(k in en));
    expect(missing, `Missing EN keys: ${missing.join(", ")}`).toEqual([]);
  });

  test("all about.* keys exist in ES dictionary", () => {
    const missing = ABOUT_KEYS.filter((k) => !(k in es));
    expect(missing, `Missing ES keys: ${missing.join(", ")}`).toEqual([]);
  });

  test("about.* keys differ between EN and ES", () => {
    const identical: string[] = [];
    for (const key of ABOUT_KEYS) {
      if (en[key] !== undefined && en[key] === es[key]) {
        identical.push(key);
      }
    }
    expect(
      identical,
      `Keys with identical EN/ES copy: ${identical.join(", ")}`,
    ).toEqual([]);
  });
});

// ─── 4. SiteFooter ───────────────────────────────────────────────────────────

describe("SiteFooter", () => {
  test("renders an About link pointing to /about (EN)", () => {
    const { container } = render(
      <LocaleProvider initialLocale="en">
        <SiteFooter />
      </LocaleProvider>,
    );
    const links = container.querySelectorAll("a[href='/about']");
    expect(links.length, "Expected an <a href='/about'> in SiteFooter").toBeGreaterThan(0);
  });

  test("renders an About link pointing to /about (ES)", () => {
    const { container } = render(
      <LocaleProvider initialLocale="es">
        <SiteFooter />
      </LocaleProvider>,
    );
    const links = container.querySelectorAll("a[href='/about']");
    expect(links.length, "Expected an <a href='/about'> in SiteFooter (ES)").toBeGreaterThan(0);
  });

  test("renders a Back to map link pointing to / (EN)", () => {
    const { container } = render(
      <LocaleProvider initialLocale="en">
        <SiteFooter />
      </LocaleProvider>,
    );
    const links = container.querySelectorAll("a[href='/']");
    expect(links.length, "Expected an <a href='/'> in SiteFooter").toBeGreaterThan(0);
  });

  test("About link text uses the EN i18n key", () => {
    const { container } = render(
      <LocaleProvider initialLocale="en">
        <SiteFooter />
      </LocaleProvider>,
    );
    const aboutLink = container.querySelector("a[href='/about']");
    expect(aboutLink?.textContent?.trim()).toBe(t("footer.about", "en"));
  });

  test("About link text uses the ES i18n key", () => {
    const { container } = render(
      <LocaleProvider initialLocale="es">
        <SiteFooter />
      </LocaleProvider>,
    );
    const aboutLink = container.querySelector("a[href='/about']");
    expect(aboutLink?.textContent?.trim()).toBe(t("footer.about", "es"));
  });
});

// ─── 5. HamburgerMenu — About link ───────────────────────────────────────────

describe("HamburgerMenu — About link", () => {
  test("panel contains an About link pointing to /about", async () => {
    const user = userEvent.setup();
    render(<HamburgerMenu locale="en" />);
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      const link = screen.getByRole("link", {
        name: new RegExp(t("nav.about", "en"), "i"),
      }) as HTMLAnchorElement;
      expect(link).toBeDefined();
      expect(link.href).toContain("/about");
    });
  });

  test("About link is present in ES locale", async () => {
    const user = userEvent.setup();
    render(<HamburgerMenu locale="es" />);
    await user.click(screen.getByRole("button", { name: /Abrir/i }));
    await waitFor(() => {
      // Look for a link to /about regardless of text
      const links = document.querySelectorAll("a[href='/about']");
      expect(links.length).toBeGreaterThan(0);
    });
  });
});

// ─── 6. buildFaqJsonLd (#PR4) ─────────────────────────────────────────────────

describe("buildFaqJsonLd", () => {
  const sample = [
    { question: "Is this free?", answer: "Yes, completely free." },
    { question: "How current is it?", answer: "Updated as reports come in." },
  ];
  const jsonLd = buildFaqJsonLd(sample) as {
    "@type": string;
    mainEntity: {
      "@type": string;
      name: string;
      acceptedAnswer: { "@type": string; text: string };
    }[];
  };

  test("@type is FAQPage", () => {
    expect(jsonLd["@type"]).toBe("FAQPage");
  });

  test("mainEntity has one entry per input item", () => {
    expect(jsonLd.mainEntity.length).toBe(2);
  });

  test("each entry is a Question whose name/answer match the input", () => {
    jsonLd.mainEntity.forEach((entry, i) => {
      expect(entry["@type"]).toBe("Question");
      expect(entry.name).toBe(sample[i].question);
      expect(entry.acceptedAnswer["@type"]).toBe("Answer");
      expect(entry.acceptedAnswer.text).toBe(sample[i].answer);
    });
  });
});

// ─── 7. about.stat.count — live venue count, not hardcoded (#PR4) ────────────

describe("about.stat.count interpolation", () => {
  test("EN template carries a {count} placeholder", () => {
    expect(en["about.stat.count"]).toContain("{count}");
  });

  test("t() substitutes {count} with the live value and leaves no placeholder", () => {
    const result = t("about.stat.count", "en", { count: "42" });
    expect(result).toContain("42");
    expect(result).not.toContain("{count}");
  });
});
