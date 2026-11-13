#!/usr/bin/env bash
# scripts/admin-preview/selfcheck.sh — the preview tool's one runnable check: proves the preview works end to
# end AND that the app's own gates are untouched (a foreign Origin is refused, the Worker with no cookie shows no
# admin content). Ends "SELF-CHECK OK" or exits non-zero. Called by start.sh; safe to run on its own while the
# preview is running. It only talks to 127.0.0.1.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
STATE="$(cd "$HERE/../.." && pwd)/.wrangler/admin-preview"
P=http://127.0.0.1:8792      # through the proxy
W=http://127.0.0.1:8791      # the Worker directly, no proxy
mkdir -p "$STATE"
JAR=$(mktemp "$STATE/.jar.XXXXXX"); BODY=$(mktemp "$STATE/.body.XXXXXX")
trap 'rm -f "$JAR" "$BODY"' EXIT
fails=0
pass() { echo "PASS $*"; }
fail() { echo "FAIL $*"; fails=$((fails + 1)); }
get() { curl -sS -L -b "$JAR" -c "$JAR" -H 'Accept: text/html' -o "$BODY" -w '%{http_code} %{url_effective}' "$@"; }

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

[ "$fails" = 0 ] && echo "SELF-CHECK OK" || { echo "SELF-CHECK FAILED ($fails)"; exit 1; }
