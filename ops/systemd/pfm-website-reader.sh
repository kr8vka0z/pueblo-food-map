#!/bin/bash
# pfm-website-reader.sh — the weekly venue website reader's start script
# (Venue Data Rebuild step 3; scripts/refresh/website.ts). Installed as
# /usr/local/lib/pfm-website-reader/run.sh and called twice by
# pfm-website-reader.service; see ops/systemd/README.md.
#
#   run.sh prepare   update the checkout and install packages — BEFORE the
#                    unit writes the secrets file, so no package install
#                    script ever runs while the Cloudflare token is on disk.
#   run.sh run       start the reader. It reads PFM_SECRETS_FILE and deletes
#                    it first thing (refresh-ingest.ts), and keeps the token
#                    out of every environment agy can see. This script never
#                    sources the file, so the token is in no shell's
#                    environment either.
#
# Runs released code only: a dedicated checkout, reset to origin/main before
# every run, so nothing on dev or in a working copy ever writes to the
# production database. agy (Gemini) uses atlas's own Antigravity login.
set -euo pipefail

checkout="${PFM_READER_CHECKOUT:-$HOME/.local/share/pfm-website-reader/pueblo-food-map}"
repo="https://github.com/kr8vka0z/pueblo-food-map.git"

case "${1:-}" in
  prepare)
    if [ ! -d "$checkout/.git" ]; then
      mkdir -p "$(dirname "$checkout")"
      git clone --quiet "$repo" "$checkout"
    fi
    cd "$checkout"
    git fetch --quiet origin main
    # This checkout belongs to the job alone: throw away anything but origin/main.
    git reset --quiet --hard origin/main
    git clean -fdxq -e node_modules
    echo "pfm-website-reader: prepared $(git rev-parse --short HEAD) from origin/main"
    npm ci --no-audit --no-fund --loglevel=error
    ;;
  run)
    cd "$checkout"
    exec npx --no-install tsx scripts/refresh-ingest.ts --db-mode remote --only website
    ;;
  *)
    echo "usage: $0 prepare|run" >&2
    exit 2
    ;;
esac
