/**
 * Auth-guard + query-shape regression test for the /admin/flags Server
 * Component page — mirrors src/app/admin/submissions/page.test.tsx's own
 * rationale: this page has its own getAdminDb() -> forbidden() fail-closed
 * wiring, a per-row JSON.parse that must degrade rather than 500 the whole
 * page, and a second `SELECT ... IN (...)` venue-name-lookup query, and
 * nothing else pins any of it.
 *
 * @/components/ProposalsReviewView is mocked to a stub that serializes its
 * received `proposals` + `venueLookup` props into the DOM so this file can
 * assert on the exact parsed/mapped shape without re-testing that
 * component's own rendering or actions (covered by
 * ProposalsReviewView.test.tsx).
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccessDeniedError } from "@/lib/cfAccess";
import type { ChangeProposalRow, ParsedProposal } from "@/lib/adminProposals";
import type { VenueLookup } from "@/app/admin/flags/page";

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

vi.mock("@/components/ProposalsReviewView", () => ({
  default: (props: { proposals: ParsedProposal[]; venueLookup: Record<string, VenueLookup> }) => (
    <pre data-testid="proposals-stub">{JSON.stringify(props)}</pre>
  ),
}));

import FlagsPage from "@/app/admin/flags/page";
import { forbidden } from "next/navigation";
import { logAdminAuthFailure } from "@/lib/logger";

function makeProposalRow(overrides: Partial<ChangeProposalRow> = {}): ChangeProposalRow {
  return {
    id: 1,
    source: "osm",
    target_venue_id: "osm-node-1",
    change_type: "update",
    proposed_diff: JSON.stringify({ before: { phone: "a" }, after: { phone: "b" }, fields_changed: ["phone"] }),
    diff_hash: "h1",
    run_id: "run-1",
    anomaly: 0,
    status: "pending",
    created_at: "2026-09-01T00:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    applied_at: null,
    ...overrides,
  };
}

/**
 * Matches the page's real call chain: db.prepare(sql).bind(...).all<T>().
 * Captures every SQL string issued so tests can assert both the
 * change_proposals query AND the venue-lookup IN query without hardcoding
 * call order.
 */
function makeFakeDb(proposalRows: ChangeProposalRow[], venueRows: { id: string; name: string; status: string }[]) {
  const capturedSql: string[] = [];
  // Captured separately from the SQL so a test can assert how many
  // parameters each statement actually binds — D1 rejects more than 100.
  const capturedBindCounts: number[] = [];
  const db = {
    prepare: (sql: string) => {
      capturedSql.push(sql);
      return {
        bind: (...args: unknown[]) => {
          capturedBindCounts.push(args.length);
          return { all: async () => ({ success: true, results: venueRows, meta: {} }) };
        },
        all: async () => ({ success: true, results: proposalRows, meta: {} }),
      };
    },
  } as unknown as object;
  return { db, getSql: () => capturedSql, getBindCounts: () => capturedBindCounts };
}

function readStub(): { proposals: ParsedProposal[]; venueLookup: Record<string, VenueLookup> } {
  const stub = screen.getByTestId("proposals-stub");
  return JSON.parse(stub.textContent ?? "{}") as { proposals: ParsedProposal[]; venueLookup: Record<string, VenueLookup> };
}

describe("FlagsPage — auth guard", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("success: renders the signed-in email and delegates to ProposalsReviewView, forbidden() not called", async () => {
    const { db } = makeFakeDb([makeProposalRow()], [{ id: "osm-node-1", name: "Eastside Grocery", status: "published" }]);
    mockGetAdminDb.mockResolvedValue({ db, identity: { email: "admin@example.com" } });

    render(await FlagsPage());

    expect(screen.getByText("admin@example.com")).toBeDefined();
    expect(screen.getByText(/Data refresh queue/i)).toBeDefined();
    expect(forbidden).not.toHaveBeenCalled();
  });

  test("queries change_proposals WHERE status = 'pending' ORDER BY created_at DESC", async () => {
    const { db, getSql } = makeFakeDb([makeProposalRow()], []);
    mockGetAdminDb.mockResolvedValue({ db, identity: { email: "admin@example.com" } });

    render(await FlagsPage());

    const sql = getSql();
    expect(sql.some((s) => s.includes("FROM change_proposals") && s.includes("status = 'pending'") && s.includes("ORDER BY created_at DESC"))).toBe(
      true,
    );
  });

  test("looks up venue names/status in ONE IN(...) query, not a per-row lookup", async () => {
    const rows = [
      makeProposalRow({ id: 1, target_venue_id: "osm-node-1" }),
      makeProposalRow({ id: 2, target_venue_id: "osm-node-2" }),
    ];
    const { db, getSql } = makeFakeDb(rows, [
      { id: "osm-node-1", name: "A", status: "published" },
      { id: "osm-node-2", name: "B", status: "published" },
    ]);
    mockGetAdminDb.mockResolvedValue({ db, identity: { email: "admin@example.com" } });

    render(await FlagsPage());

    const inQueries = getSql().filter((s) => s.includes("FROM venues WHERE id IN"));
    expect(inQueries).toHaveLength(1);
  });

  /**
   * Regression guard for a real 500 on staging, 2026-09-02. D1 rejects more
   * than 100 bound parameters in one statement (`too many SQL variables`,
   * error 7500 — measured directly against the API, not read off docs), and
   * the venue lookup used to bind every unique target_venue_id into a single
   * query. A hand-seeded queue of a few rows never hit it; the first REAL
   * pipeline run wrote 107 proposals against 107 distinct venues and the
   * whole page 500'd. The per-run cap is 150 and pending rows accumulate
   * across runs, so >100 is the normal shape here, not an edge case.
   */
  test("splits the venue lookup into batches of at most 100 bound ids", async () => {
    const rows = Array.from({ length: 107 }, (_, i) => makeProposalRow({ id: i + 1, target_venue_id: `osm-node-${i}` }));
    const { db, getSql, getBindCounts } = makeFakeDb(rows, []);
    mockGetAdminDb.mockResolvedValue({ db, identity: { email: "admin@example.com" } });

    render(await FlagsPage());

    const inQueries = getSql().filter((s) => s.includes("FROM venues WHERE id IN"));
    expect(inQueries).toHaveLength(2);
    expect(getBindCounts()).toEqual([100, 7]);
    for (const count of getBindCounts()) {
      expect(count).toBeLessThanOrEqual(100);
    }
  });

  test("zero pending proposals -> no venue-lookup query at all (empty IN() would be invalid SQL)", async () => {
    const { db, getSql } = makeFakeDb([], []);
    mockGetAdminDb.mockResolvedValue({ db, identity: { email: "admin@example.com" } });

    render(await FlagsPage());

    expect(getSql().some((s) => s.includes("FROM venues WHERE id IN"))).toBe(false);
    expect(readStub().proposals).toEqual([]);
  });

  test("access denied -> fails closed: forbidden() fires and the denial is logged", async () => {
    mockGetAdminDb.mockRejectedValue(new AccessDeniedError("not_allowlisted"));

    await expect(FlagsPage()).rejects.toThrow("FORBIDDEN_CALLED");

    expect(logAdminAuthFailure).toHaveBeenCalledWith("not_allowlisted");
    expect(forbidden).toHaveBeenCalledTimes(1);
  });

  test("unexpected error -> re-thrown, not swallowed; forbidden() and the logger are untouched", async () => {
    mockGetAdminDb.mockRejectedValue(new Error("boom"));

    await expect(FlagsPage()).rejects.toThrow("boom");

    expect(forbidden).not.toHaveBeenCalled();
    expect(logAdminAuthFailure).not.toHaveBeenCalled();
  });
});

describe("FlagsPage — row parsing", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("a valid row parses to parseError:false with its diff intact", async () => {
    const { db } = makeFakeDb([makeProposalRow({ id: 7 })], [{ id: "osm-node-1", name: "Eastside Grocery", status: "published" }]);
    mockGetAdminDb.mockResolvedValue({ db, identity: { email: "admin@example.com" } });

    render(await FlagsPage());

    const { proposals, venueLookup } = readStub();
    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.row.id).toBe(7);
    expect(proposals[0]?.parseError).toBe(false);
    expect(venueLookup["osm-node-1"]?.name).toBe("Eastside Grocery");
  });

  test("a row with malformed proposed_diff JSON degrades to parseError:true instead of 500ing the page", async () => {
    const rows = [makeProposalRow({ id: 8, proposed_diff: "{not valid json" }), makeProposalRow({ id: 9 })];
    const { db } = makeFakeDb(rows, [{ id: "osm-node-1", name: "Eastside Grocery", status: "published" }]);
    mockGetAdminDb.mockResolvedValue({ db, identity: { email: "admin@example.com" } });

    render(await FlagsPage());

    const { proposals } = readStub();
    expect(proposals).toHaveLength(2);
    const broken = proposals.find((p) => p.row.id === 8);
    const healthy = proposals.find((p) => p.row.id === 9);
    expect(broken?.parseError).toBe(true);
    expect(healthy?.parseError).toBe(false);
  });
});
