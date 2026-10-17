#!/usr/bin/env bash
# check-push-target.sh OWNER/REPO — exit 0 only if `origin` still pushes to
# github.com/OWNER/REPO. release.yml runs it right before pushing with a
# repo-write token, after a model step ran in the same checkout: it is the
# backstop if that step's tool limits ever have a gap.
# `get-url` applies url.*.insteadOf, so a retargeted remote and a rewrite rule
# both fail. Plain string compare, not a regex: repo names may contain dots.
# Never prints the URL — it can embed the token.
set -euo pipefail
want="${1:?usage: check-push-target.sh OWNER/REPO}"
url=$(git remote get-url --push origin)
rest="${url#https://}"
[ "$rest" != "$url" ] || { echo "origin is not an https URL; refusing to push" >&2; exit 1; }
hostpath="${rest#*@}" # drop "user:token@" when present
hostpath="${hostpath%.git}"
lc() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }
[ "$(lc "$hostpath")" = "$(lc "github.com/$want")" ] \
  || { echo "origin no longer points at $want; refusing to push" >&2; exit 1; }
