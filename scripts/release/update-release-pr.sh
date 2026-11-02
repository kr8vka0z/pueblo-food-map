#!/usr/bin/env bash
# update-release-pr.sh OWNER/REPO PR_NUMBER VERSION BODY_FILE — update an open
# release PR in place: new body and title, then force-push its branch.
# release.yml runs it from the release commit. A fresh PR doesn't come here.
#
# WHY the body goes first: decide.mjs reads the recorded cut from the branch.
# If the push came first and the body write failed, the next cut would see the
# commit already recorded and change nothing, leaving old notes and checks on
# new code. This way round a failed write leaves the old commit recorded, so
# the next cut redoes both.
#
# WHY a failed push is checked, not trusted: git can report failure after
# GitHub accepted the push (the reply was lost). Restoring the old body then
# would put old notes on new code, and the next cut would see nothing to do.
# So the old body goes back only when the branch is shown not to hold the new
# commit.
set -euo pipefail
repo="${1:?usage: update-release-pr.sh OWNER/REPO PR_NUMBER VERSION BODY_FILE}"
pr="${2:?missing PR number}"
version="${3:?missing version}"
body="${4:?missing body file}"
branch="release/v$version"
pr_api="repos/$repo/pulls/$pr"
old_body=$(mktemp)

# REST, not `gh pr edit`: that command also reads project fields an App token
# may not be allowed to see.
gh api "$pr_api" --jq .body > "$old_body"
gh api -X PATCH "$pr_api" -f "title=Release v$version" -F "body=@$body" >/dev/null

# Force: the branch is rebuilt from dev on every cut. The push reruns the PR's checks.
git push --force origin "$branch" && exit 0

if ! remote=$(git ls-remote --exit-code origin "refs/heads/$branch"); then
  echo "::error::Release NOT confirmed: the push failed and we could not tell what the branch holds. The PR has the new description. Check that it matches the branch, then cut again."
  exit 1
fi
if [ "${remote%%[[:space:]]*}" = "$(git rev-parse HEAD)" ]; then
  echo "::warning::git reported a push failure, but the branch holds the new commit, so the update stands."
  exit 0
fi
if ! gh api -X PATCH "$pr_api" -F "body=@$old_body" >/dev/null; then
  echo "::error::Release NOT updated: the push failed and the old description could not be put back. The PR describes a commit it doesn't hold. Cut again to repair it."
  exit 1
fi
echo "::error::Release NOT updated: the push failed, so the PR keeps its old commit and description. Cut again."
exit 1
