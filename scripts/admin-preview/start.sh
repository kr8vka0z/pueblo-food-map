#!/usr/bin/env bash
# scripts/admin-preview/start.sh — (re)builds and (re)starts the admin preview: the app's Worker in local workerd,
# the sign-in proxy (proxy.ts), and, unless --no-tunnel, a Cloudflare quick tunnel for one public https link.
# Every start resets the made-up data. Safe to run again after code changes; a running tunnel is kept, so the
# public address stays the same. Stop everything with stop.sh. Plain-language guide: README.md beside this file.
#
#   start.sh                production flavour (Publish bar visible; Publish itself cannot reach GitHub)
#   start.sh --staging      staging flavour (shows "Test site: publishing is turned off here")
#   start.sh --no-tunnel    local only, http://127.0.0.1:8792
#   start.sh --foreground   no systemd and no sudo: the parts run as background processes of this script
#                           (for a Mac, or a Linux box without passwordless sudo); stop.sh stops them by saved PID
#
# Rules this tool keeps (do not change them to make the preview easier):
# - It works from OUTSIDE the app: it never loosens the sign-in host list or the Origin check. proxy.ts makes
#   requests look like they reach dev.pueblofoodmap.com instead.
# - Sign-in is seed data (a session row in the LOCAL database, seed-session.sh). Nothing here requests, reads or
#   works out an emailed sign-in code.
# - Everything is local: `wrangler d1 ... --local`, `r2 ... --local`, `vite preview`. Never `wrangler deploy`,
#   never `--remote`. Every tool runs with an empty environment (CLEAN_ENV below), so no CLOUDFLARE_* token or
#   1Password variable can reach it, and nothing here reads 1Password.
# - The public link is a signed-in sandbox on made-up data. It goes to the site owner in chat only, never into
#   a pull request or an issue.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
# Logs, the session token, generated SQL and PID files. .wrangler/ is gitignored, so none of it can be committed.
STATE="$REPO/.wrangler/admin-preview"
WORKER_PORT=8791
PROXY_PORT=8792
U_WORKER=pfm-admin-preview-worker
U_PROXY=pfm-admin-preview-proxy
U_TUNNEL=pfm-admin-preview-tunnel
ADMIN_EMAIL=dana@example.org # made up; the same address is in seed-preview.sql, seed-session.sh and proxy.ts
# First line of the .dev.vars this tool writes. A .dev.vars without it belongs to someone else and is left alone.
DEV_VARS_MARK='# Written by scripts/admin-preview/start.sh for the local admin preview. Delete this file to undo.'

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

cd "$REPO"

# Local-only Worker settings (.dev.vars is gitignored; workerd reads it). A fresh random BETTER_AUTH_SECRET, and
# the made-up admin as the only allowed and owner email. Kept across starts so open browsers stay signed in.
if [ ! -e .dev.vars ]; then
  (umask 077; printf '%s\nADMIN_ALLOWLIST=%s\nADMIN_OWNER_EMAIL=%s\nBETTER_AUTH_SECRET=%s\n' \
    "$DEV_VARS_MARK" "$ADMIN_EMAIL" "$ADMIN_EMAIL" "$(openssl rand -hex 32)" > .dev.vars)
elif [ "$(head -n 1 .dev.vars)" != "$DEV_VARS_MARK" ]; then
  die "$REPO/.dev.vars exists and was not written by this tool; refusing to change it. Move it aside and run again."
fi

say "stopping the Worker and the proxy"
"$HERE/stop.sh" worker proxy >/dev/null

say "building ($([ "$STAGING" = 1 ] && echo staging || echo production) flavour)"
"${CLEAN_ENV[@]}" ${BUILD_ENV[@]+"${BUILD_ENV[@]}"} "$REPO/node_modules/.bin/vite" build >>"$LOG" 2>&1 || { tail -30 "$LOG"; exit 1; }

# The same repo root, database name and --env as the Worker below, so wrangler writes the very local database
# file the Worker reads under .wrangler/state. Nothing here goes near a remote database.
say "migrating and seeding the local database ($DB)"
wr d1 migrations apply "$DB" --local
"${CLEAN_ENV[@]}" "$BUN" "$HERE/gen-live-venues.ts" "$REPO" "$STATE/live-venues.sql" >>"$LOG" 2>&1 || { tail -20 "$LOG"; exit 1; }
for f in "$REPO/scripts/seed-dev.sql" "$STATE/live-venues.sql" "$HERE/seed-preview.sql"; do
  wr d1 execute "$DB" --local --file "$f"
done
# The made-up admin's user and session rows (the proxy signs the matching cookie when it starts).
if [ "$STAGING" = 1 ]; then "$HERE/seed-session.sh" --staging; else "$HERE/seed-session.sh"; fi

# Two flat placeholder JPEGs, committed (images/) so no image library is needed to start.
say "loading placeholder images into local R2"
for k in pv-evt-supper/00000000-0000-4000-8000-000000000001.jpg pending.submissions/00000000-0000-4000-8000-000000000002.jpg; do
  wr r2 object put "$FLYERS/$k" --file "$HERE/images/flyer.jpg" --content-type image/jpeg --local
done
for k in pv-box-ok-2/preview-pending-1.jpg pv-box-low-1/preview-pending-2.jpg pv-box-problem-1/preview-flagged.jpg pv-box-ok-1/preview-approved-1.jpg pv-box-empty-1/preview-approved-2.jpg; do
  wr r2 object put "$PHOTOS/box-photos/$k" --file "$HERE/images/photo.jpg" --content-type image/jpeg --local
done

# Settings the proxy reads; harmless to the Worker and the tunnel.
PART_ENV=(UPSTREAM="http://127.0.0.1:$WORKER_PORT" PORT="$PROXY_PORT" DEV_VARS="$REPO/.dev.vars" STATE_DIR="$STATE")

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
  tpid="$(cat "$STATE/tunnel.pid" 2>/dev/null || true)"
  if { command -v systemctl >/dev/null && systemctl is-active --quiet "$U_TUNNEL"; } \
    || { [[ "$tpid" =~ ^[0-9]+$ ]] && ps -o command= -p "$tpid" 2>/dev/null | grep -q cloudflared; }; then
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

PUBLIC=""
if [ "$TUNNEL" = 1 ]; then
  for _ in $(seq 1 60); do
    PUBLIC=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$STATE/tunnel.log" | tail -1 || true)
    [ -n "$PUBLIC" ] && break
    sleep 1
  done
fi

say "self-check"
"$HERE/selfcheck.sh"

echo
echo "Local:  http://127.0.0.1:$PROXY_PORT/__preview/signin   (signs in, then opens /admin)"
if [ "$TUNNEL" = 1 ]; then
  if [ -n "$PUBLIC" ]; then
    for _ in $(seq 1 30); do
      [ "$(curl -s -o /dev/null -w '%{http_code}' "$PUBLIC/api/health" || true)" = 200 ] && break
      sleep 2
    done
    echo "Public: $PUBLIC/__preview/signin   (send to the site owner in chat only)"
  else
    echo "Public: tunnel address not found yet; see $STATE/tunnel.log"
  fi
fi
echo "Logs:   $STATE/"
