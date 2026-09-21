/**
 * StalePlacesList — the /admin Dashboard's "Places due for a check" panel
 * (Dashboard-only per the task spec — the /admin/boxes tab does not show
 * this; boxes are excluded from src/lib/adminDashboard.ts's
 * selectStalePlaces in the first place, since a box's health signal is
 * check-ins, not a hand-verified `last_verified` date).
 *
 * No "use client": plain markup + a real navigation Link, same reasoning
 * BoxHealthList.tsx gives for staying server-renderable.
 */

import Link from "next/link";
import { categoryColors } from "@/data/venues";
import type { StalePlace } from "@/lib/adminDashboard";
import { formatLastVerified } from "@/lib/adminVenues";

export interface StalePlacesListProps {
  items: StalePlace[];
  totalCount: number;
}

function pluralizeMonths(months: number): string {
  return `${months} month${months === 1 ? "" : "s"}`;
}

export default function StalePlacesList({ items, totalCount }: StalePlacesListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--color-ink-500)]">Every published place has been checked recently.</p>;
  }

  return (
    <div>
      <ul className="flex flex-col gap-2">
        {items.map((place) => (
          <li key={place.id}>
            <Link
              href={`/admin/venues/${place.id}/edit`}
              className="flex min-h-11 items-start gap-2 rounded-[var(--radius-md)] px-2 py-1.5 -mx-2 transition-colors duration-150 hover:bg-[var(--color-bone-100)]"
            >
              <span
                className="mt-1.5 h-2 w-2 flex-none rounded-full"
                style={{ backgroundColor: categoryColors[place.category] }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-[var(--color-ink-700)]">{place.name}</span>
                <span className="block text-xs text-[var(--color-ink-500)]">
                  last checked {formatLastVerified(place.lastVerified)} ({pluralizeMonths(place.monthsSince)} ago)
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {totalCount > items.length && (
        <Link
          href="/admin/places"
          className="mt-2 inline-block text-sm font-medium text-[var(--color-sage-700)] underline underline-offset-2"
        >
          See all {totalCount} →
        </Link>
      )}
    </div>
  );
}
