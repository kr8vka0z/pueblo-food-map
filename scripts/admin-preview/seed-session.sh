#!/usr/bin/env bash
# scripts/admin-preview/seed-session.sh — writes the made-up admin's user row and one long-lived session row into
# the preview's own LOCAL database (.wrangler/admin-preview/state, never the ordinary .wrangler/state), so the
# proxy can hand the browser a ready session cookie. Called by start.sh after the other seed files; safe to run on
# its own (re-runnable).
#   seed-session.sh            production-flavour local database
#   seed-session.sh --staging  staging-flavour local database
# WHY plain seed rows: the preview owns its local database and its local BETTER_AUTH_SECRET, so it creates the
# session directly instead of going through sign-in. Nothing here requests, reads or works out an emailed code,
# and nothing touches a remote database (`--local` only). The proxy signs the cookie from the same token.
# The token lives only in files under the gitignored .wrangler/admin-preview/ (mode 600), never on a command line.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
STATE="$REPO/.wrangler/admin-preview"
DB=pueblo-food-map-admin; ENVFLAG=()
[ "${1:-}" = --staging ] && { DB=pueblo-food-map-admin-staging; ENVFLAG=(--env staging); }
TOKEN_FILE="$STATE/session.token"
SQL="$STATE/session-seed.sql"
mkdir -p "$STATE"
umask 077

# Same shape better-auth makes (32 letters/digits). Kept across re-seeds so a running proxy's cookie still
# matches when this script is run on its own.
grep -qxE '[A-Za-z0-9]{32}' "$TOKEN_FILE" 2>/dev/null || openssl rand -hex 16 > "$TOKEN_FILE"
TOKEN=$(cat "$TOKEN_FILE")

# Ids match seed-preview.sql's made-up admin (pv-user-dana) and today's session (pv-sess-a), so saves made in
# the preview group under that session on the Activity page. Dates use the ISO form better-auth writes.
# expiresAt is a year out: better-auth only refreshes a session within updateAge (1 h) of its 12 h window,
# so this row is never rewritten.
NOW="strftime('%Y-%m-%dT%H:%M:%fZ','now')"
cat > "$SQL" <<SQL
DELETE FROM session WHERE userId IN (SELECT id FROM "user" WHERE email = 'dana@example.org' OR id = 'pv-user-dana');
DELETE FROM account WHERE userId IN (SELECT id FROM "user" WHERE email = 'dana@example.org' OR id = 'pv-user-dana');
DELETE FROM passkey WHERE userId IN (SELECT id FROM "user" WHERE email = 'dana@example.org' OR id = 'pv-user-dana');
DELETE FROM "user" WHERE email = 'dana@example.org' OR id = 'pv-user-dana';
INSERT INTO "user" (id, name, email, emailVerified, image, createdAt, updatedAt)
  VALUES ('pv-user-dana', '', 'dana@example.org', 1, NULL, $NOW, $NOW);
INSERT INTO session (id, expiresAt, token, createdAt, updatedAt, ipAddress, userAgent, userId)
  VALUES ('pv-sess-a', strftime('%Y-%m-%dT%H:%M:%fZ','now','+1 year'), '$TOKEN', $NOW, $NOW, '203.0.113.24', 'admin preview seed', 'pv-user-dana');
SQL

cd "$REPO"
# Empty environment, as in start.sh: no CLOUDFLARE_* token or stored wrangler login can reach this call.
env -i HOME="$HOME" PATH="$PATH" WRANGLER_SEND_METRICS=false XDG_CONFIG_HOME="$STATE/xdg" NO_COLOR=1 \
  "$REPO/node_modules/.bin/wrangler" d1 execute "$DB" --local --persist-to "$STATE/state" ${ENVFLAG[@]+"${ENVFLAG[@]}"} --file "$SQL" >>"$STATE/start.log" 2>&1 \
  || { tail -20 "$STATE/start.log"; exit 1; }
