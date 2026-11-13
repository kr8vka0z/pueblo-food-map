#!/usr/bin/env bash
# scripts/admin-preview/start.sh — (re)builds and (re)starts the admin preview: the app's Worker in local workerd,
# the sign-in proxy (proxy.ts), and, unless --no-tunnel, a Cloudflare quick tunnel for one public https link.
# Every start empties the preview's own storage and seeds it again. Safe to run again after code changes; a
# running tunnel is kept (same public address), except with --no-tunnel, which stops it. Exits non-zero, with
# no public link printed and the tunnel stopped, when a requested public link does not come up or any later step
# fails. Stop everything with stop.sh.
# Plain-language guide: README.md beside this file.
#
#   start.sh                production flavour (Publish bar visible; Publish itself cannot reach GitHub)
#   start.sh --staging      staging flavour (shows "Test site: publishing is turned off here")
#   start.sh --no-tunnel    local only, http://127.0.0.1:8792; also stops a tunnel an earlier start left running
#   start.sh --foreground   no systemd and no sudo: the parts run as background processes of this script
#                           (for a Mac, or a Linux box without passwordless sudo); stop.sh stops them by saved PID
#
# Rules this tool keeps (do not change them to make the preview easier):
# - It works from OUTSIDE the app: it never loosens the sign-in host list or the Origin check. proxy.ts makes
#   requests look like they reach dev.pueblofoodmap.com instead.
# - Sign-in is seed data (a session row in the LOCAL database, seed-session.sh). Nothing here requests, reads or
#   works out an emailed sign-in code.
# - Its own storage: the Worker and every wrangler call use STORE below, deleted and recreated empty on every
#   start, so nothing from the ordinary `.wrangler/state` (or from an earlier preview) is ever reachable
#   through the public link, and the ordinary store is never read or written.
# - Its own secrets: the Worker loads only the file the build leaves next to its config (dist/server/.dev.vars).
#   That file is overwritten after every build with WORKER_VARS, written fresh here with exactly ALLOWED_KEYS,
#   and checked just before the Worker starts. The developer's own .dev.vars / .env files never reach it.
# - Everything is local: `wrangler d1 ... --local`, `r2 ... --local`, `vite preview`. Never `wrangler deploy`,
#   never `--remote`. Every tool runs with an empty environment (CLEAN_ENV below), and the start refuses if a
#   repo-root .env file would put a CLOUDFLARE_*/WRANGLER_* variable back in. Nothing here reads 1Password.
# - The public link is a signed-in sandbox on made-up data. It goes to the site owner in chat only, never into
#   a pull request or an issue.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
# Logs, the session token, generated SQL, secrets and PID files. .wrangler/ is gitignored, so none of it can be
# committed.
STATE="$REPO/.wrangler/admin-preview"
# The preview's own local D1 and R2 (absolute: vite resolves it from the repo root, wrangler from the cwd).
STORE="$STATE/state"
WORKER_VARS="$STATE/worker.dev.vars"
ALLOWED_KEYS="ADMIN_ALLOWLIST ADMIN_OWNER_EMAIL BETTER_AUTH_SECRET" # sorted; the Worker gets these and nothing else
WORKER_PORT=8791
PROXY_PORT=8792
U_WORKER=pfm-admin-preview-worker
U_PROXY=pfm-admin-preview-proxy
U_TUNNEL=pfm-admin-preview-tunnel
ADMIN_EMAIL=dana@example.org # made up; the same address is in seed-preview.sql, seed-session.sh and proxy.ts

TUNNEL=1; STAGING=0; FOREGROUND=0
for a in "$@"; do
  case "$a" in
    --no-tunnel) TUNNEL=0 ;;
    --staging) STAGING=1 ;;
    --foreground) FOREGROUND=1 ;;
    *) echo "unknown flag: $a (flags: --no-tunnel, --staging, --foreground)" >&2; exit 2 ;;
  esac
done

die() { echo "admin-preview: $*" >&2; exit 1; }
say() { echo "== $*"; }

if [ "$FOREGROUND" = 0 ]; then
  command -v systemd-run >/dev/null || die "systemd-run not found; run with --foreground instead"
  sudo -n true 2>/dev/null || die "the default mode needs passwordless sudo for systemd-run; run with --foreground instead"
fi
BUN="$(command -v bun || true)"
[ -n "$BUN" ] || { [ -x "$HOME/.bun/bin/bun" ] && BUN="$HOME/.bun/bin/bun"; } || die "bun not found (https://bun.sh)"
command -v openssl >/dev/null || die "openssl not found"
if [ "$TUNNEL" = 1 ]; then
  CLOUDFLARED="$(command -v cloudflared || true)"
  [ -n "$CLOUDFLARED" ] || die "cloudflared not found; install it or run with --no-tunnel"
fi
[ -x "$REPO/node_modules/.bin/vite" ] || die "node_modules missing; run npm ci in $REPO first"

# WHY: the Cloudflare vite plugin and wrangler load CLOUDFLARE_*/WRANGLER_* variables from the repo-root .env
# files into their own process (vite.loadEnv), undoing the empty environment below. Such a variable could carry
# an API token or switch what the Worker loads, so the start refuses. Names only, never values.
for f in "$REPO"/.env*; do
  [ -f "$f" ] && [ "$(basename "$f")" != .env.example ] || continue
  keys=$(grep -oE '^[[:space:]]*(export[[:space:]]+)?(CLOUDFLARE_|WRANGLER_)[A-Za-z0-9_]*[[:space:]]*=' "$f" | sed -E 's/^[[:space:]]*(export[[:space:]]+)?//; s/[[:space:]]*=$//' | sort -u | tr '\n' ' ' || true)
  [ -z "$keys" ] || die "$f sets ${keys% }; the preview would load it. Move that file aside (or remove those lines) and run again."
done

if [ "$STAGING" = 1 ]; then
  DB=pueblo-food-map-admin-staging; ENVFLAG=(--env staging); PHOTOS=pfm-box-photos-staging; FLYERS=pfm-event-flyers-staging; BUILD_ENV=(CLOUDFLARE_ENV=staging)
else
  DB=pueblo-food-map-admin; ENVFLAG=(); PHOTOS=pfm-box-photos; FLYERS=pfm-event-flyers; BUILD_ENV=()
fi

mkdir -p "$STATE"; chmod 700 "$STATE"
LOG="$STATE/start.log"
: > "$LOG"
# Every tool runs with an empty environment: no Cloudflare/1Password/PostHog variable can leak into the build,
# wrangler or the running parts, and XDG_CONFIG_HOME points wrangler at an empty folder (no stored login).
CLEAN_ENV=("$(command -v env)" -i HOME="$HOME" PATH="$PATH" WRANGLER_SEND_METRICS=false XDG_CONFIG_HOME="$STATE/xdg" NO_COLOR=1)
# ${arr[@]+...} because macOS's bash 3.2 treats an empty array as unset under `set -u`.
wr() { "${CLEAN_ENV[@]}" "$REPO/node_modules/.bin/wrangler" "$@" ${ENVFLAG[@]+"${ENVFLAG[@]}"} >>"$LOG" 2>&1 || { tail -20 "$LOG"; exit 1; }; }

tunnel_running() {
  local tpid
  tpid="$(cat "$STATE/tunnel.pid" 2>/dev/null || true)"
  { command -v systemctl >/dev/null && systemctl is-active --quiet "$U_TUNNEL"; } \
    || { [[ "$tpid" =~ ^[0-9]+$ ]] && ps -o command= -p "$tpid" 2>/dev/null | grep -q cloudflared; }
}

cd "$REPO"

# WHY first: the Worker is about to be replaced, and with --no-tunnel an earlier start's public address must not
# go on serving the new sandbox.
if [ "$TUNNEL" = 0 ] && tunnel_running; then
  say "--no-tunnel: stopping the public tunnel an earlier start left running (its address stops working)"
  "$HERE/stop.sh" tunnel
fi
# WHY: from here on a kept tunnel would serve whatever this start leaves behind. If the start fails at any later
# step (build, seed, secrets check, self-check), the public address must not go on serving it.
on_exit() {
  local rc=$?
  if [ "$rc" != 0 ] && tunnel_running; then
    echo "admin-preview: start failed; stopped the public tunnel, so no public link is serving this preview" >&2
    "$HERE/stop.sh" tunnel >/dev/null
  fi
}
trap on_exit EXIT
say "stopping the Worker and the proxy"
"$HERE/stop.sh" worker proxy >/dev/null

# The Worker is stopped, so nothing holds the store open: recreate it empty.
rm -rf "$STORE"; mkdir -p "$STORE"

say "building ($([ "$STAGING" = 1 ] && echo staging || echo production) flavour)"
"${CLEAN_ENV[@]}" ${BUILD_ENV[@]+"${BUILD_ENV[@]}"} "$REPO/node_modules/.bin/vite" build >>"$LOG" 2>&1 || { tail -30 "$LOG"; exit 1; }

# The Worker's secrets, fresh every start: a new random BETTER_AUTH_SECRET (a browser signed in before this
# start is sent through /__preview/signin again) and the made-up admin as the only allowed and owner email.
(umask 077; printf 'ADMIN_ALLOWLIST=%s\nADMIN_OWNER_EMAIL=%s\nBETTER_AUTH_SECRET=%s\n' \
  "$ADMIN_EMAIL" "$ADMIN_EMAIL" "$(openssl rand -hex 32)" > "$WORKER_VARS")
# WHY overwrite the build output: `vite build` copies the developer's root .dev.vars (or .env files) next to the
# built Worker config, and `vite preview` loads secrets from that folder only (wrangler getVarsForDev, relative
# to dist/server/wrangler.json). Every secrets file there is removed and replaced with ours.
CONFIG_DIRS=$(find "$REPO/dist" -name wrangler.json -exec dirname {} \;)
[ "$CONFIG_DIRS" = "$REPO/dist/server" ] || die "expected one built Worker config in dist/server, found: ${CONFIG_DIRS:-none}"
find "$REPO/dist" \( -name '.dev.vars*' -o -name '.env*' \) -type f -delete
(umask 077; cp "$WORKER_VARS" "$REPO/dist/server/.dev.vars")

# The same database name and --env as the Worker below, and the same STORE, so wrangler writes the very local
# database the Worker reads. Nothing here goes near a remote database.
say "migrating and seeding the local database ($DB)"
wr d1 migrations apply "$DB" --local --persist-to "$STORE"
"${CLEAN_ENV[@]}" "$BUN" "$HERE/gen-live-venues.ts" "$REPO" "$STATE/live-venues.sql" >>"$LOG" 2>&1 || { tail -20 "$LOG"; exit 1; }
for f in "$REPO/scripts/seed-dev.sql" "$STATE/live-venues.sql" "$HERE/seed-preview.sql"; do
  wr d1 execute "$DB" --local --persist-to "$STORE" --file "$f"
done
# The made-up admin's user and session rows (the proxy signs the matching cookie when it starts).
if [ "$STAGING" = 1 ]; then "$HERE/seed-session.sh" --staging; else "$HERE/seed-session.sh"; fi

# Two flat placeholder JPEGs, committed (images/) so no image library is needed to start.
say "loading placeholder images into local R2"
for k in pv-evt-supper/00000000-0000-4000-8000-000000000001.jpg pending.submissions/00000000-0000-4000-8000-000000000002.jpg; do
  wr r2 object put "$FLYERS/$k" --file "$HERE/images/flyer.jpg" --content-type image/jpeg --local --persist-to "$STORE"
done
for k in pv-box-ok-2/preview-pending-1.jpg pv-box-low-1/preview-pending-2.jpg pv-box-problem-1/preview-flagged.jpg pv-box-ok-1/preview-approved-1.jpg pv-box-empty-1/preview-approved-2.jpg; do
  wr r2 object put "$PHOTOS/box-photos/$k" --file "$HERE/images/photo.jpg" --content-type image/jpeg --local --persist-to "$STORE"
done

# Last look before the Worker starts: exactly one secrets file beside its config, holding exactly ALLOWED_KEYS.
found=$(cd "$REPO/dist" && find . \( -name '.dev.vars*' -o -name '.env*' \) -type f | sort | tr '\n' ' ')
[ "$found" = "./server/.dev.vars " ] || die "unexpected secrets files in dist/: $found"
keys=$(sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' "$REPO/dist/server/.dev.vars" | sort | tr '\n' ' ')
[ "$keys" = "$ALLOWED_KEYS " ] || die "dist/server/.dev.vars holds keys '$keys', expected exactly '$ALLOWED_KEYS'"

# Settings for the parts. PFM_ADMIN_PREVIEW_PERSIST points the Worker at STORE (vite.config.ts); the
# CLOUDFLARE_ ones make sure no .env file or process variable is ever used in place of dist/server/.dev.vars.
PART_ENV=(UPSTREAM="http://127.0.0.1:$WORKER_PORT" PORT="$PROXY_PORT" DEV_VARS="$WORKER_VARS" STATE_DIR="$STATE"
  PFM_ADMIN_PREVIEW_PERSIST="$STORE" CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false CLOUDFLARE_INCLUDE_PROCESS_ENV=false)

# run_part <part> <unit> <workdir> <cmd...>: starts one long-running part, logging to $STATE/<part>.log.
# Default: a transient systemd unit as the current user, so it outlives the shell (or agent session) that
# started it. --foreground: a background process in its own process group (set -m), its PID saved for stop.sh.
run_part() {
  local part=$1 unit=$2 wd=$3; shift 3
  local logf="$STATE/$part.log"
  # A fresh log owned by this user: systemd opens append: files as root, and an old root-owned log could not be
  # truncated next time.
  rm -f "$logf"; : > "$logf"
  if [ "$FOREGROUND" = 1 ]; then
    set -m
    ( cd "$wd" && exec nohup "${CLEAN_ENV[@]}" "${PART_ENV[@]}" "$@" >>"$logf" 2>&1 </dev/null ) &
    echo $! > "$STATE/$part.pid"
    set +m
  else
    sudo -n systemctl reset-failed "$unit" 2>/dev/null || true
    sudo -n systemd-run --unit="$unit" --collect --uid="$(id -un)" --gid="$(id -gn)" -p WorkingDirectory="$wd" \
      -p StandardOutput=append:"$logf" -p StandardError=append:"$logf" \
      "${CLEAN_ENV[@]}" "${PART_ENV[@]}" "$@" >/dev/null
  fi
}

say "starting the Worker on 127.0.0.1:$WORKER_PORT"
run_part worker "$U_WORKER" "$REPO" "$REPO/node_modules/.bin/vite" preview --port "$WORKER_PORT" --strictPort --host 127.0.0.1
say "starting the proxy on 127.0.0.1:$PROXY_PORT"
run_part proxy "$U_PROXY" "$STATE" "$BUN" "$HERE/proxy.ts"

if [ "$TUNNEL" = 1 ]; then
  if tunnel_running; then
    say "tunnel already running (address unchanged)"
  else
    say "starting the tunnel"
    # WHY an empty config file: without --config, cloudflared reads ~/.cloudflared/config.yml, whose ingress
    # rules (for some other named tunnel) could take over the quick tunnel.
    : > "$STATE/empty-cloudflared.yml"
    run_part tunnel "$U_TUNNEL" "$STATE" "$CLOUDFLARED" tunnel --no-autoupdate --config "$STATE/empty-cloudflared.yml" --url "http://localhost:$PROXY_PORT"
  fi
fi

say "waiting for the app to answer"
code=""
for _ in $(seq 1 120); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PROXY_PORT/api/health" || true)
  [ "$code" = 200 ] && break
  sleep 1
done
[ "$code" = 200 ] || die "app did not answer (last: $code); see $STATE/worker.log and $STATE/proxy.log"

say "self-check"
"$HERE/selfcheck.sh"

LOCAL="http://127.0.0.1:$PROXY_PORT/__preview/signin"
if [ "$TUNNEL" = 1 ]; then
  PUBLIC=""; ok=0
  for _ in $(seq 1 60); do
    PUBLIC=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$STATE/tunnel.log" 2>/dev/null | tail -1 || true)
    [ -n "$PUBLIC" ] && break
    sleep 1
    tunnel_running || break # it exited: no address will come
  done
  if [ -n "$PUBLIC" ]; then
    for _ in $(seq 1 30); do
      # WHY also over DNS-over-HTTPS (Cloudflare's 1.1.1.1, which serves trycloudflare.com anyway): a local
      # resolver that looked the brand-new name up a moment too early caches "no such name" for about a
      # minute, although the tunnel already answers everyone else.
      [ "$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$PUBLIC/api/health" || true)" = 200 ] && { ok=1; break; }
      [ "$(curl -s -o /dev/null -m 10 --doh-url https://1.1.1.1/dns-query -w '%{http_code}' "$PUBLIC/api/health" || true)" = 200 ] && { ok=1; break; }
      sleep 2
    done
  fi
  if [ "$ok" = 0 ]; then
    lasterr=$(grep ' ERR ' "$STATE/tunnel.log" 2>/dev/null | grep -v 'was empty' | tail -1 || true)
    # WHY stop it: a tunnel that comes up later would be a public link nobody was told about.
    "$HERE/stop.sh" tunnel >/dev/null
    why=$([ -n "$PUBLIC" ] && echo "the tunnel address never answered" || echo "no tunnel address appeared")
    echo
    echo "Local:  $LOCAL   (still running, this machine only)"
    echo "admin-preview: public link FAILED: $why; the tunnel was stopped and no public link exists." >&2
    echo "  tunnel log: $STATE/tunnel.log${lasterr:+ (last error: $lasterr)}" >&2
    echo "  Run start.sh again for a new tunnel, or start.sh --no-tunnel for local only." >&2
    exit 1
  fi
fi

echo
echo "Local:  $LOCAL   (signs in, then opens /admin)"
[ "$TUNNEL" = 1 ] && echo "Public: $PUBLIC/__preview/signin   (send to the site owner in chat only)"
echo "Logs:   $STATE/"
