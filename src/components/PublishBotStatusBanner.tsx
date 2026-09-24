/**
 * PublishBotStatusBanner — the admin Dashboard's own view of the SAME open
 * publish-bot PR src/lib/publishVenues.ts's commitPublishedVenues() opens
 * (#598). Rendered above PublishPanel on /admin (src/app/admin/page.tsx)
 * ONLY when fetchPublishBotPrStatus() found an open PR — most page loads
 * render nothing at all, since a publish's PR merges within minutes on a
 * healthy CI run.
 *
 * Server Component by design (no "use client", zero added client JS) — the
 * data is a one-time server-side read at page render, nothing here is
 * interactive beyond a plain outbound link.
 *
 * Exists because #598's root problem: D1 marks a venue "published" the
 * moment the PR is opened and auto-merge is armed, not once it actually
 * merges — if that PR's CI goes red, an admin has no way to know the
 * public map is still stale until the next publish happens to repair it.
 * This banner is the fix that was chosen over rewiring the state machine
 * (not worth it — see publishVenues.ts's fetchPublishBotPrStatus for the
 * full reasoning): surface the truth read-only instead of hiding it.
 *
 * `state` (review finding, 2026-09-24): reworked from a Checks-API-derived
 * pass/fail to a Pulls-API-derived `PublishBotPrState` — the
 * `GITHUB_PUBLISH_TOKEN` fine-grained PAT this repo uses cannot read check
 * runs at all (a structural PAT gap, not a missing scope), so the original
 * "checks failed" verdict could never actually render. See
 * fetchPublishBotPrStatus's own header (publishVenues.ts) for the full
 * mergeable_state/age reasoning behind the three states below.
 */

import type { PublishBotPrState } from "@/lib/publishVenues";

export interface PublishBotStatusBannerProps {
  prNumber: number;
  prUrl: string;
  state: PublishBotPrState;
}

const STUCK_COPY: Record<Exclude<PublishBotPrState, "in_progress">, string> = {
  stuck_conflict: "Publish is stuck: merge conflict —",
  stuck_checks: "Publish is stuck: checks failing or pending too long —",
};

export default function PublishBotStatusBanner({ prNumber, prUrl, state }: PublishBotStatusBannerProps) {
  const isStuck = state !== "in_progress";

  return (
    <section
      role={isStuck ? "alert" : undefined}
      className={`mb-3 rounded-[var(--radius-lg)] border px-4 py-3 text-sm sm:px-6 ${
        isStuck
          ? "border-[var(--color-danger)] bg-white text-[var(--color-danger)]"
          : "border-[var(--color-bone-200)] bg-white text-[var(--color-ink-700)]"
      }`}
    >
      {isStuck ? (
        <>
          <strong className="font-semibold">{STUCK_COPY[state]}</strong>{" "}
          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-2"
          >
            PR #{prNumber}
          </a>
          . The public map is still showing the OLD data. Fix it (or close the PR) and publish again.
        </>
      ) : (
        <>
          Publish in progress — waiting on{" "}
          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-2"
          >
            PR #{prNumber}
          </a>
          . The public map updates once it merges.
        </>
      )}
    </section>
  );
}
