/**
 * scheduledTasks.ts — custom-worker.ts's entire scheduled() orchestration:
 * the Healthchecks.io heartbeat ping, the #594 email-retention cleanup, and
 * the #238/#234 refresh-pipeline alerts. All three ride the same 5-minute
 * prod-only cron (wrangler.jsonc `triggers.crons`) — no second trigger.
 *
 * WHY this lives in its own file, not inside emailRetention.ts or
 * refreshAlerts.ts: the orchestration itself needs to import from BOTH of
 * those domain modules (plus logger.ts), and doing that from inside either
 * one would make that module responsible for a sibling feature it has
 * nothing to do with. custom-worker.ts can never carry test coverage for
 * this branching directly — it imports `.open-next/worker.js`, gitignored
 * build output that doesn't exist until `opennextjs-cloudflare build` runs,
 * so vitest can never resolve it — so the actual `if`/`ctx.waitUntil` wiring
 * lives here instead, where it's a plain function testable with a mock
 * `env`/`ctx` (see scheduledTasks.test.ts). custom-worker.ts's `scheduled()`
 * is a one-line call into runScheduledTasks below.
 *
 * History: email retention (#594, PR #616) extracted this pattern first,
 * inside emailRetention.ts itself. Refresh alerts (#238/#234, PR #624)
 * landed independently on a separate branch with its own inline
 * custom-worker.ts wiring. Reconciling the two branches on merge is what
 * created this shared module — one orchestrator, not a duplicated
 * ping-guard-plus-gate pattern per feature.
 *
 * WHY no `@/` alias imports here (relative imports only): this file is
 * reached from custom-worker.ts, which wrangler's own bundler (not Next's
 * webpack) compiles when it builds the top-level `main` entry — tsconfig
 * `paths` aliases aren't resolved there. Same constraint emailRetention.ts
 * and refreshAlerts.ts each already document for the same reason.
 *
 * Each job below gets its OWN independent `ctx.waitUntil` call, never
 * nested or chained against another: the HC.io ping must never be gated
 * behind either daily job running (a slow/failing job must never delay or
 * break the dead-man's-switch), and neither daily job may be gated behind
 * `HC_PING_URL` being set (staging/a missing secret must not also silently
 * disable a daily job) or behind the OTHER daily job's own gate/outcome —
 * three fully independent branches sharing only the one cron tick.
 */

import type { ExecutionContext, ScheduledController } from "@cloudflare/workers-types/experimental";
import {
  shouldRunEmailRetention,
  runEmailRetentionCleanup,
  EmailRetentionPartialFailure,
} from "./emailRetention";
import { shouldRunRefreshAlertsCheck, runRefreshAlertsCheck } from "./refreshAlerts";
import {
  logEmailRetentionResult,
  logEmailRetentionFailure,
  logRefreshAlertsResult,
  logRefreshAlertsFailure,
} from "./logger";

export function runScheduledTasks(event: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext): void {
  // Guard: HC_PING_URL is a prod-only runtime secret (`wrangler secret
  // put`, see wrangler.jsonc) — staging never gets it, and a missing
  // value must never throw out of a cron handler, so bail out instead of
  // fetching "undefined". This guard covers ONLY the ping — never a hard
  // early `return`, or a missing secret would also silently skip both
  // daily jobs below.
  if (env.HC_PING_URL) {
    ctx.waitUntil(fetch(env.HC_PING_URL).catch(() => {}));
  }

  // Email retention (#594) — 09:00 UTC slot (emailRetention.ts's own
  // shouldRunEmailRetention).
  if (shouldRunEmailRetention(event.scheduledTime)) {
    ctx.waitUntil(
      // event.scheduledTime (not the default `new Date()`) so the cutoff is
      // pinned to when the cron was SCHEDULED, not whenever this handler
      // actually got to run — matches retentionCutoffIso's own docstring
      // ("computed from the cron's own scheduled time") and keeps a queue
      // delay from ever shifting which rows count as 90+ days old.
      runEmailRetentionCleanup(env.ADMIN_DB, new Date(event.scheduledTime))
        .then(logEmailRetentionResult)
        .catch((err) => {
          // A partial failure still carries the counts of whichever
          // statements DID succeed (emailRetention.ts's own per-statement
          // isolation) — log those too, or a real cleanup that mostly
          // worked would show up in the logs as pure failure with no
          // record of what it did.
          if (err instanceof EmailRetentionPartialFailure) {
            logEmailRetentionResult(err.counts);
          }
          logEmailRetentionFailure(err instanceof Error ? err.message : String(err));
        }),
    );
  }

  // Refresh-pipeline alerts (#238 pending-age, #234 per-source staleness) —
  // 09:30 UTC slot (refreshAlerts.ts's own shouldRunRefreshAlertsCheck),
  // deliberately distinct from retention's 09:00 slot so the two never
  // collide.
  if (shouldRunRefreshAlertsCheck(event.scheduledTime)) {
    ctx.waitUntil(
      runRefreshAlertsCheck(env.ADMIN_DB, env.RESEND_API_KEY, new Date(event.scheduledTime))
        .then(logRefreshAlertsResult)
        .catch((err) => logRefreshAlertsFailure(err instanceof Error ? err.message : String(err))),
    );
  }
}
