"use client";

/**
 * BoxCheckinsAdminPanel — the check-in list on a blessing box's admin edit
 * screen (Blessing Boxes slice 2, Discovery C7/C9: "As the admin, I want to
 * hide any check-in or note after the fact"). Rendered only when
 * `venue.category === 'blessing_box'` (see
 * src/app/admin/venues/[id]/edit/page.tsx's resolveBoxCheckins()) — an
 * ordinary venue has no box_checkins rows to show.
 *
 * Shows EVERY check-in — hidden ones and 'problem' reports included, unlike
 * the public feed — since this is the one screen a 'problem' report is
 * meant to reach (see the checkins route handler's own header: problem
 * reports are admin-only, never public). Each row gets a Hide/Unhide toggle
 * calling POST /api/admin/box-checkins/[id]/visibility (that route's own
 * atomic db.batch() writes the flip AND its audit_log row together — this
 * component fires the request and, on success, calls router.refresh() so
 * the Server Component page re-fetches the row list, same convention
 * ArchiveVenueButton and SubmissionsReviewView already use rather than
 * holding a local copy of the list to reconcile by hand).
 *
 * No permission levels (Kyle's decision) — any signed-in admin can toggle
 * any row; the audit_log entry IS the accountability record, not a role
 * check on this button.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminCheckinRow } from "@/lib/blessingBoxes";

interface BoxCheckinsAdminPanelProps {
  checkins: AdminCheckinRow[];
}

const KIND_LABEL: Record<AdminCheckinRow["kind"], string> = {
  filled: "Filled",
  took: "Used the box",
  low: "Running low",
  empty: "Empty",
  problem: "Problem report",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export default function BoxCheckinsAdminPanel({ checkins }: BoxCheckinsAdminPanelProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [errorId, setErrorId] = useState<number | null>(null);

  async function toggleVisibility(row: AdminCheckinRow) {
    const nextVisibility = row.visibility === "visible" ? "hidden" : "visible";
    setPendingId(row.id);
    setErrorId(null);
    try {
      const res = await fetch(`/api/admin/box-checkins/${row.id}/visibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: nextVisibility }),
      });
      if (res.status === 200) {
        router.refresh();
        return;
      }
      setErrorId(row.id);
    } catch {
      setErrorId(row.id);
    } finally {
      setPendingId(null);
    }
  }

  if (checkins.length === 0) {
    return <p className="text-sm text-[var(--color-ink-500)]">No check-ins yet.</p>;
  }

  return (
    <ul className="divide-y divide-[var(--color-bone-200)]">
      {checkins.map((row) => (
        <li key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--color-ink-700)]">
              {KIND_LABEL[row.kind]}
              {row.kind === "problem" && (
                <span className="ml-2 rounded bg-[var(--color-danger)]/10 px-1.5 py-0.5 text-xs font-medium text-[var(--color-danger)]">
                  Admin only
                </span>
              )}
              {row.visibility === "hidden" && (
                <span className="ml-2 rounded bg-[var(--color-bone-100)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-ink-500)]">
                  Hidden
                </span>
              )}
            </p>
            <p className="text-xs text-[var(--color-ink-400)]">
              {dateFormatter.format(new Date(row.created_at))}
              {row.hidden_by && ` · hidden by ${row.hidden_by}`}
            </p>
            {row.note && <p className="mt-1 text-sm text-[var(--color-ink-700)]">{row.note}</p>}
            {errorId === row.id && (
              <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">
                Something went wrong. Try again.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => toggleVisibility(row)}
            disabled={pendingId === row.id}
            className={
              "shrink-0 rounded-[var(--radius-md)] border border-[var(--color-bone-300)] px-3 py-1.5 " +
              "text-sm font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-bone-100)] " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
              "disabled:opacity-50 disabled:cursor-not-allowed"
            }
          >
            {pendingId === row.id ? "Saving…" : row.visibility === "visible" ? "Hide" : "Unhide"}
          </button>
        </li>
      ))}
    </ul>
  );
}
