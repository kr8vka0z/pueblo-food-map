import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// WHY: the default "dummy" incremental cache never populates
// .open-next/cache/, so /venue/[id] and /report/[venueId] — both
// dynamicParams=false static routes since PR #351 (2026-08-24) — hit
// Next's NoFallbackError on every cache miss and 404. This override reads
// prerendered HTML from Workers Static Assets instead (populated at build
// time by `opennextjs-cloudflare build`'s populateCache step), which fixes
// every prerendered dynamic route. Its tradeoff is no revalidation support
// — acceptable here because nothing in src/ calls revalidate/unstable_cache/
// cacheTag; the publish flow already redeploys on every data change.
// Outage: pueblofoodmap.com 404s on 218/230 public URLs, 2026-08-24 to
// 2026-09-02 (10 days, 19 deploys). See AGENTS.md "Per-venue pages".
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
