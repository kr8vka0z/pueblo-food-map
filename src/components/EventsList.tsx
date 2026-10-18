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
import { useTransition } from "react";
import { formatEventWhen } from "@/lib/eventTime";
import type { EventListItem } from "@/lib/adminEventReads";
import type { EventStatus } from "@/lib/adminEventValidation";

export interface EventsListProps {
  /** null = the read failed. */
  events: EventListItem[] | null;
}

const STATUS_LABEL: Record<EventStatus, string> = {
  draft: "Draft",
  published: "Published",
  cancelled: "Cancelled",
  archived: "Archived",
};

const STATUS_CLASS: Record<EventStatus, string> = {
  draft: "bg-[var(--color-bone-200)] text-[var(--color-ink-700)]",
  published: "bg-[var(--color-sage-100)] text-[var(--color-sage-700)]",
  cancelled: "bg-[var(--color-clay-100)] text-[var(--color-clay-700)]",
  archived: "bg-[var(--color-bone-100)] text-[var(--color-ink-500)]",
};

const primaryLinkClass =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] " +
  "bg-[var(--color-sage-600)] px-4 text-base font-semibold text-[var(--color-bone-50)] " +
  "transition-colors duration-150 hover:bg-[var(--color-sage-700)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2";

export default function EventsList({ events }: EventsListProps) {
  const router = useRouter();
  const [isRetrying, startRetry] = useTransition();

  if (isRetrying) {
    return (
      <p role="status" className="text-sm text-[var(--color-ink-400)] motion-safe:animate-pulse">
        Loading…
      </p>
    );
  }

  if (events === null) {
    return (
      <div role="alert" className="max-w-xl rounded-[var(--radius-lg)] border border-[var(--color-danger)] bg-white p-4">
        <p className="text-sm font-medium text-[var(--color-danger)]">Couldn&rsquo;t load events.</p>
        <p className="mt-1 text-sm text-[var(--color-ink-500)]">Check your connection and try again.</p>
        <button
          type="button"
          onClick={() => startRetry(() => router.refresh())}
          className={
            "mt-3 inline-flex min-h-11 items-center rounded-[var(--radius-md)] border border-[var(--color-danger)] " +
            "bg-white px-4 text-sm font-medium text-[var(--color-danger)] transition-colors duration-150 " +
            "hover:bg-[var(--color-bone-100)] focus-visible:outline-none focus-visible:ring-2 " +
            "focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2"
          }
        >
          Retry
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="max-w-xl rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-6">
        <p className="text-base font-medium text-[var(--color-ink-900)]">No events yet</p>
        <p className="mt-1 text-sm text-[var(--color-ink-500)]">
          Add a one-day giveaway, a turkey drive or a pop-up distribution.
        </p>
        <Link href="/admin/events/new" className={`mt-4 ${primaryLinkClass}`}>
          Add event
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/admin/events/new" className={primaryLinkClass}>
          Add event
        </Link>
      </div>
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white">
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
            {events.map((e) => (
              <tr key={e.id} className="border-b border-[var(--color-bone-100)] last:border-b-0">
                <td className="px-4 py-3 font-medium text-[var(--color-ink-900)]">{e.name}</td>
                <td className="px-4 py-3 text-[var(--color-ink-700)]">{formatEventWhen(e.starts_at)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[e.status]}`}>
                    {STATUS_LABEL[e.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/events/${e.id}/edit`}
                    className="inline-flex min-h-11 items-center font-medium text-[var(--color-sage-700)] underline underline-offset-2"
                    aria-label={`Edit ${e.name}`}
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
