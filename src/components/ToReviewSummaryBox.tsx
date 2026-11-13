"use client";

/**
 * ToReviewSummaryBox — the Places tab's "To review" summary box (issue
 * #674, "fold the Data refresh tab into Places"): a one-line count next to
 * the existing "Waiting to publish" box (WaitingToPublishBox.tsx, #673),
 * plus the retired /admin/flags queue's "Approve all date-only updates"
 * bulk action (ProposalsReviewView.tsx's own header explained the reason
 * this exists: the first production refresh run wrote 107 proposals, 89 of
 * them a bare freshness confirmation — "no admin clicks 89 times a month").
 *
 * The issue's own spec names this box ("N to review · X from the data
 * refresh") but doesn't say where the bulk-approve button that used to live
 * on /admin/flags should go — this is the obvious home: it acts on the
 * SAME "to review" set this box already summarizes, and there is nowhere
 * else on the new Places tab a bulk action across every pending proposal
 * would make sense. Judgment call, not spec'd.
 *
 * `reviewRowCount` (places with something to review), `proposals.length`
 * (raw pending-proposal count, "from the data refresh"), and
 * `submissionCount` (raw pending-public-submission count, "from the
 * public" — #675) are reported separately rather than collapsed into one
 * number: a place can carry more than one pending item, and the two source
 * counts can legitimately overlap on the SAME row (e.g. a data-refresh
 * update proposal and a public closure report both targeting one venue), so
 * summing them would double-count that row while still under-counting the
 * two sources' own totals.
 *
 * Renders nothing when there's nothing pending — same "hide when empty"
 * convention WaitingToPublishBox already follows on this same page.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BULK_APPROVE_MAX_IDS, isDateOnlyUpdateProposal } from "@/lib/adminProposals";
import type { ParsedProposal } from "@/lib/adminProposals";
import { cardSlimClass, primaryButtonClass } from "@/lib/adminCardStyles";
import AdminConfirm, { useAdminConfirm } from "@/components/AdminConfirm";

export interface ToReviewSummaryBoxProps {
  /** Places rows (existing venues + "Suggested new place" rows) with at least one pending item (a proposal, a submission, or both). */
  reviewRowCount: number;
  /** Every pending proposal across the whole Places tab — scopes the bulk-approve button (see this file's own header on why this is the full set, not whichever chip/filter is currently active). */
  proposals: ParsedProposal[];
  /** #675: every pending public_submissions row's own count ("from the public"). */
  submissionCount: number;
}

/** Bulk-approve's own local result state — mirrors ProposalsReviewView.tsx's original BulkApproveState exactly (same route, same response shape). */
type BulkApproveState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "done"; approved: number; skipped: number }
  | { status: "error"; message: string };

export default function ToReviewSummaryBox({ reviewRowCount, proposals, submissionCount }: ToReviewSummaryBoxProps) {
  const router = useRouter();
  const [bulkState, setBulkState] = useState<BulkApproveState>({ status: "idle" });
  // On-page confirm (#926 decision 7): nothing is sent until its own
  // Approve button is pressed, the same gate window.confirm used to be.
  const { asking, ask, cancel, triggerRef } = useAdminConfirm();

  // Capped at the route's per-request limit: past it the route refuses the
  // whole request, so the button approves the first batch and the rest wait.
  const dateOnlyIds = useMemo(
    () =>
      proposals
        .filter((p) => !p.parseError && isDateOnlyUpdateProposal(p.row, p.diff))
        .map((p) => p.row.id)
        .slice(0, BULK_APPROVE_MAX_IDS),
    [proposals],
  );
  // One update reads "Approve 1 date-only update", never "all 1 … updates".
  const one = dateOnlyIds.length === 1;
  const allOrCount = one ? "1" : dateOnlyIds.length < BULK_APPROVE_MAX_IDS ? `all ${dateOnlyIds.length}` : String(BULK_APPROVE_MAX_IDS);
  const updatesWord = one ? "update" : "updates";

  if (reviewRowCount === 0) return null;

  async function handleBulkApprove(ids: number[]) {
    setBulkState({ status: "submitting" });
    await runBulkApprove(ids);
    // Close the confirm either way; the result line below says what happened.
    cancel();
  }

  async function runBulkApprove(ids: number[]) {
    try {
      const res = await fetch("/api/admin/proposals/approve-date-only", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = (await res.json().catch(() => null)) as
        | { approved?: number; skipped?: { id: number }[]; error?: string }
        | null;
      if (res.status === 200 && data) {
        setBulkState({ status: "done", approved: data.approved ?? 0, skipped: data.skipped?.length ?? 0 });
        router.refresh();
        return;
      }
      // Same status-shape reasoning ProposalsReviewView.tsx's original
      // handleBulkApprove documented: a 400/401/403 means the server never
      // started the per-id loop (nothing applied); anything else may have
      // partially applied before failing.
      if (data?.error === "too_many_ids") {
        setBulkState({
          status: "error",
          message: "Nothing was approved: more than 200 date-only proposals were selected. Narrow the filter and try again.",
        });
        return;
      }
      const requestNeverStarted = res.status === 400 || res.status === 401 || res.status === 403;
      setBulkState({
        status: "error",
        message: requestNeverStarted
          ? "Nothing was approved. Try again."
          : "Some updates may not have been approved. Refresh the page to see which, then try again.",
      });
    } catch {
      setBulkState({ status: "error", message: "Nothing was approved. Try again." });
    }
  }

  const submitting = bulkState.status === "submitting";

  return (
    <div className={cardSlimClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--color-ink-700)]">
          {reviewRowCount} to review · {proposals.length} from the data refresh, {submissionCount} from the public
        </p>
        {dateOnlyIds.length > 0 && (
          <button
            ref={triggerRef}
            type="button"
            hidden={asking}
            onClick={ask}
            disabled={submitting}
            className={primaryButtonClass}
          >
            {`Approve ${allOrCount} date-only ${updatesWord}`}
          </button>
        )}
      </div>
      {asking && dateOnlyIds.length > 0 && (
        <div className="mt-3">
          <AdminConfirm
            title={`Approve ${allOrCount} date-only ${updatesWord}?`}
            confirmLabel={`Approve ${dateOnlyIds.length} ${updatesWord}`}
            busyLabel="Approving…"
            tone="primary"
            busy={submitting}
            onConfirm={() => handleBulkApprove(dateOnlyIds)}
            onCancel={cancel}
          >
            {one ? "This only updates" : "These only update"} the last-verified date. Real changes are not included.
          </AdminConfirm>
        </div>
      )}
      {(bulkState.status === "done" || bulkState.status === "error") && (
        <p
          aria-live="polite"
          className={
            "mt-1 text-sm " +
            (bulkState.status === "error" ? "text-[var(--color-danger)]" : "text-[var(--color-ink-500)]")
          }
        >
          {bulkState.status === "done" ? `Approved ${bulkState.approved}. Skipped ${bulkState.skipped}.` : bulkState.message}
        </p>
      )}
    </div>
  );
}
