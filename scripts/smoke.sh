#!/usr/bin/env bash
# scripts/smoke.sh — post-deploy smoke test, run by deploy-prod.yml and deploy-dev.yml right after
# `wrangler deploy`. Usage:
#   bash scripts/smoke.sh <workers.dev origin> [--canonical-host <host>]
# Checks, against the origin: the public pages answer 200, the /es pages carry <html lang="es">, unmatched URLs
# answer a real 404, and the origin sends X-Robots-Tag noindex. With --canonical-host (prod only) it also checks
# that https://<host>/ does NOT send noindex. Exits non-zero on any failure; a red run is the signal, nothing is
# rolled back.
#
# WHY: a green build does not prove the pages work on this stack (a `redirects()` rule that built clean and passed
# CI 500'd the live homepage; the 10-day 2026-08-24 to 2026-09-02 outage had 218/230 public URLs 404ing; a next /
# OpenNext bump 404'd every staging venue page for days with every run green). AGENTS.md "Hosting and deploys".
# WHY the workers.dev origin, never the zone host (#773): the zone runs Cloudflare Bot Fight Mode, which on the
# Free plan no WAF rule can skip, and it answers 403 to every GitHub-hosted runner request.
set -e

cd "$(dirname "$0")/.."

ORIGIN="${1:?usage: smoke.sh <origin> [--canonical-host <host>]}"
CANONICAL_HOST=""
if [ "${2:-}" = "--canonical-host" ]; then CANONICAL_HOST="${3:?--canonical-host needs a host}"; fi

VENUE_ID=$(grep -m1 '"id":' src/data/published-venues.ts | sed -E 's/.*"id": *"([^"]+)".*/\1/')
if [ -z "$VENUE_ID" ]; then
  echo "Smoke check failed: could not read a venue id from src/data/published-venues.ts" >&2
  exit 1
fi

# RETRY, because `wrangler deploy` returning is not the same as the new
# version serving. Its first run (2026-09-03) went red against a
# deployment that was in fact correct: `/` and `/venues` answered 200
# while `/venue/<id>` still 404'd, and the same URL served 200 a couple
# of minutes later with nothing redeployed in between (then on OpenNext,
# whose prerendered pages lived in static assets; venue pages now
# render in the Worker on first request, but a fresh deployment still
# takes a moment to reach every location). Without a retry this step reports every good deploy as a
# failure, and a check that cries wolf gets deleted, taking the real
# signal with it.
#
# Deliberately NOT curl's own --retry: that retries a connection-level
# failure, not a well-formed 404, which is exactly the shape here.
#
# ponytail: fixed 10s x 6 rather than exponential backoff — one minute
# covers the propagation observed by a wide margin. If a deploy ever
# legitimately needs longer, raise the attempt count; do not weaken the
# assertion to a warning.
attempts=6
status=0

# 200 checks. The /es pages' 200 alone would also pass if they quietly served English; the body check below
# proves they are the /es tree. /blessing-boxes reads D1, and a D1 failure still answers 200 (degraded page,
# noindex), so a 200 proves the route deployed, not that D1 is healthy.
for path in "/" "/venues" "/venue/${VENUE_ID}" "/es" "/es/venues" "/es/venue/${VENUE_ID}" "/report/${VENUE_ID}" "/food-pantries" "/es/food-pantries" "/snap-wic-stores" "/es/snap-wic-stores" "/community-gardens" "/es/community-gardens" "/blessing-boxes" "/es/blessing-boxes" "/sitemap.xml" "/robots.txt" "/llms.txt"; do
  code=""
  for i in $(seq 1 "$attempts"); do
    # No -f: a 404 must be READ, not turned into a curl error. `-f`
    # suppresses the body AND exits non-zero, which previously
    # concatenated with the fallback and printed the nonsense "404000".
    # curl prints "000" itself via -w when the connection fails, so `|| true`
    # (not `|| echo 000`, which appended a second 000 and made "000000",
    # so a refused connection never matched the retry). --max-time keeps
    # one hung request from eating the job's timeout.
    code=$(curl -sS --max-time 20 -o /dev/null -w "%{http_code}" "${ORIGIN}${path}") || true
    [ "$code" = "200" ] && break
    if [ "$i" -lt "$attempts" ]; then
      echo "GET ${ORIGIN}${path} -> ${code} (attempt ${i}/${attempts}, retrying in 10s)"
      sleep 10
    fi
  done
  echo "GET ${ORIGIN}${path} -> ${code}"
  if [ "$code" != "200" ]; then
    echo "Smoke check failed: ${path} returned ${code}, expected 200" >&2
    status=1
  fi
done

# The /es paths above returned 200 — also confirm the body actually carries <html lang="es"> (grepping bare
# lang="es" risked a false-positive match against an unrelated attribute or an embedded RSC payload string), so a
# deploy that quietly serves the EN page (or an error page) under an /es URL with a 200 still fails loudly.
for path in "/es" "/es/venues" "/es/venue/${VENUE_ID}" "/es/food-pantries" "/es/snap-wic-stores" "/es/community-gardens" "/es/blessing-boxes"; do
  body=""
  ok=1
  for i in $(seq 1 "$attempts"); do
    body=$(curl -sS --max-time 20 "${ORIGIN}${path}") || body=""
    if printf '%s' "$body" | grep -q '<html lang="es"'; then
      ok=0
      break
    fi
    if [ "$i" -lt "$attempts" ]; then
      echo "GET ${ORIGIN}${path} -> missing <html lang=\"es\"> (attempt ${i}/${attempts}, retrying in 10s)"
      sleep 10
    fi
  done
  if [ "$ok" = "0" ]; then
    echo "GET ${ORIGIN}${path} -> <html lang=\"es\"> present"
  else
    echo "Smoke check failed: ${path} response body is missing <html lang=\"es\">" >&2
    status=1
  fi
done

# An unmatched URL must answer a real 404 (src/app/global-not-found.tsx, #689). A soft-200 here would let crawlers
# index junk URLs; a 500 means the experimental globalNotFound path broke on the Worker. Unknown venue ids prove
# the dynamicParams = false pages 404 rather than 500. /event/<unknown> and /es/event/<unknown> (#762) read D1 per
# request, and production runs this code before it has migration 0018 (the `events` table): they must answer 404
# then, never a 500. (A 404 cannot tell a deployed route from a missing one; it does tell 404 from 500.)
# Retried only past a failed fetch (000), never past a wrong status.
for missing in "/smoke-check-no-such-page" "/venue/smoke-check-no-such-venue" "/es/venue/smoke-check-no-such-venue" "/event/smoke-check-no-such-event" "/es/event/smoke-check-no-such-event"; do
  for i in $(seq 1 "$attempts"); do
    code=$(curl -sS --max-time 20 -o /dev/null -w "%{http_code}" "${ORIGIN}${missing}") || true
    [ "$code" != "000" ] && break
    if [ "$i" -lt "$attempts" ]; then sleep 10; fi
  done
  echo "GET ${ORIGIN}${missing} -> ${code}"
  if [ "$code" != "404" ]; then
    echo "Smoke check failed: ${missing} returned ${code}, expected 404" >&2
    status=1
  fi
done

# Indexing policy (SEO/AEO plan Phase 0, src/lib/indexingHost.ts):
# only pueblofoodmap.com may be indexed. A noindex leaking onto the
# canonical host would quietly deindex the whole site, so that's a
# hard failure; every workers.dev origin must carry the header.
# Both checks retry like the path loop above (the old version can
# answer for a moment after `wrangler deploy`, and one network blip
# mustn't fail a good deploy), and a failed fetch is reported as a
# failed fetch, never read as "header present" or "header missing".
# has_noindex: 0 = header present, 1 = absent, 2 = curl failed.
has_noindex() {
  local headers
  headers=$(curl -sS --max-time 20 -D - -o /dev/null "$1") || return 2
  printf '%s' "$headers" | grep -qi '^x-robots-tag:.*noindex'
}
# expect_noindex URL WANT: WANT is 0 (must have it) or 1 (must not).
expect_noindex() {
  local url="$1" want="$2" rc=2 i
  for i in $(seq 1 "$attempts"); do
    rc=0; has_noindex "$url" || rc=$?
    [ "$rc" = "$want" ] && break
    if [ "$i" -lt "$attempts" ]; then
      echo "${url}: noindex check got ${rc}, want ${want} (attempt ${i}/${attempts}, retrying in 10s)"
      sleep 10
    fi
  done
  case "$rc" in
    "$want") [ "$want" = "0" ] && echo "${url} -> noindex" || echo "${url} -> indexable (no X-Robots-Tag noindex)" ;;
    2) echo "Smoke check failed: could not fetch ${url}" >&2; status=1 ;;
    0) echo "Smoke check failed: ${url} sends X-Robots-Tag noindex" >&2; status=1 ;;
    *) echo "Smoke check failed: ${url} is missing X-Robots-Tag noindex" >&2; status=1 ;;
  esac
}
if [ -n "$CANONICAL_HOST" ]; then expect_noindex "https://${CANONICAL_HOST}/" 1; fi
expect_noindex "${ORIGIN}/" 0

exit $status
