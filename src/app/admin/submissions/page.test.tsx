/**
 * Auth-guard + query-shape regression test for the /admin/submissions
 * Server Component page (#259) — mirrors src/app/admin/page.test.tsx's own
 * rationale: this page has its own getAdminDb() -> forbidden() fail-closed
 * wiring, plus a per-row JSON.parse that must degrade rather than 500 the
 * whole page, and nothing else pins either.
 *
 * @/components/SubmissionsReviewView is mocked to a stub that serializes
 * its received `submissions` prop into the DOM so this file can assert on
 * the exact parsed/mapped shape without re-testing that component's own
 * rendering or actions (covered by SubmissionsReviewView.test.tsx).
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccessDeniedError } from "@/lib/cfAccess";
import type { PublicSubmissionRow } from "@/lib/publicSubmissions";
import type { ReviewSubmission } from "@/components/SubmissionsReviewView";

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

vi.mock("@/components/SubmissionsReviewView", () => ({
  default: (props: { submissions: ReviewSubmission[] }) => (
    <pre data-testid="submissions-stub">{JSON.stringify(props.submissions)}</pre>
  ),
}));

import SubmissionsPage from "@/app/admin/submissions/page";
import { forbidden } from "next/navigation";
import { logAdminAuthFailure } from "@/lib/logger";

function makeRow(overrides: Partial<PublicSubmissionRow> = {}): PublicSubmissionRow {
  return {
    id: 1,
    kind: "new_venue",
    payload: JSON.stringify({
      venueName: "Eastside Pantry",
      address: "123 Test St, Pueblo, CO",
      category: "pantry",
      acceptsSnap: true,
      acceptsWic: false,
      submitterEmail: "suggester@example.com",
    }),
    target_venue_id: null,
    submitter_email: "suggester@example.com",
    status: "pending",
    created_at: "2026-07-01T00:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    review_reason: null,
    ...overrides,
  };
}

/** Matches the page's real call chain: db.prepare(sql).all<PublicSubmissionRow>(); captures the SQL for AC1's ordering assertion. */
function makeFakeDb(rows: PublicSubmissionRow[]) {
  let capturedSql = "";
  const db = {
    prepare: (sql: string) => {
      capturedSql = sql;
      return { all: async () => ({ success: true, results: rows, meta: {} }) };
    },
  } as unknown as object;
  return { db, getSql: () => capturedSql };
}

function readStubbedSubmissions(): ReviewSubmission[] {
  const stub = screen.getByTestId("submissions-stub");
  return JSON.parse(stub.textContent ?? "[]") as ReviewSubmission[];
}

describe("SubmissionsPage — auth guard", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("success: renders the signed-in email and delegates to SubmissionsReviewView, forbidden() not called", async () => {
    const { db } = makeFakeDb([makeRow()]);
    mockGetAdminDb.mockResolvedValue({ db, identity: { email: "admin@example.com" } });

    render(await SubmissionsPage());

    expect(screen.getByText("admin@example.com")).toBeDefined();
    expect(screen.getByText(/Review queue/i)).toBeDefined();
    expect(forbidden).not.toHaveBeenCalled();
  });

  test("queries public_submissions WHERE status = 'pending' ORDER BY created_at DESC (AC1: newest-first, pending only)", async () => {
    const { db, getSql } = makeFakeDb([makeRow()]);
    mockGetAdminDb.mockResolvedValue({ db, identity: { email: "admin@example.com" } });

    render(await SubmissionsPage());

    const sql = getSql();
    expect(sql).toContain("FROM public_submissions");
    expect(sql).toContain("status = 'pending'");
    expect(sql).toContain("ORDER BY created_at DESC");
  });

  test("access denied -> fails closed: forbidden() fires and the denial is logged", async () => {
    mockGetAdminDb.mockRejectedValue(new AccessDeniedError("invalid_token"));

    await expect(SubmissionsPage()).rejects.toThrow("FORBIDDEN_CALLED");

    expect(logAdminAuthFailure).toHaveBeenCalledWith("invalid_token");
    expect(forbidden).toHaveBeenCalledTimes(1);
  });

  test("unexpected error -> re-thrown, not swallowed; forbidden() and the logger are untouched", async () => {
    mockGetAdminDb.mockRejectedValue(new Error("boom"));

    await expect(SubmissionsPage()).rejects.toThrow("boom");

    expect(forbidden).not.toHaveBeenCalled();
    expect(logAdminAuthFailure).not.toHaveBeenCalled();
  });
});

describe("SubmissionsPage — row parsing (#259)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("a new_venue row maps to a parsed, typed ReviewSubmission", async () => {
    const { db } = makeFakeDb([makeRow({ id: 3 })]);
    mockGetAdminDb.mockResolvedValue({ db, identity: { email: "admin@example.com" } });

    render(await SubmissionsPage());

    const submissions = readStubbedSubmissions();
    expect(submissions).toHaveLength(1);
    expect(submissions[0]?.id).toBe(3);
    expect(submissions[0]?.kind).toBe("new_venue");
    expect(submissions[0]?.parseError).toBe(false);
    expect((submissions[0]?.payload as { venueName?: string } | null)?.venueName).toBe("Eastside Pantry");
  });

  test("a closure row maps to a parsed ReviewSubmission carrying target_venue_id", async () => {
    const closureRow = makeRow({
      id: 4,
      kind: "closure",
      target_venue_id: "manual-existing-1",
      payload: JSON.stringify({
        venueId: "manual-existing-1",
        venueName: "Main Street Grocery",
        venueAddress: "456 Main Ave, Pueblo, CO",
        issueType: "closed",
        description: "Shut down last month.",
      }),
    });
    const { db } = makeFakeDb([closureRow]);
    mockGetAdminDb.mockResolvedValue({ db, identity: { email: "admin@example.com" } });

    render(await SubmissionsPage());

    const submissions = readStubbedSubmissions();
    expect(submissions[0]?.kind).toBe("closure");
    expect(submissions[0]?.targetVenueId).toBe("manual-existing-1");
    expect(submissions[0]?.parseError).toBe(false);
  });

  test("a row with malformed payload JSON degrades to parseError:true instead of 500ing the page", async () => {
    const { db } = makeFakeDb([makeRow({ id: 5, payload: "{not valid json" }), makeRow({ id: 6 })]);
    mockGetAdminDb.mockResolvedValue({ db, identity: { email: "admin@example.com" } });

    render(await SubmissionsPage());

    const submissions = readStubbedSubmissions();
    expect(submissions).toHaveLength(2);
    const broken = submissions.find((s) => s.id === 5);
    const healthy = submissions.find((s) => s.id === 6);
    expect(broken?.parseError).toBe(true);
    expect(broken?.payload).toBeNull();
    expect(healthy?.parseError).toBe(false);
  });

  test("zero pending rows -> an empty array reaches SubmissionsReviewView (its own empty state, not tested here)", async () => {
    const { db } = makeFakeDb([]);
    mockGetAdminDb.mockResolvedValue({ db, identity: { email: "admin@example.com" } });

    render(await SubmissionsPage());

    expect(readStubbedSubmissions()).toEqual([]);
  });
});
