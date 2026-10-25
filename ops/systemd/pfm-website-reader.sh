#!/bin/bash
# pfm-website-reader.sh — the weekly venue website reader's start script
# (Venue Data Rebuild step 3; scripts/refresh/website.ts). Installed as
# /usr/local/lib/pfm-website-reader/run.sh and started by
# pfm-website-reader.service; see ops/systemd/README.md.
#
# Runs released code only: a dedicated checkout, reset to origin/main before
# every run, so nothing on dev or in a working copy ever writes to the
# production database. CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID come from
# the unit's secrets file; agy (Gemini) uses atlas's own Antigravity login.
set -euo pipefail

checkout="${PFM_READER_CHECKOUT:-$HOME/.local/share/pfm-website-reader/pueblo-food-map}"
repo="https://github.com/kr8vka0z/pueblo-food-map.git"

if [ ! -d "$checkout/.git" ]; then
  mkdir -p "$(dirname "$checkout")"
  git clone --quiet "$repo" "$checkout"
fi
cd "$checkout"
git fetch --quiet origin main
# This checkout belongs to the job alone: throw away anything but origin/main.
git reset --quiet --hard origin/main
git clean -fdxq -e node_modules
echo "pfm-website-reader: running $(git rev-parse --short HEAD) from origin/main"
npm ci --no-audit --no-fund --loglevel=error
exec npx --no-install tsx scripts/refresh-ingest.ts --db-mode remote --only website
