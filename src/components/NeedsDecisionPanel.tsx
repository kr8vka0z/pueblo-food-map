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
 * "reason" textarea is dropped here (POSTs `{ reason: null }` after a native
 * window.confirm() gate) — a fast-triage panel benefits more from a quick
 * confirm-then-reject than from carrying every full-queue affordance, and the
 * reason field is genuinely optional everywhere it's used (the full queue,
 * one click away, still offers it for anyone who wants to leave one). The
 * confirm step itself is NOT optional (review finding) — see RejectButton's
 * own header for why.
 *
 * On any successful action, router.refresh() re-runs the Dashboard's own
 * Server Component queries — same "no local list copy to reconcile"
 * convention every ReviewView component in this app already follows.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReviewSubmission } from "@/components/SubmissionsReviewView";
import { SOURCE_BADGE, fieldLabel, formatFieldValue } from "@/components/ProposalsReviewView";
import { reviewableDiffFields } from "@/lib/adminProposals";
import type { ParsedProposal, ProposalChangeType, ProposalSourceValue, ProposedDiff } from "@/lib/adminProposals";
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

/**
 * One-click reject POST — `path` is the exact same route each full queue's
 * own reject button calls.
 *
 * `confirmMessage` is REQUIRED, not optional (review finding: one-click
 * reject with no confirm at all made a mis-click on this fast-triage panel
 * irreversible with zero warning — a box-photo reject in particular
 * permanently deletes the stored R2 object, see box-photos/[id]/reject's own
 * header). Every call site below supplies its own wording.
 *
 * A 404 response means this row was already handled elsewhere (approved,
 * rejected, or deleted) between page load and click — a stale card, not a
 * real failure — so it refreshes the same as success rather than showing a
 * "Try again" that would just repeat the same 404 (review finding). 409 is
 * NOT in that list (#568 item 4, dead-code finding): every reject route this
 * panel calls (submissions, proposals, box-photos, box-adopters) returns 404
 * for a stale row and never returns 409 at all — verified against all four
 * route.ts files, not assumed — so a 409 here can only mean a real,
 * unexpected failure and should show "Try again" like any other non-200.
 */
function RejectButton({ path, confirmMessage, onDone }: { path: string; confirmMessage: string; onDone: () => void }) {
  const [state, setState] = useState<RejectState>("idle");

  async function handleReject() {
    if (!window.confirm(confirmMessage)) return;
    setState("submitting");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: null }),
      });
      if (res.status === 200 || res.status === 404) {
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

// ─── Shared inline approve (item 5/6: collapses ProposalApproveAction /  ───
// ─── PhotoApproveAction / AdopterApproveAction into one component)      ───

/**
 * Reads a non-200 JSON response and decides what to do. Returns `"handled"`
 * when the row should be treated as already resolved (refresh, no error
 * shown) — the default for 404/409, which mean this row moved under the
 * admin (approved/rejected/superseded/deleted elsewhere) since page load,
 * not a real failure worth retrying. Returns a string to show that message
 * instead of the default "Try again" (box-adopters/approve's real 409 —
 * "unconfirmed" — is NOT a stale row, so AdopterApproveAction overrides this
 * default below).
 */
function defaultInterpretApproveError(status: number, body: { message?: string } | null): "handled" | string {
  if (status === 404 || status === 409) return "handled";
  return body?.message ?? "Try again";
}

interface ApproveButtonProps {
  path: string;
  onDone: () => void;
  /** window.confirm() gate before POSTing — omitted means no confirm (the common case: approving a field edit or a new upload isn't destructive). */
  confirmMessage?: string;
  label?: string;
  submittingLabel?: string;
  variant?: "primary" | "danger";
  interpretError?: (status: number, body: { error?: string; message?: string } | null) => "handled" | string;
}

/**
 * One shared inline-approve button for every "Needs a decision" row
 * (proposals, box photos, box adopters) — collapses three near-identical
 * copies (ProposalApproveAction/PhotoApproveAction/AdopterApproveAction used
 * to each hand-roll their own fetch + error state) so the stale-row fix
 * above (404/409 -> refresh, not "Try again") lives in exactly one place.
 */
function ApproveButton({
  path,
  onDone,
  confirmMessage,
  label = "Approve",
  submittingLabel = "Approving…",
  variant = "primary",
  interpretError = defaultInterpretApproveError,
}: ApproveButtonProps) {
  const [state, setState] = useState<"idle" | "submitting" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleApprove() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setState("submitting");
    try {
      const res = await fetch(path, { method: "POST" });
      if (res.status === 200) {
        onDone();
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
      const outcome = interpretError(res.status, body);
      if (outcome === "handled") {
        onDone();
        return;
      }
      setMessage(outcome);
      setState("error");
    } catch {
      setMessage("Try again");
      setState("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleApprove}
        disabled={state === "submitting"}
        className={variant === "danger" ? dangerButtonClass : primaryButtonClass}
      >
        {state === "submitting" ? submittingLabel : label}
      </button>
      {state === "error" && (
        <span role="alert" className="text-xs text-[var(--color-danger)]">
          {message}
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
                  <RejectButton
                    path={`/api/admin/submissions/${s.id}/reject`}
                    confirmMessage="Reject this suggestion? This can't be undone."
                    onDone={refresh}
                  />
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
                  <RejectButton
                    path={`/api/admin/proposals/${p.row.id}/reject`}
                    confirmMessage="Reject this proposed change? This can't be undone."
                    onDone={refresh}
                  />
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
                          <RejectButton
                            path={`/api/admin/box-photos/${photo.id}/reject`}
                            confirmMessage="Reject this photo? The photo will be permanently deleted. This can't be undone."
                            onDone={refresh}
                          />
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
                          <RejectButton
                            path={`/api/admin/box-adopters/${adopter.id}/reject`}
                            confirmMessage="Reject this adoption request? This can't be undone."
                            onDone={refresh}
                          />
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

/**
 * Compact one-line "what changed" for an `update` proposal — the Dashboard's
 * fast-triage panel has no room for the full queue's FieldDiff table
 * (ProposalsReviewView.tsx), so this shows only the FIRST reviewable field's
 * before -> after plus a "+N more" count. Reuses reviewableDiffFields/
 * fieldLabel/formatFieldValue (the SAME field selection + formatting the
 * full queue's own diff view uses) rather than a second diff parser — the
 * two views can never disagree about what a field's value reads as.
 */
function ProposalDiffPreview({ diff }: { diff: ProposedDiff }) {
  const fields = reviewableDiffFields(diff);
  if (fields.length === 0) return null;
  const [first, ...rest] = fields;
  const before = (diff.before ?? {}) as Record<string, unknown>;
  const after = (diff.after ?? {}) as Record<string, unknown>;
  return (
    <p className="mt-1 text-xs text-[var(--color-ink-500)]">
      {fieldLabel(first)}:{" "}
      <span className="line-through decoration-1">{formatFieldValue(first, before[first])}</span>{" "}
      <span aria-hidden>→</span>{" "}
      <span className="font-medium text-[var(--color-sage-700)]">{formatFieldValue(first, after[first])}</span>
      {rest.length > 0 && <span className="text-[var(--color-ink-400)]"> (+{rest.length} more)</span>}
    </p>
  );
}

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
  const sourceLabel = SOURCE_BADGE[row.source as ProposalSourceValue]?.label ?? row.source;
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
      <p className="text-xs text-[var(--color-ink-400)]">
        {sourceLabel} · {formatWhen(row.created_at)}
      </p>
      {/* Only `update` proposals get a diff line — `add`/`remove` are
          already fully described by the badge above, and link_health's own
          "no blind approve" rule (ProposalApproveAction below) means an
          admin never approves one from this preview anyway. */}
      {!proposal.parseError && changeType === "update" && row.source !== "link_health" && (
        <ProposalDiffPreview diff={proposal.diff} />
      )}
    </div>
  );
}

function ProposalApproveAction({ proposal, onDone }: { proposal: ParsedProposal; onDone: () => void }) {
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

  // A multi-field update doesn't fit this row's one-line diff preview — send
  // the admin to the full queue to review every changed field rather than
  // approving something they can't fully see here (review finding).
  if (changeType === "update" && reviewableDiffFields(proposal.diff).length > 1) {
    return (
      <Link href="/admin/flags" className={primaryButtonClass}>
        Review in queue
      </Link>
    );
  }

  return (
    <ApproveButton
      path={`/api/admin/proposals/${row.id}/approve`}
      onDone={onDone}
      confirmMessage={
        changeType === "remove"
          ? "Remove this venue from the map? Its record is kept, not deleted, and can be reviewed later."
          : undefined
      }
      label={changeType === "remove" ? "Archive" : "Approve"}
      submittingLabel={changeType === "remove" ? "Applying…" : "Approving…"}
      variant={changeType === "remove" ? "danger" : "primary"}
      // Override: a 409 here can mean the venue changed after the proposal was
      // made — applyApprovedProposal then marks it superseded and applies
      // NOTHING. Refreshing silently would make the row vanish as if the fix
      // landed, so show the route's own explanation instead (review finding).
      interpretError={(status, body) => {
        if (status === 404) return "handled";
        return body?.message ?? "Try again";
      }}
    />
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
  return <ApproveButton path={`/api/admin/box-photos/${photoId}/approve`} onDone={onDone} />;
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
  return (
    <ApproveButton
      path={`/api/admin/box-adopters/${adopterId}/approve`}
      onDone={onDone}
      // Override: this route's 409 is a REAL, non-stale business rule
      // ("the applicant hasn't clicked their own confirm-email link yet" —
      // see box-adopters/[id]/approve/route.ts's own header), not a row that
      // moved under the admin — so it must NOT silently refresh like the
      // default 404/409 handling does everywhere else.
      interpretError={(status, body) => {
        if (status === 409 && body?.error === "unconfirmed") return "Not confirmed yet";
        if (status === 404) return "handled";
        return body?.message ?? "Try again";
      }}
    />
  );
}
