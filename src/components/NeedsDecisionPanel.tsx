"use client";

/**
 * NeedsDecisionPanel — the /admin Dashboard's "Needs a decision" panel
 * (approved mockup Direction A). Groups every pending item that needs an
 * admin's decision — public suggestions/closure reports, data-refresh
 * proposals, box photos, adoption requests — into one place, each row
 * capped (server passes already-trimmed arrays; see src/app/admin/page.tsx)
 * with a "+N more →" link to that item's own full review queue.
 *
 * Deliberately reuses the SAME mutation routes (POST /api/admin/submissions/
 * [id]/reject, /api/admin/proposals/[id]/{approve,reject},
 * /api/admin/box-photos/[id]/{approve,reject},
 * /api/admin/box-adopters/[id]/{approve,reject}) each full queue's own
 * ReviewView component already calls — "reuse the same API routes with the
 * same request shapes" per the task spec, not a second write path. Every
 * row's Approve/Reject action here is either the exact same fetch call the
 * full queue makes, or — where approving genuinely needs more than a
 * button (a submission/proposal's own edit-before-approve review) — the
 * exact same navigation Link the full queue already uses, never a
 * re-implemented flow.
 *
 * One deliberate simplification from the full queues: reject's optional
 * "reason" textarea is dropped here (POSTs `{ reason: null }` directly on
 * click, no confirm step) — a fast-triage panel benefits more from a true
 * one-click reject than from carrying every full-queue affordance, and the
 * reason field is genuinely optional everywhere it's used (the full queue,
 * one click away, still offers it for anyone who wants to leave one).
 *
 * On any successful action, router.refresh() re-runs the Dashboard's own
 * Server Component queries — same "no local list copy to reconcile"
 * convention every ReviewView component in this app already follows.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReviewSubmission } from "@/components/SubmissionsReviewView";
import type { ParsedProposal, ProposalChangeType } from "@/lib/adminProposals";
import type { VenueLookup } from "@/lib/adminVenueLookup";
import type { AdminBoxPhotoRow } from "@/lib/boxPhotos";
import type { AdminBoxAdopterRow } from "@/lib/boxAdopters";

export interface NeedsDecisionPanelProps {
  submissions: ReviewSubmission[];
  submissionsTotal: number;
  proposals: ParsedProposal[];
  proposalsTotal: number;
  venueLookup: Record<string, VenueLookup>;
  photos: AdminBoxPhotoRow[];
  photosTotal: number;
  adopters: AdminBoxAdopterRow[];
  adoptersTotal: number;
}

// ─── Shared styling (same tokens/classes every ReviewView already uses) ────

const rowClass =
  "flex flex-col gap-2 border-b border-[var(--color-bone-100)] py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between";

const primaryButtonClass =
  "inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-sage-500)] " +
  "px-3 py-1.5 text-sm font-semibold text-[var(--color-bone-50)] transition-colors duration-150 " +
  "hover:bg-[var(--color-sage-600)] focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const secondaryButtonClass =
  "inline-flex items-center rounded-[var(--radius-md)] border border-[var(--color-bone-300)] " +
  "px-3 py-1.5 text-sm font-medium text-[var(--color-ink-700)] bg-transparent " +
  "transition-colors duration-150 hover:bg-[var(--color-bone-100)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const dangerButtonClass =
  "inline-flex items-center rounded-[var(--radius-md)] border border-[var(--color-danger)] " +
  "px-3 py-1.5 text-sm font-medium text-[var(--color-danger)] bg-transparent " +
  "transition-colors duration-150 hover:bg-[var(--color-danger)] hover:text-[var(--color-bone-50)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)] focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const badgeClass = (className: string) => `inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${className}`;

const moreLinkClass = "text-sm font-medium text-[var(--color-sage-700)] underline underline-offset-2";

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

// ─── Shared one-click reject (no reason box — see file header) ─────────────

type RejectState = "idle" | "submitting" | "error";

/** One-click reject POST — `path` is the exact same route each full queue's own reject button calls. */
function RejectButton({ path, onDone }: { path: string; onDone: () => void }) {
  const [state, setState] = useState<RejectState>("idle");

  async function handleReject() {
    setState("submitting");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: null }),
      });
      if (res.status === 200) {
        onDone();
        return;
      }
      setState("error");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={handleReject} disabled={state === "submitting"} className={secondaryButtonClass}>
        {state === "submitting" ? "Rejecting…" : "Reject"}
      </button>
      {state === "error" && (
        <span role="alert" className="text-xs text-[var(--color-danger)]">
          Try again
        </span>
      )}
    </div>
  );
}

// ─── Group shell ────────────────────────────────────────────────────────────

function DecisionGroup({
  title,
  totalCount,
  shownCount,
  moreHref,
  children,
}: {
  title: string;
  totalCount: number;
  shownCount: number;
  moreHref: string;
  children: React.ReactNode;
}) {
  if (totalCount === 0) return null;
  const remaining = totalCount - shownCount;
  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--color-ink-700)]">
        {title} <span className="font-normal text-[var(--color-ink-400)]">({totalCount})</span>
      </h3>
      <div className="mt-1">{children}</div>
      {remaining > 0 && (
        <Link href={moreHref} className={`${moreLinkClass} mt-2 inline-block`}>
          +{remaining} more →
        </Link>
      )}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function NeedsDecisionPanel({
  submissions,
  submissionsTotal,
  proposals,
  proposalsTotal,
  venueLookup,
  photos,
  photosTotal,
  adopters,
  adoptersTotal,
}: NeedsDecisionPanelProps) {
  const router = useRouter();
  const totalCount = submissionsTotal + proposalsTotal + photosTotal + adoptersTotal;
  const refresh = () => router.refresh();

  if (totalCount === 0) {
    return (
      <section className="elevation-1 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-4 sm:p-5">
        <h2 className="wordmark text-lg text-[var(--color-ink-900)]">Needs a decision</h2>
        <p className="mt-2 text-sm text-[var(--color-ink-500)]">
          Nothing waiting on you. New suggestions, data changes, box photos and adoption requests show up here as
          they come in.
        </p>
      </section>
    );
  }

  return (
    <section className="elevation-1 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white p-4 sm:p-5">
      <h2 className="wordmark text-lg text-[var(--color-ink-900)]">Needs a decision ({totalCount})</h2>

      <div className="mt-3 flex flex-col gap-5">
        <DecisionGroup
          title="Suggestions from the public"
          totalCount={submissionsTotal}
          shownCount={submissions.length}
          moreHref="/admin/submissions"
        >
          <ul>
            {submissions.map((s) => (
              <li key={s.id} className={rowClass}>
                <SubmissionRowDetail submission={s} />
                <div className="flex items-center gap-2">
                  {!s.parseError && s.kind === "new_venue" && (
                    <Link href={`/admin/venues/new?submission=${s.id}`} className={primaryButtonClass}>
                      Review &amp; approve
                    </Link>
                  )}
                  {s.kind === "closure" && s.targetVenueId && (
                    <Link
                      href={`/admin/venues/${s.targetVenueId}/edit?submission=${s.id}`}
                      className={primaryButtonClass}
                    >
                      Review &amp; approve
                    </Link>
                  )}
                  <RejectButton path={`/api/admin/submissions/${s.id}/reject`} onDone={refresh} />
                </div>
              </li>
            ))}
          </ul>
        </DecisionGroup>

        <DecisionGroup
          title="Data refresh"
          totalCount={proposalsTotal}
          shownCount={proposals.length}
          moreHref="/admin/flags"
        >
          <ul>
            {proposals.map((p) => (
              <li key={p.row.id} className={rowClass}>
                <ProposalRowDetail proposal={p} venueLookup={venueLookup} />
                <div className="flex items-center gap-2">
                  <ProposalApproveAction proposal={p} onDone={refresh} />
                  <RejectButton path={`/api/admin/proposals/${p.row.id}/reject`} onDone={refresh} />
                </div>
              </li>
            ))}
          </ul>
        </DecisionGroup>

        {(photosTotal > 0 || adoptersTotal > 0) && (
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-ink-700)]">
              Blessing boxes{" "}
              <span className="font-normal text-[var(--color-ink-400)]">({photosTotal + adoptersTotal})</span>
            </h3>
            <div className="mt-1 flex flex-col gap-4">
              {photosTotal > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-400)]">
                    Photos to review
                  </p>
                  <ul>
                    {photos.map((photo) => (
                      <li key={photo.id} className={rowClass}>
                        <PhotoRowDetail photo={photo} />
                        <div className="flex items-center gap-2">
                          <PhotoApproveAction photoId={photo.id} onDone={refresh} />
                          <RejectButton path={`/api/admin/box-photos/${photo.id}/reject`} onDone={refresh} />
                        </div>
                      </li>
                    ))}
                  </ul>
                  {photosTotal - photos.length > 0 && (
                    <Link href="/admin/box-photos" className={`${moreLinkClass} mt-2 inline-block`}>
                      +{photosTotal - photos.length} more →
                    </Link>
                  )}
                </div>
              )}
              {adoptersTotal > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-400)]">
                    Adoption requests
                  </p>
                  <ul>
                    {adopters.map((adopter) => (
                      <li key={adopter.id} className={rowClass}>
                        <AdopterRowDetail adopter={adopter} />
                        <div className="flex items-center gap-2">
                          <AdopterApproveAction adopterId={adopter.id} onDone={refresh} />
                          <RejectButton path={`/api/admin/box-adopters/${adopter.id}/reject`} onDone={refresh} />
                        </div>
                      </li>
                    ))}
                  </ul>
                  {adoptersTotal - adopters.length > 0 && (
                    <Link href="/admin/box-adopters" className={`${moreLinkClass} mt-2 inline-block`}>
                      +{adoptersTotal - adopters.length} more →
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Row detail + per-kind approve actions ─────────────────────────────────

function SubmissionRowDetail({ submission }: { submission: ReviewSubmission }) {
  const name =
    !submission.parseError && "venueName" in submission.payload ? submission.payload.venueName : `Submission #${submission.id}`;
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-[var(--color-ink-700)]">
        {name}{" "}
        <span className={badgeClass(submission.kind === "closure" ? "bg-[var(--color-clay-100)] text-[var(--color-clay-700)]" : "bg-[var(--color-sage-100)] text-[var(--color-sage-700)]")}>
          {submission.kind === "closure" ? "Closure report" : "New place"}
        </span>
      </p>
      <p className="text-xs text-[var(--color-ink-400)]">{formatWhen(submission.createdAt)}</p>
    </div>
  );
}

const CHANGE_TYPE_LABEL: Record<ProposalChangeType, string> = {
  add: "New venue",
  update: "Field update",
  remove: "Remove",
};

function ProposalRowDetail({
  proposal,
  venueLookup,
}: {
  proposal: ParsedProposal;
  venueLookup: Record<string, VenueLookup>;
}) {
  const { row } = proposal;
  const targetVenue = venueLookup[row.target_venue_id];
  const afterName = !proposal.parseError && typeof proposal.diff.after?.name === "string" ? proposal.diff.after.name : undefined;
  const name = targetVenue?.name ?? afterName ?? row.target_venue_id;
  const changeType = row.change_type as ProposalChangeType;
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-[var(--color-ink-700)]">
        {name}{" "}
        <span className={badgeClass("bg-[var(--color-bone-100)] text-[var(--color-ink-500)]")}>
          {CHANGE_TYPE_LABEL[changeType] ?? changeType}
        </span>
        {row.anomaly === 1 && (
          <span className={`${badgeClass("bg-[var(--color-clay-100)] text-[var(--color-clay-700)]")} ml-1.5`}>
            Unusual run
          </span>
        )}
      </p>
      <p className="text-xs text-[var(--color-ink-400)]">{formatWhen(row.created_at)}</p>
    </div>
  );
}

function ProposalApproveAction({ proposal, onDone }: { proposal: ParsedProposal; onDone: () => void }) {
  const [state, setState] = useState<"idle" | "submitting" | "error">("idle");
  const { row } = proposal;
  const source = row.source;
  const changeType = row.change_type as ProposalChangeType;

  // link_health: no blind approve — the full queue's own rule (a dead-link
  // finding is not a field edit to apply); hand off to the edit screen.
  if (!proposal.parseError && source === "link_health") {
    return (
      <Link href={`/admin/venues/${row.target_venue_id}/edit?proposal=${row.id}`} className={primaryButtonClass}>
        Review &amp; fix link
      </Link>
    );
  }
  if (proposal.parseError) return null;

  async function handleApprove() {
    if (
      changeType === "remove" &&
      !window.confirm("Remove this venue from the map? Its record is kept, not deleted, and can be reviewed later.")
    ) {
      return;
    }
    setState("submitting");
    try {
      const res = await fetch(`/api/admin/proposals/${row.id}/approve`, { method: "POST" });
      if (res.status === 200) {
        onDone();
        return;
      }
      setState("error");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleApprove}
        disabled={state === "submitting"}
        className={changeType === "remove" ? dangerButtonClass : primaryButtonClass}
      >
        {state === "submitting" ? "Applying…" : changeType === "remove" ? "Archive" : "Approve"}
      </button>
      {state === "error" && (
        <span role="alert" className="text-xs text-[var(--color-danger)]">
          Try again
        </span>
      )}
    </div>
  );
}

function PhotoRowDetail({ photo }: { photo: AdminBoxPhotoRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- admin-only preview of a runtime R2 object, same as BoxPhotosReviewView's full-size card */}
      <img
        src={`/api/admin/box-photos/${photo.id}/preview`}
        alt={`Photo submitted for ${photo.venue_name}`}
        className="h-10 w-10 flex-none rounded-[var(--radius-sm)] border border-[var(--color-bone-200)] object-cover"
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--color-ink-700)]">
          {photo.venue_name}{" "}
          <span
            className={badgeClass(
              photo.status === "flagged"
                ? "bg-[var(--color-clay-100)] text-[var(--color-clay-700)]"
                : "bg-[var(--color-sage-100)] text-[var(--color-sage-700)]",
            )}
          >
            {photo.status === "flagged" ? `Reported (${photo.flag_count}×)` : "New upload"}
          </span>
        </p>
        <p className="text-xs text-[var(--color-ink-400)]">{formatWhen(photo.created_at)}</p>
      </div>
    </div>
  );
}

function PhotoApproveAction({ photoId, onDone }: { photoId: number; onDone: () => void }) {
  const [state, setState] = useState<"idle" | "submitting" | "error">("idle");

  async function handleApprove() {
    setState("submitting");
    try {
      const res = await fetch(`/api/admin/box-photos/${photoId}/approve`, { method: "POST" });
      if (res.status === 200) {
        onDone();
        return;
      }
      setState("error");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={handleApprove} disabled={state === "submitting"} className={primaryButtonClass}>
        {state === "submitting" ? "Approving…" : "Approve"}
      </button>
      {state === "error" && (
        <span role="alert" className="text-xs text-[var(--color-danger)]">
          Try again
        </span>
      )}
    </div>
  );
}

function AdopterRowDetail({ adopter }: { adopter: AdminBoxAdopterRow }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-[var(--color-ink-700)]">
        {adopter.display_name} — {adopter.venue_name}{" "}
        <span
          className={badgeClass(
            adopter.email_confirmed_at
              ? "bg-[var(--color-sage-100)] text-[var(--color-sage-700)]"
              : "bg-[var(--color-clay-100)] text-[var(--color-clay-700)]",
          )}
        >
          {adopter.email_confirmed_at ? "Email confirmed" : "Awaiting confirmation"}
        </span>
      </p>
      <p className="text-xs text-[var(--color-ink-400)]">{formatWhen(adopter.created_at)}</p>
    </div>
  );
}

function AdopterApproveAction({ adopterId, onDone }: { adopterId: number; onDone: () => void }) {
  const [state, setState] = useState<"idle" | "submitting" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleApprove() {
    setState("submitting");
    try {
      const res = await fetch(`/api/admin/box-adopters/${adopterId}/approve`, { method: "POST" });
      if (res.status === 200) {
        onDone();
        return;
      }
      if (res.status === 409) {
        setMessage("Not confirmed yet");
        setState("error");
        return;
      }
      setMessage("Try again");
      setState("error");
    } catch {
      setMessage("Try again");
      setState("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={handleApprove} disabled={state === "submitting"} className={primaryButtonClass}>
        {state === "submitting" ? "Approving…" : "Approve"}
      </button>
      {state === "error" && (
        <span role="alert" className="text-xs text-[var(--color-danger)]">
          {message}
        </span>
      )}
    </div>
  );
}
