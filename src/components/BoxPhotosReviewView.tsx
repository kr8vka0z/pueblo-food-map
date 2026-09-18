"use client";

/**
 * BoxPhotosReviewView — the photo moderation queue's card list (Blessing
 * Boxes slice 5). Rendered by src/app/admin/box-photos/page.tsx, which owns
 * the auth gate and the `loadReviewQueue()` read; this component is
 * presentational + interactive only, same split as SubmissionsReviewView
 * (whose card shell, button classes, and "Confirm reject with an optional
 * reason" flow this component reuses near-verbatim — same admin-surface
 * visual language, no new tokens invented).
 *
 * Each photo's bytes come from GET /api/admin/box-photos/[id]/preview (NOT
 * the public serve route — that one is approved-only and would 404 every
 * pending/flagged row this queue exists to show).
 *
 * On Approve/Reject, router.refresh() re-runs the Server Component's
 * loadReviewQueue() — the acted-on card stops matching (no longer pending
 * or flagged) and disappears from the next render, same "no local list
 * copy to reconcile" convention SubmissionsReviewView established.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminBoxPhotoRow } from "@/lib/boxPhotos";

export interface BoxPhotosReviewViewProps {
  photos: AdminBoxPhotoRow[];
}

// ─── Shared styling (reuses SubmissionsReviewView's exact classes) ─────────

const cardClass =
  "elevation-1 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-4 sm:p-5";

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

function formatSubmittedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function BoxPhotosReviewView({ photos }: BoxPhotosReviewViewProps) {
  if (photos.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white px-4 py-16 text-center">
        <p className="text-sm font-semibold text-[var(--color-ink-700)]">No photos to review</p>
        <p className="mt-1 text-sm text-[var(--color-ink-500)]">
          New uploads and reported photos will show up here.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {photos.map((photo) => (
        <li key={photo.id}>
          <BoxPhotoCard photo={photo} />
        </li>
      ))}
    </ul>
  );
}

// ─── One card + its own local action state ─────────────────────────────────

type ActionState = { status: "idle" } | { status: "submitting" } | { status: "error"; message: string };

function BoxPhotoCard({ photo }: { photo: AdminBoxPhotoRow }) {
  const router = useRouter();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<ActionState>({ status: "idle" });

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
          {photo.status === "flagged" && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-[var(--color-clay-100)] text-[var(--color-clay-700)]">
              Reported ({photo.flag_count}×)
            </span>
          )}
          {photo.status === "pending" && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-[var(--color-sage-100)] text-[var(--color-sage-700)]">
              New upload
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
          className="h-48 w-full rounded-[var(--radius-md)] border border-[var(--color-bone-200)] object-cover sm:h-32 sm:w-32 sm:flex-none"
        />
        <div className="space-y-1">
          <p className="text-base font-semibold text-[var(--color-ink-700)]">{photo.venue_name}</p>
          {photo.checkin_kind && (
            <p className="text-sm text-[var(--color-ink-700)]">
              <span className={fieldLabelClass}>Attached to check-in: </span>
              {photo.checkin_kind}
            </p>
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
          {state.status === "submitting" ? "Approving…" : "Approve"}
        </button>
        {!rejectOpen && (
          <button
            type="button"
            onClick={() => setRejectOpen(true)}
            disabled={state.status === "submitting"}
            className={secondaryButtonClass}
          >
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
              {state.status === "submitting" ? "Rejecting…" : "Confirm reject"}
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
