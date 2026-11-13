#!/usr/bin/env bash
# scripts/admin-preview/selfcheck.sh — the preview tool's one runnable check: proves the preview works end to
# end AND that the app's own gates are untouched (a foreign Origin is refused, the Worker with no cookie shows no
# admin content), and that the Worker loaded only the tool's own secrets file. Ends "SELF-CHECK OK" or exits
# non-zero.
#
#   selfcheck.sh                          check the running preview (what start.sh runs; safe to run on its own
#                                         while the preview is running; only talks to 127.0.0.1)
#   selfcheck.sh --lifecycle [--foreground]
#       the start/stop proofs, run by hand after changing start.sh or stop.sh (several builds, a few minutes):
#       a repo-root .env with a CLOUDFLARE_* key makes start refuse; fake keys in the root .dev.vars,
#       .dev.vars.staging and .env.local never reach the Worker (Publish says its key isn't set up, no fake value
#       anywhere in the build output or the preview's storage); the ordinary .wrangler/state is not touched; a
#       place and an event made in the preview are gone after the next start; when cloudflared is installed,
#       start.sh --no-tunnel stops an earlier tunnel and its public address stops answering, and a tunnel that
#       fails to start makes start.sh exit non-zero without printing a public link. Needs a repo root with no
#       .dev.vars* or .env* file (other than .env.example), since it writes fake ones there and removes them.
#       It restarts and finally stops any running preview and tunnel, and calls the public address it opens.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
STATE="$REPO/.wrangler/admin-preview"
P=http://127.0.0.1:8792      # through the proxy
W=http://127.0.0.1:8791      # the Worker directly, no proxy
ALLOWED_KEYS="ADMIN_ALLOWLIST ADMIN_OWNER_EMAIL BETTER_AUTH_SECRET" # the same list as start.sh
mkdir -p "$STATE"
JAR=$(mktemp "$STATE/.jar.XXXXXX"); BODY=$(mktemp "$STATE/.body.XXXXXX")
trap 'rm -f "$JAR" "$BODY"' EXIT
fails=0
pass() { echo "PASS $*"; }
fail() { echo "FAIL $*"; fails=$((fails + 1)); }
get() { curl -sS -L -b "$JAR" -c "$JAR" -H 'Accept: text/html' -o "$BODY" -w '%{http_code} %{url_effective}' "$@"; }
# /api/health status, 200 if either the local resolver or DNS-over-HTTPS reaches it (start.sh says why).
health() {
  local a b
  a=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$1/api/health" || true)
  [ "$a" = 200 ] || [[ "$1" != https://* ]] && { echo "$a"; return; }
  b=$(curl -s -o /dev/null -m 10 --doh-url https://1.1.1.1/dns-query -w '%{http_code}' "$1/api/health" || true)
  echo "$b"
}
tunnel_up() {
  { command -v systemctl >/dev/null && systemctl is-active --quiet pfm-admin-preview-tunnel; } \
    || { p=$(cat "$STATE/tunnel.pid" 2>/dev/null) && [[ "$p" =~ ^[0-9]+$ ]] && ps -o command= -p "$p" 2>/dev/null | grep -q cloudflared; }
}

lifecycle() {
  # out and stub stay global: the EXIT trap below runs after this function returns.
  local extra=("$@") sent=SENTINEL-NOT-A-REAL-KEY f url tag
  for f in "$REPO"/.dev.vars* "$REPO"/.env*; do
    [ -e "$f" ] && [ "$(basename "$f")" != .env.example ] && { echo "lifecycle: move $f aside first (this check writes fake key files in the repo root)"; exit 2; }
  done
  out=$(mktemp "$STATE/.out.XXXXXX"); stub=$(mktemp -d "$STATE/.stub.XXXXXX")
  trap 'rm -f "$JAR" "$BODY" "$out" "$REPO/.env" "$REPO/.dev.vars" "$REPO/.dev.vars.staging" "$REPO/.env.local"; rm -rf "$stub"; "$HERE/stop.sh" >/dev/null' EXIT
  run() { "$HERE/start.sh" ${extra[@]+"${extra[@]}"} "$@" >"$out" 2>&1; }

  echo "-- L1 a CLOUDFLARE_* key in a root .env makes start refuse"
  printf 'CLOUDFLARE_API_TOKEN=%s-cloudflare\n' "$sent" > "$REPO/.env"
  if run --no-tunnel; then fail "L1 start did not refuse"
  elif grep -q 'sets CLOUDFLARE_API_TOKEN' "$out" && ! grep -q "$sent" "$out"; then pass "L1 refused: $(grep -o 'sets CLOUDFLARE_API_TOKEN.*' "$out" | head -c 60)..."
  else fail "L1 unexpected refusal: $(tail -2 "$out")"; fi
  rm -f "$REPO/.env"

  echo "-- L2 fake keys in the root .dev.vars, .dev.vars.staging and .env.local never reach the Worker"
  for f in .dev.vars .dev.vars.staging .env.local; do
    printf 'RESEND_API_KEY=%s-resend\nGITHUB_PUBLISH_TOKEN=%s-github\nPOSTHOG_PERSONAL_API_KEY=%s-posthog\n' "$sent" "$sent" "$sent" > "$REPO/$f"
  done
  printf 'CLOUDFLARE_API_TOKEN=%s-cloudflare\n' "$sent" >> "$REPO/.dev.vars"
  touch "$STATE/.ordinary-stamp"; sleep 1
  if ! run --no-tunnel; then fail "L2 start failed: $(tail -5 "$out")"; return; fi
  grep -q 'SELF-CHECK OK' "$out" && pass "L2 start with fake keys present -> SELF-CHECK OK" || fail "L2 no SELF-CHECK OK"
  if grep -rlq "$sent" "$REPO/dist" "$STATE/state" 2>/dev/null; then fail "L2 a fake key value is in dist/ or the preview storage"
  else pass "L2 no fake key value anywhere in dist/ or .wrangler/admin-preview/state"; fi
  get "$P/__preview/signin" >/dev/null
  code=$(curl -sS -b "$JAR" -o "$BODY" -w '%{http_code}' -X POST -H "Origin: $P" -H 'Content-Type: application/json' -d '{}' "$P/api/admin/publish")
  if [ "$code" = 503 ] && grep -q publish_not_configured "$BODY"; then pass "L2 Publish -> 503 publish_not_configured (GITHUB_PUBLISH_TOKEN absent in the Worker)"
  else fail "L2 Publish -> $code $(head -c 120 "$BODY")"; fi

  echo "-- L3 the ordinary .wrangler/state is not touched"
  if [ -d "$REPO/.wrangler/state" ] && [ -n "$(find "$REPO/.wrangler/state" -newer "$STATE/.ordinary-stamp" | head -1)" ]; then
    fail "L3 files under .wrangler/state changed during the start"
  else pass "L3 nothing under .wrangler/state changed during the start"; fi

  echo "-- L4 a place and an event made in the preview are gone after the next start"
  tag="Lifecycle check $RANDOM$RANDOM"
  code=$(curl -sS -b "$JAR" -o "$BODY" -w '%{http_code}' -X POST -H "Origin: $P" -H 'Content-Type: application/json' \
    -d "{\"name\":\"$tag place\",\"category\":\"pantry\",\"lat\":38.25,\"lng\":-104.6,\"address\":\"1 Made Up St, Pueblo, CO\",\"source\":\"Manual entry\",\"last_verified\":\"2026-11-01\"}" "$P/api/admin/venues")
  [ "$code" = 201 ] || [ "$code" = 200 ] || fail "L4 create place -> $code $(head -c 200 "$BODY")"
  code=$(curl -sS -b "$JAR" -o "$BODY" -w '%{http_code}' -X POST -H "Origin: $P" -H 'Content-Type: application/json' \
    -d "{\"action\":\"save_draft\",\"name\":\"$tag event\",\"starts_at_local\":\"2026-12-05T10:00\",\"ends_at_local\":\"2026-12-05T12:00\",\"address\":\"1 Made Up St, Pueblo, CO\",\"lat\":38.25,\"lng\":-104.6}" "$P/api/admin/events")
  [ "$code" = 201 ] || [ "$code" = 200 ] || fail "L4 create event -> $code $(head -c 200 "$BODY")"
  for page in places events; do
    get "$P/admin/$page" >/dev/null
    grep -q "$tag" "$BODY" && pass "L4 /admin/$page shows the new $tag row" || fail "L4 /admin/$page does not show the new row"
  done
  rm -f "$REPO/.dev.vars" "$REPO/.dev.vars.staging" "$REPO/.env.local"
  if ! run --no-tunnel; then fail "L4 restart failed: $(tail -5 "$out")"; return; fi
  get "$P/__preview/signin" >/dev/null
  for page in places events; do
    get "$P/admin/$page" >/dev/null
    grep -q "$tag" "$BODY" && fail "L4 /admin/$page still shows the row after a restart" || pass "L4 /admin/$page: the row is gone after a restart"
  done

  if ! command -v cloudflared >/dev/null; then echo "-- L5/L6 skipped: cloudflared not installed"; return; fi
  echo "-- L5 start with a tunnel, then --no-tunnel stops it"
  if ! run; then fail "L5 start with a tunnel failed: $(tail -4 "$out")"; return; fi
  url=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$out" | tail -1)
  [ -n "$url" ] && [ "$(health "$url")" = 200 ] && pass "L5 public address answers /api/health 200" || fail "L5 public address not answering"
  if ! run --no-tunnel; then fail "L5 --no-tunnel start failed: $(tail -4 "$out")"; return; fi
  grep -q 'stopping the public tunnel' "$out" && pass "L5 --no-tunnel said it stopped the tunnel" || fail "L5 --no-tunnel did not mention the tunnel"
  tunnel_up && fail "L5 tunnel unit/process still running" || pass "L5 tunnel unit/process gone"
  grep -q trycloudflare "$out" && fail "L5 --no-tunnel printed a public address" || pass "L5 --no-tunnel printed no public address"
  code=200; for _ in $(seq 1 10); do code=$(health "$url"); [ "$code" != 200 ] && break; sleep 3; done
  [ "$code" != 200 ] && pass "L5 old public address no longer answers (/api/health -> $code)" || fail "L5 old public address still answers 200"

  echo "-- L6 a tunnel that fails to start: non-zero exit, no public link, local preview still up"
  "$HERE/stop.sh" >/dev/null
  printf '#!/bin/sh\necho "ERR stub cloudflared: failing on purpose" >&2\nexit 1\n' > "$stub/cloudflared"; chmod +x "$stub/cloudflared"
  if PATH="$stub:$PATH" run; then fail "L6 start exited 0"; else pass "L6 start exited non-zero ($(grep -o 'public link FAILED[^;]*' "$out"))"; fi
  grep -qE '^Public:|trycloudflare' "$out" && fail "L6 a public link was printed" || pass "L6 no public link printed"
  [ "$(health "http://127.0.0.1:8792")" = 200 ] && pass "L6 local preview still answers" || fail "L6 local preview down"
  tunnel_up && fail "L6 tunnel still running" || pass "L6 no tunnel left running"
}

if [ "${1:-}" = --lifecycle ]; then
  shift
  lifecycle "$@"
  [ "$fails" = 0 ] && echo "LIFECYCLE OK" || { echo "LIFECYCLE FAILED ($fails)"; exit 1; }
  exit 0
fi

# 1. auto sign-in lands on /admin, signed in as the made-up admin
read -r code url < <(get "$P/__preview/signin")
if [ "$code" = 200 ] && [ "${url%%\?*}" = "$P/admin" ] && grep -q 'Signed in as' "$BODY" && grep -q 'dana@example.org' "$BODY"; then
  pass "1 /__preview/signin -> $url 200, 'Signed in as dana@example.org'"
else fail "1 /__preview/signin -> $code $url"; exit 1; fi

# 2. every admin page renders signed in (not the sign-in form)
for path in /admin /admin/boxes /admin/places /admin/events /admin/activity /admin/venues/new /admin/events/new \
  /admin/venues/test-soup-kitchen-01/edit /admin/venues/pv-box-ok-1/edit /admin/events/pv-evt-supper/edit; do
  read -r code url < <(get "$P$path")
  if [ "$code" = 200 ] && [ "${url%%\?*}" = "$P$path" ] && grep -q 'Signed in as' "$BODY" && ! grep -q 'id="admin-login-email"' "$BODY"; then
    pass "2 $path 200"
  else fail "2 $path -> $code $url"; fi
done

# 2b. the seeded placeholder images are served from local R2 (box photo, event flyer, sent-in flyer)
for path in /api/admin/box-photos/900203/preview /api/admin/events/pv-evt-supper/flyer /api/admin/event-submissions/pv-esub-1/flyer; do
  ct=$(curl -sS -b "$JAR" -o /dev/null -w '%{http_code} %{content_type}' "$P$path")
  [ "$ct" = "200 image/jpeg" ] && pass "2b $path image" || fail "2b $path -> $ct"
done

# 3. a harmless admin write passes the origin check through the proxy (rejects sacrificial proposal 900099;
#    re-seeding restores it), and a foreign Origin is still refused by the app
code=$(curl -sS -b "$JAR" -o "$BODY" -w '%{http_code}' -X POST -H "Origin: $P" -H 'Content-Type: application/json' \
  -d '{"reason":"preview self-check"}' "$P/api/admin/proposals/900099/reject")
if [ "$code" = 200 ] || grep -q '"handled":true' "$BODY"; then pass "3 POST reject proposal 900099 -> $code ($(head -c 120 "$BODY"))"
else fail "3 POST reject proposal 900099 -> $code $(head -c 200 "$BODY")"; fi
code=$(curl -sS -b "$JAR" -o "$BODY" -w '%{http_code}' -X POST -H 'Origin: https://evil.example' -H 'Content-Type: application/json' \
  -d '{"reason":"x"}' "$P/api/admin/proposals/900099/reject")
if [ "$code" = 403 ]; then pass "3b foreign Origin refused by the app -> 403"; else fail "3b foreign Origin -> $code (expected 403)"; fi

# 3c. "Suggest Spanish" (Workers AI, which would reach Cloudflare) is refused by the proxy itself
code=$(curl -sS -b "$JAR" -o "$BODY" -w '%{http_code}' -X POST -H "Origin: $P" -H 'Content-Type: application/json' -d '{}' "$P/api/admin/events/translate")
if [ "$code" = 503 ] && grep -q preview_ai_disabled "$BODY"; then pass "3c Suggest Spanish blocked at the proxy -> 503"; else fail "3c translate -> $code"; fi

# 4. after /__preview/signout, /admin/login shows the sign-in form and is not redirected
get "$P/__preview/signout" >/dev/null
read -r code url < <(get "$P/admin/login")
if [ "$code" = 200 ] && [ "$url" = "$P/admin/login" ] && grep -q 'id="admin-login-email"' "$BODY" && ! grep -q 'Signed in as' "$BODY"; then
  pass "4 /admin/login after sign-out shows the sign-in form"
else fail "4 /admin/login -> $code $url"; fi

# 5. the Worker itself, no proxy and no cookie: /admin shows no admin content and sends you to /admin/login
code=$(curl -sS -o "$BODY" -w '%{http_code}' -H 'Host: dev.pueblofoodmap.com' -H 'Accept: text/html' "$W/admin")
if ! grep -q 'Signed in as' "$BODY" && ! grep -q 'Places to review' "$BODY" && grep -q 'NEXT_REDIRECT;[^"]*%2Fadmin%2Flogin' "$BODY"; then
  pass "5 Worker direct /admin without a cookie -> $code, no admin content, redirect to /admin/login"
else fail "5 Worker direct /admin without a cookie leaked admin content (code $code)"; fi

# 6. the Worker loaded exactly one secrets file, the tool's copy beside the built config, holding exactly the
#    allowed keys (wrangler logs each file it loads as "Using secrets defined in <path>")
loaded=$(grep -o 'Using secrets defined in [^ ]*' "$STATE/worker.log" 2>/dev/null | sort -u | tr '\n' ' ')
keys=$(sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' "$REPO/dist/server/.dev.vars" 2>/dev/null | sort | tr '\n' ' ')
if [ "$loaded" = "Using secrets defined in dist/server/.dev.vars " ] && [ "$keys" = "$ALLOWED_KEYS " ]; then
  pass "6 the Worker loaded only dist/server/.dev.vars, keys: $keys"
else fail "6 Worker secrets: loaded '$loaded', keys '$keys'"; fi

[ "$fails" = 0 ] && echo "SELF-CHECK OK" || { echo "SELF-CHECK FAILED ($fails)"; exit 1; }
