/**
 * Render tests for the SEO hub page bodies + /resources FAQ (#709).
 *
 * Synthetic fixtures only. PageNav is stubbed (it has its own test and needs
 * next/navigation); next/link is stubbed to a plain <a>.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CommunityGardensHub, FoodPantriesHub, SnapWicHub } from "@/components/HubPages";
import ResourcesFaq from "@/components/ResourcesFaq";
import { t } from "@/lib/i18n";
import { PLACEHOLDER_ADDRESS } from "@/lib/venueSummary";
import type { Venue } from "@/types/venue";

vi.mock("@/components/PageNav", () => ({ default: () => null, PAGE_NAV_CLEARANCE: "" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
}));

function fx(id: string, overrides: Partial<Venue> = {}): Venue {
  return {
    id,
    name: `Fixture ${id}`,
    category: "pantry",
    lat: 38.27,
    lng: -104.61,
    address: `${id} Test St, Pueblo, CO 81003`,
    source: "test",
    last_verified: "2026-05-12",
    ...overrides,
  };
}

/** Parses every JSON-LD script in the container. */
function jsonLd(container: HTMLElement): Record<string, unknown>[] {
  return [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) =>
    JSON.parse(s.textContent ?? ""),
  );
}

const PANTRIES = [
  fx("with-hours", { name: "Hours Pantry", hours_weekly: { thu: ["11:00-14:00"] } }),
  fx("no-hours", { name: "Silent Pantry" }),
  fx("placeholder", { name: "Placeholder Pantry", address: PLACEHOLDER_ADDRESS }),
  fx("store", { name: "Not A Pantry", category: "grocery" }),
];

describe("FoodPantriesHub", () => {
  test("h1, count-in-data intro, name links to the venue page, EN", () => {
    render(<FoodPantriesHub locale="en" venues={PANTRIES} />);
    expect(screen.getByRole("heading", { level: 1, name: t("hubs.pantries.heading", "en") })).toBeDefined();
    // 3 pantries: the grocery store is excluded from the count.
    expect(screen.getByText(/There are 3 free food pantries/)).toBeDefined();
    expect(screen.getByRole("link", { name: "Hours Pantry" }).getAttribute("href")).toBe("/venue/with-hours");
    expect(screen.queryByText("Not A Pantry")).toBeNull();
  });

  test("ES tree links stay in /es and copy is Spanish", () => {
    render(<FoodPantriesHub locale="es" venues={PANTRIES} />);
    expect(screen.getByRole("link", { name: "Hours Pantry" }).getAttribute("href")).toBe("/es/venue/with-hours");
    expect(screen.getByRole("heading", { level: 1, name: t("hubs.pantries.heading", "es") })).toBeDefined();
  });

  test("hours in words when present; honest 'not listed' when not; never the placeholder address", () => {
    const { container } = render(<FoodPantriesHub locale="en" venues={PANTRIES} />);
    expect(screen.getByText("Hours: Thursdays, 11am – 2pm.")).toBeDefined();
    // Two pantries have no hours (no-hours, placeholder).
    expect(screen.getAllByText(t("hubs.hoursMissing", "en"))).toHaveLength(2);
    expect(container.textContent).not.toContain(PLACEHOLDER_ADDRESS);
    expect(container.textContent).not.toContain("Address not in");
    expect(screen.getByText("no-hours Test St, Pueblo, CO 81003")).toBeDefined();
  });

  test("ItemList JSON-LD matches the visible list; FAQPage text matches the visible FAQ exactly", () => {
    const { container } = render(<FoodPantriesHub locale="en" venues={PANTRIES} />);
    const blocks = jsonLd(container);
    const list = blocks.find((b) => b["@type"] === "ItemList") as {
      itemListElement: { position: number; name: string; url: string }[];
    };
    expect(list.itemListElement.map((i) => i.name)).toEqual(["Hours Pantry", "Placeholder Pantry", "Silent Pantry"]);
    expect(list.itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(list.itemListElement[0].url).toBe("https://pueblofoodmap.com/venue/with-hours");

    const faq = blocks.find((b) => b["@type"] === "FAQPage") as {
      mainEntity: { name: string; acceptedAnswer: { text: string } }[];
    };
    expect(faq.mainEntity).toHaveLength(4);
    for (const q of faq.mainEntity) {
      expect(screen.getByRole("heading", { level: 3, name: q.name })).toBeDefined();
      expect(screen.getByText(q.acceptedAnswer.text)).toBeDefined();
    }
  });

  test("the FAQ makes no eligibility, ID, income or immigration claim", () => {
    const { container } = render(<FoodPantriesHub locale="en" venues={PANTRIES} />);
    const faq = container.querySelector("section[aria-labelledby='pantry-faq-heading']")?.textContent ?? "";
    expect(faq).not.toMatch(/\b(ID|income|immigration|citizen|eligib)/i);
  });
});

describe("SnapWicHub", () => {
  const list = [
    fx("snap", { name: "Snap Store", category: "grocery", accepts_snap: true }),
    fx("both", { name: "Both Store", category: "grocery", accepts_snap: true, accepts_wic: true }),
    fx("wic", { name: "Wic Store", category: "convenience", accepts_wic: true }),
    fx("false", { name: "Neither Store", category: "grocery", accepts_snap: false }),
    fx("str", { name: "String Store", category: "grocery", accepts_snap: "true" as unknown as boolean }),
  ];

  test("counts computed from data; only strictly-true places listed", () => {
    render(<SnapWicHub locale="en" venues={list} />);
    expect(screen.getByText(/2 places on the map accept SNAP\/EBT and 2 accept WIC/)).toBeDefined();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByText("Neither Store")).toBeNull();
    expect(screen.queryByText("String Store")).toBeNull();
  });

  test("badges match each place's own fields", () => {
    render(<SnapWicHub locale="en" venues={list} />);
    const item = (name: string) => screen.getByRole("link", { name }).closest("li") as HTMLElement;
    expect(within(item("Snap Store")).getByText("Accepts SNAP/EBT")).toBeDefined();
    expect(within(item("Both Store")).getByText("Accepts SNAP/EBT · Accepts WIC")).toBeDefined();
    expect(within(item("Wic Store")).getByText("Accepts WIC")).toBeDefined();
  });

  test("never calls these places free; links to /resources in its own tree", () => {
    const { container } = render(<SnapWicHub locale="en" venues={list} />);
    expect(container.textContent?.toLowerCase()).not.toContain("free");
    // The footer carries the same label, so check every match.
    const hrefs = screen.getAllByRole("link", { name: t("resources.heading", "en") }).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/resources");
  });

  test("ES: /es venue + resources links, Spanish badges", () => {
    render(<SnapWicHub locale="es" venues={list} />);
    expect(screen.getByRole("link", { name: "Snap Store" }).getAttribute("href")).toBe("/es/venue/snap");
    const esHrefs = screen.getAllByRole("link", { name: t("resources.heading", "es") }).map((a) => a.getAttribute("href"));
    expect(esHrefs).toContain("/es/resources");
    expect(screen.getAllByText(/Acepta/).length).toBeGreaterThan(0);
  });

  test("ItemList JSON-LD lists each place once", () => {
    const { container } = render(<SnapWicHub locale="en" venues={list} />);
    const ld = jsonLd(container)[0] as { "@type": string; itemListElement: { name: string }[] };
    expect(ld["@type"]).toBe("ItemList");
    expect(ld.itemListElement.map((i) => i.name)).toEqual(["Both Store", "Snap Store", "Wic Store"]);
  });
});

describe("CommunityGardensHub", () => {
  const list = [
    fx("g", { name: "Bean Plot", category: "garden", hours_weekly: { sat: ["09:00-12:00"] } }),
    fx("e", { name: "Orchard Walk", category: "edible_landscape" }),
    fx("s", { name: "A Store", category: "grocery" }),
  ];

  test("free wording appears (both categories are in FREE_CATEGORIES); groups by category", () => {
    render(<CommunityGardensHub locale="en" venues={list} />);
    expect(screen.getByText(/There are 2 free community gardens and edible landscapes/)).toBeDefined();
    expect(screen.getByRole("heading", { level: 2, name: t("category.full.garden", "en") })).toBeDefined();
    expect(screen.getByRole("heading", { level: 2, name: t("category.full.edible_landscape", "en") })).toBeDefined();
    expect(screen.queryByText("A Store")).toBeNull();
  });

  test("hours in words, or not-listed line", () => {
    render(<CommunityGardensHub locale="en" venues={list} />);
    expect(screen.getByText("Hours: Saturdays, 9am – 12pm.")).toBeDefined();
    expect(screen.getByText(t("hubs.hoursMissing", "en"))).toBeDefined();
  });

  test("ES renders Spanish intro and /es links", () => {
    render(<CommunityGardensHub locale="es" venues={list} />);
    expect(screen.getByText(/Hay 2 huertos comunitarios y paisajes comestibles gratuitos/)).toBeDefined();
    expect(screen.getByRole("link", { name: "Bean Plot" }).getAttribute("href")).toBe("/es/venue/g");
  });
});

describe("ResourcesFaq", () => {
  test.each(["en", "es"] as const)("%s: four Q&As, FAQPage JSON-LD text equals the visible text", (locale) => {
    const { container } = render(<ResourcesFaq locale={locale} />);
    const faq = jsonLd(container)[0] as {
      "@type": string;
      inLanguage: string;
      mainEntity: { name: string; acceptedAnswer: { text: string } }[];
    };
    expect(faq["@type"]).toBe("FAQPage");
    expect(faq.inLanguage).toBe(locale);
    expect(faq.mainEntity).toHaveLength(4);
    for (const q of faq.mainEntity) {
      expect(screen.getByRole("heading", { level: 3, name: q.name })).toBeDefined();
      expect(screen.getByText(q.acceptedAnswer.text)).toBeDefined();
    }
    // No raw i18n key leaked through (a missing key renders the key itself).
    expect(container.textContent).not.toMatch(/resources\.faq\./);
  });

  test("EN answers state no eligibility/ID/income/immigration claim", () => {
    const { container } = render(<ResourcesFaq locale="en" />);
    // "income" appears once, in the SNAP answer: the county decides based on it (CDHS wording).
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/immigration|citizen|proof of|need (an? )?ID/i);
  });
});
