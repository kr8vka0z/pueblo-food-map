#!/usr/bin/env bash
# section.sh VERSION — print CHANGELOG.md's "## [VERSION]" section (body only,
# heading excluded). Shared by release.yml (PR body) and deploy-prod.yml
# (GitHub Release notes) so both quote the same text. Exits 1 if missing/empty:
# a release with no changelog entry should fail loudly, not publish blank notes.
set -euo pipefail
v="${1:?usage: section.sh X.Y.Z}"
out=$(awk -v v="$v" '
  $0 ~ "^## \\[" v "\\]" { on = 1; next }
  on && /^## \[/ { exit }
  on && /^\[[^]]+\]: / { exit }
  on { print }
' "$(dirname "$0")/../../CHANGELOG.md")
# Trim leading/trailing blank lines.
out=$(printf '%s\n' "$out" | sed -e '/./,$!d' | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}')
[ -n "$out" ] || { echo "no CHANGELOG section for $v" >&2; exit 1; }
printf '%s\n' "$out"
