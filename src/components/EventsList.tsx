"use client";

/**
 * EventsList — the body of /admin/events (#757): "All events", a table of
 * events (name, date in Pueblo time, status, edit link) under a title row
 * with Add event, the "No events yet" empty state
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
import {
  emptyStateClass,
  failureBoxClass,
  failureLineClass,
  linkClass,
  loadingLineClass,
  secondaryButtonClass,
  sectionTitleClass,
  tableCellClass,
  tableHeadCellClass,
  tableHeadRowClass,
  tableLinkRowClass,
  tableWrapClass,
  tagClass,
  type TagTone,
} from "@/lib/adminCardStyles";
import { ADMIN_PRIMARY_BUTTON } from "@/components/formClasses";
import type { EventListItem } from "@/lib/adminEventReads";
import type { EventStatus } from "@/lib/adminEventValidation";
import { openRowLink } from "@/lib/rowLinkClick";

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

export default function EventsList({ events }: EventsListProps) {
  const router = useRouter();
  const [isRetrying, startRetry] = useTransition();
  // Prefix for the per-row ids the Edit links' names point at (above the early returns: hooks rule).
  const rowId = useId();

  if (isRetrying) {
    return (
      <p role="status" className={loadingLineClass}>
        Loading…
      </p>
    );
  }

  if (events === null) {
    return (
      <div role="alert" className={failureBoxClass}>
        <p className={`${failureLineClass} font-medium`}>Couldn&rsquo;t load events.</p>
        <p className="mt-1 text-sm text-[var(--color-ink-500)]">Check your connection and try again.</p>
        <button type="button" onClick={() => startRetry(() => router.refresh())} className={`mt-3 ${secondaryButtonClass}`}>
          Retry
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={emptyStateClass}>
        <p>No events yet.</p>
        <p>Add a one-day giveaway, a turkey drive or a pop-up distribution.</p>
        <Link href="/admin/events/new" className={ADMIN_PRIMARY_BUTTON}>
          Add event
        </Link>
      </div>
    );
  }

  return (
    <section aria-labelledby={`${rowId}-heading`}>
      {/* The table's title with Add event at its right, as Blessing Boxes titles
          its table; on a phone the button wraps under the title. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 id={`${rowId}-heading`} className={sectionTitleClass}>
          All events
        </h3>
        <Link href="/admin/events/new" className={ADMIN_PRIMARY_BUTTON}>
          Add event
        </Link>
      </div>
      <div className={tableWrapClass}>
        {/* WHY these minimums: at 512 the Event column was squeezed to 132 px
            on a phone and names wrapped to three or four lines. 240 (with its
            32 px padding) keeps a name to two lines beside the one-line date;
            the table scrolls sideways inside its box instead (#926). */}
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className={tableHeadRowClass}>
              <th scope="col" className={`${tableHeadCellClass} sticky left-0 z-10 min-w-[240px] bg-white shadow-[1px_0_0_var(--color-bone-200)] sm:static sm:shadow-none`}>
                Event
              </th>
              <th scope="col" className={tableHeadCellClass}>Starts (Pueblo time)</th>
              <th scope="col" className={tableHeadCellClass}>Status</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              // Name IS the edit link (matching Places and Blessing Boxes); a
              // click anywhere on the row opens it too (src/lib/rowLinkClick.ts).
              <tr key={e.id} className={tableLinkRowClass} onClick={openRowLink}>
                <td className={`${tableCellClass} sticky left-0 z-10 bg-white font-medium shadow-[1px_0_0_var(--color-bone-200)] transition-colors duration-150 group-hover:bg-[var(--color-sage-100)] sm:static sm:bg-transparent sm:shadow-none sm:group-hover:bg-transparent`}>
                  <Link href={`/admin/events/${e.id}/edit`} data-row-link className={linkClass}>
                    {e.name}
                  </Link>
                </td>
                <td className={`${tableCellClass} whitespace-nowrap tabular-nums text-[var(--color-ink-700)]`}>{formatEventWhen(e.starts_at)}</td>
                <td className={tableCellClass}>
                  <span className={tagClass(STATUS_TONE[e.status])}>{STATUS_LABEL[e.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
