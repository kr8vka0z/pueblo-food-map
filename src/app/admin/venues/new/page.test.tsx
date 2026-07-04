/**
 * Auth-guard regression test for the /admin/venues/new Server Component
 * page (#254) — mirrors src/app/admin/page.test.tsx's own rationale: this
 * page has its own getAdminDb() -> forbidden() fail-closed wiring that
 * nothing else pins, so a future edit routing around it wouldn't fail red
 * without this test.
 *
 * @/components/AddVenueForm is mocked to a lightweight stub — its own
 * fields/validation/submit behavior is covered by AddVenueForm.test.tsx;
 * this file only proves the page's auth gate and chrome, not the form
 * itself (avoids re-testing the same behavior twice, and avoids needing a
 * next/navigation useRouter mock here too).
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccessDeniedError } from "@/lib/cfAccess";

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
}));

vi.mock("@/lib/logger", () => ({
  logAdminAuthFailure: vi.fn(),
}));

vi.mock("@/components/AddVenueForm", () => ({
  default: () => <div data-testid="add-venue-form-stub" />,
}));

import NewVenuePage from "@/app/admin/venues/new/page";
import { forbidden } from "next/navigation";
import { logAdminAuthFailure } from "@/lib/logger";

describe("NewVenuePage — auth guard", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("success: renders the signed-in email and the form, forbidden() not called", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: {} as unknown,
      identity: { email: "admin@example.com" },
    });

    render(await NewVenuePage());

    expect(screen.getByText("admin@example.com")).toBeDefined();
    expect(screen.getByTestId("add-venue-form-stub")).toBeDefined();
    expect(screen.getByText(/Add a venue/i)).toBeDefined();
    expect(forbidden).not.toHaveBeenCalled();
  });

  test("access denied -> fails closed: forbidden() fires and the denial is logged", async () => {
    mockGetAdminDb.mockRejectedValue(new AccessDeniedError("invalid_token"));

    await expect(NewVenuePage()).rejects.toThrow("FORBIDDEN_CALLED");

    expect(logAdminAuthFailure).toHaveBeenCalledWith("invalid_token");
    expect(forbidden).toHaveBeenCalledTimes(1);
  });

  test("unexpected error -> re-thrown, not swallowed; forbidden() and the logger are untouched", async () => {
    mockGetAdminDb.mockRejectedValue(new Error("boom"));

    await expect(NewVenuePage()).rejects.toThrow("boom");

    expect(forbidden).not.toHaveBeenCalled();
    expect(logAdminAuthFailure).not.toHaveBeenCalled();
  });
});
