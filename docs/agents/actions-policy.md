# Actions policy for pull_request_target

Moved verbatim from AGENTS.md. The hard rules stay in AGENTS.md.

- **Actions policy for `pull_request_target`:** from 2026-11-02 GitHub blocks that event in public repos unless an Actions policy allows it. Repo policy id 6930, "Allow pull_request_target for the two API-only workflows" (Settings → Actions → Policies; REST `repos/kr8vka0z/pueblo-food-map/actions/policies`, header `X-GitHub-Api-Version: 2026-03-10`; created 2026-10-08), covers exactly `dependabot-auto-merge.yml` and `request-review.yml` and allow-lists only `pull_request_target`. Adding another trigger (e.g. `workflow_dispatch`) to either file is blocked until the policy's allowed events change; deleting the policy stops both workflows; a new workflow that needs `pull_request_target` must be added to the policy's file list. It is a repo setting, so it is invisible in diffs.
