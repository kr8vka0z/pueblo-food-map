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
 */

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

export default function WaitingToPublishBox({ changes }: WaitingToPublishBoxProps) {
  if (changes.length === 0) return null;

  return (
    <div className="max-w-2xl rounded-[var(--radius-lg)] border border-[var(--color-clay-500)] bg-[var(--color-clay-100)] px-4 py-3 text-sm text-[var(--color-clay-700)]">
      <p className="font-semibold">Waiting to publish</p>
      <p className="mt-1">These changes won&apos;t show on the public map until the next Publish.</p>
      <dl className="mt-3 flex flex-col gap-3">
        {changes.map((change) => (
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
