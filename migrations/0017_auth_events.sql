-- migrations/0017_auth_events.sql
--
-- Issue #679: the owner-only admin Activity log (/admin/activity).
--
-- Part 1 — auth_events: a PERMANENT record of every admin sign-in, sign-out,
-- failed sign-in and passkey change. Better Auth's own `session` table can't
-- serve as this history: its rows are deleted on sign-out/expiry, and it
-- records neither the sign-in method nor failed attempts. Written only by
-- src/lib/authEvents.ts (Better Auth hooks wired in auth-options.ts); read
-- only by src/lib/activityLog.ts for the owner's Activity page.
--
-- event:        'sign_in' | 'sign_out' | 'sign_in_failed' | 'passkey_added'
--               | 'passkey_removed' (CHECK below — a new kind is a reviewed
--               migration, never an ad hoc string).
-- email:        the account's email, or the email a rejected sign-in link was
--               requested for (NULL when unknown, e.g. a failed passkey).
-- user_id / session_id: Better Auth's `user.id` / `session.id` (never the
--               session TOKEN). audit_log.session_id (Part 2) joins here.
-- method:       'passkey' | 'email_link' | 'email_code' | NULL.
-- ip / user_agent / city / region / country: from the request
--               (CF-Connecting-IP, User-Agent, Cloudflare's request.cf).
-- detail_json:  small, secret-free extra detail, e.g. {"reason":"INVALID_TOKEN"}.
--               NEVER a sign-in-link token or passkey credential data.
--
-- Retention: kept permanently (tens of rows a week). The 90-day email
-- cleanup (src/lib/emailRetention.ts, #616) must never touch this table or
-- audit_log — emailRetention.test.ts asserts that.
CREATE TABLE auth_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event        TEXT NOT NULL CHECK (event IN ('sign_in','sign_out','sign_in_failed','passkey_added','passkey_removed')),
  email        TEXT,
  user_id      TEXT,
  session_id   TEXT,
  method       TEXT,
  ip           TEXT,
  user_agent   TEXT,
  city         TEXT,
  region       TEXT,
  country      TEXT,
  detail_json  TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_auth_events_created_at ON auth_events(created_at);
CREATE INDEX idx_auth_events_session    ON auth_events(session_id);

-- Part 2 — tie each admin action to the sign-in that made it. Nullable:
-- rows written before this migration, and system actors (refresh-pipeline),
-- stay NULL. Every admin write route fills it from the caller's Better Auth
-- session (AdminIdentity.sessionId, src/lib/adminSession.ts).
--
-- NOT IDEMPOTENT — SQLite's ALTER TABLE ... ADD COLUMN has no IF NOT EXISTS
-- form (same limitation 0011/0012/0015/0016 document). Apply it with
-- `wrangler d1 migrations apply`, never `d1 execute --file`.
ALTER TABLE audit_log ADD COLUMN session_id TEXT;

CREATE INDEX idx_audit_session ON audit_log(session_id);
