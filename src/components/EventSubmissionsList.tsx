"use client";

/**
 * EventSubmissionsList — "Sent in by the public" on the admin Events tab
 * (#883): pending "Share an event" submissions, newest first, each with its
 * details, flyer, and the sender's name and email (admin-only, never public).
 *
 * Each item's two actions sit in one three-dot menu at its top right (#926
 * decision 9): "Make it a draft event" calls the convert route and opens the
 * new draft in the event form; when the address couldn't be located the
 * route answers `needs_location` and this opens the prefilled "Add event"
 * form instead. "Dismiss" (last, in red) hides the submission (a status
 * change; nothing is deleted). An unreadable submission has only Dismiss,
 * so it gets a plain button, not a menu.
 */

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { formatEventWhen } from "@/lib/eventTime";
import type { PendingEventSubmission } from "@/lib/eventSubmissions";
import { cardClass, cardNameClass, failureLineClass, fieldLabelClass, secondaryButtonClass, sectionTitleClass } from "@/lib/adminCardStyles";
import AdminRowMenu from "@/components/AdminRowMenu";

const FAILED: Record<"convert" | "dismiss", string> = {
  convert: "The draft event was not made. Try again.",
  dismiss: "The submission was not dismissed. Try again.",
};

function SubmissionCard({ item }: { item: PendingEventSubmission }) {
  const router = useRouter();
  const nameId = useId();
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
      setMessage(data?.message ?? FAILED[path]);
    } catch {
      setMessage(FAILED[path]);
    }
    setBusy(false);
  }

  return (
    <li className={cardClass}>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row">
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
                <h4 id={nameId} className={cardNameClass}>
                  {p.name}
                </h4>
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
                    <span className={fieldLabelClass}>Bring </span>
                    {p.whatToBring}
                  </p>
                )}
                {p.linkUrl && (
                  <p className="break-all">
                    <span className={fieldLabelClass}>Link ({p.linkLabel}) </span>
                    {p.linkUrl}
                  </p>
                )}
              </>
            ) : (
              <p className="text-[var(--color-danger)]">This submission can&rsquo;t be read. Dismiss it.</p>
            )}
            {/* break-words: an unbroken email address must not push the card wider than a phone. */}
            <p className="break-words text-[var(--color-ink-500)]">
              Sent by {item.submitterName} &lt;{item.submitterEmail}&gt; on {formatEventWhen(item.createdAt)}
            </p>
          </div>
        </div>
        {p && (
          // disabled: while one choice runs, the three-dot button itself is off.
          <AdminRowMenu
            labelledBy={nameId}
            disabled={busy}
            items={[
              { label: "Make it a draft event", onSelect: () => void act("convert") },
              { label: "Dismiss", onSelect: () => void act("dismiss"), danger: true },
            ]}
          />
        )}
      </div>
      {message && (
        <p role="alert" className={`mt-3 ${failureLineClass}`}>
          {message}
        </p>
      )}
      {!p && (
        <button type="button" disabled={busy} onClick={() => void act("dismiss")} className={`mt-3 ${secondaryButtonClass}`}>
          Dismiss
        </button>
      )}
    </li>
  );
}

export default function EventSubmissionsList({ items }: { items: PendingEventSubmission[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="event-submissions-heading">
      <h3 id="event-submissions-heading" className={`${sectionTitleClass} mb-3`}>
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
