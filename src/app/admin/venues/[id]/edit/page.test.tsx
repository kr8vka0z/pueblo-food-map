/**
 * Auth-guard + not-found regression test for the /admin/venues/[id]/edit
 * Server Component page (#255) — mirrors
 * src/app/admin/venues/new/page.test.tsx's own rationale: this page has its
 * own getAdminDb() -> forbidden()/notFound() fail-closed wiring that nothing
 * else pins, so a future edit routing around it wouldn't fail red without
 * this test.
 *
 * @/components/AddVenueForm and @/components/ArchiveVenueButton are mocked
 * to lightweight stubs — their own behavior is covered by their own test
 * files; this file only proves the page's auth gate, not-found handling,
 * and prop wiring (venueId + mapped initialValues reach AddVenueForm;
 * id/name/status reach ArchiveVenueButton).
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccessDeniedError } from "@/lib/cfAccess";
import type { AdminVenueRow } from "@/types/venue";

const mockGetAdminDb = vi.fn();
vi.mock("@/lib/adminDb", () => ({
  getAdminDb: (...args: unknown[]) => mockGetAdminDb(...args),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: () => null })),
}));

vi.mock("next/navigation", () => ({
  forbidden: vi.fn(() => {
    throw new Error("FORBIDDEN_CALLED");
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND_CALLED");
  }),
}));

vi.mock("@/lib/logger", () => ({
  logAdminAuthFailure: vi.fn(),
}));

vi.mock("@/components/AddVenueForm", () => ({
  default: (props: { venueId?: string; initialValues?: { name?: string } }) => (
    <div data-testid="add-venue-form-stub" data-venue-id={props.venueId} data-name={props.initialValues?.name} />
  ),
}));

vi.mock("@/components/ArchiveVenueButton", () => ({
  default: (props: { venueId: string; venueName: string; alreadyArchived: boolean }) => (
    <div
      data-testid="archive-button-stub"
      data-venue-id={props.venueId}
      data-name={props.venueName}
      data-already-archived={String(props.alreadyArchived)}
    />
  ),
}));

import EditVenuePage from "@/app/admin/venues/[id]/edit/page";
import { forbidden, notFound } from "next/navigation";
import { logAdminAuthFailure } from "@/lib/logger";

function makeRow(overrides: Partial<AdminVenueRow> = {}): AdminVenueRow {
  return {
    id: "manual-abc",
    name: "Eastside Pantry",
    category: "pantry",
    lat: 38.25,
    lng: -104.6,
    address: "123 Test St, Pueblo, CO",
    hours_weekly: null,
    accepts_snap: null,
    accepts_wic: null,
    phone: null,
    email: null,
    url: null,
    notes: null,
    operator: null,
    source: "Manual entry",
    last_verified: "2026-07-03",
    status: "draft",
    source_type: "manual",
    outside_county: 0,
    created_at: "2026-07-01T00:00:00.000Z",
    created_by: "admin@pueblofoodmap.com",
    updated_at: "2026-07-01T00:00:00.000Z",
    updated_by: "admin@pueblofoodmap.com",
    published_at: null,
    published_by: null,
    ...overrides,
  };
}

function mockDbReturning(row: AdminVenueRow | null) {
  mockGetAdminDb.mockResolvedValue({
    db: { prepare: () => ({ bind: () => ({ first: async () => row }) }) },
    identity: { email: "admin@example.com" },
  });
}

describe("EditVenuePage — auth guard, not-found, and prop wiring", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("success: renders the signed-in email, the form (with venueId + mapped values), and the archive button", async () => {
    mockDbReturning(makeRow());

    render(await EditVenuePage({ params: Promise.resolve({ id: "manual-abc" }) }));

    expect(screen.getByText("admin@example.com")).toBeDefined();
    const formStub = screen.getByTestId("add-venue-form-stub");
    expect(formStub.getAttribute("data-venue-id")).toBe("manual-abc");
    expect(formStub.getAttribute("data-name")).toBe("Eastside Pantry");

    const archiveStub = screen.getByTestId("archive-button-stub");
    expect(archiveStub.getAttribute("data-venue-id")).toBe("manual-abc");
    expect(archiveStub.getAttribute("data-name")).toBe("Eastside Pantry");
    expect(archiveStub.getAttribute("data-already-archived")).toBe("false");

    expect(forbidden).not.toHaveBeenCalled();
    expect(notFound).not.toHaveBeenCalled();
  });

  test("an already-archived venue passes alreadyArchived=true to ArchiveVenueButton", async () => {
    mockDbReturning(makeRow({ status: "archived" }));

    render(await EditVenuePage({ params: Promise.resolve({ id: "manual-abc" }) }));

    expect(screen.getByTestId("archive-button-stub").getAttribute("data-already-archived")).toBe("true");
  });

  test("no venue with that id -> notFound() fires", async () => {
    mockDbReturning(null);

    await expect(EditVenuePage({ params: Promise.resolve({ id: "manual-missing" }) })).rejects.toThrow(
      "NOT_FOUND_CALLED",
    );
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  test("access denied -> fails closed: forbidden() fires and the denial is logged", async () => {
    mockGetAdminDb.mockRejectedValue(new AccessDeniedError("invalid_token"));

    await expect(EditVenuePage({ params: Promise.resolve({ id: "manual-abc" }) })).rejects.toThrow(
      "FORBIDDEN_CALLED",
    );

    expect(logAdminAuthFailure).toHaveBeenCalledWith("invalid_token");
    expect(forbidden).toHaveBeenCalledTimes(1);
    expect(notFound).not.toHaveBeenCalled();
  });

  test("unexpected error -> re-thrown, not swallowed; forbidden()/notFound() and the logger are untouched", async () => {
    mockGetAdminDb.mockRejectedValue(new Error("boom"));

    await expect(EditVenuePage({ params: Promise.resolve({ id: "manual-abc" }) })).rejects.toThrow("boom");

    expect(forbidden).not.toHaveBeenCalled();
    expect(notFound).not.toHaveBeenCalled();
    expect(logAdminAuthFailure).not.toHaveBeenCalled();
  });
});
