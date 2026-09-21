// @vitest-environment node
/**
 * generateMetadata + notFound tests for /box/[id] (Blessing Boxes slice 1).
 * Same mocking pattern as the public blessing-boxes route test: mocks
 * @opennextjs/cloudflare's getCloudflareContext and src/lib/blessingBoxes'
 * loadLiveBoxById, so this proves the page's own best-effort loadBox() +
 * generateMetadata() logic without a live D1 binding.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const mockLoadLiveBoxById = vi.fn();
vi.mock("@/lib/blessingBoxes", async () => {
  const actual = await vi.importActual<typeof import("@/lib/blessingBoxes")>("@/lib/blessingBoxes");
  return { ...actual, loadLiveBoxById: (...args: unknown[]) => mockLoadLiveBoxById(...args) };
});

import { generateMetadata } from "@/app/box/[id]/page";

function makeBox(overrides: Partial<PublicBlessingBox> = {}): PublicBlessingBox {
  return {
    id: "plentiful-blessing-box-216-w-routt-plentiful-1454",
    name: "216 W Routt Blessing Box",
    category: "blessing_box",
    lat: 38.25902,
    lng: -104.625612,
    address: "216 W Routt Ave, Pueblo, CO 81004",
    source: "directory.plentiful.org/colorado/pueblo",
    last_verified: "2026-09-15",
    box: {
      hostName: "Jane Doe",
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
    ...overrides,
  };
}

describe("box/[id] generateMetadata", () => {
  beforeEach(() => {
    mockGetCloudflareContext.mockReset();
    mockLoadLiveBoxById.mockReset();
    mockGetCloudflareContext.mockReturnValue({ env: { ADMIN_DB: {} } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("known box -> metadata includes the box's own name and address", async () => {
    const box = makeBox();
    mockLoadLiveBoxById.mockResolvedValue(box);

    const metadata = await generateMetadata({ params: Promise.resolve({ id: box.id }) });
    expect(metadata.title).toBe(box.name);
    expect(String(metadata.description)).toContain(box.name);
    expect(String(metadata.description)).toContain(box.address);
  });

  test("unknown id -> empty metadata (same 404 convention as /venue/[id])", async () => {
    mockLoadLiveBoxById.mockResolvedValue(null);
    const metadata = await generateMetadata({ params: Promise.resolve({ id: "not-a-real-box" }) });
    expect(metadata).toEqual({});
  });

  test("D1 read failure -> empty metadata, never throws", async () => {
    mockGetCloudflareContext.mockImplementation(() => {
      throw new Error("no cloudflare context");
    });
    const metadata = await generateMetadata({ params: Promise.resolve({ id: "any-id" }) });
    expect(metadata).toEqual({});
  });
});
