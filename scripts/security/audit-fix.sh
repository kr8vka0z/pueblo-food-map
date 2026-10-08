#!/usr/bin/env bash
# audit-fix.sh — the work of .github/workflows/security-fix.yml (daily): patch what `npm audit` can patch
# in package-lock.json, ship it as an auto-merging PR into dev, and keep ONE open issue while the required
# "Dependency CVE Audit" check still fails. Tests: audit-fix.test.mjs.
# Env: GH_TOKEN (App token: push, PR, auto-merge), ISSUE_TOKEN (issues only), GITHUB_REPOSITORY.
#
# WHY every lockfile WRITE uses `npx -y npm@11`: Node 22's bundled npm 10 flags ~150 production-reachable
# packages `"dev": true`, which hides them from `npm audit --omit=dev` (#752, repaired in #753). READS
# (`npm audit`) use the bundled npm, exactly as CI does.
set -euo pipefail
: "${GH_TOKEN:?}" "${ISSUE_TOKEN:?}" "${GITHUB_REPOSITORY:?}"

BRANCH=fix/security-advisories
TITLE='fix(deps): patch security advisories (automated)'
ISSUE_TITLE='Security check is failing and cannot be fixed automatically'
tmp=$(mktemp -d)
cp package-lock.json "$tmp/before.json"

# Exits 1 while any advisory stays unfixed (five dev-only ones always do), so its exit code means nothing.
# Only in-range fixes: exact-pinned direct dependencies are out of its reach and package.json is never edited.
npx -y npm@11 audit fix --package-lock-only --ignore-scripts || true

# One table row per package whose version differs. No rows = nothing to ship, so no daily no-op PR.
jq -rn --slurpfile a "$tmp/before.json" --slurpfile b package-lock.json '
  $a[0].packages as $x | $b[0].packages as $y
  | ([$x, $y] | map(keys) | add | unique)[]
  | select($x[.].version != $y[.].version)
  | "| \(sub("^.*node_modules/"; "")) | \($x[.].version // "-") | \($y[.].version // "-") |"' > "$tmp/rows.md"

if [ -s "$tmp/rows.md" ]; then
  [ "$(git status --porcelain)" = " M package-lock.json" ] || {
    echo "Expected only package-lock.json to change; got:" >&2; git status --porcelain >&2; exit 1; }
  # The #752 regression: a package that was not dev before must not turn dev. (New packages may be dev.)
  gained=$(jq -rn --slurpfile a "$tmp/before.json" --slurpfile b package-lock.json '
    $a[0].packages as $x | $b[0].packages | to_entries[]
    | select(.value.dev == true and $x[.key] != null and $x[.key].dev != true) | .key')
  [ -z "$gained" ] || { echo "Refusing to push: these packages gained \"dev\": true:" >&2; echo "$gained" >&2; exit 1; }
  # The push below carries a repo-write token, so prove it still goes to this repo.
  bash scripts/release/check-push-target.sh "$GITHUB_REPOSITORY"

  git config user.name "pueblo-release-bot"
  git config user.email "pueblo-release-bot@users.noreply.github.com"
  git switch -C "$BRANCH"
  git add package-lock.json
  git commit -q -m "$TITLE"
  # One fixed branch, recreated from current dev each run: a stale or conflicted PR heals itself next run.
  git push -q --force origin "$BRANCH"

  # "<number> <true|false>": is a PR open for the branch, and is auto-merge already switched on?
  open=$(gh pr list --head "$BRANCH" --base dev --state open --json number,autoMergeRequest \
    --jq '.[0] | select(.) | "\(.number) \(.autoMergeRequest != null)"')
  armed=false
  if [ -n "$open" ]; then
    pr=${open% *}
    armed=${open#* }
  else
    {
      echo "Automated fix for known security advisories. Only \`package-lock.json\` changed; \`package.json\` is unchanged."
      printf '\n| package | before | after |\n|---|---|---|\n'
      cat "$tmp/rows.md"
      printf '\nMade with `npx -y npm@11 audit fix --package-lock-only --ignore-scripts`.\n'
    } > "$tmp/body.md"
    pr=$(gh pr create --base dev --head "$BRANCH" --title "$TITLE" --body-file "$tmp/body.md")
  fi
  # dev's ruleset requires four status checks, so --auto waits for green. Also done for a PR left open by an
  # earlier run that died between create and this call, or no one would ever merge it (and the audit below,
  # run on the fixed lockfile, would stay quiet). Skipped when already on, so a healthy open PR costs no call.
  [ "$armed" = true ] || gh pr merge --auto --squash "$pr"
else
  cp "$tmp/before.json" package-lock.json # drop metadata-only churn
fi

# Loudness, on every path: the required check's own command, against the lockfile now in the tree.
open_issue=$(GH_TOKEN="$ISSUE_TOKEN" gh issue list --state open --limit 1000 --json number,title \
  | jq -r --arg t "$ISSUE_TITLE" '[.[] | select(.title == $t)][0].number // empty')
if npm audit --audit-level=high --omit=dev; then
  if [ -n "$open_issue" ]; then
    GH_TOKEN="$ISSUE_TOKEN" gh issue close "$open_issue" --comment "The security check passes again, so this is closed."
  fi
else
  npm audit --omit=dev --json > "$tmp/audit.json" || true
  list=$(jq -r '.vulnerabilities // {} | .[] | select(.severity == "high" or .severity == "critical")
    | "- \(.name) (\(.severity)): " + ([.via[]? | select(type == "object") | .url] | unique | join(", "))' "$tmp/audit.json")
  # No named package means npm itself failed (registry down?), not a finding: red run, no misleading issue.
  [ -n "$list" ] || { echo "npm audit failed without naming a high or critical package" >&2; exit 1; }
  {
    echo "The check that scans the packages our live site depends on for known security problems is failing, and the daily fix job could not repair it. **Every pull request into \`dev\` is blocked until this is fixed.**"
    printf '\nPackages the check names:\n\n%s\n\n' "$list"
    echo "The usual cause is a package we pin to one exact version (next, @opennextjs/cloudflare, eslint-config-next), which the automatic fixer cannot touch. Monday's Dependabot version update normally fixes it. If it does not, bump the package by hand with \`npx -y npm@11 install <package>@<fixed version>\` (npm 11, never the bundled npm 10) and open a pull request into \`dev\`."
    printf '\nLast checked: %s. This issue closes itself when the check passes again.\n' "$(date -u +%F)"
  } > "$tmp/issue.md"
  if [ -n "$open_issue" ]; then
    GH_TOKEN="$ISSUE_TOKEN" gh issue edit "$open_issue" --body-file "$tmp/issue.md"
  else
    GH_TOKEN="$ISSUE_TOKEN" gh issue create --title "$ISSUE_TITLE" --body-file "$tmp/issue.md"
  fi
  # Exit 0 on purpose: the issue is the signal; a red scheduled run every day would only spam failure emails.
fi
