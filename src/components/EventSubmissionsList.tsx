"use client";

/**
 * EventSubmissionsList — "Sent in by the public" on the admin Events tab
 * (#883): pending "Share an event" submissions, newest first, each with its
 * details, flyer, and the sender's name and email (admin-only, never public).
 *
 * "Make it a draft event" calls the convert route and opens the new draft in
 * the event form; when the address couldn't be located the route answers
 * `needs_location` and this opens the prefilled "Add event" form instead.
 * "Dismiss" hides the submission (a status change; nothing is deleted).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatEventWhen } from "@/lib/eventTime";
import type { PendingEventSubmission } from "@/lib/eventSubmissions";
import { ADMIN_PRIMARY_BUTTON } from "@/components/formClasses";

const secondary =
  "inline-flex min-h-12 items-center rounded-[var(--radius-md)] border border-[var(--color-bone-300)] bg-white px-4 " +
  "text-sm font-medium text-[var(--color-ink-700)] transition-colors duration-150 hover:bg-[var(--color-bone-100)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
  "disabled:opacity-60 disabled:cursor-not-allowed";
const label = "text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]";

function SubmissionCard({ item }: { item: PendingEventSubmission }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const p = item.payload;

  async function act(path: "convert" | "dismiss") {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/event-submissions/${encodeURIComponent(item.id)}/${path}`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; editUrl?: string; openUrl?: string; error?: string; message?: string } | null;
      if (data?.ok && path === "convert" && data.editUrl) {
        router.push(data.editUrl);
        return;
      }
      if (data?.ok) {
        router.refresh();
        return;
      }
      if (data?.error === "needs_location" && data.openUrl) {
        router.push(data.openUrl);
        return;
      }
      setMessage(data?.message ?? "Something went wrong. Try again.");
    } catch {
      setMessage("Something went wrong. Try again.");
    }
    setBusy(false);
  }

  return (
    <li className="rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        {item.hasFlyer && (
          // eslint-disable-next-line @next/next/no-img-element -- a session-only admin route; next/image would need it as a remote pattern
          <img
            src={`/api/admin/event-submissions/${encodeURIComponent(item.id)}/flyer`}
            alt={p ? `Flyer for ${p.name}` : "Flyer"}
            className="h-auto w-full max-w-[160px] self-start rounded-[var(--radius-md)] border border-[var(--color-bone-200)]"
          />
        )}
        <div className="min-w-0 flex-1 space-y-2 text-sm text-[var(--color-ink-700)]">
          {p ? (
            <>
              <h4 className="text-base font-semibold text-[var(--color-ink-900)]">{p.name}</h4>
              <p>Hosted by {p.host}</p>
              <p>
                <span className="font-medium text-[var(--color-ink-900)]">{formatEventWhen(p.startsAt)}</span> to{" "}
                {formatEventWhen(p.endsAt)} (Pueblo time)
              </p>
              <p>
                {p.venueName && <span className="font-medium text-[var(--color-ink-900)]">{p.venueName}, </span>}
                {p.address}
              </p>
              <p className="whitespace-pre-line">{p.description}</p>
              {p.whatToBring && (
                <p className="whitespace-pre-line">
                  <span className={label}>Bring </span>
                  {p.whatToBring}
                </p>
              )}
              {p.linkUrl && (
                <p className="break-all">
                  <span className={label}>Link ({p.linkLabel}) </span>
                  {p.linkUrl}
                </p>
              )}
            </>
          ) : (
            <p className="text-[var(--color-danger)]">This submission can&rsquo;t be read. Dismiss it.</p>
          )}
          <p className="text-[var(--color-ink-500)]">
            Sent by {item.submitterName} &lt;{item.submitterEmail}&gt; on {formatEventWhen(item.createdAt)}
          </p>
        </div>
      </div>
      {message && (
        <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">
          {message}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        {p && (
          <button type="button" disabled={busy} onClick={() => void act("convert")} className={ADMIN_PRIMARY_BUTTON}>
            Make it a draft event
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => void act("dismiss")} className={secondary}>
          Dismiss
        </button>
      </div>
    </li>
  );
}

export default function EventSubmissionsList({ items }: { items: PendingEventSubmission[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="event-submissions-heading" className="max-w-3xl space-y-3">
      <h3 id="event-submissions-heading" className="wordmark text-lg text-[var(--color-ink-900)]">
        Sent in by the public
      </h3>
      <ul className="space-y-3">
        {items.map((item) => (
          <SubmissionCard key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}
