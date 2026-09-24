// @vitest-environment node
/**
 * Regression test for #568 item 3 — new file because
 * src/app/api/admin/proposals/[id]/approve/route.test.ts is an existing
 * test file (write-guarded on fix/* branches); this covers ONLY the new
 * `message` field on the two 422 responses (corrupted_proposal,
 * nothing_to_apply), not the rest of the route (see that file for the
 * supersede-race/stale-apply/atomic-batch coverage this duplicates just
 * enough fixture/mock setup to stand alone from).
 *
 * Root cause (adminProposals.ts's applyApprovedProposal): both 422s used to
 * return `{ok: false, error}` with no `message`. BOTH review surfaces that
 * read this response already fall back to a generic "Try again"/"Something
 * went wrong" when `message` is absent (NeedsDecisionPanel.tsx's
 * defaultInterpretApproveError, ProposalsReviewView.tsx's ApproveAction) —
 * so adding `message` at the shared source fixes both UIs at once, with no
 * component change needed.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { ADMIN_ORIGIN } from "@/lib/adminOrigin";
import type { AdminVenueRow } from "@/types/venue";
import type { ChangeProposalRow, ProposedDiff } from "@/lib/adminProposals";

const ADMIN_EMAIL = "admin@pueblofoodmap.com";
const PROPOSAL_ID = 7;
const VENUE_ID = "osm-node-1";

const mockGetCloudflareContext = vi.fn();
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (...args: unknown[]) => mockGetCloudflareContext(...args),
}));

const mockRequireAdminSession = vi.fn();
vi.mock("@/lib/adminSession", () => ({
  requireAdminSession: (...args: unknown[]) => mockRequireAdminSession(...args),
}));

import { POST } from "@/app/api/admin/proposals/[id]/approve/route";

function makeProposal(overrides: Partial<ChangeProposalRow> = {}): ChangeProposalRow {
  const diff: ProposedDiff = {
    before: { phone: "719-555-0100", last_verified: "2026-08-01" },
    after: { phone: "719-555-0199", last_verified: "2026-09-02" },
    fields_changed: ["phone", "last_verified"],
  };
  return {
    id: PROPOSAL_ID,
    source: "osm",
    target_venue_id: VENUE_ID,
    change_type: "update",
    proposed_diff: JSON.stringify(diff),
    diff_hash: "hash1",
    run_id: "local-1",
    anomaly: 0,
    status: "pending",
    created_at: "2026-09-01T00:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    applied_at: null,
    ...overrides,
  };
}

function makeVenue(overrides: Partial<AdminVenueRow> = {}): AdminVenueRow {
  return {
    id: VENUE_ID,
    name: "Eastside Grocery",
    category: "grocery",
    lat: 38.25,
    lng: -104.6,
    address: "123 Test St, Pueblo, CO",
    hours_weekly: null,
    accepts_snap: null,
    accepts_wic: null,
    phone: "719-555-0100",
    email: null,
    url: "https://example.com",
    notes: null,
    operator: null,
    source: "OpenStreetMap (node/1)",
    last_verified: "2026-08-01",
    status: "published",
    source_type: "osm",
    outside_county: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    created_by: "seed",
    updated_at: "2026-01-01T00:00:00.000Z",
    updated_by: "seed",
    published_at: "2026-01-02T00:00:00.000Z",
    published_by: "seed",
    ...overrides,
  };
}

function makeFakeDb(opts: { proposal: ChangeProposalRow | null; venue: AdminVenueRow | null }) {
  const batch = vi.fn(async (stmts: unknown[]) => stmts.map(() => ({ success: true, results: [], meta: { changes: 1 } })));
  const prepare = (sql: string) => ({
    bind: () => ({
      first: async <T,>(): Promise<T | null> => {
        if (sql.includes("FROM change_proposals")) return opts.proposal as unknown as T | null;
        if (sql.includes("FROM venues")) return opts.venue as unknown as T | null;
        return null;
      },
      run: async () => ({ success: true, results: [], meta: { changes: 1 } }),
    }),
  });
  return { db: { prepare, batch } as unknown as D1Database, batch };
}

function makeRequest(): NextRequest {
  return new NextRequest(`https://pueblofoodmap.com/api/admin/proposals/${PROPOSAL_ID}/approve`, {
    method: "POST",
    headers: { Origin: ADMIN_ORIGIN },
  });
}

function callApprove(req: NextRequest) {
  return POST(req, { params: Promise.resolve({ id: String(PROPOSAL_ID) }) });
}

describe("POST /api/admin/proposals/[id]/approve — 422 messages (#568 item 3)", () => {
  beforeEach(() => {
    mockGetCloudflareContext.mockReset();
    mockRequireAdminSession.mockReset();
    mockRequireAdminSession.mockResolvedValue({ email: ADMIN_EMAIL });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("corrupted proposed_diff JSON -> 422 now carries a readable message, not just an error code", async () => {
    const { db, batch } = makeFakeDb({ proposal: makeProposal({ proposed_diff: "{not valid" }), venue: makeVenue() });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callApprove(makeRequest());

    expect(res.status).toBe(422);
    const data = (await res.json()) as { ok: boolean; error: string; message?: string };
    expect(data.error).toBe("corrupted_proposal");
    expect(data.message).toBeTruthy();
    expect(data.message).toMatch(/corrupted/i);
    expect(batch).not.toHaveBeenCalled();
  });

  test("an update proposal with no applicable fields -> 422 now carries a readable message", async () => {
    // "notes" isn't in APPLIABLE_VENUE_FIELDS — fields.length === 0 after
    // filtering, the nothing_to_apply branch. Venue's own `notes` matches
    // diff.before.notes so this doesn't trip the (separate) stale-apply
    // guard first.
    const diff: ProposedDiff = {
      before: { notes: "Old note" },
      after: { notes: "New note" },
      fields_changed: ["notes"],
    };
    const { db, batch } = makeFakeDb({
      proposal: makeProposal({ proposed_diff: JSON.stringify(diff) }),
      venue: makeVenue({ notes: "Old note" }),
    });
    mockGetCloudflareContext.mockResolvedValue({ env: { ADMIN_DB: db } });

    const res = await callApprove(makeRequest());

    expect(res.status).toBe(422);
    const data = (await res.json()) as { ok: boolean; error: string; message?: string };
    expect(data.error).toBe("nothing_to_apply");
    expect(data.message).toBeTruthy();
    expect(data.message).toMatch(/no applicable/i);
    expect(batch).not.toHaveBeenCalled();
  });
});
