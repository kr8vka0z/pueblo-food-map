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
