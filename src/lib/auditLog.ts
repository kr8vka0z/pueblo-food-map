/**
 * auditLog.ts — the shared plain (VALUES-form) audit_log INSERT.
 *
 * Every admin write that records an unconditional audit row binds these eight
 * params in this order. Writes that must skip the audit row when their own
 * UPDATE didn't apply use a SELECT ... WHERE EXISTS form instead (see
 * AUDIT_INSERT_SQL in adminVenueEditSql.ts and EVENT_AUDIT_INSERT_SQL in
 * adminEvents.ts).
 */
export const AUDIT_INSERT_VALUES_SQL =
  "INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
