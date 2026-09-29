/**
 * /blessing-boxes + /es/blessing-boxes page tests (#709 PR B): the D1 read,
 * degraded (D1 failure) and empty states, and noindex-on-failure metadata.
 * Synthetic boxes only. Mocks getCloudflareContext + loadLiveBoxesForHub like
 * box/[id]/page.test.tsx does.
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const mockLoadLiveBoxes = vi.fn();
vi.mock("@/lib/blessingBoxes", async () => {
  const actual = await vi.importActual<typeof import("@/lib/blessingBoxes")>("@/lib/blessingBoxes");
  return { ...actual, loadLiveBoxesForHub: (...args: unknown[]) => mockLoadLiveBoxes(...args) };
});

vi.mock("@/components/PageNav", () => ({ default: () => null, PAGE_NAV_CLEARANCE: "" }));
vi.mock("@/components/SiteFooter", () => ({ default: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import BlessingBoxesPage, { generateMetadata, dynamic } from "@/app/(site)/blessing-boxes/page";
import EsBlessingBoxesPage, {
  generateMetadata as esGenerateMetadata,
  dynamic as esDynamic,
} from "@/app/es/blessing-boxes/page";

function makeBox(id: string, name: string): PublicBlessingBox {
  return {
    id,
    name,
    category: "blessing_box",
    lat: 38.27,
    lng: -104.61,
    address: `${id} Test St, Pueblo, CO 81003`,
    source: "test",
    last_verified: "2026-09-15",
    box: {
      hostName: null,
      hostNote: null,
      mostNeeded: null,
      installedOn: null,
      removedOn: null,
      status: "unknown",
      lastFilledAt: null,
      recentCheckins: [],
      latestPhoto: null,
      adopters: [],
    },
  };
}

beforeEach(() => {
  mockGetCloudflareContext.mockReset();
  mockLoadLiveBoxes.mockReset();
  mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: {} } });
});

describe("/blessing-boxes", () => {
  test("renders per request (force-dynamic) in both trees", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(esDynamic).toBe("force-dynamic");
  });

  test("lists the live boxes read from ADMIN_DB", async () => {
    mockLoadLiveBoxes.mockResolvedValue([makeBox("b1", "Beta Box"), makeBox("a1", "Alpha Box")]);
    render(await BlessingBoxesPage());
    expect(mockLoadLiveBoxes).toHaveBeenCalledWith({});
    expect(screen.getByRole("link", { name: "Alpha Box" }).getAttribute("href")).toBe("/?venue=a1");
    expect(screen.getByText(/There are 2 blessing boxes/)).toBeDefined();
  });

  test("ES page links into /es?venue=", async () => {
    mockLoadLiveBoxes.mockResolvedValue([makeBox("a1", "Alpha Box")]);
    render(await EsBlessingBoxesPage());
    expect(screen.getByRole("link", { name: "Alpha Box" }).getAttribute("href")).toBe("/es?venue=a1");
  });

  test("D1 failure: degraded message, no list, no JSON-LD", async () => {
    mockLoadLiveBoxes.mockRejectedValue(new Error("d1 down"));
    const { container } = render(await BlessingBoxesPage());
    expect(screen.getByText(/couldn't load the list of blessing boxes/)).toBeDefined();
    expect(container.querySelector("ul")).toBeNull();
    expect(container.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  test("missing Cloudflare context is also degraded, never a throw", async () => {
    mockGetCloudflareContext.mockImplementation(() => {
      throw new Error("no cloudflare context");
    });
    render(await BlessingBoxesPage());
    expect(screen.getByText(/couldn't load the list of blessing boxes/)).toBeDefined();
  });

  test("metadata: indexable with hreflang alternates when the read works", async () => {
    mockLoadLiveBoxes.mockResolvedValue([makeBox("a1", "Alpha Box")]);
    const meta = await generateMetadata();
    expect(meta.title).toBe("Blessing Boxes in Pueblo, CO");
    expect(meta.robots).toBeUndefined();
    expect(meta.alternates?.languages).toBeDefined();
  });

  test("metadata: noindex, follow when degraded (EN and ES)", async () => {
    mockLoadLiveBoxes.mockRejectedValue(new Error("d1 down"));
    expect((await generateMetadata()).robots).toEqual({ index: false, follow: true });
    expect((await esGenerateMetadata()).robots).toEqual({ index: false, follow: true });
  });

  test("a real empty result stays indexable (not degraded)", async () => {
    mockLoadLiveBoxes.mockResolvedValue([]);
    expect((await generateMetadata()).robots).toBeUndefined();
    render(await BlessingBoxesPage());
    expect(screen.getByText("There are no blessing boxes listed right now.")).toBeDefined();
  });
});
