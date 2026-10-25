// custom-worker.ts
// Wraps vinext's generated fetch handler (`vinext/server/fetch-handler`) so the
// /ingest PostHog proxy, the noindex policy and a scheduled() cron handler can ride
// alongside it. vinext's handler is fetch() only; a custom entry that delegates to it
// is vinext's own documented pattern (its examples/app-router-cloudflare/worker/index.ts).
// wrangler.jsonc's top-level `main` points here.
//
// WHY a scoped named-type import for ExecutionContext/ExportedHandler/ScheduledController
// (not a bare `wrangler types` full-runtime include, and not `.wrangler`'s own generated
// runtime.d.ts, which is itself gitignored build output — absent in a fresh checkout, so
// relying on it would only work by local-cache accident, not in CI): AGENTS.md's "Don't run
// bare `wrangler types`" bullet documents why this app never enables wrangler's full runtime type set
// (`wrangler types` default) — it collides Cloudflare's HTMLRewriter `Element` with
// lib.dom's `Element` and corrupts DOM types project-wide. cloudflare-env.d.ts already
// works around this by importing only the one runtime type it needs (`D1Database`) from
// `@cloudflare/workers-types/experimental` instead of pulling in the whole ambient set.
// This file follows the exact same pattern for the three Workers runtime types a
// scheduled()-handler signature needs — none of which is `Element` or collides with DOM.
import type { ExecutionContext, ExportedHandler, ScheduledController } from "@cloudflare/workers-types/experimental";
import { runScheduledTasks } from "./src/lib/scheduledTasks";
import { ingestTarget } from "./src/lib/ingestTarget";
import { isExcludedIp } from "./src/lib/ipMatch";
import { applyHostIndexingPolicy } from "./src/lib/indexingHost";
import handler from "vinext/server/fetch-handler";
import { runWithRequestCf } from "./src/lib/cloudflareContext";

export default {
  // /ingest proxy (#485): PostHog's project setting "Discard client IP data"
  // means PostHog itself can never filter Kyle's own home traffic out — the
  // filter has to run upstream of PostHog, here, before a request is ever
  // forwarded. Anything under /ingest that matches ANALYTICS_EXCLUDED_IPS
  // (env var, comma-separated IPs/CIDRs — see src/lib/ipMatch.ts) gets a 204
  // and nothing is sent onward; every other /ingest request is proxied
  // same-origin to the real PostHog host (src/lib/ingestTarget.ts) so
  // ad-blockers that target third-party analytics domains don't hide it.
  // Requests outside /ingest fall straight through to vinext, unchanged.
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const target = ingestTarget(url.pathname, url.search);
    if (target !== null) {
      if (isExcludedIp(request.headers.get("CF-Connecting-IP"), env.ANALYTICS_EXCLUDED_IPS)) {
        return new Response(null, { status: 204 });
      }
      // Forward the method/body/headers as-is; only the destination host+path
      // changes. `redirect: "manual"` isn't needed — PostHog's ingest/assets
      // endpoints don't redirect under normal operation.
      //
      // WHY the cast: `request` is typed via @cloudflare/workers-types (see
      // this file's own header on the scoped ExportedHandler import), but
      // the bare `Request`/`RequestInit` identifiers below resolve to
      // lib.dom's versions (this project deliberately never declares global
      // Request/Response from workers-types — same HTMLRewriter `Element`
      // collision cloudflare-env.d.ts's header documents). Both describe the
      // exact same real Workers-runtime object; the mismatch is structural
      // typing only (their ReadableStream generics disagree), not a real
      // incompatibility.
      const proxied = new Request(target, request as unknown as RequestInit);
      return fetch(proxied);
    }
    // Every host but pueblofoodmap.com (dev., *.workers.dev) gets
    // `X-Robots-Tag: noindex` — src/lib/indexingHost.ts has the why. The
    // canonical host's response is returned untouched.
    // runWithRequestCf: makes request.cf readable from getCloudflareContext() (src/lib/cloudflareContext.ts).
    // `as never`: workers-types' Request/ExecutionContext vs the lib.dom-typed handler signature; same objects at runtime.
    const response = await runWithRequestCf(request.cf, () =>
      handler.fetch(request as never, env as never, ctx as never),
    );
    return applyHostIndexingPolicy(response, url.hostname);
  },

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
  // The ping (HC_PING_URL guard, prod-only secret, never gates anything else) and
  // every daily-gated job riding this same cron (#594 email retention, #238/#234
  // refresh-pipeline alerts) all live in runScheduledTasks (src/lib/scheduledTasks.ts)
  // — moved out of this file specifically so the branching itself is unit-testable.
  // This file's own import of vinext's handler (a Vite virtual module that only exists
  // inside `vite build`) means vitest can never import custom-worker.ts directly, so nothing here can carry
  // test coverage; see scheduledTasks.ts's own header for the full reasoning.
  async scheduled(event: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    runScheduledTasks(event, env, ctx);
  },
} satisfies ExportedHandler<CloudflareEnv>;
