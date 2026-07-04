"use client";

/**
 * ArchiveVenueButton — the "Remove from map" action on the venue edit page
 * (#255, AC2).
 *
 * A small, separate Client Component rather than folding this into
 * AddVenueForm: archive only makes sense in edit mode, and AddVenueForm is
 * deliberately kept as ONE component shared with create mode (see its own
 * header) — bolting an archive-only branch onto it would undo that DRY
 * move for no benefit. This component owns nothing about the venue's other
 * fields; it only needs an id, a name (for the confirm message), and
 * whether the venue is already archived.
 *
 * WHY a native window.confirm() and not a custom modal: it IS a confirm
 * dialog (the literal acceptance criterion), needs no new dependency, and
 * this codebase has no existing modal/dialog component to reuse (vaul is
 * used only for the public map's mobile BottomSheet drawer, an unrelated
 * concern) — matching CLAUDE.md's ponytail default of using the smallest
 * thing that satisfies the requirement.
 *
 * Danger-zone styling reaches for the `--color-danger` token
 * (globals.css @theme / DESIGN.md "Semantic" colors) rather than a literal
 * Tailwind red utility — that token is already defined and drift-checked
 * but had no consumer yet; this is its first and, so far, only use, kept to
 * this one destructive action per DESIGN.md's "one clear accent per role"
 * convention (sage = interactive, clay = informational emphasis, orange =
 * the one primary CTA per screen, danger = destructive).
 *
 * #270: an optional `submissionId` prop lets this button double as the
 * approve action for a pending closure report reviewed from
 * /admin/venues/[id]/edit's `?submission=<id>` context. When present, it's
 * sent as a JSON body `{ submissionId }` — the archive route already
 * accepts this optional field and, in the SAME atomic batch as the status
 * flip, marks that closure submission approved (see that route's header;
 * same technique SubmissionsReviewView's closure card used before #270
 * moved that action to this edit-page flow). Redirecting back to the
 * review queue (rather than the venue list) afterward completes that loop.
 * When absent, every part of this component behaves exactly as before
 * #270 — this is additive, not a fork.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ArchiveVenueButtonProps {
  venueId: string;
  venueName: string;
  /** When true, the venue is already archived — render an informational
   *  state instead of an actionable button (there is nothing to confirm). */
  alreadyArchived: boolean;
  /** #270: set when reviewing a pending closure report (see file header). */
  submissionId?: number;
}

const dangerButtonClass =
  "inline-flex items-center rounded-[var(--radius-md)] border border-[var(--color-danger)] " +
  "px-3 py-1.5 text-sm font-medium text-[var(--color-danger)] bg-transparent " +
  "transition-colors duration-150 hover:bg-[var(--color-danger)] hover:text-[var(--color-bone-50)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)] focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export default function ArchiveVenueButton({
  venueId,
  venueName,
  alreadyArchived,
  submissionId,
}: ArchiveVenueButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");

  async function handleClick() {
    const confirmed = window.confirm(
      `Remove "${venueName}" from the map? It will stop appearing on the next publish, but its record ` +
        `is kept, not deleted, and this can be reviewed later.`,
    );
    if (!confirmed) return;

    setStatus("submitting");
    try {
      const res = await fetch(
        `/api/admin/venues/${venueId}/archive`,
        submissionId != null
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ submissionId }),
            }
          : { method: "POST" },
      );
      if (res.status === 200) {
        router.push(submissionId != null ? "/admin/submissions" : "/admin");
        router.refresh();
        return;
      }
      setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  if (alreadyArchived) {
    return <p className="text-sm text-[var(--color-ink-500)]">This venue is removed from the map.</p>;
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={status === "submitting"} className={dangerButtonClass}>
        {status === "submitting" ? "Removing…" : "Remove from map"}
      </button>
      {status === "error" && (
        <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">
          Something went wrong. The venue was not removed. Try again.
        </p>
      )}
    </div>
  );
}
