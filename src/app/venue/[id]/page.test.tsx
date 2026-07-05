/**
 * generateMetadata regression test — issue #164 duplicate-content fix (S4).
 *
 * WHY: generateMetadata previously built the SAME description string for
 * every venue sharing a category (e.g. every "grocery" venue got a
 * byte-identical `"${category} in Pueblo, CO. Hours, ..."` description) — a
 * duplicate-content SEO problem search engines can penalize. This locks in
 * that each venue's description includes its own name + address, so no two
 * venues (even in the same category) ever produce the same string.
 *
 * Only `generateMetadata` is exercised here, not the default page export —
 * the default export calls `cookies()` (next/headers), which needs a real
 * request context this test environment doesn't provide. generateMetadata
 * itself never touches cookies, so it's safely testable in isolation.
 */

import { describe, test, expect } from "vitest";
import { generateMetadata } from "@/app/venue/[id]/page";
import { venues } from "@/data/venues";

async function descriptionFor(id: string): Promise<string> {
  const metadata = await generateMetadata({ params: Promise.resolve({ id }) });
  return String(metadata.description ?? "");
}

describe("venue page generateMetadata", () => {
  test("description includes the venue's own name and address", async () => {
    const v = venues[0];
    const description = await descriptionFor(v.id);
    expect(description).toContain(v.name);
    expect(description).toContain(v.address);
  });

  test("two distinct venues never get the same description", async () => {
    const [a, b] = venues;
    const [descA, descB] = await Promise.all([
      descriptionFor(a.id),
      descriptionFor(b.id),
    ]);
    expect(descA).not.toBe(descB);
  });

  test("two venues sharing a category still get different descriptions (the original bug)", async () => {
    const byCategory = new Map<string, typeof venues>();
    for (const v of venues) {
      const bucket = byCategory.get(v.category) ?? [];
      bucket.push(v);
      byCategory.set(v.category, bucket);
    }
    const sharedCategoryPair = [...byCategory.values()].find((bucket) => bucket.length >= 2);
    // If no category has 2+ venues today, this guard has nothing to prove —
    // but the venue set (74+, per AGENTS.md) makes that vanishingly unlikely.
    expect(sharedCategoryPair).toBeDefined();
    const [a, b] = sharedCategoryPair!;
    const [descA, descB] = await Promise.all([
      descriptionFor(a.id),
      descriptionFor(b.id),
    ]);
    expect(descA).not.toBe(descB);
  });

  test("description stays under 160 chars for every venue", async () => {
    const descriptions = await Promise.all(venues.map((v) => descriptionFor(v.id)));
    for (const description of descriptions) {
      expect(description.length).toBeLessThan(160);
    }
  });

  test("unknown venue id returns empty metadata (unchanged 404 behavior)", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ id: "not-a-real-id" }) });
    expect(metadata).toEqual({});
  });
});
