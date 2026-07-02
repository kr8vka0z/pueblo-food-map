// cloudflare-env.d.ts — bridges the wrangler-generated `Env` interface into
// the `CloudflareEnv` global interface that @opennextjs/cloudflare's
// getCloudflareContext() reads, and supplies the one Workers runtime type
// (`D1Database`) this project's own .ts files reference directly.
//
// WHY this file exists: @opennextjs/cloudflare ships its own ambient
// `CloudflareEnv` (dist/api/cloudflare-context.d.ts) containing only the
// bindings IT knows about (ISR cache, ASSETS, etc.) — it has no way to know
// about this project's own bindings like ADMIN_DB. `npx wrangler types`
// (run against wrangler.jsonc) generates worker-configuration.d.ts with the
// real `Env` interface, e.g. `ADMIN_DB: D1Database`. TypeScript interface
// declaration merging combines this file's `CloudflareEnv extends Env` with
// @opennextjs/cloudflare's own `CloudflareEnv` declaration, so
// `getCloudflareContext().env.ADMIN_DB` type-checks (src/lib/adminDb.ts).
//
// WHY `D1Database` is imported here from @cloudflare/workers-types rather
// than generated via `wrangler types --include-runtime` (the default): this
// app also targets the DOM (tsconfig `lib: ["dom", ...]` — Mapbox, forms,
// etc.). Wrangler's bundled runtime types include Cloudflare's HTMLRewriter
// `Element` type, which collides with lib.dom's `Element` and silently
// corrupts unrelated DOM types across the whole project (observed: every
// `as HTMLSelectElement` cast in the existing form tests broke, plus
// src/components/Map.tsx's GeoJSON typing) — see #237 checkpoint c report.
// worker-configuration.d.ts is therefore regenerated with
// `--include-runtime=false` (Env/binding shapes only); importing just the
// one runtime type actually used avoids the collision entirely.
// Regenerate worker-configuration.d.ts (`npx wrangler types
// --include-runtime=false`) after any wrangler.jsonc binding change — this
// file itself only needs to change if a *new* binding introduces another
// runtime type (e.g. KVNamespace) alongside D1Database.
import type { D1Database as CFD1Database } from "@cloudflare/workers-types/experimental";

declare global {
  type D1Database = CFD1Database;
  // This MUST stay an `interface` (not eslint's suggested `type` alias) so
  // it declaration-merges with @opennextjs/cloudflare's own
  // `declare global { interface CloudflareEnv {...} }` — a `type` alias
  // cannot merge with an existing interface of the same name and would fail
  // to compile (duplicate identifier) once both are in scope.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface CloudflareEnv extends Env {}
}

export {};
