"use client";

/**
 * PhotoReviewCard — one box photo's moderation card: a preview, a status
 * badge, and Approve/Reject (pending) or Keep photo/Remove photo (flagged),
 * with an optional reject/remove reason (issue #677, "fold Photo review and
 * Sponsor requests into the Blessing Boxes tab").
 *
 * Extracted from BoxPhotosReviewView.tsx's inner BoxPhotoCard — same card
 * shell, button classes and reject-reason flow. Now renders in TWO places: this tab's own review views
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

import { busyButtonProps } from "@/components/formClasses";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminRejectStep, useAdminStep } from "@/components/AdminConfirm";
import { KIND_LABEL } from "@/components/BoxCheckinsAdminPanel";
import type { AdminBoxPhotoRow } from "@/lib/boxPhotos";
import {
  cardClass,
  cardNameClass,
  failureLineClass,
  fieldLabelClass,
  formatSubmittedAt,
  primaryButtonClass,
  secondaryButtonClass,
  tagClass,
} from "@/lib/adminCardStyles";

export interface PhotoReviewCardProps {
  photo: AdminBoxPhotoRow;
}

// `action` says which button is working, so only that one reads "Approving…"
// or "Saving…" (both stay disabled either way).
type ActionState =
  | { status: "idle" }
  | { status: "submitting"; action: "approve" | "reject" }
  | { status: "error"; message: string };

export default function PhotoReviewCard({ photo }: PhotoReviewCardProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [state, setState] = useState<ActionState>({ status: "idle" });
  // Focus goes to the reason box on open and back to the button on Cancel (#926).
  const { open: rejectOpen, openStep: openReject, closeStep: closeReject, triggerRef: rejectRef, fieldRef: reasonRef } =
    useAdminStep({ busy: state.status === "submitting", onCancel: cancelReject });

  // The step's Cancel; Escape runs it too, so the typed reason is cleared either way.
  function cancelReject() {
    setReason("");
    setState({ status: "idle" });
    closeReject();
  }

  const isFlagged = photo.status === "flagged";
  const reasonFieldId = `photo-reject-reason-${photo.id}`;
  const confirmRejectLabel = isFlagged ? "Confirm remove" : "Confirm reject";
  // #926 decision 15: an error says what did NOT happen, then what to do.
  const errorMessage = {
    approve: isFlagged ? "The photo was not kept. Try again." : "The photo was not approved. Try again.",
    reject: isFlagged ? "The photo was not removed. Try again." : "The photo was not rejected. Try again.",
  };

  // Approve sends no body; reject sends `{ reason }`. Anything but a 200
  // (or a network error) shows that action's error line.
  async function act(path: "approve" | "reject", body?: { reason: string }) {
    setState({ status: "submitting", action: path });
    try {
      const res = await fetch(`/api/admin/box-photos/${photo.id}/${path}`, {
        method: "POST",
        ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
      });
      if (res.status === 200) {
        router.refresh();
        return;
      }
    } catch {
      // fall through to the error state
    }
    setState({ status: "error", message: errorMessage[path] });
  }

  const handleApprove = () => act("approve");
  const handleConfirmReject = () => act("reject", { reason });

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* clay-100/700: this codebase's established "informational emphasis" badge pairing — same as SubmissionCard's "Public report" badge. */}
          {isFlagged && <span className={tagClass("attention")}>Photo reported ({photo.flag_count}×)</span>}
          {photo.status === "pending" && <span className={tagClass("calm")}>New photo</span>}
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
          <p className={cardNameClass}>{photo.venue_name}</p>
          {photo.checkin_kind && (
            <p className="text-sm text-[var(--color-ink-700)]">
              <span className={fieldLabelClass}>Attached to check-in: </span>
              {/* The Check-ins list's own words ("Problem report"), never the stored code. */}
              {KIND_LABEL[photo.checkin_kind as keyof typeof KIND_LABEL] ?? photo.checkin_kind}
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
          {...busyButtonProps(state.status === "submitting")}
          className={primaryButtonClass}
        >
          {state.status === "submitting" && state.action === "approve"
            ? "Approving…"
            : isFlagged
              ? "Keep photo"
              : "Approve"}
        </button>
        <button
          ref={rejectRef}
          type="button"
          hidden={rejectOpen}
          onClick={openReject}
          disabled={state.status === "submitting"}
          className={secondaryButtonClass}
        >
          {isFlagged ? "Remove photo" : "Reject"}
        </button>
      </div>

      {rejectOpen && (
        <AdminRejectStep
          id={reasonFieldId}
          fieldRef={reasonRef}
          reason={reason}
          onReason={setReason}
          busy={state.status === "submitting"}
          confirmLabel={confirmRejectLabel}
          // "Saving…" only while the reject itself runs; an Approve running keeps the plain label.
          busyLabel={state.status === "submitting" && state.action === "reject" ? "Saving…" : confirmRejectLabel}
          onCancel={cancelReject}
          onConfirm={handleConfirmReject}
        />
      )}

      {state.status === "error" && (
        <p role="alert" className={`mt-2 ${failureLineClass}`}>
          {state.message}
        </p>
      )}
    </div>
  );
}
