/**
 * sqlChunks.ts — splits a run's generated SQL into batches small enough to
 * pass as a single `wrangler d1 execute --command` argument.
 *
 * Lives here, beside diffEngine.ts and linkHealth.ts, for the same reason
 * those do: scripts/refresh-ingest.ts calls main() at import time, so nothing
 * in it can be unit-tested directly. Pure logic that has to be right belongs
 * in this directory, where a test can import it.
 *
 * WHY this exists at all: a full refresh run is ~45 KB of SQL. Passing it as
 * one argv exceeds Windows' 32,767-character CreateProcess limit and fails
 * with `spawnSync … ENAMETOOLONG` before wrangler even starts. It happens to
 * survive on a Linux GitHub runner (ARG_MAX ~2 MB), which is why the failure
 * only ever showed up locally — the production path worked while every local
 * Windows run died. Found by the first real remote run (107 proposals against
 * the staging database, 2026-09-02).
 *
 * See scripts/refresh-ingest.ts's d1ApplyFile() header for the atomicity
 * ceiling chunking introduces and how to recover from a partial run.
 */

/** Windows' limit is 32,767 for the WHOLE command line; leave room for the node/wrangler paths and flags. */
export const MAX_COMMAND_SQL_CHARS = 24_000;

/**
 * Splits newline-separated SQL statements into groups whose joined length
 * stays under `maxChars`.
 *
 * One statement per line is guaranteed by the writer in refresh-ingest.ts
 * (`statements.join("\n")`), and every statement is single-line because
 * proposed_diff is `JSON.stringify`'d — which escapes a real newline to a
 * literal backslash-n — so splitting on newlines can never cut a string
 * literal in half.
 *
 * ponytail: a single statement longer than `maxChars` is emitted alone rather
 * than split, and would still fail at spawn time. Not guarded because the
 * longest statement this pipeline generates is one INSERT of a proposal row
 * (~1 KB against a 24 KB budget) — splitting a statement is not something a
 * caller could do safely anyway.
 */
export function chunkSqlStatements(sql: string, maxChars: number = MAX_COMMAND_SQL_CHARS): string[] {
  const statements = sql.split("\n").filter((line) => line.trim() !== "");
  const chunks: string[] = [];
  let current: string[] = [];
  let currentChars = 0;

  for (const statement of statements) {
    if (current.length > 0 && currentChars + statement.length + 1 > maxChars) {
      chunks.push(current.join("\n"));
      current = [];
      currentChars = 0;
    }
    current.push(statement);
    currentChars += statement.length + 1;
  }
  if (current.length > 0) chunks.push(current.join("\n"));

  return chunks;
}
