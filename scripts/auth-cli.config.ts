/**
 * scripts/auth-cli.config.ts — CLI-only Better Auth config for
 * `@better-auth/cli generate`/`migrate` (#314 Phase 1).
 *
 * NEVER imported by runtime app code — src/lib/auth.ts builds its own
 * instance against the real ADMIN_DB D1 binding via getCloudflareContext().
 * This file exists solely so the CLI (run in plain Node, outside any
 * Workers request context) has SOMETHING to import: `@better-auth/cli`
 * loads the exported `auth` instance via jiti to introspect its schema and
 * diff it against the target migrations directory.
 *
 * WHY an in-memory better-sqlite3 database, not a raw D1Database (stub or
 * real): `@better-auth/cli@1.4.21` bundles its OWN pinned copy of
 * `better-auth@1.4.21` (node_modules/@better-auth/cli/node_modules/
 * better-auth) — released before D1 support existed — and its internal
 * `getAdapter()`/`getMigrations()` calls resolve `better-auth/db` against
 * THAT nested copy, not this project's top-level `better-auth@1.6.23`. Its
 * structural database-type detection (createKyselyAdapter in that old
 * copy's dialect.mjs) has no D1 branch at all, so handing it a raw
 * D1Database — real or stubbed — always throws "Failed to initialize
 * database adapter" (verified empirically). This is a real gap in
 * @better-auth/cli 1.4.21, not a config mistake.
 *
 * The generated SQL is unaffected by this substitution: Better Auth's
 * schema/migration generator branches on the coarse `databaseType` enum
 * ("sqlite" | "mysql" | "pg" | "mssql"), not on the specific physical
 * driver — D1 IS SQLite-compatible SQL, so a plain in-memory SQLite
 * (better-sqlite3, `:memory:`, thrown away after generation) produces
 * identical "sqlite"-flavored CREATE TABLE output to what a live D1
 * connection would. `better-sqlite3` is already present in node_modules
 * (a transitive dependency of `better-auth`'s own devDependency graph) and
 * pinned here explicitly as a devDependency for stability. Runtime
 * behavior — actually applying/executing against D1 via `db.batch()`, never
 * raw transactions — is unaffected; only THIS generation step routes around
 * the CLI's stale nested dependency.
 */

import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
import { buildAuthOptions } from "../src/lib/auth-options";

export const auth = betterAuth(
  buildAuthOptions(new Database(":memory:")),
);
