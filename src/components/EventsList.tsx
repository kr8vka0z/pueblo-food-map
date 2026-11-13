"use client";

/**
 * EventsList — the body of /admin/events (#757): a table of events (name,
 * date in Pueblo time, status, edit link), the "No events yet" empty state
 * with an Add event button, and a "couldn't load" state with Retry.
 *
 * The server page does the read and passes `events` (null when the read
 * failed). A failed read is expected until the `events` migration reaches an
 * environment, so it is a calm in-page message, never a crash. Retry is
 * router.refresh() — it re-runs the server read; useTransition drives the
 * "Loading…" text while it does (the first load is covered by the admin
 * segment's loading.tsx). Not a layout/auth component: it holds no session.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import { formatEventWhen } from "@/lib/eventTime";
import { cardClass, secondaryButtonClass, tableWrapClass, tagClass, tapLinkClass, type TagTone } from "@/lib/adminCardStyles";
import { ADMIN_PRIMARY_BUTTON } from "@/components/formClasses";
import type { EventListItem } from "@/lib/adminEventReads";
import type { EventStatus } from "@/lib/adminEventValidation";

interface EventsListProps {
  /** null = the read failed. */
  events: EventListItem[] | null;
}

const STATUS_LABEL: Record<EventStatus, string> = {
  draft: "Draft",
  published: "Published",
  cancelled: "Cancelled",
  archived: "Archived",
};

const STATUS_TONE: Record<EventStatus, TagTone> = {
  draft: "neutral",
  published: "calm",
  cancelled: "attention",
  archived: "quiet",
};

// SHARED-GAP: a red-edged failure box (role="alert" panel). cardClass carries
// a bone 200 edge, and appending a red border would fight it in stylesheet order.
const failureBoxClass = "rounded-[var(--radius-lg)] border border-[var(--color-danger)] bg-white p-4";

export default function EventsList({ events }: EventsListProps) {
  const router = useRouter();
  const [isRetrying, startRetry] = useTransition();
  // Prefix for the per-row ids the Edit links' names point at (above the early returns: hooks rule).
  const rowId = useId();

  if (isRetrying) {
    return (
      <p role="status" className="text-sm text-[var(--color-ink-400)] motion-safe:animate-pulse">
        Loading…
      </p>
    );
  }

  if (events === null) {
    return (
      <div role="alert" className={`max-w-xl ${failureBoxClass}`}>
        <p className="text-sm font-medium text-[var(--color-danger)]">Couldn&rsquo;t load events.</p>
        <p className="mt-1 text-sm text-[var(--color-ink-500)]">Check your connection and try again.</p>
        <button type="button" onClick={() => startRetry(() => router.refresh())} className={`mt-3 ${secondaryButtonClass}`}>
          Retry
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={`max-w-xl ${cardClass}`}>
        <p className="text-base font-medium text-[var(--color-ink-900)]">No events yet</p>
        <p className="mt-1 text-sm text-[var(--color-ink-500)]">
          Add a one-day giveaway, a turkey drive or a pop-up distribution.
        </p>
        <Link href="/admin/events/new" className={`mt-4 ${ADMIN_PRIMARY_BUTTON}`}>
          Add event
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/admin/events/new" className={ADMIN_PRIMARY_BUTTON}>
          Add event
        </Link>
      </div>
      <div className={tableWrapClass}>
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="border-b border-[var(--color-bone-200)] text-[var(--color-ink-500)]">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Event</th>
              <th scope="col" className="px-4 py-3 font-medium">Starts (Pueblo time)</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Edit</span></th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={e.id} className="border-b border-[var(--color-bone-100)] last:border-b-0">
                <td id={`${rowId}-${i}-name`} className="px-4 py-3 font-medium text-[var(--color-ink-900)]">
                  {e.name}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--color-ink-700)]">{formatEventWhen(e.starts_at)}</td>
                <td className="px-4 py-3">
                  <span className={tagClass(STATUS_TONE[e.status])}>{STATUS_LABEL[e.status]}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {/* WHY aria-labelledby, not aria-label: the name ("Edit <event>") is built from visible text,
                      so no stored text goes into an attribute. */}
                  <Link
                    id={`${rowId}-${i}-edit`}
                    href={`/admin/events/${e.id}/edit`}
                    className={tapLinkClass}
                    aria-labelledby={`${rowId}-${i}-edit ${rowId}-${i}-name`}
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
