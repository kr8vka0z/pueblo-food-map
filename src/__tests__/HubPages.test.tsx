/**
 * Render tests for the SEO hub page bodies + /resources FAQ (#709).
 *
 * Synthetic fixtures only. PageNav is stubbed (it has its own test and needs
 * next/navigation); next/link is stubbed to a plain <a>.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { BlessingBoxesHub, CommunityGardensHub, FoodPantriesHub, SnapWicHub } from "@/components/HubPages";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";
import ResourcesContent from "@/components/ResourcesContent";
import { LocaleProvider } from "@/lib/LocaleContext";
import { resourcesFaqJsonLd } from "@/lib/resourcesFaq";
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
    expect(screen.getByRole("heading", { level: 2, name: t("hubs.gardens.section.garden", "en") })).toBeDefined();
    expect(screen.getByRole("heading", { level: 2, name: t("hubs.gardens.section.edible_landscape", "en") })).toBeDefined();
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

describe("/resources FAQ (ResourcesContent + resourcesFaqJsonLd)", () => {
  function renderPage(tree: "en" | "es", jsonLdLocale: "en" | "es" = tree) {
    return render(
      <LocaleProvider initialLocale={tree}>
        <ResourcesContent faqJsonLd={resourcesFaqJsonLd(jsonLdLocale)} />
      </LocaleProvider>,
    );
  }

  test.each(["en", "es"] as const)("%s: four Q&As, FAQPage JSON-LD text equals the visible text", (locale) => {
    const { container } = renderPage(locale);
    const faq = jsonLd(container).find((b) => b["@type"] === "FAQPage") as {
      inLanguage: string;
      mainEntity: { name: string; acceptedAnswer: { text: string } }[];
    };
    expect(faq.inLanguage).toBe(locale);
    expect(faq.mainEntity).toHaveLength(4);
    for (const q of faq.mainEntity) {
      expect(screen.getByRole("heading", { level: 3, name: q.name })).toBeDefined();
      expect(screen.getByText(q.acceptedAnswer.text)).toBeDefined();
    }
    // No raw i18n key leaked through (a missing key renders the key itself).
    expect(container.textContent).not.toMatch(/resources\.faq\./);
  });

  test("the visible FAQ follows the visitor's locale, not the JSON-LD's tree", () => {
    // Spanish visitor (cookie/provider) on the EN page: JSON-LD stays English,
    // the visible FAQ is Spanish.
    const { container } = renderPage("es", "en");
    expect(screen.getByRole("heading", { level: 2, name: t("resources.faq.heading", "es") })).toBeDefined();
    const faq = jsonLd(container).find((b) => b["@type"] === "FAQPage") as { inLanguage: string };
    expect(faq.inLanguage).toBe("en");
  });

  test("Spanish copy names the hotline like the card does (Recursos, not Ayuda)", () => {
    renderPage("es");
    expect(document.body.textContent).not.toContain("Línea de Ayuda Alimentaria");
  });

  test("EN answers state no eligibility/ID/immigration claim", () => {
    const { container } = renderPage("en");
    // Only the FAQ section: the program cards above it have their own, separately sourced text.
    const faq = container.querySelector("section[aria-labelledby='resources-faq-heading']")?.textContent ?? "";
    expect(faq.length).toBeGreaterThan(0);
    expect(faq).not.toMatch(/immigration|citizen|proof of|need (an? )?ID/i);
  });
});

// /blessing-boxes (PR B): synthetic boxes only.
function boxFx(
  id: string,
  overrides: Partial<PublicBlessingBox> = {},
  status: PublicBlessingBox["box"]["status"] = "unknown",
): PublicBlessingBox {
  return {
    ...fx(id, { name: `Box ${id}` }),
    category: "blessing_box",
    box: {
      hostName: "Private Host",
      hostNote: null,
      mostNeeded: null,
      installedOn: null,
      removedOn: null,
      status,
      lastFilledAt: null,
      recentCheckins: [],
      latestPhoto: null,
      adopters: [],
    },
    ...overrides,
  };
}

describe("BlessingBoxesHub", () => {
  const BOXES = [
    boxFx("zz", { name: "Zulu Box" }, "low"),
    boxFx("aa", { name: "Alpha Box", address: PLACEHOLDER_ADDRESS }),
  ];

  test("h1, live count, sorted links into the map card, EN", () => {
    render(<BlessingBoxesHub locale="en" boxes={BOXES} degraded={false} />);
    expect(screen.getByRole("heading", { level: 1, name: t("hubs.boxes.heading", "en") })).toBeDefined();
    expect(screen.getByText(/There are 2 blessing boxes/)).toBeDefined();
    const links = screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.includes("?venue="));
    expect(links.map((a) => a.textContent)).toEqual(["Alpha Box", "Zulu Box"]);
    expect(links[0].getAttribute("href")).toBe("/?venue=aa");
  });

  test("ES links go to /es?venue=<id> and copy is Spanish", () => {
    render(<BlessingBoxesHub locale="es" boxes={BOXES} degraded={false} />);
    expect(screen.getByRole("link", { name: "Zulu Box" }).getAttribute("href")).toBe("/es?venue=zz");
    expect(screen.getByText(/Hay 2 cajas de bendiciones/)).toBeDefined();
  });

  test("placeholder address omitted; status only when known; no host data, no 'free', no controls", () => {
    const { container } = render(<BlessingBoxesHub locale="en" boxes={BOXES} degraded={false} />);
    expect(container.textContent).not.toContain(PLACEHOLDER_ADDRESS);
    expect(container.textContent).not.toContain("Address not in");
    expect(container.textContent).not.toContain("Private Host");
    expect(container.textContent).not.toMatch(/\bfree\b/i);
    expect(screen.getByText("Status: Running low")).toBeDefined();
    expect(screen.getAllByText(/^Status:/)).toHaveLength(1);
    expect(container.querySelector("button, form, input")).toBeNull();
  });

  test("ItemList JSON-LD matches the visible list", () => {
    const { container } = render(<BlessingBoxesHub locale="en" boxes={BOXES} degraded={false} />);
    const [ld] = jsonLd(container) as { itemListElement: { name: string; url: string }[] }[];
    expect(ld.itemListElement.map((e) => e.name)).toEqual(["Alpha Box", "Zulu Box"]);
    expect(ld.itemListElement[0].url).toBe("https://pueblofoodmap.com/?venue=aa");
  });

  test("real empty result: says none listed, no JSON-LD, no '0 boxes'", () => {
    const { container } = render(<BlessingBoxesHub locale="en" boxes={[]} degraded={false} />);
    expect(screen.getByText(t("hubs.boxes.empty", "en"))).toBeDefined();
    expect(jsonLd(container)).toHaveLength(0);
    expect(container.textContent).not.toMatch(/\b0 blessing/);
  });

  test("degraded: honest message + map link, no list, no JSON-LD, never a count", () => {
    const { container } = render(<BlessingBoxesHub locale="en" boxes={[]} degraded={true} />);
    expect(screen.getByText(t("hubs.boxes.degraded", "en"))).toBeDefined();
    expect(screen.getByRole("link", { name: t("hubs.boxes.openMap", "en") }).getAttribute("href")).toBe("/");
    expect(container.querySelector("ul")).toBeNull();
    expect(jsonLd(container)).toHaveLength(0);
    expect(container.textContent).not.toMatch(/There are|no blessing boxes listed/);
  });
});
