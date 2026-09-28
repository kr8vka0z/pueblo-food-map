/**
 * /admin/activity (#679) — the owner gate and the page's wiring. The data
 * and grouping are covered against real SQLite in
 * src/lib/activityLog.sql.test.ts; this file pins:
 * - no session / not allowlisted → the usual fail-closed auth handling;
 * - an allowlisted admin who isn't the owner → 404, with NO activity read;
 * - the owner → the page renders, with the Activity nav item.
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccessDeniedError } from "@/lib/adminOrigin";

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
  redirect: vi.fn(() => {
    throw new Error("REDIRECT_CALLED");
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND_CALLED");
  }),
}));

vi.mock("@/lib/logger", () => ({
  logAdminAuthFailure: vi.fn(),
}));

const mockLoadActivityPage = vi.fn();
const mockLoadActivityPeople = vi.fn();
vi.mock("@/lib/activityLog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/activityLog")>();
  return {
    ...actual,
    loadActivityPage: (...args: unknown[]) => mockLoadActivityPage(...args),
    loadActivityPeople: (...args: unknown[]) => mockLoadActivityPeople(...args),
  };
});

vi.mock("@/lib/adminNavCounts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/adminNavCounts")>();
  return { ...actual, loadAdminNavCounts: vi.fn(async () => actual.ZERO_ADMIN_NAV_COUNTS) };
});

import ActivityPage from "@/app/(site)/admin/activity/page";
import { notFound, redirect } from "next/navigation";

const signInRow = {
  id: 1,
  event: "sign_in" as const,
  email: "kysboyd@gmail.com",
  user_id: "u",
  session_id: "s1",
  method: "passkey",
  ip: "203.0.113.9",
  user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Safari/605.1.15",
  city: "Pueblo",
  region: "Colorado",
  country: "US",
  detail_json: null,
  created_at: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockLoadActivityPage.mockResolvedValue({ actions: [], events: [signInRow], sessionHeaders: [], nextUntil: null });
  mockLoadActivityPeople.mockResolvedValue(["kysboyd@gmail.com"]);
});

describe("/admin/activity owner gate", () => {
  test("no session → redirected to /admin/login", async () => {
    mockGetAdminDb.mockRejectedValue(new AccessDeniedError("no_session"));
    await expect(ActivityPage()).rejects.toThrow("REDIRECT_CALLED");
    expect(redirect).toHaveBeenCalledWith("/admin/login");
    expect(mockLoadActivityPage).not.toHaveBeenCalled();
  });

  test("an allowlisted admin who isn't the owner gets a 404 and nothing is read", async () => {
    mockGetAdminDb.mockResolvedValue({ db: {}, identity: { email: "helper@example.com", isOwner: false } });

    await expect(ActivityPage()).rejects.toThrow("NOT_FOUND_CALLED");

    expect(notFound).toHaveBeenCalled();
    expect(mockLoadActivityPage).not.toHaveBeenCalled();
    expect(mockLoadActivityPeople).not.toHaveBeenCalled();
  });

  test("a missing isOwner flag fails closed (404)", async () => {
    mockGetAdminDb.mockResolvedValue({ db: {}, identity: { email: "kysboyd@gmail.com" } });
    await expect(ActivityPage()).rejects.toThrow("NOT_FOUND_CALLED");
  });

  test("the owner sees the page, the sign-in and the Activity nav item", async () => {
    mockGetAdminDb.mockResolvedValue({ db: {}, identity: { email: "kysboyd@gmail.com", sessionId: "s1", isOwner: true } });

    render(await ActivityPage({ searchParams: Promise.resolve({ type: "sign_ins" }) }));

    expect(screen.getByRole("link", { name: "Activity" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByText(/kysboyd@gmail\.com signed in with passkey/)).toBeDefined();
    expect(screen.getByText(/Safari on Mac · Pueblo, Colorado, US/)).toBeDefined();
    // Partial IP shown; the full one only on hover.
    expect(screen.getByTitle("203.0.113.9").textContent).toBe("203.0.113.x");
    expect(mockLoadActivityPage.mock.calls[0][1]).toMatchObject({ type: "sign_ins" });
  });
});
