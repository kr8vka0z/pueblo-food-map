# REVIEW.md — how to review a change in this repo

Read by the CI reviewer (`.github/workflows/claude-code-review.yml`) and the `reviewer`
subagent. One page on purpose. Operational facts live in [AGENTS.md](AGENTS.md); design
rationale in [ARCHITECTURE.md](ARCHITECTURE.md).

## Severity

- **Blocker** — wrong behavior, data loss, a security hole, anything that breaks a
  standing rule below, a test weakened to pass, a migration that could cascade-delete
  a referenced table.
- **Important** — works but fragile: new behavior with no test, an unhandled error path,
  an accessibility regression, a diff that departs from the issue's plan without saying so.
- **Nit** — naming, style, small simplifications. At most 5 per review; drop the rest.

## Check every time

1. Does the diff do what the PR/issue describes — no more, no less?
2. Is there a test that would fail if this change were reverted? For a bug fix: did the
   failing test exist before the fix?
3. Did any existing test change? If yes, why — which requirement demanded it?
4. Does this change make `AGENTS.md`, `README.md` or `ARCHITECTURE.md` wrong? Say which line.
5. A new top-level binding, var, or secret in `wrangler.jsonc` → is its `env.staging` twin
   in the same change? Named environments inherit almost nothing here (see AGENTS.md,
   "Hosting").

## Standing rules for this repo (owner decisions — a diff that breaks one is a Blocker)

- **Every Blessing Box interaction (check-in, photo, adopt) lives in the on-map venue
  card — never a separate page.** The one exception is `/box/<id>/history`, a read-only
  chronological log, not an interaction. Check-in wording is exactly **"I used this box"**.
- **D1 migrations reach the target database before the code that needs them.** The
  promotion checklist in AGENTS.md (search "promotion checklist") shows how to list the
  outstanding ones. Never rebuild a table other tables reference — no safe way to do that
  without cascading deletes.
- **After a squash promotion, `main` is true-merged back into `dev`.** Compare branches
  with `git diff --stat origin/dev origin/main` — never a commit count
  (`git rev-list --count`), which reads non-zero even when the branches are
  content-identical (squash-only merges rewrite SHAs).
- **Mapbox: only the URL-restricted public token (`pk.*`) ships in a client bundle.**
  Never the secret token (`sk.*`). The Mapbox attribution logo rendering at 65×20 is
  expected and not a finding.
- **Dependabot targets `dev`, never `main`.** The `dev` branch ruleset requires the same
  four checks as `main` (`Lint, typecheck, build`, Semgrep, TruffleHog, Dependency CVE
  Audit) — loosening or removing that ruleset silently turns Dependabot auto-merge into
  merge-on-open. Never `paths-ignore` a required check.
- **Deploy only through the GitHub Actions robots** (`deploy-prod.yml` on push to `main`,
  `deploy-dev.yml` on push to `dev`). Never a manual `wrangler deploy` outside CI.
- **Date-only freshness proposals auto-apply by design** (Kyle, 2026-09-15) — not a
  finding. `/venue/<id>` routing (including the box-vs-venue split) is settled — don't
  re-litigate it absent a new bug report.

## Skip

Generated files, lockfiles, `.open-next/`, anything CI already enforces (lint, types,
format), `migrations/` files that are already applied (immutable history).
