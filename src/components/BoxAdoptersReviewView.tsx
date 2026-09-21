"use client";

/**
 * BoxAdoptersReviewView — the adopt-a-box moderation queue's card list
 * (Blessing Boxes slice 6). Rendered by src/app/admin/box-adopters/page.tsx,
 * which owns the auth gate and the loadPendingAdopters() read; this
 * component is presentational + interactive only — same split, same card
 * shell, and near-verbatim reuse of the button/reject-reason classes as
 * BoxPhotosReviewView.tsx (see that file's own header for the shared
 * admin-surface visual language this reuses rather than reinventing).
 *
 * On Approve/Reject, router.refresh() re-runs the Server Component's
 * loadPendingAdopters() — the acted-on card stops matching (no longer
 * pending) and disappears from the next render, same "no local list copy to
 * reconcile" convention every other admin queue in this app already uses.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminBoxAdopterRow } from "@/lib/boxAdopters";

export interface BoxAdoptersReviewViewProps {
  adopters: AdminBoxAdopterRow[];
}

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

export default function BoxAdoptersReviewView({ adopters }: BoxAdoptersReviewViewProps) {
  if (adopters.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white px-4 py-16 text-center">
        <p className="text-sm font-semibold text-[var(--color-ink-700)]">No adoption requests to review</p>
        <p className="mt-1 text-sm text-[var(--color-ink-500)]">New applications will show up here.</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {adopters.map((adopter) => (
        <li key={adopter.id}>
          <BoxAdopterCard adopter={adopter} />
        </li>
      ))}
    </ul>
  );
}

type ActionState = { status: "idle" } | { status: "submitting" } | { status: "error"; message: string };

function BoxAdopterCard({ adopter }: { adopter: AdminBoxAdopterRow }) {
  const router = useRouter();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<ActionState>({ status: "idle" });

  const reasonFieldId = `adopter-reject-reason-${adopter.id}`;
  const genericErrorMessage = "Something went wrong. Try again.";
  const unconfirmedErrorMessage = "This applicant hasn't confirmed their email yet — approve is refused until they do.";

  async function handleApprove() {
    setState({ status: "submitting" });
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
      setState({ status: "error", message: genericErrorMessage });
    } catch {
      setState({ status: "error", message: genericErrorMessage });
    }
  }

  async function handleConfirmReject() {
    setState({ status: "submitting" });
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
      setState({ status: "error", message: genericErrorMessage });
    } catch {
      setState({ status: "error", message: genericErrorMessage });
    }
  }

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span
          className={
            "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium " +
            (adopter.email_confirmed_at
              ? "bg-[var(--color-sage-100)] text-[var(--color-sage-700)]"
              : "bg-[var(--color-clay-100)] text-[var(--color-clay-700)]")
          }
        >
          {adopter.email_confirmed_at ? "Email confirmed" : "Awaiting email confirmation"}
        </span>
        <p className="text-xs text-[var(--color-ink-400)]">{formatSubmittedAt(adopter.created_at)}</p>
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-base font-semibold text-[var(--color-ink-700)]">{adopter.venue_name}</p>
        <p className="text-sm text-[var(--color-ink-700)]">
          <span className={fieldLabelClass}>Name: </span>
          {adopter.display_name}
        </p>
        <p className="text-sm text-[var(--color-ink-700)]">
          <span className={fieldLabelClass}>Email: </span>
          <a href={`mailto:${adopter.email}`} className="underline underline-offset-2">
            {adopter.email}
          </a>
        </p>
        {adopter.note && (
          <p className="text-sm text-[var(--color-ink-700)]">
            <span className={fieldLabelClass}>Note: </span>
            {adopter.note}
          </p>
        )}
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
            {adopter.status === "approved" ? "Remove" : "Reject"}
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
              {state.status === "submitting" ? "Saving…" : `Confirm ${adopter.status === "approved" ? "remove" : "reject"}`}
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
