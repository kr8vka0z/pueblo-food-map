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
 * fields; it only needs an id, a name (for the confirm question), and
 * whether the venue is already archived.
 *
 * The confirm is the admin's shared on-page box (AdminConfirm, #926
 * decision 7), not the browser's own pop-up: it opens right where the
 * button was, names the place, says what happens and what does not, and
 * puts Cancel first. The archive POST goes only from the box's second
 * button, the same gate the pop-up used to be.
 *
 * Red (`--color-danger`) because it is the one destructive action on the
 * page (DESIGN.md "one clear accent per role": sage = interactive, clay =
 * informational emphasis, orange = the one Add place button, danger =
 * destructive); the class comes from the shared dangerButtonClass.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminConfirm, { useAdminConfirm } from "@/components/AdminConfirm";
import { dangerButtonClass } from "@/lib/adminCardStyles";

export interface ArchiveVenueButtonProps {
  venueId: string;
  venueName: string;
  /** When true, the venue is already archived — render an informational
   *  state instead of an actionable button (there is nothing to confirm). */
  alreadyArchived: boolean;
  /** What the confirm promises. A blessing box is live (no Publish), so
   *  archiving one takes it off the map at once (src/lib/blessingBoxes.ts:
   *  the live box reads skip archived rows); a place waits for the next
   *  publish. Defaults to "place". */
  kind?: "place" | "box";
}

export default function ArchiveVenueButton({
  venueId,
  venueName,
  alreadyArchived,
  kind = "place",
}: ArchiveVenueButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const { asking, ask, cancel, triggerRef } = useAdminConfirm();

  async function handleConfirm() {
    setStatus("submitting");
    try {
      const res = await fetch(`/api/admin/venues/${venueId}/archive`, { method: "POST" });
      if (res.status === 200) {
        // Back to the venue list (/admin/places, moved from /admin in the
        // admin dashboard build), not the Dashboard. The box stays busy
        // until the page changes, so it can't be pressed twice.
        router.push("/admin/places");
        router.refresh();
        return;
      }
      setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  // WHY reset the status here: a reopened box must not show the last
  // attempt's failure line.
  function handleCancel() {
    setStatus("idle");
    cancel();
  }

  if (alreadyArchived) {
    return <p className="text-sm text-[var(--color-ink-500)]">This place is removed from the map.</p>;
  }

  return (
    <div>
      <button type="button" ref={triggerRef} hidden={asking} onClick={ask} className={dangerButtonClass}>
        Remove from map
      </button>
      {asking && (
        <AdminConfirm
          title={`Remove ${venueName} from the map?`}
          confirmLabel="Remove from map"
          busyLabel="Removing…"
          tone="danger"
          busy={status === "submitting"}
          error={status === "error" ? "The place was not removed. Try again." : null}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        >
          {kind === "box"
            ? "It leaves the map right away. Its record is kept, not deleted, and this can be reviewed later."
            : "It will stop appearing on the next publish. Its record is kept, not deleted, and this can be reviewed later."}
        </AdminConfirm>
      )}
    </div>
  );
}
