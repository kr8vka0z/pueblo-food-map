/**
 * auditLog.ts — the one place the audit_log INSERT is written.
 *
 * AUDIT_INSERT_VALUES_SQL: every admin write that records an unconditional
 * audit row binds these eight params in this order.
 *
 * auditInsertIfExistsSql(): writes that must skip the audit row when their
 * own UPDATE didn't apply (a stale `updated_at`, an already-reviewed row) use
 * a SELECT ... WHERE EXISTS form instead, so a rejected write never leaves an
 * audit row claiming it happened (#265). Callers: AUDIT_INSERT_SQL
 * (adminVenueEditSql.ts), EVENT_AUDIT_INSERT_SQL (adminEvents.ts), and the
 * submissions "done" route.
 */
const AUDIT_INSERT_INTO =
  "INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp, session_id)";

export const AUDIT_INSERT_VALUES_SQL = `${AUDIT_INSERT_INTO} VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

/** `selectList`: the eight column values, `?` or SQL literals. `existsGuard`: the subquery that must return a row. */
export function auditInsertIfExistsSql(selectList: string, existsGuard: string): string {
  return `${AUDIT_INSERT_INTO}\n  SELECT ${selectList}\n  WHERE EXISTS (${existsGuard})`;
}

/**
 * The unconditional audit row as a prepared statement, for a route's
 * db.batch(). `before`/`after` are JSON-encoded here; null stays SQL NULL
 * (a create has no before row). session_id ties the action to the sign-in
 * that made it (#679, the owner's Activity log).
 */
export function auditStatement(
  db: D1Database,
  identity: { email: string; sessionId?: string },
  row: { entity: string; entityId: string; action: string; before: unknown; after: unknown; timestamp: string },
): ReturnType<D1Database["prepare"]> {
  return db
    .prepare(AUDIT_INSERT_VALUES_SQL)
    .bind(
      identity.email,
      row.entity,
      row.entityId,
      row.action,
      row.before === null ? null : JSON.stringify(row.before),
      row.after === null ? null : JSON.stringify(row.after),
      row.timestamp,
      identity.sessionId ?? null,
    );
}
