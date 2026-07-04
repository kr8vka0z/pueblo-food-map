"use client";

/**
 * SubmissionsReviewView — the admin review queue's card list (#259, all five
 * ACs). Rendered by src/app/admin/submissions/page.tsx, which owns the auth
 * gate and the `SELECT ... WHERE status = 'pending' ORDER BY created_at DESC`
 * read; this component is presentational + interactive only, same
 * Server-Component-data / Client-Component-action split as VenueListView and
 * PublishPanel.
 *
 * Cards, not a dense table (unlike VenueListView): a submission carries far
 * more per-row detail than a venue's list columns (full address, hours,
 * contact, notes, or a closure's description) — a table would either clip
 * that detail or force horizontal scroll, where 108 rows of DENSE tabular
 * comparison genuinely suits VenueListView, a handful of pending
 * submissions read better as review cards.
 *
 * Approve is a plain navigation Link for BOTH kinds (#270 made closure
 * match new_venue) — reusing existing routes rather than inventing new
 * ones, and nothing to POST from this component for either approve path:
 *   - new_venue "Review & approve" hands off to
 *     /admin/venues/new?submission=<id>, where the actual approve happens
 *     inside POST /api/admin/venues's existing atomic batch (see that
 *     route's header).
 *   - closure "Review & approve" hands off to
 *     /admin/venues/<targetVenueId>/edit?submission=<id> — that page shows
 *     the report's details and lets the admin verify/fix the venue (or
 *     remove it) before approving; the actual approve happens inside
 *     POST /api/admin/venues/<id>/archive's existing atomic batch when
 *     ArchiveVenueButton is used from that context (see that route's and
 *     ArchiveVenueButton's headers). Originally a one-click confirm+archive
 *     button; changed because a closure report can mean "the hours
 *     changed," not only "this place is gone" — the admin should get the
 *     same edit-before-approve review new_venue already gets.
 *   - Reject (either kind) is the one write this slice adds:
 *     POST /api/admin/submissions/<id>/reject.
 *
 * On any successful action, router.refresh() re-runs the Server Component's
 * `WHERE status = 'pending'` query — the acted-on card simply stops
 * matching and disappears from the next render; this component holds no
 * local copy of the list to reconcile.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { categoryLabels } from "@/data/venues";
import { ISSUE_TYPES, type IssueTypeKey } from "@/lib/reportTypes";
import type { VenueCategory } from "@/types/venue";
import type {
  ClosurePayload,
  NewVenuePayload,
  PublicSubmissionKind,
} from "@/lib/publicSubmissions";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReviewSubmissionBase {
  id: number;
  createdAt: string;
  /** submitter_email column — present regardless of payload-parse success. */
  submitterEmail: string | null;
  /** target_venue_id column — populated for "closure", null for "new_venue"; a
   *  real column (not inside the JSON payload), so the closure approve action
   *  works even on a row whose payload failed to parse. */
  targetVenueId: string | null;
}

/**
 * Discriminated on `parseError` first, then `kind` — a row whose stored
 * `payload` JSON failed to parse (src/app/admin/submissions/page.tsx wraps
 * that per-row) degrades to the `parseError: true` arm regardless of kind,
 * carrying no payload at all rather than a guessed/partial one.
 */
export type ReviewSubmission =
  | (ReviewSubmissionBase & { kind: "new_venue"; parseError: false; payload: NewVenuePayload })
  | (ReviewSubmissionBase & { kind: "closure"; parseError: false; payload: ClosurePayload })
  | (ReviewSubmissionBase & { kind: PublicSubmissionKind; parseError: true; payload: null });

export interface SubmissionsReviewViewProps {
  submissions: ReviewSubmission[];
}

// ─── Shared styling (reuses existing DESIGN.md tokens — no new ones) ───────

const cardClass =
  "elevation-1 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-4 sm:p-5";

const KIND_BADGE: Record<PublicSubmissionKind, { label: string; className: string }> = {
  // sage-100/700: this codebase's established "calm, not urgent" badge
  // pairing (DESIGN.md; VenueCard's SNAP/WIC badges use the same pairing).
  new_venue: { label: "New place", className: "bg-[var(--color-sage-100)] text-[var(--color-sage-700)]" },
  // clay-100/700: the established informational-emphasis pairing (DESIGN.md;
  // VenueListView's "Unpublished changes" marker, VenueCard's SNAP badge).
  closure: { label: "Closure report", className: "bg-[var(--color-clay-100)] text-[var(--color-clay-700)]" },
};

const primaryButtonClass =
  "inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-sage-500)] " +
  "px-4 py-2 text-sm font-semibold text-[var(--color-bone-50)] transition-colors duration-150 " +
  "hover:bg-[var(--color-sage-600)] focus-visible:outline-none focus-visible:ring-2 " +
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

// ─── Component ──────────────────────────────────────────────────────────────

export default function SubmissionsReviewView({ submissions }: SubmissionsReviewViewProps) {
  if (submissions.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white px-4 py-16 text-center">
        <p className="text-sm font-semibold text-[var(--color-ink-700)]">No submissions to review</p>
        <p className="mt-1 text-sm text-[var(--color-ink-500)]">
          New suggestions and closure reports will show up here.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {submissions.map((submission) => (
        <li key={submission.id}>
          <SubmissionCard submission={submission} />
        </li>
      ))}
    </ul>
  );
}

// ─── One card + its own local action state ─────────────────────────────────

type ActionState = { status: "idle" } | { status: "submitting" } | { status: "error"; message: string };

function SubmissionCard({ submission }: { submission: ReviewSubmission }) {
  const router = useRouter();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [rejectState, setRejectState] = useState<ActionState>({ status: "idle" });

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
        {submission.kind === "closure" && submission.targetVenueId && (
          // No `!submission.parseError` gate here (unlike new_venue above):
          // target_venue_id is a real column, independent of the parsed
          // payload, so a row whose JSON failed to parse can still be
          // reviewed on the edit page — same reasoning the parseError
          // branch below still offers Reject.
          <Link
            href={`/admin/venues/${submission.targetVenueId}/edit?submission=${submission.id}`}
            className={primaryButtonClass}
          >
            Review &amp; approve
          </Link>
        )}
        {!rejectOpen && (
          <button type="button" onClick={() => setRejectOpen(true)} className={secondaryButtonClass}>
            Reject
          </button>
        )}
      </div>

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
            className={
              "w-full rounded-[var(--radius-md)] border border-[var(--color-bone-300)] px-3 py-2 text-sm " +
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
