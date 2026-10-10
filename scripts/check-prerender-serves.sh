#!/usr/bin/env bash
# scripts/check-prerender-serves.sh — builds the real OpenNext Cloudflare bundle,
# serves it in the local Worker emulator and asserts the PRERENDERED venue pages
# answer 200. Run by ci.yml; run it by hand after any next / @opennextjs/cloudflare bump.
#
# WHY this exists: `next build` and `opennextjs-cloudflare build` both succeed, and list
# every /venue/<id> as prerendered, even when the Worker then 404s all of them at
# request time. Next 16.3.8 changed its prerender cache keys and @opennextjs/cloudflare
# 1.20.7 could not read them, so dev.pueblofoodmap.com lost ~214 venue pages while every
# gate stayed green (same symptom class as the 2026-08 10-day outage, AGENTS.md
# "Discoverability / SEO traps"). Only actually requesting a page proves it works.
# The local emulator reproduces this faithfully: prod's own commit with its own
# lockfile serves 200, the same commit with next 16.3.8 + OpenNext 1.20.7 serves 404.
#
# WHY a temp wrangler config: wrangler.jsonc binds Workers AI, which `wrangler dev`
# can only run against the real Cloudflare account (needs an API token). The emulator
# needs no secrets once that one binding is dropped; nothing here talks to Cloudflare.
set -euo pipefail

cd "$(dirname "$0")/.."
PORT=8799
CONFIG=wrangler.ci-preview.jsonc   # must sit in the repo root: `main` is relative to it
LOG="$(mktemp)"

VENUE_ID=$(grep -m1 '"id":' src/data/published-venues.ts | sed -E 's/.*"id": *"([^"]+)".*/\1/')
if [ -z "$VENUE_ID" ]; then
  echo "check-prerender-serves: could not read a venue id from src/data/published-venues.ts" >&2
  exit 1
fi

cleanup() {
  # `preview` spawns wrangler -> workerd as children; kill the whole tree.
  pkill -P "${PREVIEW_PID:-0}" 2>/dev/null || true
  kill "${PREVIEW_PID:-0}" 2>/dev/null || true
  rm -f "$CONFIG"
}
trap cleanup EXIT

grep -Fv '"ai": { "binding": "AI" }' wrangler.jsonc > "$CONFIG"
if grep -q '"ai"' "$CONFIG"; then
  echo "check-prerender-serves: wrangler.jsonc has an \"ai\" binding this script cannot strip; update the grep above" >&2
  exit 1
fi

npx opennextjs-cloudflare build
npx opennextjs-cloudflare preview --port "$PORT" --config "$CONFIG" > "$LOG" 2>&1 &
PREVIEW_PID=$!

ready=0
for _ in $(seq 1 60); do
  if curl -s -o /dev/null "http://127.0.0.1:${PORT}/"; then ready=1; break; fi
  sleep 2
done
if [ "$ready" != 1 ]; then
  echo "check-prerender-serves: preview never answered on :${PORT}" >&2
  cat "$LOG" >&2
  exit 1
fi

status=0
# Every route here is dynamicParams=false + prerendered; /report/<id> shares the cache
# path with /venue/<id>, so it is a second witness.
for path in "/" "/es" "/venue/${VENUE_ID}" "/es/venue/${VENUE_ID}" "/report/${VENUE_ID}"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}${path}")
  echo "GET ${path} -> ${code}"
  if [ "$code" != 200 ]; then
    echo "check-prerender-serves: ${path} returned ${code}, expected 200" >&2
    status=1
  fi
done
# The inverse must hold too: an id outside generateStaticParams is a real 404.
code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/venue/check-no-such-venue")
echo "GET /venue/check-no-such-venue -> ${code}"
if [ "$code" != 404 ]; then
  echo "check-prerender-serves: unknown venue id returned ${code}, expected 404" >&2
  status=1
fi
if [ "$status" != 0 ]; then
  echo "--- preview log ---" >&2
  cat "$LOG" >&2
fi
exit "$status"
