#!/usr/bin/env bash
# scripts/check-pages-serve.sh — builds the real Worker bundle with `vite build` (vinext), serves it in the local
# workerd preview and asserts the venue pages answer: a real /venue/<id>, /es/venue/<id> and /report/<id> are 200 with
# the venue's name in the body, an unknown id on each is a 404, and / and /sitemap.xml are 200. Run by ci.yml; run it
# by hand after any next / vinext / vite bump.
#
# WHY this exists: a green build does not prove these pages serve. Under OpenNext (before vinext) every /venue/<id>
# 404'd in production for 10 days (2026-08-24 to 09-02) while the build listed them all as prerendered, and a
# next + OpenNext bump did it again on staging (2026-10-05). Only requesting the pages from the real Worker bundle
# proves they work. Under vinext they render on first request (generateStaticParams + dynamicParams = false), so this
# also proves an id outside the bundled data is a 404, not a 500 or a soft 200.
#
# Nothing here talks to Cloudflare: vite.config.ts turns remote bindings off, and these pages read only the bundled
# venue data (src/data/published-venues.ts), so no D1, secrets or token are needed.
set -euo pipefail

cd "$(dirname "$0")/.."
LOG="$(mktemp)"

# A free port, so a busy dev box or a parallel CI step can't collide (--strictPort below refuses a taken one).
PORT=$(node -e 'const s=require("net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')

# First venue whose name has no characters HTML would escape, so a plain grep of the body is a fair test.
read -r VENUE_ID VENUE_NAME < <(npx tsx -e '
  import("./src/data/published-venues.ts").then(({ publishedVenues }) => {
    const v = publishedVenues.find((x) => /^[A-Za-z0-9 .,-]+$/.test(x.name));
    if (v) console.log(v.id, v.name);
  });') || true  # read fails on empty input; the check below reports it
if [ -z "${VENUE_ID:-}" ] || [ -z "${VENUE_NAME:-}" ]; then
  echo "check-pages-serve: could not pick a venue from src/data/published-venues.ts" >&2
  exit 1
fi

cleanup() {
  # `vite preview` spawns workerd; setsid below made it a process-group leader, so signalling the negative PID takes
  # the whole tree down.
  if [ -n "${PREVIEW_PID:-}" ]; then kill -- "-${PREVIEW_PID}" 2>/dev/null || true; fi
  rm -f "$LOG"
}
trap cleanup EXIT

npx vite build
setsid npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort > "$LOG" 2>&1 &
PREVIEW_PID=$!

ready=0
for _ in $(seq 1 60); do
  if curl -s -o /dev/null "http://127.0.0.1:${PORT}/"; then ready=1; break; fi
  sleep 1
done
if [ "$ready" != 1 ]; then
  echo "check-pages-serve: preview never answered on :${PORT}" >&2
  cat "$LOG" >&2
  exit 1
fi

status=0
# expect <path> <status> [text the body must contain]
expect() {
  local body code
  body=$(curl -s -w '\n%{http_code}' "http://127.0.0.1:${PORT}$1")
  code=${body##*$'\n'}
  body=${body%$'\n'*}
  echo "GET $1 -> ${code}"
  if [ "$code" != "$2" ]; then
    echo "check-pages-serve: $1 returned ${code}, expected $2" >&2
    status=1
  elif [ -n "${3:-}" ] && ! grep -qF -- "$3" <<<"$body"; then
    echo "check-pages-serve: $1 body is missing \"$3\"" >&2
    status=1
  fi
}

expect "/" 200
expect "/sitemap.xml" 200 "/venue/${VENUE_ID}"
expect "/venue/${VENUE_ID}" 200 "$VENUE_NAME"
expect "/es/venue/${VENUE_ID}" 200 "$VENUE_NAME"
expect "/report/${VENUE_ID}" 200 "$VENUE_NAME"
expect "/venue/check-no-such-venue" 404
expect "/es/venue/check-no-such-venue" 404
expect "/report/check-no-such-venue" 404

if [ "$status" != 0 ]; then
  echo "--- preview log ---" >&2
  cat "$LOG" >&2
fi
exit "$status"
