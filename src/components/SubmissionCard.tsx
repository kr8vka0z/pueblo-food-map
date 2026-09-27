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
 *     fields via AddVenueForm's own save, or removed it via
 *     ArchiveVenueButton's existing `?submission=` archive-and-resolve
 *     path, a SEPARATE action this card doesn't render) or **Reject**
 *     (optional reason).
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
import { categoryLabels } from "@/data/venues";
import { ISSUE_TYPES, type IssueTypeKey } from "@/lib/reportTypes";
import type { VenueCategory } from "@/types/venue";
import type { ClosurePayload, NewVenuePayload, ReviewSubmission } from "@/lib/publicSubmissions";

export interface SubmissionCardProps {
  submission: ReviewSubmission;
}

// ─── Shared styling (reuses existing DESIGN.md tokens — no new ones,
// duplicated per-file same as ProposalCard.tsx's own copy) ─────────────────

const cardClass =
  "elevation-1 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-4 sm:p-5";

// sage-100/700: this codebase's established "calm, not urgent" badge
// pairing (DESIGN.md; VenueCard's SNAP/WIC badges use the same pairing).
const KIND_BADGE: Record<ReviewSubmission["kind"], { label: string; className: string }> = {
  new_venue: { label: "New place", className: "bg-[var(--color-sage-100)] text-[var(--color-sage-700)]" },
  // clay-100/700: the established informational-emphasis pairing (DESIGN.md;
  // VenueListView's "Unpublished changes" marker, VenueCard's SNAP badge).
  closure: { label: "Public report", className: "bg-[var(--color-clay-100)] text-[var(--color-clay-700)]" },
};

const primaryButtonClass =
  "inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-sage-600)] " +
  "px-4 py-2 text-sm font-semibold text-[var(--color-bone-50)] transition-colors duration-150 " +
  "hover:bg-[var(--color-sage-700)] focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const secondaryButtonClass =
  "inline-flex items-center rounded-[var(--radius-md)] border border-[var(--color-bone-300)] " +
  "px-3 py-1.5 text-sm font-medium text-[var(--color-ink-700)] bg-transparent " +
  "transition-colors duration-150 hover:bg-[var(--color-bone-100)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const dangerButtonClass =
  "inline-flex items-center rounded-[var(--radius-md)] border border-[var(--color-danger)] " +
  "px-3 py-1.5 text-sm font-medium text-[var(--color-danger)] bg-transparent " +
  "transition-colors duration-150 hover:bg-[var(--color-danger)] hover:text-[var(--color-bone-50)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)] focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const fieldLabelClass = "text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)]";

/**
 * Full date + time, in the viewer's LOCAL timezone (deliberately NOT pinned
 * to UTC like adminVenues.ts's formatLastVerified) — `created_at` is a
 * genuine timestamp an admin reads as "when did this arrive," not a
 * date-only field with an established display convention to match
 * elsewhere, so showing it in the browser's own local time is the more
 * useful reading here.
 */
function formatSubmittedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso; // defensive: never crash a card on a malformed timestamp
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

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
  if (submission.parseError) return "Public report — couldn't read details";
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
      setRejectState({ status: "error", message: "Something went wrong. This wasn't rejected. Try again." });
    } catch {
      setRejectState({ status: "error", message: "Something went wrong. This wasn't rejected. Try again." });
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
      setDoneState({ status: "error", message: "Something went wrong. This wasn't marked done. Try again." });
    } catch {
      setDoneState({ status: "error", message: "Something went wrong. This wasn't marked done. Try again." });
    }
  }

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${badge.className}`}>
          {badge.label}
        </span>
        <p className="text-xs text-[var(--color-ink-400)]">
          {formatSubmittedAt(submission.createdAt)}
          {submission.submitterEmail && <> · {submission.submitterEmail}</>}
        </p>
      </div>

      <div className="mt-3">
        {submission.parseError ? (
          <p className="text-sm text-[var(--color-clay-700)]">
            Couldn&apos;t read details for this submission — the stored data may be malformed. You can still
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
            Reason <span className="font-normal normal-case text-[var(--color-ink-400)]">(optional)</span>
          </label>
          <textarea
            id={reasonFieldId}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            // text-base on mobile: iOS Safari auto-zooms on focus under 16px.
            className={
              "w-full rounded-[var(--radius-md)] border border-[var(--color-bone-300)] px-3 py-2 text-base md:text-sm " +
              "text-[var(--color-ink-900)] bg-white placeholder:text-[var(--color-ink-400)] " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
              "focus-visible:border-[var(--color-sage-500)]"
            }
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleConfirmReject}
              disabled={rejectState.status === "submitting"}
              className={dangerButtonClass}
            >
              {rejectState.status === "submitting" ? "Rejecting…" : "Confirm reject"}
            </button>
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm text-[var(--color-ink-700)]">
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
