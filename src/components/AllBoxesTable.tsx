/**
 * AllBoxesTable — the /admin/boxes tab's full box list (approved mockup
 * Direction B, below the map + chart). Same "table wrapped in
 * overflow-x-auto, no card/table breakpoint swap" mobile pattern
 * VenueListView.tsx already established for /admin/places, rather than
 * inventing a second responsive convention for this app's other admin
 * table.
 *
 * No "use client": plain markup + a real navigation Link per row, same
 * reasoning BoxHealthList.tsx/StalePlacesList.tsx give for staying
 * server-renderable.
 */

import Link from "next/link";
import type { BoxHealthEntry, BoxHealthStatus } from "@/lib/boxHealth";

export interface AllBoxesTableProps {
  entries: BoxHealthEntry[];
}

// Same label/color pairing as BoxHealthList.tsx's STATUS_META, as a badge
// rather than a dot — a table row has room to spell the status out.
const STATUS_BADGE: Record<BoxHealthStatus, { label: string; className: string }> = {
  ok: { label: "OK", className: "bg-[var(--color-sage-100)] text-[var(--color-sage-700)]" },
  low: { label: "Low", className: "bg-[var(--color-clay-100)] text-[var(--color-warning)]" },
  empty: { label: "Empty", className: "bg-[var(--color-clay-100)] text-[var(--color-danger)]" },
  problem: { label: "Problem", className: "bg-[var(--color-clay-100)] text-[var(--color-clay-700)]" },
  quiet: { label: "Quiet", className: "bg-[var(--color-bone-100)] text-[var(--color-ink-500)]" },
};

function formatLastReport(entry: BoxHealthEntry): string {
  if (entry.health.daysSinceLastReport === null) return "No reports yet";
  if (entry.health.daysSinceLastReport === 0) return "Today";
  if (entry.health.daysSinceLastReport === 1) return "1 day ago";
  return `${entry.health.daysSinceLastReport} days ago`;
}

export default function AllBoxesTable({ entries }: AllBoxesTableProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white px-4 py-10 text-center">
        <p className="text-sm text-[var(--color-ink-500)]">No blessing boxes yet.</p>
      </div>
    );
  }

  return (
    <div className="elevation-1 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--color-bone-200)] text-xs uppercase tracking-wide text-[var(--color-ink-400)]">
            <th scope="col" className="px-4 py-3 font-medium">
              Box
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Status
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Last report
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Caretaker
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              <span className="sr-only">Edit</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const badge = STATUS_BADGE[entry.health.status];
            return (
              <tr key={entry.venueId} className="border-b border-[var(--color-bone-100)] last:border-b-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-[var(--color-ink-700)]">{entry.name}</p>
                  <p className="text-xs text-[var(--color-ink-500)]">{entry.address}</p>
                  {entry.removedOn && (
                    <p className="text-xs font-medium text-[var(--color-clay-700)]">Removed from service</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--color-ink-700)]">{formatLastReport(entry)}</td>
                <td className="px-4 py-3 text-[var(--color-ink-700)]">{entry.caretaker ?? "No caretaker"}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/venues/${entry.venueId}/edit`}
                    className="text-sm font-medium text-[var(--color-sage-700)] underline underline-offset-2"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
