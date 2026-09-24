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
import { AccessDeniedError } from "@/lib/adminOrigin";
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

vi.mock("@/components/BoxCheckinsAdminPanel", () => ({
  default: (props: { checkins: Array<{ id: number }> }) => (
    <div data-testid="box-checkins-panel-stub" data-count={props.checkins.length} />
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
    // "not_allowlisted" stands in for any AccessDeniedError reason OTHER
    // than "no_session" here — this test proves the generic forbidden()/403
    // branch, not this specific reason (see adminAuthErrors.ts).
    mockGetAdminDb.mockRejectedValue(new AccessDeniedError("not_allowlisted"));

    await expect(
      EditVenuePage({
        params: Promise.resolve({ id: "manual-abc" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("FORBIDDEN_CALLED");

    expect(logAdminAuthFailure).toHaveBeenCalledWith("not_allowlisted");
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

describe("EditVenuePage — blessing box check-ins panel (slice 2)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  /** Matches the page's real call chain for a blessing_box venue: a venues
   *  SELECT, then (only when the venue is a blessing_box) a box_checkins
   *  SELECT via .all() — dispatched on SQL text, same convention as
   *  makeDualQueryDb above. */
  function makeBoxCheckinsDb(
    venueRow: AdminVenueRow | null,
    checkinRows: Array<{ id: number }> | (() => never),
  ) {
    return {
      prepare: (sql: string) => ({
        bind: () => ({
          first: async () => {
            if (sql.includes("FROM venues")) return venueRow;
            return venueRow;
          },
          all: async () => {
            if (typeof checkinRows === "function") return checkinRows();
            return { results: checkinRows };
          },
        }),
      }),
    } as unknown as object;
  }

  test("a blessing_box venue renders the check-ins panel with the loaded rows", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: makeBoxCheckinsDb(makeRow({ category: "blessing_box" }), [{ id: 1 }, { id: 2 }, { id: 3 }]),
      identity: { email: "admin@example.com" },
    });

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "manual-abc" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByText("Check-ins")).toBeDefined();
    expect(screen.getByTestId("box-checkins-panel-stub").getAttribute("data-count")).toBe("3");
  });

  test("an ordinary (non-box) venue renders no check-ins panel, and box_checkins is never queried", async () => {
    const throwIfCalled = () => {
      throw new Error("box_checkins should never be queried for a non-blessing_box venue");
    };
    mockGetAdminDb.mockResolvedValue({
      db: makeBoxCheckinsDb(makeRow({ category: "pantry" }), throwIfCalled),
      identity: { email: "admin@example.com" },
    });

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "manual-abc" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.queryByText("Check-ins")).toBeNull();
    expect(screen.queryByTestId("box-checkins-panel-stub")).toBeNull();
  });

  test("a D1 failure reading box_checkins degrades to an empty panel, never crashes the page", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: makeBoxCheckinsDb(makeRow({ category: "blessing_box" }), () => {
        throw new Error("D1 unavailable");
      }),
      identity: { email: "admin@example.com" },
    });

    render(
      await EditVenuePage({
        params: Promise.resolve({ id: "manual-abc" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByTestId("box-checkins-panel-stub").getAttribute("data-count")).toBe("0");
  });
});
