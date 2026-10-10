/**
 * sqliteD1.testutil.ts — test-only D1Database shim over better-sqlite3, so a
 * route test can run its real SQL (WHERE clauses, the updated_at
 * precondition, the batch) against a schema built from the real migration
 * files instead of a hand-written mock that can't catch a wrong query.
 * Implements only what the events code calls: prepare().bind().first/all/run
 * and batch() (atomic, like D1's). Never imported by production code.
 */

import Database from "better-sqlite3";

interface ShimStatement {
  bind: (...args: unknown[]) => ShimStatement;
  first: <T>() => Promise<T | null>;
  all: <T>() => Promise<{ results: T[] }>;
  run: () => Promise<{ success: true; meta: { changes: number } }>;
  runSync: () => { success: true; meta: { changes: number } };
}

export function sqliteD1(db: Database.Database): D1Database {
  function prepare(sql: string): ShimStatement {
    let args: unknown[] = [];
    const stmt: ShimStatement = {
      bind(...a) {
        args = a;
        return stmt;
      },
      first: async <T>() => (db.prepare(sql).get(...args) as T | undefined) ?? null,
      all: async <T>() => ({ results: db.prepare(sql).all(...args) as T[] }),
      runSync: () => ({ success: true as const, meta: { changes: db.prepare(sql).run(...args).changes } }),
      run: async () => stmt.runSync(),
    };
    return stmt;
  }
  const shim = {
    prepare,
    batch: async (stmts: ShimStatement[]) => db.transaction(() => stmts.map((s) => s.runSync()))(),
  };
  return shim as unknown as D1Database;
}
