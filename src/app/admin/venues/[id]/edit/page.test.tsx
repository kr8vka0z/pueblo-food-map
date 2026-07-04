/**
 * Auth-guard + not-found regression test for the /admin/venues/[id]/edit
 * Server Component page (#255; `?submission=<id>` closure-report context
 * added #270) — mirrors src/app/admin/venues/new/page.test.tsx's own
 * rationale: this page has its own getAdminDb() -> forbidden()/notFound()
 * fail-closed wiring that nothing else pins, so a future edit routing
 * around it wouldn't fail red without this test.
 *
 * @/components/AddVenueForm and @/components/ArchiveVenueButton are mocked
 * to lightweight stubs — their own behavior is covered by their own test
 * files; this file only proves the page's auth gate, not-found handling,
 * and prop wiring (venueId + mapped initialValues reach AddVenueForm;
 * id/name/status/(#270) submissionId reach ArchiveVenueButton).
 *
 * Every call below now supplies `searchParams` — the page's signature
 * requires it (mirrors the real Next.js contract; unlike
 * new/page.tsx, this page has no pre-existing no-arg test call to keep
 * working, so there was no reason to make it optional here).
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccessDeniedError } from "@/lib/cfAccess";
import type { AdminVenueRow } from "@/types/venue";
import type { ClosurePayload, PublicSubmissionRow } from "@/lib/publicSubmissions";

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
  default: (props: { venueId: string; venueName: string; alreadyArchived: boolean; submissionId?: number }) => (
    <div
      data-testid="archive-button-stub"
      data-venue-id={props.venueId}
      data-name={props.venueName}
      data-already-archived={String(props.alreadyArchived)}
      data-submission-id={props.submissionId}
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

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "manual-abc" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByText("admin@example.com")).toBeDefined();
    const formStub = screen.getByTestId("add-venue-form-stub");
    expect(formStub.getAttribute("data-venue-id")).toBe("manual-abc");
    expect(formStub.getAttribute("data-name")).toBe("Eastside Pantry");

    const archiveStub = screen.getByTestId("archive-button-stub");
    expect(archiveStub.getAttribute("data-venue-id")).toBe("manual-abc");
    expect(archiveStub.getAttribute("data-name")).toBe("Eastside Pantry");
    expect(archiveStub.getAttribute("data-already-archived")).toBe("false");
    expect(archiveStub.getAttribute("data-submission-id")).toBeNull();

    expect(forbidden).not.toHaveBeenCalled();
    expect(notFound).not.toHaveBeenCalled();
  });

  test("an already-archived venue passes alreadyArchived=true to ArchiveVenueButton", async () => {
    mockDbReturning(makeRow({ status: "archived" }));

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "manual-abc" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByTestId("archive-button-stub").getAttribute("data-already-archived")).toBe("true");
  });

  test("no venue with that id -> notFound() fires", async () => {
    mockDbReturning(null);

    await expect(
      EditVenuePage({
        params: Promise.resolve({ id: "manual-missing" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NOT_FOUND_CALLED");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  test("access denied -> fails closed: forbidden() fires and the denial is logged", async () => {
    mockGetAdminDb.mockRejectedValue(new AccessDeniedError("invalid_token"));

    await expect(
      EditVenuePage({
        params: Promise.resolve({ id: "manual-abc" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("FORBIDDEN_CALLED");

    expect(logAdminAuthFailure).toHaveBeenCalledWith("invalid_token");
    expect(forbidden).toHaveBeenCalledTimes(1);
    expect(notFound).not.toHaveBeenCalled();
  });

  test("unexpected error -> re-thrown, not swallowed; forbidden()/notFound() and the logger are untouched", async () => {
    mockGetAdminDb.mockRejectedValue(new Error("boom"));

    await expect(
      EditVenuePage({
        params: Promise.resolve({ id: "manual-abc" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("boom");

    expect(forbidden).not.toHaveBeenCalled();
    expect(notFound).not.toHaveBeenCalled();
    expect(logAdminAuthFailure).not.toHaveBeenCalled();
  });
});

describe("EditVenuePage — closure report context via ?submission=<id> (#270)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  function makeClosureSubmissionRow(overrides: Partial<PublicSubmissionRow> = {}): PublicSubmissionRow {
    const payload: ClosurePayload = {
      venueId: "manual-abc",
      venueName: "Eastside Pantry",
      venueAddress: "123 Test St, Pueblo, CO",
      issueType: "closed",
      description: "This store shut down last month.",
      contactEmail: "reporter@example.com",
    };
    return {
      id: 9,
      kind: "closure",
      payload: JSON.stringify(payload),
      target_venue_id: "manual-abc",
      submitter_email: "reporter@example.com",
      status: "pending",
      created_at: "2026-07-02T00:00:00.000Z",
      reviewed_by: null,
      reviewed_at: null,
      review_reason: null,
      ...overrides,
    };
  }

  /** Matches the page's real (#270) call chain: a venues SELECT, then (only
   *  when a venue was found and ?submission= is present) a public_submissions
   *  SELECT — dispatched on the SQL text since both go through the same
   *  db.prepare().bind().first() shape. */
  function makeDualQueryDb(
    venueRow: AdminVenueRow | null,
    submissionRow: PublicSubmissionRow | null | (() => never),
  ) {
    return {
      prepare: (sql: string) => ({
        bind: () => ({
          first: async () => {
            if (sql.includes("FROM venues")) return venueRow;
            if (typeof submissionRow === "function") return submissionRow();
            return submissionRow;
          },
        }),
      }),
    } as unknown as object;
  }

  test("a matching pending closure submission -> ArchiveVenueButton receives submissionId and the context banner renders", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: makeDualQueryDb(makeRow(), makeClosureSubmissionRow()),
      identity: { email: "admin@example.com" },
    });

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "manual-abc" }),
        searchParams: Promise.resolve({ submission: "9" }),
      }),
    );

    expect(screen.getByTestId("archive-button-stub").getAttribute("data-submission-id")).toBe("9");
    expect(screen.getByText(/Reviewing a closure report/i)).toBeDefined();
    expect(screen.getByText(/This store shut down last month\./)).toBeDefined();
  });

  test("no ?submission= param -> renders as before (no banner, no submissionId, no second query)", async () => {
    const throwIfCalled = () => {
      throw new Error("db.prepare for public_submissions should never run with no ?submission= param");
    };
    mockGetAdminDb.mockResolvedValue({
      db: makeDualQueryDb(makeRow(), throwIfCalled),
      identity: { email: "admin@example.com" },
    });

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "manual-abc" }),
        searchParams: Promise.resolve({}),
      }),
    );

    const archiveStub = screen.getByTestId("archive-button-stub");
    expect(archiveStub.getAttribute("data-submission-id")).toBeNull();
    expect(screen.queryByText(/Reviewing a closure report/i)).toBeNull();
  });

  test("a submission targeting a DIFFERENT venue -> renders as before (no banner, no submissionId)", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: makeDualQueryDb(makeRow(), makeClosureSubmissionRow({ target_venue_id: "manual-other" })),
      identity: { email: "admin@example.com" },
    });

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "manual-abc" }),
        searchParams: Promise.resolve({ submission: "9" }),
      }),
    );

    const archiveStub = screen.getByTestId("archive-button-stub");
    expect(archiveStub.getAttribute("data-submission-id")).toBeNull();
    expect(screen.queryByText(/Reviewing a closure report/i)).toBeNull();
  });

  test("no matching row (bad id) -> renders as before, no crash", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: makeDualQueryDb(makeRow(), null),
      identity: { email: "admin@example.com" },
    });

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "manual-abc" }),
        searchParams: Promise.resolve({ submission: "999" }),
      }),
    );

    expect(screen.getByTestId("archive-button-stub").getAttribute("data-submission-id")).toBeNull();
  });

  test("a non-integer ?submission= value -> falls back to no banner (never queries public_submissions)", async () => {
    const throwIfCalled = () => {
      throw new Error("db.prepare for public_submissions should never run for a non-integer submission param");
    };
    mockGetAdminDb.mockResolvedValue({
      db: makeDualQueryDb(makeRow(), throwIfCalled),
      identity: { email: "admin@example.com" },
    });

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "manual-abc" }),
        searchParams: Promise.resolve({ submission: "not-a-number" }),
      }),
    );

    expect(screen.getByTestId("archive-button-stub").getAttribute("data-submission-id")).toBeNull();
  });

  test("a matching pending closure with malformed payload JSON -> submissionId still passed, banner falls back to generic copy", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: makeDualQueryDb(makeRow(), makeClosureSubmissionRow({ payload: "{not valid json" })),
      identity: { email: "admin@example.com" },
    });

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "manual-abc" }),
        searchParams: Promise.resolve({ submission: "9" }),
      }),
    );

    expect(screen.getByTestId("archive-button-stub").getAttribute("data-submission-id")).toBe("9");
    expect(screen.getByText(/Reviewing a closure report/i)).toBeDefined();
    expect(screen.getByText(/a closure report was submitted/i)).toBeDefined();
  });
});
