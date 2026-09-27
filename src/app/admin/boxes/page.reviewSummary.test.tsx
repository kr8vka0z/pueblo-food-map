/**
 * page.reviewSummary.test.tsx (#677) — new file rather than adding to
 * page.test.tsx (an existing test file): covers BoxesToReviewBox's wiring
 * (the X/Y/Z counts reach it from the real photo/adopter rows) and
 * `?show=review` reaching AllBoxesTable as `initialShowReview`. Per-
 * component behavior (the summary line's exact wording, the table's
 * column/chip/sort) is already covered by BoxesToReviewBox.test.tsx and
 * AllBoxesTable.test.tsx.
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/adminDb", () => ({
  getAdminDb: (...args: unknown[]) => mockGetAdminDb(...args),
}));
const mockGetAdminDb = vi.fn();

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: () => null })),
}));

vi.mock("next/navigation", () => ({
  forbidden: vi.fn(() => {
    throw new Error("FORBIDDEN_CALLED");
  }),
}));

vi.mock("@/lib/logger", () => ({
  logAdminAuthFailure: vi.fn(),
}));

import BoxesPage from "@/app/admin/boxes/page";

/**
 * Dispatches on SQL text: box_photos review-queue SELECT and box_adopters
 * pending SELECT (.all, no .bind() first — see boxPhotos.ts/boxAdopters.ts's
 * own loaders), plus the venues SELECT loadBoxHealthEntries needs so
 * AllBoxesTable actually renders a table (not its own "No blessing boxes
 * yet." empty state, which has no filter chips to assert on). Everything
 * else (check-ins, nav counts) resolves to empty/zero.
 */
function makeDb(photoRows: unknown[] = [], adopterRows: unknown[] = [], venueRows: unknown[] = []) {
  return {
    prepare: (sql: string) => {
      const all = async () => {
        if (sql.includes("FROM box_photos")) return { results: photoRows, meta: {} };
        if (sql.includes("FROM box_adopters")) return { results: adopterRows, meta: {} };
        if (sql.includes("LEFT JOIN blessing_boxes")) return { results: venueRows, meta: {} };
        return { results: [], meta: {} };
      };
      return { bind: () => ({ all, first: async () => ({ n: 0 }) }), all, first: async () => ({ n: 0 }) };
    },
  } as unknown as object;
}

function venueRow(overrides: Record<string, unknown> = {}) {
  return { id: "box-1", name: "Box 1", address: "1 Test St", lat: 38.25, lng: -104.6, removed_on: null, ...overrides };
}

function photoRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    venue_id: "box-1",
    venue_name: "Box 1",
    checkin_id: null,
    checkin_kind: null,
    status: "pending",
    flag_count: 0,
    created_at: "2026-09-18T15:00:00.000Z",
    ...overrides,
  };
}

function adopterRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    venue_id: "box-2",
    venue_name: "Box 2",
    display_name: "The Lee Family",
    email: "lee@example.com",
    note: null,
    status: "pending",
    email_confirmed_at: "2026-09-18T15:00:00.000Z",
    created_at: "2026-09-18T14:00:00.000Z",
    ...overrides,
  };
}

describe("BoxesPage — 'To review' summary box wiring (#677)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("photos+adopters counts reach BoxesToReviewBox, including the flagged-photo subcount", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: makeDb([photoRow({ id: 1, status: "flagged", flag_count: 2 }), photoRow({ id: 2, venue_id: "box-3" })], [
        adopterRow(),
      ]),
      identity: { email: "admin@example.com" },
    });

    render(await BoxesPage({ searchParams: Promise.resolve({}) }));

    // 3 distinct venues (box-1's flagged photo, box-3's pending photo,
    // box-2's sponsor request) even though only 2 photo rows exist.
    expect(
      screen.getByText("3 to review: 2 photos (1 reported by a visitor) and 1 sponsor request"),
    ).toBeDefined();
  });

  test("?show=review pre-selects the table's To review chip", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: makeDb([photoRow()], [], [venueRow({ id: "box-1" }), venueRow({ id: "box-2" })]),
      identity: { email: "admin@example.com" },
    });

    render(await BoxesPage({ searchParams: Promise.resolve({ show: "review" }) }));

    expect(screen.getByRole("button", { name: "To review (1)" }).getAttribute("aria-pressed")).toBe("true");
  });

  test("no show param leaves the All chip selected", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: makeDb([photoRow()], [], [venueRow({ id: "box-1" }), venueRow({ id: "box-2" })]),
      identity: { email: "admin@example.com" },
    });

    render(await BoxesPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("button", { name: /^All /}).getAttribute("aria-pressed")).toBe("true");
  });
});
