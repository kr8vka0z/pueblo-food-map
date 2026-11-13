"use client";

/**
 * BoxCheckinsAdminPanel — the check-in list on a blessing box's admin edit
 * screen (Blessing Boxes slice 2, Discovery C7/C9: "As the admin, I want to
 * hide any check-in or note after the fact"). Rendered only when
 * `venue.category === 'blessing_box'` (see
 * src/app/(site)/admin/venues/[id]/edit/page.tsx) — an
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

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { parseAdminNeeds, type AdminCheckinRow } from "@/lib/blessingBoxes";
import { t } from "@/lib/i18n";
import { secondaryButtonClass, tagClass } from "@/lib/adminCardStyles";

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
  const idPrefix = useId();
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
    return (
      <div>
        <p className="text-sm text-[var(--color-ink-500)]">No check-ins yet.</p>
        <p className="text-sm text-[var(--color-ink-500)]">
          They show up here when someone reports on this box from its card on the map.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[var(--color-bone-200)]">
      {checkins.map((row) => {
        // The button's name says which check-in it acts on ("Hide Filled
        // Sep 17, 2026, 12:00 PM") through aria-labelledby pointing at this
        // row's visible kind and date, never an aria-label built from text.
        const buttonId = `${idPrefix}-${row.id}-button`;
        const kindId = `${idPrefix}-${row.id}-kind`;
        const dateId = `${idPrefix}-${row.id}-date`;
        return (
          <li key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-ink-700)]">
                <span id={kindId}>{KIND_LABEL[row.kind]}</span>
                {row.kind === "problem" && <span className={`ml-2 ${tagClass("attention")}`}>Admin only</span>}
                {row.visibility === "hidden" && <span className={`ml-2 ${tagClass("quiet")}`}>Hidden</span>}
              </p>
              <p className="text-xs text-[var(--color-ink-400)]">
                <span id={dateId} className="whitespace-nowrap">{dateFormatter.format(new Date(row.created_at))}</span>
                {row.hidden_by && ` · hidden by ${row.hidden_by}`}
              </p>
              {row.note && <p className="mt-1 text-sm text-[var(--color-ink-700)]">{row.note}</p>}
              {/* Needs labels come from the public card's i18n keys; this
                  panel is English-only (see dateFormatter), so always "en". */}
              {parseAdminNeeds(row.needs).length > 0 && (
                <p className="mt-1 text-xs text-[var(--color-ink-500)]">
                  Needs: {parseAdminNeeds(row.needs).map((k) => t(`box.needs.${k}`, "en")).join(", ")}
                </p>
              )}
              {errorId === row.id && (
                <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">
                  {row.visibility === "visible"
                    ? "The check-in was not hidden. Try again."
                    : "The check-in is still hidden. Try again."}
                </p>
              )}
            </div>
            <button
              id={buttonId}
              type="button"
              aria-labelledby={`${buttonId} ${kindId} ${dateId}`}
              onClick={() => toggleVisibility(row)}
              disabled={pendingId === row.id}
              className={`${secondaryButtonClass} shrink-0`}
            >
              {pendingId === row.id ? "Saving…" : row.visibility === "visible" ? "Hide" : "Unhide"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
