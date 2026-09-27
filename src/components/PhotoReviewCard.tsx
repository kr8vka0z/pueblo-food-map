"use client";

/**
 * PhotoReviewCard — one box photo's moderation card: a preview, a status
 * badge, and Approve/Reject (pending) or Keep photo/Remove photo (flagged),
 * with an optional reject/remove reason (issue #677, "fold Photo review and
 * Sponsor requests into the Blessing Boxes tab").
 *
 * Extracted from BoxPhotosReviewView.tsx's inner BoxPhotoCard — same card
 * shell, button classes and reject-reason flow (verbatim, including the
 * fetch call that actually sends `{ reason }`, unlike ProposalCard.tsx's
 * postAction() which drops it — see that file's own header on why not to
 * repeat that bug). Now renders in TWO places: this tab's own review views
 * (until #677 removes them) and, going forward, the box edit page's
 * "Things to review" box (BoxReviewBox.tsx) — a large preview there (this
 * component's own default size already meets both call sites' needs, see
 * this file's own size comment below).
 *
 * On Approve/Reject, router.refresh() re-runs the caller's Server
 * Component read — the acted-on card stops matching (no longer pending or
 * flagged) and disappears from the next render, same "no local list copy to
 * reconcile" convention every other admin queue in this app already uses.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminBoxPhotoRow } from "@/lib/boxPhotos";

export interface PhotoReviewCardProps {
  photo: AdminBoxPhotoRow;
}

const cardClass =
  "elevation-1 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-4 sm:p-5";

const primaryButtonClass =
  "inline-flex min-h-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-sage-600)] " +
  "px-4 py-2 text-sm font-semibold text-[var(--color-bone-50)] transition-colors duration-150 " +
  "hover:bg-[var(--color-sage-700)] focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const secondaryButtonClass =
  "inline-flex min-h-12 items-center rounded-[var(--radius-md)] border border-[var(--color-bone-300)] " +
  "px-3 py-1.5 text-sm font-medium text-[var(--color-ink-700)] bg-transparent " +
  "transition-colors duration-150 hover:bg-[var(--color-bone-100)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const dangerButtonClass =
  "inline-flex min-h-12 items-center rounded-[var(--radius-md)] border border-[var(--color-danger)] " +
  "px-3 py-1.5 text-sm font-medium text-[var(--color-danger)] bg-transparent " +
  "transition-colors duration-150 hover:bg-[var(--color-danger)] hover:text-[var(--color-bone-50)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)] focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const fieldLabelClass = "text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)]";

function formatSubmittedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

type ActionState = { status: "idle" } | { status: "submitting" } | { status: "error"; message: string };

export default function PhotoReviewCard({ photo }: PhotoReviewCardProps) {
  const router = useRouter();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<ActionState>({ status: "idle" });

  const isFlagged = photo.status === "flagged";
  const reasonFieldId = `photo-reject-reason-${photo.id}`;
  const genericErrorMessage = "Something went wrong. Try again.";

  async function handleApprove() {
    setState({ status: "submitting" });
    try {
      const res = await fetch(`/api/admin/box-photos/${photo.id}/approve`, { method: "POST" });
      if (res.status === 200) {
        router.refresh();
        return;
      }
      setState({ status: "error", message: genericErrorMessage });
    } catch {
      setState({ status: "error", message: genericErrorMessage });
    }
  }

  async function handleConfirmReject() {
    setState({ status: "submitting" });
    try {
      const res = await fetch(`/api/admin/box-photos/${photo.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.status === 200) {
        router.refresh();
        return;
      }
      setState({ status: "error", message: genericErrorMessage });
    } catch {
      setState({ status: "error", message: genericErrorMessage });
    }
  }

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* clay-100/700: this codebase's established "informational emphasis" badge pairing — same as SubmissionsReviewView's closure-report badge. */}
          {isFlagged && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-[var(--color-clay-100)] text-[var(--color-clay-700)]">
              Photo reported ({photo.flag_count}×)
            </span>
          )}
          {photo.status === "pending" && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-[var(--color-sage-100)] text-[var(--color-sage-700)]">
              New photo
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--color-ink-400)]">{formatSubmittedAt(photo.created_at)}</p>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        {/* eslint-disable-next-line @next/next/no-img-element -- admin-only preview of a runtime R2 object, not a build-time asset next/image can optimize */}
        <img
          src={`/api/admin/box-photos/${photo.id}/preview`}
          alt={`Photo submitted for ${photo.venue_name}`}
          // #677 Risk: this preview is what the admin judges the photo BY —
          // wide enough to actually see on desktop (>=180px), full width on
          // phones (same "preview must be big enough to judge" spec as the
          // box edit page's own card, which reuses this exact component).
          className="h-56 w-full rounded-[var(--radius-md)] border border-[var(--color-bone-200)] object-cover sm:h-48 sm:w-48 sm:flex-none"
        />
        <div className="space-y-1">
          <p className="text-base font-semibold text-[var(--color-ink-700)]">{photo.venue_name}</p>
          {photo.checkin_kind && (
            <p className="text-sm text-[var(--color-ink-700)]">
              <span className={fieldLabelClass}>Attached to check-in: </span>
              {photo.checkin_kind}
            </p>
          )}
          {isFlagged && (
            <p className="text-sm text-[var(--color-ink-500)]">Hidden from the public card until you decide.</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleApprove}
          disabled={state.status === "submitting"}
          className={primaryButtonClass}
        >
          {state.status === "submitting" ? "Approving…" : isFlagged ? "Keep photo" : "Approve"}
        </button>
        {!rejectOpen && (
          <button
            type="button"
            onClick={() => setRejectOpen(true)}
            disabled={state.status === "submitting"}
            className={secondaryButtonClass}
          >
            {isFlagged ? "Remove photo" : "Reject"}
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
              disabled={state.status === "submitting"}
              className={dangerButtonClass}
            >
              {state.status === "submitting" ? "Saving…" : `Confirm ${isFlagged ? "remove" : "reject"}`}
            </button>
            <button
              type="button"
              onClick={() => {
                setRejectOpen(false);
                setReason("");
                setState({ status: "idle" });
              }}
              disabled={state.status === "submitting"}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.status === "error" && (
        <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">
          {state.message}
        </p>
      )}
    </div>
  );
}
