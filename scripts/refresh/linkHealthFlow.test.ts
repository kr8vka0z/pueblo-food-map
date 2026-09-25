// @vitest-environment node
/**
 * linkHealthFlow.test.ts — synthetic replacement for issue #235's canary.
 * #235 (a real, intentionally-unfixed dead Plentiful link) was the live
 * proof that this pipeline's link-health check actually flags a dead url
 * end to end; it healed on 2026-09-23 (the target page started resolving
 * again) and was closed, so it can no longer prove anything. This file
 * proves the same claim with a MOCKED response — no real third-party URL,
 * no dependency on any site staying broken forever — by driving the exact
 * three functions a real monthly run chains together (linkHealth.ts's
 * checkUrl -> diffEngine.ts's buildLinkHealthProposal ->
 * proposalSql.ts's buildProposalWriteStatements), the same sequence
 * scripts/refresh-ingest.ts's own step 4/6 run (see that file's header).
 *
 * `.invalid` (RFC 2606, reserved — guaranteed to never resolve) stands in
 * for a real host; the OUTCOME is what's mocked (a 404), not the network
 * call itself, so this never depends on DNS behavior either.
 */

import { describe, test, expect, vi } from "vitest";
import { checkUrl } from "./linkHealth";
import { buildLinkHealthProposal } from "./diffEngine";
import { buildProposalWriteStatements } from "./proposalSql";

const DEAD_URL = "https://dead-canary.invalid/gone";
const RUN_ID = "test-run-1";

function sqlText(value: string | null | undefined): string {
  if (value === null || value === undefined) return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

describe("link-health finding flows through to a change_proposals write", () => {
  test("a mocked 404 classifies dead, builds a link_health proposal, and writes exactly one pending INSERT (no venues UPDATE)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));

    const outcome = await checkUrl(DEAD_URL, { fetchImpl });
    expect(outcome).toEqual({ classification: "dead", httpStatus: 404 });
    if (outcome.classification !== "dead") return; // narrows for TS below

    const checkedAt = "2026-09-24T00:00:00.000Z";
    const proposal = buildLinkHealthProposal("venue-canary", DEAD_URL, outcome.httpStatus, checkedAt, RUN_ID);
    expect(proposal.source).toBe("link_health");
    expect(proposal.changeType).toBe("update");
    expect(proposal.proposedDiff.before).toEqual({ url: DEAD_URL });
    expect(proposal.proposedDiff.after).toEqual({ url: null });
    expect(proposal.proposedDiff.meta).toEqual({ http_status: 404, checked_at: checkedAt });

    const built = buildProposalWriteStatements(proposal, "2026-09-24T00:00:01.000Z", sqlText);

    // A link_health finding is never auto-applied — it always waits for a
    // human review at /admin/flags (see proposalSql.ts's own header +
    // adminProposals.ts's applyApprovedProposal, which refuses to apply a
    // link_health row directly).
    expect(built.autoApplied).toBe(false);
    expect(built.statements).toHaveLength(1);
    expect(built.statements[0]).toContain("INSERT INTO change_proposals");
    expect(built.statements[0]).toContain("'link_health'");
    expect(built.statements[0]).toContain("'venue-canary'");
    expect(built.statements.join("\n")).not.toContain("UPDATE venues");
  });

  test("an unresolvable host is classified 'ignore', NOT 'dead' — by design (linkHealth.ts's own false-positive-avoidance rule), so it produces no proposal at all", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND dead-canary.invalid"));

    const outcome = await checkUrl("https://dead-canary.invalid/dns-fail", { fetchImpl });

    expect(outcome.classification).toBe("ignore");
    // No proposal is ever built for an "ignore" outcome in the real
    // pipeline (scripts/refresh-ingest.ts only calls buildLinkHealthProposal
    // inside its `if (outcome.classification === "dead")` branch) — this
    // assertion documents that rule rather than re-implementing it.
  });
});
