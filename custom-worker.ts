// custom-worker.ts
// Wraps the OpenNext-generated fetch handler so a scheduled() cron handler can ride
// alongside it. @opennextjs/cloudflare only exports { fetch } from .open-next/worker.js
// by default — the official how-to for adding any other handler (cron, DO, etc.) is a
// thin wrapper worker that re-exports the generated fetch handler and adds the rest:
// https://opennext.js.org/cloudflare/howtos/custom-worker
// wrangler.jsonc's top-level `main` points here instead of directly at
// .open-next/worker.js so this one extra export doesn't require touching generated
// build output (which is gitignored and rebuilt every deploy).
//
// WHY a scoped named-type import for ExecutionContext/ExportedHandler/ScheduledController
// (not a bare `wrangler types` full-runtime include, and not `.wrangler`'s own generated
// runtime.d.ts, which is itself gitignored build output — absent in a fresh checkout, so
// relying on it would only work by local-cache accident, not in CI): AGENTS.md's "Typing
// ADMIN_DB" section documents why this app never enables wrangler's full runtime type set
// (`wrangler types` default) — it collides Cloudflare's HTMLRewriter `Element` with
// lib.dom's `Element` and corrupts DOM types project-wide. cloudflare-env.d.ts already
// works around this by importing only the one runtime type it needs (`D1Database`) from
// `@cloudflare/workers-types/experimental` instead of pulling in the whole ambient set.
// This file follows the exact same pattern for the three Workers runtime types a
// scheduled()-handler signature needs — none of which is `Element` or collides with DOM.
import type { ExecutionContext, ExportedHandler, ScheduledController } from "@cloudflare/workers-types/experimental";
//
// WHY `@ts-ignore` (not `@ts-expect-error`) on the imports below: .open-next/worker.js
// is produced by `opennextjs-cloudflare build` and does not exist in a fresh checkout —
// `npm run typecheck` / `predeploy` run BEFORE any build step in both CI (ci.yml) and
// the deploy workflows, so the module genuinely does not resolve at typecheck time.
// `@ts-expect-error` would fail typecheck locally (after a build already populated
// .open-next) because the error it expects is no longer there. `@ts-ignore` suppresses
// whatever diagnostic is present — none once built, "cannot find module" when not —
// without caring which case applies. The repo's own eslint config bans bare `@ts-ignore`
// (`@typescript-eslint/ban-ts-comment`, prefers `@ts-expect-error`) for the same reason
// this comment argues against it everywhere else — this is the one deliberate exception,
// so the ban is disabled for just these two lines rather than loosened project-wide.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore `.open-next/worker.js` is generated at build time (opennextjs-cloudflare build)
import { default as handler } from "./.open-next/worker.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore `.open-next/worker.js` is generated at build time (opennextjs-cloudflare build)
import { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

export default {
  fetch: handler.fetch,

  // Uptime dead-man's-switch (robot-deploy migration, Phase 2 slice 2). Mirrors
  // ToastHoster's src/index.ts scheduled() handler — same design, same reasoning.
  // Cron trigger lives in the top-level wrangler.jsonc `triggers` block (PROD ONLY —
  // env.staging deliberately has no cron; see that block's WHY comment in wrangler.jsonc).
  //
  // WHY a dead-man's-switch: Healthchecks.io alerts on the ABSENCE of a ping, not the
  // presence of a failure report. If the worker is down, misrouted, or this very handler
  // can't run, no ping arrives within the check's period+grace window and HC.io fires the
  // alert itself. The worker never has to correctly detect or report its own failure —
  // every failure mode collapses to the same "silence" signal.
  //
  // WHY a bare heartbeat, NOT a self-fetch of pueblofoodmap.com: this cron runs ON the
  // same worker/zone that serves the site, and a worker fetching its own custom domain
  // trips a Cloudflare loop-guard that returns a non-200 — so probing our own URL would
  // report a false "down" every run (same failure ToastHoster's src/index.ts documents,
  // and the reason it does a bare heartbeat too). The cron firing at all already proves
  // the worker is alive and scheduled; that IS the liveness signal. Pinging the success
  // URL unconditionally is the correct, simpler design.
  async scheduled(_event: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    // Guard: HC_PING_URL is a prod-only runtime secret (`wrangler secret put`, see
    // wrangler.jsonc) — staging never gets it, and a missing value must never throw
    // out of a cron handler, so bail out instead of fetching "undefined".
    if (!env.HC_PING_URL) return;
    ctx.waitUntil(fetch(env.HC_PING_URL).catch(() => {}));
  },
} satisfies ExportedHandler<CloudflareEnv>;

// Re-export the OpenNext-managed Durable Object classes unconditionally — matches what
// .open-next/worker.js itself always exports today (DOQueueHandler, DOShardedTagCache,
// BucketCachePurge), regardless of whether wrangler.jsonc currently binds them, per the
// official custom-worker how-to above. Keeps this wrapper a pure passthrough for
// anything OpenNext generates beyond fetch.
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge };
