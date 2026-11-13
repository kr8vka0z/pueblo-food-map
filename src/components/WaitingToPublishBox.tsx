"use client";

/**
 * WaitingToPublishBox — the edit page's "Waiting to publish" panel (#673
 * pt.3). Shown only for a place displayStatusOf() (src/lib/adminVenues.ts)
 * reads as `live_edits_waiting`: lists every field that differs between
 * what's on the public map right now and what Publish would ship, plus who
 * made each change (see attributeFieldChange's own header for the "You" /
 * an admin's email / "Automatic data refresh" / "Approved from Data refresh
 * by …" rules).
 *
 * Presentational only — src/app/(site)/admin/venues/[id]/edit/page.tsx computes
 * `changes` from D1 (audit_log + change_proposals) and passes them in
 * already resolved, same split as every other Server-Component-fetches /
 * Client-or-presentational-renders pair in this admin (VenueListView,
 * PublishPanel).
 *
 * #926: values are shown the way a person reads them, through the helpers
 * the change cards already use: the category's own label ("Meal Site", not
 * "meal_site") and ProposalCard's hours formatter (the diff hands hours over
 * as JSON text). A row whose two sides read the same is not a change and is
 * not shown (the diff compares raw values, so an omitted "No" and a stored
 * "No" differ there but read "No → No" here).
 *
 * WHY "use client": ProposalCard is a client module, so its formatter can
 * only be called from a client component. The edit page already ships
 * ProposalCard through SuggestionsBox, so this adds nothing to its bundle.
 */

import { categoryLabels } from "@/lib/categories";
import { formatFieldValue } from "@/components/ProposalCard";
import { clayNoticeClass } from "@/lib/adminCardStyles";
import type { VenueCategory } from "@/types/venue";

export interface WaitingToPublishChange {
  field: string;
  label: string;
  onMapNow: string;
  afterPublish: string;
  who: string;
}

export interface WaitingToPublishBoxProps {
  changes: WaitingToPublishChange[];
}

/** One side of a change as a person reads it; anything not listed here is already plain text. */
function readable(field: string, value: string): string {
  if (field === "category") return categoryLabels[value as VenueCategory] ?? value;
  if (field === "hours_weekly" || field === "hours_irregular") return formatFieldValue(field, value);
  return value;
}

export default function WaitingToPublishBox({ changes }: WaitingToPublishBoxProps) {
  const shown = changes
    .map((c) => ({ ...c, onMapNow: readable(c.field, c.onMapNow), afterPublish: readable(c.field, c.afterPublish) }))
    .filter((c) => c.onMapNow !== c.afterPublish);
  if (shown.length === 0) return null;

  return (
    <div className={clayNoticeClass}>
      <p className="font-semibold">Waiting to publish</p>
      <p className="mt-1">These changes won&apos;t show on the public map until the next Publish.</p>
      <dl className="mt-3 flex flex-col gap-3">
        {shown.map((change) => (
          <div key={change.field}>
            <dt className="font-semibold">{change.label}</dt>
            <dd className="mt-0.5">
              <span className="line-through decoration-1">{change.onMapNow}</span>
              {" → "}
              <span className="font-medium">{change.afterPublish}</span>
              <span className="block text-xs text-[var(--color-ink-500)]">Changed by {change.who}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
