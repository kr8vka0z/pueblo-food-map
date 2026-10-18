#!/usr/bin/env bash
# audit-fix.sh — the work of .github/workflows/security-fix.yml (daily): patch what `npm audit` can patch
# in package-lock.json, ship it as an auto-merging PR into dev, and keep ONE open issue while dev's own
# lockfile fails the required "Dependency CVE Audit" check. Tests: audit-fix.test.mjs.
# Env: GH_TOKEN (App token: push, PR, auto-merge), ISSUE_TOKEN (issues only), GITHUB_REPOSITORY.
#
# WHY every lockfile WRITE uses npm 11: Node 22's bundled npm 10 flags ~150 production-reachable packages
# `"dev": true`, which hides them from `npm audit --omit=dev` (#752, repaired in #753). READS
# (`npm audit`) use the bundled npm, exactly as CI does.
#
# State machine ("gate" = `npm audit --audit-level=high --omit=dev`, the required check):
#   fix changes a version AND gate passes on the fixed lockfile -> ship a PR, arm auto-merge
#   fix changes a version but gate still fails                  -> ship NOTHING (see below)
#   nothing changes                                             -> nothing to ship
# Whatever was open and is no longer wanted gets closed. The issue follows dev's OWN lockfile.
set -euo pipefail
: "${GH_TOKEN:?}" "${ISSUE_TOKEN:?}" "${GITHUB_REPOSITORY:?}"

# Exact pin on purpose: registry-fetched code runs here beside a repo-write token, and a published version
# is immutable. Bump by hand (also in the issue recipe below): Dependabot cannot see a version in a script.
NPM=npm@11.21.0
BRANCH=fix/security-advisories
TITLE='fix(deps): patch security advisories (automated)'
ISSUE_TITLE='Security check is failing and cannot be fixed automatically'
tmp=$(mktemp -d)
cp package-lock.json "$tmp/before.json"

# --omit=dev: repair what the required check audits (production dependencies). A build-tool bump bundled
#   into the same PR could break lint/build and block the production fix; the weekly Dependabot version
#   updates handle build tools.
# --min-release-age=3: never lock a version published in the last 3 days (publish-then-yank, hijacked
#   releases). `audit fix` otherwise takes the newest in-range version and this PR merges with no human.
#   npm warns on stderr when it holds a fix back; those lines go into the issue.
# Exits 1 while any advisory stays unfixed (dev-only ones always do), so its exit code means nothing.
npx -y "$NPM" audit fix --package-lock-only --ignore-scripts --omit=dev --min-release-age=3 2> "$tmp/fix.err" || true
cat "$tmp/fix.err" >&2
held=$(grep -i 'release-age' "$tmp/fix.err" || true)

# Only a same-repo PR may ever be reused: `--head` matches the branch NAME, so a fork PR from a branch called
# like ours would otherwise be adopted and have auto-merge armed on it by the App token.
# Result "<number> <auto-merge already on?>", empty when none.
open=$(gh pr list --head "$BRANCH" --base dev --state open --json number,autoMergeRequest,isCrossRepository \
  --jq '[.[] | select(.isCrossRepository == false)][0] | select(.) | "\(.number) \(.autoMergeRequest != null)"')
pr=${open% *}
armed=${open#* }
pr_at_start=$pr

# One table row per package whose version differs.
jq -rn --slurpfile a "$tmp/before.json" --slurpfile b package-lock.json '
  $a[0].packages as $x | $b[0].packages as $y
  | ([$x, $y] | map(keys) | add | unique)[]
  | select($x[.].version != $y[.].version)
  | "| \(sub("^.*node_modules/"; "")) | \($x[.].version // "-") | \($y[.].version // "-") |"' > "$tmp/rows.md"
cp package-lock.json "$tmp/after.json"

# Booleans are the strings true/false, run as commands. `named` exits non-zero when npm audit fails
# without naming a high or critical package (registry down?): a red run, not a finding.
gate() { npm audit --audit-level=high --omit=dev; }
named() {
  npm audit --omit=dev --json > "$tmp/audit.json" || true
  local l
  l=$(jq -r '.vulnerabilities // {} | .[] | select(.severity == "high" or .severity == "critical")
    | "- \(.name) (\(.severity)): " + ([.via[]? | select(type == "object") | .url] | unique | join(", "))' "$tmp/audit.json")
  [ -n "$l" ] || { echo "npm audit failed without naming a high or critical package" >&2; exit 1; }
  printf '%s' "$l"
}
changed=false; [ ! -s "$tmp/rows.md" ] || changed=true
gate_fixed=false; ! gate || gate_fixed=true
still=
if $changed; then
  $gate_fixed || still=$(named)
  cp "$tmp/before.json" package-lock.json # audit dev's own lockfile
  gate_dev=false; ! gate || gate_dev=true
else
  gate_dev=$gate_fixed # nothing changed: the same lockfile, the same answer
fi
dev_list=; $gate_dev || dev_list=$(named)

created=false stuck_pr=
if $changed && $gate_fixed; then
  cp "$tmp/after.json" package-lock.json
  [ "$(git status --porcelain)" = " M package-lock.json" ] || {
    echo "Expected only package-lock.json to change; got:" >&2; git status --porcelain >&2; exit 1; }
  # No "dev": true guard here (the #752 regression): a repo-wide CI check covers it.
  # The push below carries a repo-write token, so prove it still goes to this repo.
  bash scripts/release/check-push-target.sh "$GITHUB_REPOSITORY"

  git config user.name "pueblo-release-bot"
  git config user.email "pueblo-release-bot@users.noreply.github.com"
  git switch -C "$BRANCH"
  git add package-lock.json
  git commit -q -m "$TITLE"
  # One fixed branch, recreated from current dev each run: a stale or conflicted PR heals itself next run.
  git push -q --force origin "$BRANCH"

  if [ -z "$pr" ]; then
    {
      echo "Automated fix for known security advisories in production dependencies. Only \`package-lock.json\` changed; \`package.json\` is unchanged."
      printf '\n| package | before | after |\n|---|---|---|\n'
      cat "$tmp/rows.md"
      printf '\nMade with `npx -y %s audit fix --package-lock-only --ignore-scripts --omit=dev --min-release-age=3`.\n' "$NPM"
    } > "$tmp/body.md"
    pr=$(gh pr create --base dev --head "$BRANCH" --title "$TITLE" --body-file "$tmp/body.md")
    created=true armed=false
  fi
  stuck_pr=$pr_at_start # a PR that was already open yesterday and still has not merged
  # dev's ruleset requires four status checks, so --auto waits for green. Also armed on a PR left open by a
  # run that died between create and this call, or nobody would merge it. --match-head-commit: never merge
  # content this run did not just push.
  [ "$armed" = true ] || gh pr merge --auto --squash --match-head-commit "$(git rev-parse HEAD)" "$pr"
else
  # A fix that cannot turn the gate green is not shipped. While the check is red on dev, nothing can merge
  # unless that one PR makes it green, so a partial fix PR could never land, and a hand-made bump PR would
  # stay red on the in-range advisory: a deadlock.
  cp "$tmp/before.json" package-lock.json # also drops metadata-only churn
  reason='dev needs no automatic fix any more.'
  ! $changed || reason='this fix alone would not make the security check pass, so it could never merge (see the open issue).'
  [ -z "$pr" ] || gh pr close "$pr" --delete-branch --comment "Closing automatically: $reason"
fi

bot_issue=$(GH_TOKEN="$ISSUE_TOKEN" gh issue list --state open --limit 1000 --json number,title,author \
  | jq -r --arg t "$ISSUE_TITLE" '[.[] | select(.title == $t and .author.is_bot)][0].number // empty')
if $gate_dev; then
  [ -z "$bot_issue" ] || GH_TOKEN="$ISSUE_TOKEN" gh issue close "$bot_issue" --comment "The security check passes again, so this is closed."
elif $created; then
  : # dev is red but the fix PR is minutes from merging: not worth an issue
else
  {
    echo "The check that scans the packages our live site depends on for known security problems is failing on \`dev\`, and the daily fix job could not repair it. **Every pull request into \`dev\` is blocked until this is fixed.**"
    printf '\nWhat the check names:\n\n%s\n' "$dev_list"
    [ -z "$stuck_pr" ] || printf '\nThe fix pull request #%s has been open since an earlier run and has not merged, so its checks need a look.\n' "$stuck_pr"
    if $changed && ! $gate_fixed; then
      printf '\nThe automatic fixer can update these packages, but the job did not open a pull request because the check would still fail afterwards:\n\n| package | before | after |\n|---|---|---|\n%s\n\nStill failing after those updates:\n\n%s\n' "$(cat "$tmp/rows.md")" "$still"
    fi
    [ -z "$held" ] || printf '\nSome fixes were held back because the fixed version is less than 3 days old (a safety delay against hijacked releases). The job picks them up by itself once they are 3 days old. For an urgent hand fix, add `--min-release-age-exclude=<package>` to the commands below.\n\n```\n%s\n```\n' "$held"
    # Not said when a fix PR is merely stuck: then the cause is that PR's failing checks, not a pin.
    [ -n "$stuck_pr" ] || printf '\n%s\n' "The usual cause is a package pinned to an exact version in package.json, which the automatic fixer cannot touch. Monday's Dependabot version update normally bumps it."
    printf '\nTo fix it by hand, make both changes in ONE pull request into `dev`, from a new branch (never push to `%s`: the job owns it and overwrites it every run). `--save-exact` matters: without it npm turns an exact pin into a range.\n\n```\nnpx -y %s install --save-exact --package-lock-only --ignore-scripts <package>@<fixed version>\nnpx -y %s audit fix --package-lock-only --ignore-scripts --omit=dev\n```\n' "$BRANCH" "$NPM" "$NPM"
    printf '\nLast checked: %s. This issue closes itself when the check passes again.\n' "$(date -u +%F)"
  } > "$tmp/issue.md"
  # Exit 0 on purpose: the issue is the signal; a red scheduled run every day would only spam failure emails.
  if [ -n "$bot_issue" ]; then
    GH_TOKEN="$ISSUE_TOKEN" gh issue edit "$bot_issue" --body-file "$tmp/issue.md"
  else
    GH_TOKEN="$ISSUE_TOKEN" gh issue create --title "$ISSUE_TITLE" --body-file "$tmp/issue.md"
  fi
fi
