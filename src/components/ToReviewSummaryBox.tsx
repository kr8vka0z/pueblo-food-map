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
import { isDateOnlyUpdateProposal } from "@/lib/adminProposals";
import type { ParsedProposal } from "@/lib/adminProposals";

export interface ToReviewSummaryBoxProps {
  /** Places rows (existing venues + "Suggested new place" rows) with at least one pending item (a proposal, a submission, or both). */
  reviewRowCount: number;
  /** Every pending proposal across the whole Places tab — scopes the bulk-approve button (see this file's own header on why this is the full set, not whichever chip/filter is currently active). */
  proposals: ParsedProposal[];
  /** #675: every pending public_submissions row's own count ("from the public"). */
  submissionCount: number;
}

const cardClass =
  "elevation-1 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white px-4 py-3 mb-4";

const primaryButtonClass =
  "inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-sage-600)] " +
  "px-4 py-2 text-sm font-semibold text-[var(--color-bone-50)] transition-colors duration-150 " +
  "hover:bg-[var(--color-sage-700)] focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

/** Bulk-approve's own local result state — mirrors ProposalsReviewView.tsx's original BulkApproveState exactly (same route, same response shape). */
type BulkApproveState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "done"; approved: number; skipped: number }
  | { status: "error"; message: string };

export default function ToReviewSummaryBox({ reviewRowCount, proposals, submissionCount }: ToReviewSummaryBoxProps) {
  const router = useRouter();
  const [bulkState, setBulkState] = useState<BulkApproveState>({ status: "idle" });

  const dateOnlyIds = useMemo(
    () => proposals.filter((p) => !p.parseError && isDateOnlyUpdateProposal(p.row, p.diff)).map((p) => p.row.id),
    [proposals],
  );

  if (reviewRowCount === 0) return null;

  async function handleBulkApprove(ids: number[]) {
    const confirmed = window.confirm(
      `Approve all ${ids.length} proposals that only update the last-verified date? Real changes are not included.`,
    );
    if (!confirmed) return;
    setBulkState({ status: "submitting" });
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
          message: "More than 200 date-only proposals selected — narrow the filter and retry.",
        });
        return;
      }
      const requestNeverStarted = res.status === 400 || res.status === 401 || res.status === 403;
      setBulkState({
        status: "error",
        message: requestNeverStarted
          ? "Something went wrong. Nothing was applied. Try again."
          : "Something went wrong. Some proposals may already be approved — refresh before retrying.",
      });
    } catch {
      setBulkState({ status: "error", message: "Something went wrong. Nothing was applied. Try again." });
    }
  }

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--color-ink-700)]">
          {reviewRowCount} to review · {proposals.length} from the data refresh, {submissionCount} from the public
        </p>
        {dateOnlyIds.length > 0 && (
          <button
            type="button"
            onClick={() => handleBulkApprove(dateOnlyIds)}
            disabled={bulkState.status === "submitting"}
            className={primaryButtonClass}
          >
            {bulkState.status === "submitting" ? "Approving…" : `Approve all ${dateOnlyIds.length} date-only updates`}
          </button>
        )}
      </div>
      {(bulkState.status === "done" || bulkState.status === "error") && (
        <p aria-live="polite" className="mt-1 text-sm text-[var(--color-ink-500)]">
          {bulkState.status === "done" ? `Approved ${bulkState.approved}. Skipped ${bulkState.skipped}.` : bulkState.message}
        </p>
      )}
    </div>
  );
}
