"use client";

/**
 * SubmissionCard — one `public_submissions` row's review card (#675, "fold
 * the Review queue into Places"). Extracted from the now-deleted
 * SubmissionsReviewView.tsx (#259) — that component owned both this card
 * AND the standalone /admin/submissions queue's list/empty-state chrome;
 * the queue itself is gone (redirects to /admin/places?show=review&from=public),
 * but the SAME card renders in two places now: the venue edit page's
 * "Suggestions to review" box (SuggestionsBox.tsx, generalized to dispatch
 * on ReviewItem's `kind`) and nowhere else — a `new_venue` submission's own
 * "Suggested new place" row on the Places tab links straight to
 * /admin/venues/new?submission=<id> (VenueListView.tsx), the same handoff
 * this card's own "Review & approve" link already used, so it never needed
 * its own card there.
 *
 * Actions differ by kind, per the issue's own spec — a report ISN'T a
 * ready-made change the way a `change_proposals` row is, so there's no
 * one-click Approve:
 *   - "closure" (every ISSUE_TYPES value, not just an actual closure —
 *     migrations/0002's `kind` column predates the report form's issue-type
 *     picker and was never renamed): **Mark done** (POST
 *     .../submissions/<id>/done — the admin already fixed the venue's
 *     fields via AddVenueForm's own save, or removed it with the edit
 *     page's plain "Remove from map" — Mark done is the only way a closure
 *     report gets resolved) or **Reject** (optional reason).
 *   - "new_venue": a plain navigation Link to
 *     /admin/venues/new?submission=<id> (unchanged from #259/#270 — the
 *     actual approve happens inside POST /api/admin/venues's existing
 *     atomic batch, see that route's header) plus the same Reject.
 *
 * Public submissions can point at a place that's since been removed
 * (issue's own "Risks" note) — this card renders identically either way; it
 * has no opinion on the target venue's current status, only on `submission`
 * itself. The caller (edit page / Places tab) decides which row to render
 * it under.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { categoryLabels } from "@/lib/categories";
import { ISSUE_TYPES, type IssueTypeKey } from "@/lib/reportTypes";
import type { VenueCategory } from "@/types/venue";
import type { ClosurePayload, NewVenuePayload, ReviewSubmission } from "@/lib/publicSubmissions";
import { inputBase, inputBorder } from "@/components/formClasses";
import {
  cardClass,
  dangerButtonClass,
  fieldLabelClass,
  formatSubmittedAt,
  primaryButtonClass,
  secondaryButtonClass,
  tagClass,
  type TagTone,
} from "@/lib/adminCardStyles";

export interface SubmissionCardProps {
  submission: ReviewSubmission;
}

// ─── Styling (card, button and tag classes come from adminCardStyles.ts) ───

// calm: a new place is not urgent; attention: a public report needs a look.
const KIND_BADGE: Record<ReviewSubmission["kind"], { label: string; tone: TagTone }> = {
  new_venue: { label: "New place", tone: "calm" },
  closure: { label: "Public report", tone: "attention" },
};

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

/**
 * A short, human line for VenueListView's "To review" cell — mirrors
 * summarizeProposalForRow's own role in that file exactly, just for a
 * `public_submissions` row instead of a `change_proposals` one. Exported
 * (not local to VenueListView.tsx) for the same reuse reason ProposalCard.tsx's
 * SOURCE_BADGE/fieldLabel are: the one place that knows how to summarize a
 * submission for a table row is this file, which already owns its full
 * detail rendering.
 */
export function summarizeSubmissionForRow(submission: ReviewSubmission): string {
  if (submission.parseError) return "Public report: couldn't read details";
  if (submission.kind === "new_venue") return "Suggested new place";
  const issueLabel = ISSUE_TYPES[submission.payload.issueType as IssueTypeKey] ?? submission.payload.issueType;
  return `"${issueLabel}"`;
}

type ActionState = { status: "idle" } | { status: "submitting" } | { status: "error"; message: string };

export default function SubmissionCard({ submission }: SubmissionCardProps) {
  const router = useRouter();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [rejectState, setRejectState] = useState<ActionState>({ status: "idle" });
  const [doneState, setDoneState] = useState<ActionState>({ status: "idle" });

  const badge = KIND_BADGE[submission.kind];
  const reasonFieldId = `reject-reason-${submission.id}`;
  const rejectFailMessage = `This ${submission.kind === "new_venue" ? "suggestion" : "report"} was not rejected. Try again.`;

  async function handleConfirmReject() {
    setRejectState({ status: "submitting" });
    try {
      const res = await fetch(`/api/admin/submissions/${submission.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.status === 200) {
        router.refresh();
        return;
      }
      setRejectState({ status: "error", message: rejectFailMessage });
    } catch {
      setRejectState({ status: "error", message: rejectFailMessage });
    }
  }

  async function handleMarkDone() {
    setDoneState({ status: "submitting" });
    try {
      const res = await fetch(`/api/admin/submissions/${submission.id}/done`, { method: "POST" });
      if (res.status === 200) {
        router.refresh();
        return;
      }
      setDoneState({ status: "error", message: "This report was not marked done. Try again." });
    } catch {
      setDoneState({ status: "error", message: "This report was not marked done. Try again." });
    }
  }

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className={tagClass(badge.tone)}>{badge.label}</span>
        <p className="text-xs text-[var(--color-ink-400)]">
          {formatSubmittedAt(submission.createdAt)}
          {submission.submitterEmail && <> · {submission.submitterEmail}</>}
        </p>
      </div>

      <div className="mt-3">
        {submission.parseError ? (
          <p className="text-sm text-[var(--color-clay-700)]">
            Couldn&apos;t read details for this submission. The stored data may be malformed. You can still
            reject it below.
          </p>
        ) : submission.kind === "new_venue" ? (
          <NewVenueDetails payload={submission.payload} />
        ) : (
          <ClosureDetails payload={submission.payload} />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!submission.parseError && submission.kind === "new_venue" && (
          <Link href={`/admin/venues/new?submission=${submission.id}`} className={primaryButtonClass}>
            Review &amp; approve
          </Link>
        )}
        {submission.kind === "closure" && (
          <button
            type="button"
            onClick={handleMarkDone}
            disabled={doneState.status === "submitting"}
            className={primaryButtonClass}
          >
            {doneState.status === "submitting" ? "Marking done…" : "Mark done"}
          </button>
        )}
        {!rejectOpen && (
          <button type="button" onClick={() => setRejectOpen(true)} className={secondaryButtonClass}>
            Reject
          </button>
        )}
      </div>

      {doneState.status === "error" && (
        <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">
          {doneState.message}
        </p>
      )}

      {rejectOpen && (
        <div className="mt-4 border-t border-[var(--color-bone-200)] pt-4">
          <label htmlFor={reasonFieldId} className={`${fieldLabelClass} mb-1 block`}>
            Reason <span className="font-normal normal-case text-[var(--color-ink-400)]">(optional, for your own notes)</span>
          </label>
          <textarea
            id={reasonFieldId}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={`${inputBase} ${inputBorder(false)}`}
          />
          {/* Cancel first, the red Confirm second (#926 decision 8). */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setRejectOpen(false);
                setReason("");
                setRejectState({ status: "idle" });
              }}
              disabled={rejectState.status === "submitting"}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmReject}
              disabled={rejectState.status === "submitting"}
              className={dangerButtonClass}
            >
              {rejectState.status === "submitting" ? "Rejecting…" : "Confirm reject"}
            </button>
          </div>
          {rejectState.status === "error" && (
            <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">
              {rejectState.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Per-kind detail rows ───────────────────────────────────────────────────

// whitespace-pre-line: a report's description and a suggestion's notes keep
// the visitor's paragraph breaks (#894 item 8); every other value is one line.
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="whitespace-pre-line text-sm text-[var(--color-ink-700)]">
      <span className={fieldLabelClass}>{label}: </span>
      {value}
    </p>
  );
}

function NewVenueDetails({ payload }: { payload: NewVenuePayload }) {
  const categoryLabel = categoryLabels[payload.category as VenueCategory] ?? payload.category;
  return (
    <div className="space-y-1">
      <p className="text-base font-semibold text-[var(--color-ink-700)]">{payload.venueName}</p>
      <DetailRow label="Address" value={payload.address} />
      <DetailRow label="Category" value={categoryLabel} />
      {payload.hours && <DetailRow label="Hours" value={payload.hours} />}
      {payload.contact && <DetailRow label="Contact" value={payload.contact} />}
      <DetailRow label="Accepts SNAP" value={yesNo(payload.acceptsSnap)} />
      <DetailRow label="Accepts WIC" value={yesNo(payload.acceptsWic)} />
      {payload.notes && <DetailRow label="Notes" value={payload.notes} />}
    </div>
  );
}

function ClosureDetails({ payload }: { payload: ClosurePayload }) {
  const issueLabel = ISSUE_TYPES[payload.issueType as IssueTypeKey] ?? payload.issueType;
  return (
    <div className="space-y-1">
      <p className="text-base font-semibold text-[var(--color-ink-700)]">{payload.venueName}</p>
      <DetailRow label="Address" value={payload.venueAddress} />
      <DetailRow label="Issue" value={issueLabel} />
      <DetailRow label="Description" value={payload.description} />
      {payload.contactEmail && <DetailRow label="Reporter contact" value={payload.contactEmail} />}
    </div>
  );
}
