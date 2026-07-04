"use client";

/**
 * PublishPanel — the admin's Publish action (#256).
 *
 * Rendered above VenueListView on /admin (src/app/admin/page.tsx) so the
 * admin sees "what will publish" — new drafts, published rows edited since
 * their last publish, and previously-live rows now archived (will be
 * removed) — before scrolling the venue list. Counts are computed
 * server-side by summarizePublishChanges() (src/lib/adminVenues.ts) from
 * the SAME `SELECT *` rows the page already loads; this component does no
 * fetching of its own for the summary, only for the publish action itself.
 *
 * Auth split matches every other admin mutation surface (AddVenueForm,
 * ArchiveVenueButton): this component holds none. The page's Server
 * Component owns the Cloudflare Access gate; POST /api/admin/publish
 * (src/app/api/admin/publish/route.ts) re-verifies identity + Origin
 * itself. The confirm step is a native window.confirm() — ArchiveVenueButton
 * established this pattern in this codebase (no modal dependency exists
 * here, and none is needed for one confirm dialog).
 *
 * Button treatment: filled sage-500/sage-600-hover, bone-50 text — the same
 * classes as "Add place" (src/app/admin/page.tsx) and AddVenueForm's submit
 * button. That IS the strongest CTA tier this design system offers for the
 * admin surface: DESIGN.md reserves brand-orange ("ButtonPrimary") for
 * exactly two public-map elements (splash CTA, LocateButton pill) with an
 * explicit Don't against using it anywhere else, while sage is documented
 * as "the primary interactive color" broadly. Reusing filled-sage rather
 * than inventing a bolder/new treatment keeps Publish visually equal to
 * "Add place" (both are this screen's primary actions) without breaking
 * DESIGN.md's orange scoping rule.
 *
 * On a successful publish, D1 has already promoted the drafts (route.ts's
 * NB1-ordered promotePublishedDrafts already ran before the 200 response
 * returns) — router.refresh() re-fetches the admin page's rows so this
 * panel's own summary drops back toward zero immediately, rather than
 * lingering with stale non-zero counts right after a successful publish.
 * The success message itself is untouched by the refresh (same DOM
 * position, component doesn't unmount), so it stays visible underneath.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PublishChangeSummary } from "@/lib/adminVenues";

export interface PublishPanelProps {
  summary: PublishChangeSummary;
}

interface PublishSuccessBody {
  ok: true;
  prUrl: string;
  prNumber: number;
  reused: boolean;
  publishedCount: number;
  snapshotCount: number;
}

interface PublishErrorBody {
  ok: false;
  error?: string;
}

type PublishResponseBody = PublishSuccessBody | PublishErrorBody;

type PublishState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; prUrl: string; publishedCount: number }
  | { status: "error"; message: string };

const primaryButtonClass =
  "inline-flex items-center justify-center rounded-[var(--radius-md)] " +
  "bg-[var(--color-sage-500)] px-4 py-2 text-sm font-semibold text-[var(--color-bone-50)] " +
  "transition-colors duration-150 hover:bg-[var(--color-sage-600)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage-500)] " +
  "focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function buildConfirmMessage({ newDrafts, editedSincePublish, archived }: PublishChangeSummary): string {
  return (
    `Publish ${pluralize(newDrafts, "new place")} and ${pluralize(editedSincePublish, "edited place")} ` +
    `to the public map? ${pluralize(archived, "place")} will be removed. ` +
    `This opens a change request that auto-merges.`
  );
}

/**
 * Maps a non-200 response to a calm, specific message per #256 AC3/AC5. The
 * `error` field (present on every ok:false JSON body this route returns) is
 * checked first since it's the more precise signal; `status` is the
 * fallback for the one branch with no JSON body at all (403 -- see
 * route.ts, which returns plain-text "Forbidden").
 */
function friendlyErrorMessage(status: number, error?: string): string {
  if (error === "publish_not_configured") {
    return "The publish key isn't set up yet, so this can't publish. (Setup is tracked separately.)";
  }
  if (error === "github_commit_failed") {
    return "Couldn't reach GitHub to publish. Nothing was changed — try again in a moment.";
  }
  if (status === 422) {
    return `Couldn't publish: something in a venue's data didn't pass validation.${error ? ` (${error})` : ""}`;
  }
  if (status === 403) {
    return "Your session expired — reload and sign in again.";
  }
  return "Something went wrong publishing. Nothing was changed — try again in a moment.";
}

export default function PublishPanel({ summary }: PublishPanelProps) {
  const router = useRouter();
  const [state, setState] = useState<PublishState>({ status: "idle" });
  const { newDrafts, editedSincePublish, archived } = summary;
  const upToDate = newDrafts === 0 && editedSincePublish === 0 && archived === 0;

  async function handlePublish() {
    const confirmed = window.confirm(buildConfirmMessage(summary));
    if (!confirmed) return;

    setState({ status: "submitting" });
    try {
      const res = await fetch("/api/admin/publish", { method: "POST" });
      const body = (await res.json().catch(() => null)) as PublishResponseBody | null;

      if (res.status === 200 && body?.ok) {
        setState({ status: "success", prUrl: body.prUrl, publishedCount: body.publishedCount });
        router.refresh();
        return;
      }
      setState({
        status: "error",
        message: friendlyErrorMessage(res.status, body && !body.ok ? body.error : undefined),
      });
    } catch {
      setState({ status: "error", message: friendlyErrorMessage(0) });
    }
  }

  return (
    <section className="mb-6 rounded-[var(--radius-lg)] border border-[var(--color-bone-200)] bg-white px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--color-ink-700)]">
          {upToDate ? (
            "The public map is up to date."
          ) : (
            <>
              <strong className="font-semibold text-[var(--color-ink-900)]">{newDrafts} new</strong>
              {", "}
              <strong className="font-semibold text-[var(--color-ink-900)]">{editedSincePublish} edited</strong>
              {", "}
              <strong className="font-semibold text-[var(--color-ink-900)]">{archived} removed</strong>
              {" since the last publish."}
            </>
          )}
        </p>
        <button
          type="button"
          onClick={handlePublish}
          disabled={upToDate || state.status === "submitting"}
          className={primaryButtonClass}
        >
          {state.status === "submitting" ? "Publishing…" : "Publish"}
        </button>
      </div>

      {state.status === "success" && (
        <p aria-live="polite" className="mt-3 text-sm text-[var(--color-sage-700)]">
          Published — {pluralize(state.publishedCount, "place")} pushed to the public map. A{" "}
          <a
            href={state.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-2"
          >
            change request
          </a>{" "}
          was opened and set to auto-merge. It can take a minute for the map to update.
        </p>
      )}

      {state.status === "error" && (
        <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">
          {state.message}
        </p>
      )}
    </section>
  );
}
