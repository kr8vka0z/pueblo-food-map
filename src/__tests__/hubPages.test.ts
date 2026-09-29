/**
 * Unit tests for src/lib/hubPages.ts — SEO hub pages (#709).
 *
 * Synthetic fixtures only: never a real venue's name/hours, and nothing depends
 * on src/data/venues.ts, so an admin Publish can't break these.
 */

import { describe, test, expect } from "vitest";
import {
  allFree,
  gardensForHub,
  hubAddress,
  hubHours,
  pantriesForHub,
  snapWicForHub,
} from "@/lib/hubPages";
import { buildVenueListJsonLd, buildFaqJsonLd } from "@/lib/venueSchema";
import { PLACEHOLDER_ADDRESS } from "@/lib/venueSummary";
import { SITE_URL } from "@/lib/site";
import type { Venue } from "@/types/venue";

function fx(id: string, overrides: Partial<Venue> = {}): Venue {
  return {
    id,
    name: `Fixture ${id}`,
    category: "pantry",
    lat: 38.27,
    lng: -104.61,
    address: "100 Test St, Pueblo, CO 81003",
    source: "test",
    last_verified: "2026-05-12",
    ...overrides,
  };
}

describe("pantriesForHub", () => {
  test("keeps only pantries and sorts by name", () => {
    const list = [
      fx("b", { name: "Zeta" }),
      fx("a", { name: "Alpha" }),
      fx("g", { name: "Aardvark Garden", category: "garden" }),
      fx("m", { name: "Middle" }),
    ];
    expect(pantriesForHub(list).map((v) => v.name)).toEqual(["Alpha", "Middle", "Zeta"]);
  });

  test("keeps a pantry with no hours and one with the placeholder address", () => {
    const noHours = fx("nh", { name: "No Hours" });
    const placeholder = fx("ph", { name: "Placeholder", address: PLACEHOLDER_ADDRESS });
    expect(pantriesForHub([noHours, placeholder])).toHaveLength(2);
  });
});

describe("hubAddress / hubHours", () => {
  test("hubAddress hides the OSM placeholder, keeps a real address", () => {
    expect(hubAddress(fx("a", { address: PLACEHOLDER_ADDRESS }))).toBeNull();
    expect(hubAddress(fx("a"))).toBe("100 Test St, Pueblo, CO 81003");
  });

  test("hubHours is null with no hours data (never invented)", () => {
    expect(hubHours(fx("a"), "en")).toBeNull();
  });

  test("hubHours words weekly hours, in both locales", () => {
    const v = fx("a", { hours_weekly: { thu: ["11:00-14:00"] } });
    expect(hubHours(v, "en")).toBe("Hours: Thursdays, 11am – 2pm.");
    expect(hubHours(v, "es")).toMatch(/^Horario: /);
  });

  test("hubHours words a monthly schedule", () => {
    const v = fx("a", {
      hours_irregular: [
        { recurrence: "monthly_ordinal", ordinal: 2, weekday: "fri", slots: ["10:00-15:45"] },
      ],
    });
    expect(hubHours(v, "en")).toContain("2nd Friday of each month");
  });
});

describe("snapWicForHub — strict === true", () => {
  const list = [
    fx("snap", { name: "B Snap", category: "grocery", accepts_snap: true }),
    fx("wic", { name: "C Wic", category: "grocery", accepts_wic: true }),
    fx("both", { name: "A Both", category: "grocery", accepts_snap: true, accepts_wic: true }),
    fx("false", { name: "D False", accepts_snap: false, accepts_wic: false }),
    fx("undef", { name: "E Undef" }),
    // A string or 1 must never pass a truthy check — only the literal boolean.
    fx("str", { name: "F Str", accepts_snap: "true" as unknown as boolean }),
    fx("one", { name: "G One", accepts_wic: 1 as unknown as boolean }),
  ];

  test("includes only confirmed places, each once, sorted by name", () => {
    const { places } = snapWicForHub(list);
    expect(places.map((v) => v.id)).toEqual(["both", "snap", "wic"]);
  });

  test("counts SNAP and WIC separately from the filtered list", () => {
    const { snapCount, wicCount } = snapWicForHub(list);
    expect(snapCount).toBe(2);
    expect(wicCount).toBe(2);
  });

  test("empty input gives zero counts", () => {
    expect(snapWicForHub([])).toEqual({ places: [], snapCount: 0, wicCount: 0 });
  });
});

describe("gardensForHub", () => {
  test("groups gardens then edible landscapes, sorted by name, ignoring other categories", () => {
    const list = [
      fx("e1", { name: "Yarrow Walk", category: "edible_landscape" }),
      fx("g2", { name: "Zinnia Plot", category: "garden" }),
      fx("g1", { name: "Aster Plot", category: "garden" }),
      fx("p", { name: "A Pantry", category: "pantry" }),
    ];
    const groups = gardensForHub(list);
    expect(groups.map((g) => g.category)).toEqual(["garden", "edible_landscape"]);
    expect(groups[0].items.map((v) => v.name)).toEqual(["Aster Plot", "Zinnia Plot"]);
    expect(groups[1].items.map((v) => v.name)).toEqual(["Yarrow Walk"]);
  });

  test("drops an empty group", () => {
    const groups = gardensForHub([fx("g", { category: "garden" })]);
    expect(groups.map((g) => g.category)).toEqual(["garden"]);
  });
});

describe("allFree — 'free' wording gate", () => {
  test("true only when every place is in FREE_CATEGORIES (garden, edible_landscape, pantry)", () => {
    expect(allFree([fx("a", { category: "garden" }), fx("b", { category: "edible_landscape" })])).toBe(true);
    expect(allFree([fx("a", { category: "pantry" })])).toBe(true);
  });

  test("false when any place is a store, and for an empty list", () => {
    expect(allFree([fx("a", { category: "garden" }), fx("b", { category: "grocery" })])).toBe(false);
    expect(allFree([])).toBe(false);
  });
});

describe("hub JSON-LD (house builders fed the hub lists)", () => {
  test("ItemList: positions 1..n, absolute URLs, names, matching the list order", () => {
    const list = pantriesForHub([fx("b", { name: "B" }), fx("a", { name: "A" })]);
    const ld = buildVenueListJsonLd(list, "en") as {
      "@context": string;
      "@type": string;
      itemListElement: { "@type": string; position: number; url: string; name: string }[];
    };
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("ItemList");
    expect(ld.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(ld.itemListElement.map((i) => i.name)).toEqual(["A", "B"]);
    for (const item of ld.itemListElement) {
      expect(item["@type"]).toBe("ListItem");
      expect(item.url.startsWith(`${SITE_URL}/venue/`)).toBe(true);
    }
  });

  test("ES ItemList points at /es/venue/<id>", () => {
    const ld = buildVenueListJsonLd([fx("a")], "es") as { itemListElement: { url: string }[] };
    expect(ld.itemListElement[0].url).toBe(`${SITE_URL}/es/venue/a`);
  });

  test("FAQPage: Question/Answer pairs, language set", () => {
    const ld = buildFaqJsonLd([{ question: "Q?", answer: "A." }], "es") as {
      "@type": string;
      inLanguage: string;
      mainEntity: { "@type": string; name: string; acceptedAnswer: { "@type": string; text: string } }[];
    };
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.inLanguage).toBe("es");
    expect(ld.mainEntity[0]).toEqual({
      "@type": "Question",
      name: "Q?",
      acceptedAnswer: { "@type": "Answer", text: "A." },
    });
  });
});
