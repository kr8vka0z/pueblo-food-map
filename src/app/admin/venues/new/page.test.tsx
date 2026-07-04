/**
 * Auth-guard regression test for the /admin/venues/new Server Component
 * page (#254; `?submission=<id>` pre-fill added #259) — mirrors
 * src/app/admin/page.test.tsx's own rationale: this page has its own
 * getAdminDb() -> forbidden() fail-closed wiring that nothing else pins, so
 * a future edit routing around it wouldn't fail red without this test.
 *
 * @/components/AddVenueForm is mocked to a lightweight stub that echoes its
 * received props as data-attributes — its own fields/validation/submit
 * behavior is covered by AddVenueForm.test.tsx; this file only proves the
 * page's auth gate, chrome, and (#259) which props reach the form under
 * which `?submission=` conditions, not the form itself (avoids re-testing
 * the same behavior twice, and avoids needing a next/navigation useRouter
 * mock here too).
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccessDeniedError } from "@/lib/cfAccess";
import type { PublicSubmissionRow, NewVenuePayload } from "@/lib/publicSubmissions";

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
  default: (props: { initialValues?: { name?: string }; submissionId?: number }) => (
    <div
      data-testid="add-venue-form-stub"
      data-name={props.initialValues?.name}
      data-submission-id={props.submissionId}
    />
  ),
}));

import NewVenuePage from "@/app/admin/venues/new/page";
import { forbidden } from "next/navigation";
import { logAdminAuthFailure } from "@/lib/logger";

function makeSubmissionRow(overrides: Partial<PublicSubmissionRow> = {}): PublicSubmissionRow {
  const payload: NewVenuePayload = {
    venueName: "Eastside Pantry",
    address: "123 Test St, Pueblo, CO",
    category: "pantry",
    acceptsSnap: true,
    acceptsWic: false,
    submitterEmail: "suggester@example.com",
  };
  return {
    id: 5,
    kind: "new_venue",
    payload: JSON.stringify(payload),
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

/** Matches the page's real (#259) call chain: db.prepare(sql).bind(id).first<PublicSubmissionRow>(). */
function makeFakeDb(row: PublicSubmissionRow | null | (() => never)) {
  return {
    prepare: () => ({
      bind: () => ({
        first: async () => {
          if (typeof row === "function") return row();
          return row;
        },
      }),
    }),
  } as unknown as object;
}

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

  test("no ?submission= param -> AddVenueForm gets no initialValues/submissionId (unchanged plain-form path)", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: {} as unknown,
      identity: { email: "admin@example.com" },
    });

    render(await NewVenuePage());

    const stub = screen.getByTestId("add-venue-form-stub");
    expect(stub.getAttribute("data-submission-id")).toBeNull();
    expect(stub.getAttribute("data-name")).toBeNull();
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

describe("NewVenuePage — ?submission=<id> pre-fill (#259)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("a pending new_venue submission -> AddVenueForm receives mapped initialValues + submissionId", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: makeFakeDb(makeSubmissionRow()),
      identity: { email: "admin@example.com" },
    });

    render(await NewVenuePage({ searchParams: Promise.resolve({ submission: "5" }) }));

    const stub = screen.getByTestId("add-venue-form-stub");
    expect(stub.getAttribute("data-name")).toBe("Eastside Pantry");
    expect(stub.getAttribute("data-submission-id")).toBe("5");
    expect(forbidden).not.toHaveBeenCalled();
  });

  test("no matching row (bad id) -> falls back to the plain form, no crash", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: makeFakeDb(null),
      identity: { email: "admin@example.com" },
    });

    render(await NewVenuePage({ searchParams: Promise.resolve({ submission: "999" }) }));

    const stub = screen.getByTestId("add-venue-form-stub");
    expect(stub.getAttribute("data-submission-id")).toBeNull();
  });

  test("a non-integer ?submission= value -> falls back to the plain form (never queries D1)", async () => {
    const throwIfCalled = () => {
      throw new Error("db.prepare should never be called for a non-integer submission param");
    };
    mockGetAdminDb.mockResolvedValue({
      db: makeFakeDb(throwIfCalled),
      identity: { email: "admin@example.com" },
    });

    render(await NewVenuePage({ searchParams: Promise.resolve({ submission: "not-a-number" }) }));

    const stub = screen.getByTestId("add-venue-form-stub");
    expect(stub.getAttribute("data-submission-id")).toBeNull();
  });

  test("a submission row with malformed JSON payload degrades to the plain form instead of crashing the page", async () => {
    mockGetAdminDb.mockResolvedValue({
      db: makeFakeDb(makeSubmissionRow({ payload: "{not valid json" })),
      identity: { email: "admin@example.com" },
    });

    render(await NewVenuePage({ searchParams: Promise.resolve({ submission: "5" }) }));

    const stub = screen.getByTestId("add-venue-form-stub");
    expect(stub.getAttribute("data-submission-id")).toBeNull();
  });
});
