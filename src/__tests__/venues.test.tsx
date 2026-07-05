/**
 * /venues directory page tests — SEO/AEO PR4 item S5
 *
 * Covers:
 *   1. Sitemap includes /venues URL.
 *   2. buildPageMetadata produces correct canonical + OG for /venues.
 *   3. i18n keys for the venues directory are present and differ EN/ES.
 *   4. groupVenuesByCategory: category order, empty-category omission,
 *      within-group name sort, and no venue lost/duplicated.
 *   5. HamburgerMenu contains a /venues link when open.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SITE_URL, buildPageMetadata } from "@/lib/site";
import sitemap from "@/app/sitemap";
import { groupVenuesByCategory } from "@/app/venues/page";
import { I18N_DICTIONARIES, t } from "@/lib/i18n";
import { categoryLabels } from "@/data/venues";
import type { Venue, VenueCategory } from "@/types/venue";
import HamburgerMenu from "@/components/HamburgerMenu";

// ─── next/link mock (same pattern as about.test.tsx / HamburgerMenu.test.tsx) ─
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

describe("sitemap — /venues", () => {
  test("/venues is present in the sitemap", () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${SITE_URL}/venues`);
  });

  test("/venues entry has a positive priority", () => {
    const entries = sitemap();
    const entry = entries.find((e) => e.url === `${SITE_URL}/venues`);
    expect(entry).toBeDefined();
    expect((entry?.priority ?? 0) > 0).toBe(true);
  });
});

// ─── 2. Page metadata ─────────────────────────────────────────────────────────

describe("buildPageMetadata — /venues", () => {
  const m = buildPageMetadata({
    title: "All Food Resources",
    description:
      "Browse every food resource on the Pueblo Food Map — food pantries, grocery stores, community gardens, farms, and meal sites across Pueblo County, CO, with addresses and hours.",
    path: "/venues",
  });

  test("alternates.canonical is the /venues URL", () => {
    expect(m.alternates?.canonical).toBe(`${SITE_URL}/venues`);
  });

  test("openGraph.url is the /venues URL", () => {
    const og = m.openGraph as { url?: string };
    expect(og.url).toBe(`${SITE_URL}/venues`);
  });
});

// ─── 3. i18n — venues.* / nav.venuesList key parity ──────────────────────────

const { en, es } = I18N_DICTIONARIES;

describe("i18n — venues directory keys", () => {
  const VENUES_KEYS = [
    "nav.venuesList",
    "venues.heading",
    "venues.intro",
    "venues.noHours",
  ] as const;

  test("all keys exist in EN dictionary", () => {
    const missing = VENUES_KEYS.filter((k) => !(k in en));
    expect(missing, `Missing EN keys: ${missing.join(", ")}`).toEqual([]);
  });

  test("all keys exist in ES dictionary", () => {
    const missing = VENUES_KEYS.filter((k) => !(k in es));
    expect(missing, `Missing ES keys: ${missing.join(", ")}`).toEqual([]);
  });

  test("keys differ between EN and ES", () => {
    const identical: string[] = [];
    for (const key of VENUES_KEYS) {
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

// ─── 4. groupVenuesByCategory ─────────────────────────────────────────────────
//
// Synthetic fixtures (not the real venues dataset) so category coverage is
// controlled: only pantry, garden, and meal_site are populated, proving the
// other four categories are correctly omitted rather than rendered empty.

function makeVenue(overrides: Partial<Venue> & { id: string; name: string; category: VenueCategory }): Venue {
  return {
    lat: 38.27,
    lng: -104.6,
    address: "1 Test St, Pueblo, CO",
    source: "test",
    last_verified: "2026-01-01",
    ...overrides,
  };
}

const FIXTURE_VENUES: Venue[] = [
  makeVenue({ id: "v1", name: "Zed Pantry", category: "pantry" }),
  makeVenue({ id: "v2", name: "Alpha Pantry", category: "pantry" }),
  makeVenue({ id: "v3", name: "Community Garden", category: "garden" }),
  makeVenue({ id: "v4", name: "Downtown Meal Site", category: "meal_site" }),
];

describe("groupVenuesByCategory", () => {
  const groups = groupVenuesByCategory(FIXTURE_VENUES);

  test("groups are in categoryLabels key order", () => {
    const allCategories = Object.keys(categoryLabels) as VenueCategory[];
    const presentCategories = groups.map((g) => g.category);
    const expectedOrder = allCategories.filter((c) => presentCategories.includes(c));
    expect(presentCategories).toEqual(expectedOrder);
  });

  test("empty categories are omitted", () => {
    const presentCategories = groups.map((g) => g.category);
    for (const emptyCategory of ["grocery", "convenience", "farm", "edible_landscape"] as const) {
      expect(presentCategories).not.toContain(emptyCategory);
    }
  });

  test("within a group, items are sorted by name", () => {
    const pantryGroup = groups.find((g) => g.category === "pantry");
    expect(pantryGroup).toBeDefined();
    expect(pantryGroup!.items.map((v) => v.name)).toEqual(["Alpha Pantry", "Zed Pantry"]);
  });

  test("every input venue appears exactly once across groups", () => {
    const outputIds = groups.flatMap((g) => g.items.map((v) => v.id));
    expect(outputIds.slice().sort()).toEqual(FIXTURE_VENUES.map((v) => v.id).sort());
    expect(new Set(outputIds).size).toBe(outputIds.length);
  });
});

// ─── 5. HamburgerMenu — /venues link ─────────────────────────────────────────

describe("HamburgerMenu — venues directory link", () => {
  test("panel contains a link to /venues (EN)", async () => {
    const user = userEvent.setup();
    render(<HamburgerMenu locale="en" />);
    await user.click(screen.getByRole("button", { name: /Open menu/i }));
    await waitFor(() => {
      const link = screen.getByRole("link", {
        name: new RegExp(t("nav.venuesList", "en"), "i"),
      }) as HTMLAnchorElement;
      expect(link).toBeDefined();
      expect(link.href).toContain("/venues");
    });
  });
});
