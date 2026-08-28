import { describe, test, expect, vi } from "vitest";
import ReportPage, { generateMetadata } from "@/app/report/[venueId]/page";
import { venues } from "@/data/venues";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => undefined),
  })),
}));

describe("/report/[venueId] page", () => {
  test("generateMetadata does not include manual Pueblo Food Map suffix", async () => {
    const venue = venues[0];
    const metadata = await generateMetadata({
      params: Promise.resolve({ venueId: venue.id }),
    });
    expect(metadata.title).toBe(`Report an issue — ${venue.name}`);
    expect(metadata.title).not.toContain("Pueblo Food Map");
  });

  test("generateMetadata handles missing venue without brand suffix", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ venueId: "unknown-venue-id" }),
    });
    expect(metadata.title).toBe("Report an issue");
  });

  test("ReportPage calls notFound() for unknown venue ID", async () => {
    const { notFound } = await import("next/navigation");
    await expect(
      ReportPage({ params: Promise.resolve({ venueId: "invalid-venue-xyz" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});