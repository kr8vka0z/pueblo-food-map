"use client";

/**
 * SponsorRequestCard — one box-adoption application's moderation card: the
 * applicant's public name, private email, note and sent date, plus Approve
 * sponsor/Decline (or Remove, for an already-approved sponsor) with an
 * optional reason (issue #677, "fold Photo review and Sponsor requests into
 * the Blessing Boxes tab").
 *
 * Extracted from BoxAdoptersReviewView.tsx's inner BoxAdopterCard — same
 * card shell, button classes and reject-reason flow (verbatim, including
 * the fetch call that actually sends `{ reason }`, unlike
 * ProposalCard.tsx's postAction() which drops it). Now renders in TWO
 * places: this tab's own review view (until #677 removes it) and, going
 * forward, the box edit page's "Things to review" box (BoxReviewBox.tsx).
 *
 * On Approve/Reject, router.refresh() re-runs the caller's Server
 * Component read — same "no local list copy to reconcile" convention every
 * other admin queue in this app already uses.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminRejectStep, useAdminStep } from "@/components/AdminConfirm";
import type { AdminBoxAdopterRow } from "@/lib/boxAdopters";
import {
  cardClass,
  cardNameClass,
  failureLineClass,
  fieldLabelClass,
  formatSubmittedAt,
  linkClass,
  primaryButtonClass,
  secondaryButtonClass,
  tagClass,
} from "@/lib/adminCardStyles";

export interface SponsorRequestCardProps {
  adopter: AdminBoxAdopterRow;
}

// `action` says which button is working, so only that one reads "Approving…"
// or "Saving…" (both stay disabled either way).
type ActionState =
  | { status: "idle" }
  | { status: "submitting"; action: "approve" | "reject" }
  | { status: "error"; message: string };

export default function SponsorRequestCard({ adopter }: SponsorRequestCardProps) {
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

  const reasonFieldId = `adopter-reject-reason-${adopter.id}`;
  const isApproved = adopter.status === "approved";
  const confirmRejectLabel = isApproved ? "Confirm remove" : "Confirm decline";
  // #926 decision 15: an error says what did NOT happen, then what to do.
  const approveErrorMessage = "The sponsor was not approved. Try again.";
  const rejectErrorMessage = isApproved
    ? "The sponsor was not removed. Try again."
    : "The request was not declined. Try again.";
  const unconfirmedErrorMessage =
    "This applicant hasn't confirmed their email yet, so they can't be approved until they do.";

  async function handleApprove() {
    setState({ status: "submitting", action: "approve" });
    try {
      const res = await fetch(`/api/admin/box-adopters/${adopter.id}/approve`, { method: "POST" });
      if (res.status === 200) {
        router.refresh();
        return;
      }
      if (res.status === 409) {
        setState({ status: "error", message: unconfirmedErrorMessage });
        return;
      }
      setState({ status: "error", message: approveErrorMessage });
    } catch {
      setState({ status: "error", message: approveErrorMessage });
    }
  }

  async function handleConfirmReject() {
    setState({ status: "submitting", action: "reject" });
    try {
      const res = await fetch(`/api/admin/box-adopters/${adopter.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.status === 200) {
        router.refresh();
        return;
      }
      setState({ status: "error", message: rejectErrorMessage });
    } catch {
      setState({ status: "error", message: rejectErrorMessage });
    }
  }

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className={tagClass(adopter.email_confirmed_at ? "calm" : "attention")}>
          {adopter.email_confirmed_at ? "Email confirmed" : "Awaiting email confirmation"}
        </span>
        <p className="text-xs text-[var(--color-ink-400)]">{formatSubmittedAt(adopter.created_at)}</p>
      </div>

      <div className="mt-3 space-y-1">
        <p className={cardNameClass}>{adopter.venue_name}</p>
        <p className="text-sm text-[var(--color-ink-700)]">
          <span className={fieldLabelClass}>Name: </span>
          {adopter.display_name}
        </p>
        <p className="text-sm text-[var(--color-ink-700)]">
          <span className={fieldLabelClass}>Email: </span>
          <a href={`mailto:${adopter.email}`} className={`${linkClass} break-words`}>
            {adopter.email}
          </a>
        </p>
        {adopter.note && (
          <p className="text-sm text-[var(--color-ink-700)]">
            <span className={fieldLabelClass}>Note: </span>
            {adopter.note}
          </p>
        )}
        {/* #677 spec: the box edit page and this tab both need this line so
            "Approve" reads as a real public-facing consequence, not just a
            status flip. */}
        <p className="text-sm text-[var(--color-ink-500)]">
          Approving adds them to &ldquo;Sponsored by …&rdquo; on the public card.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleApprove}
          disabled={state.status === "submitting"}
          className={primaryButtonClass}
        >
          {state.status === "submitting" && state.action === "approve" ? "Approving…" : "Approve sponsor"}
        </button>
        <button
          ref={rejectRef}
          type="button"
          hidden={rejectOpen}
          onClick={openReject}
          disabled={state.status === "submitting"}
          className={secondaryButtonClass}
        >
          {isApproved ? "Remove" : "Decline"}
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
          // "Saving…" only while the decline itself runs; an Approve running keeps the plain label.
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
