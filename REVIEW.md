# REVIEW.md — how to review a change in this repo

Read by the Codex PR review (run by the server's `pr-review` script, posted as a PR comment) and
by any human or agent reviewer. One page on purpose. Operational facts live in
[AGENTS.md](AGENTS.md); design rationale in [ARCHITECTURE.md](ARCHITECTURE.md).

## Judge against the PR description

The reviewer sees only the PR description, the diff, this file and AGENTS.md: no issue, no chat,
no history. So the description has to carry the case on its own (template:
`.github/pull_request_template.md`, sections Why / What changed / How it was tested / Watch for).

- The diff should do what the description says, and nothing it doesn't explain. A file or change
  the description never accounts for is a finding.
- A description that is missing, empty, or doesn't match the diff is a Blocker.
- Where a rule below needs proof the diff can't show (a test that failed before the fix,
  `scripts/check-pages-serve.sh` after a `next`/`vinext`/`vite` bump, a migration applied to
  staging), the proof is a sentence in "How it was tested". No sentence, no proof.

## Severity

- **Blocker** — must be fixed before merge: wrong behavior, data loss, a security hole, a broken
  standing rule below, a test weakened to pass, a migration that could cascade-delete a referenced
  table, a description missing or not matching the diff.
- **Important** — works but fragile: new behavior with no test, an unhandled error path,
  an accessibility regression, a diff that goes beyond what the description says without
  explaining it.
- **Nit** — naming, style, small simplifications. At most 5 per review; drop the rest.

## Security

This repo is public: anything committed is published.

- Secrets: none in code, config, tests, fixtures or logs. Only the URL-restricted Mapbox public
  token (`pk.*`) ships in a client bundle, never the secret token (`sk.*`). The full-access Resend
  key never goes in the Worker.
- Logs: never log an IP, email or form content; `invocation_logs` stays `false`
  (AGENTS.md "Scheduled jobs and observability").
- Injection: JSON-LD only through `serializeJsonLd`; D1 queries use bound parameters.
- Auth and permission checks: new admin code fetches D1 only through `getAdminDb()`; every non-GET
  `/api/admin/*` route calls `requireAdminOrigin()`; `ADMIN_ALLOWLIST` fails toward "only Kyle".
  The allowlist plugin's tests (`adminAuthAllowlistPlugin.test.ts`) are the security boundary:
  weakening them is a Blocker.
- Input: the server re-validates every admin field (`adminVenueValidation.ts`); public forms keep
  Turnstile and the D1 rate limiters. Scraped HTML is untrusted, so `CLOUDFLARE_D1_TOKEN` never
  goes to a deploy job.
- Workflows: `pull_request_target` workflows never check out or run PR code.
- New dependencies: each one says why in the description, and why nothing already installed covers it.

## Check every time

1. Does the diff do what the description says — no more, no less?
2. Is there a test that would fail if this change were reverted? For a bug fix: does the
   description say the new test failed before the fix?
3. Did any existing test change? If yes, does the description say which requirement made it change?
4. Does this change make `AGENTS.md`, `README.md` or `ARCHITECTURE.md` wrong? Say which line.
5. A new top-level binding, var, or secret in `wrangler.jsonc` → is its `env.staging` twin
   in the same change? Named environments inherit almost nothing here (see AGENTS.md,
   "Hosting").
6. PR into `dev`: is the title a Conventional Commit? PR into `main`: is the head branch
   `release/*`, `hotfix/*` or the publish bot? Anything else is a Blocker.

## Standing rules for this repo (owner decisions — a diff that breaks one is a Blocker)

- **Every Blessing Box interaction (check-in, photo, adopt) lives in the on-map venue
  card — never a separate page.** Two read-only pages are the exceptions, because neither
  is an interaction: `/box/<id>/history`, a chronological log, and `/blessing-boxes`, a
  server-rendered list of live boxes for search engines (SEO/AEO plan, `docs/seo-aeo-plan.md`).
  The list may show each box's name, address and status, and link to the box's map card;
  it must not carry check-in, photo or adopt controls. Check-in wording is exactly
  **"I used this box"**.
- **D1 migrations reach the target database before the code that needs them.** The
  promotion checklist in AGENTS.md (search "promotion checklist") shows how to list the
  outstanding ones. Never rebuild a table other tables reference — no safe way to do that
  without cascading deletes.
- **After every push to `main`, an automatic `sync/main-<sha>` PR merges `main` into `dev` with a merge commit** (the only merge-commit PR; releases and hotfixes into `main` are squashes — AGENTS.md "Release schedule"). Compare branches
  with `git diff --stat origin/dev origin/main` — never a commit count
  (`git rev-list --count`), which reads non-zero even when the branches are
  content-identical (squash-only merges rewrite SHAs).
- **Mapbox:** the Mapbox attribution logo rendering at 65×20 is expected and not a finding.
- **Dependabot targets `dev`, never `main`.** The `dev` branch ruleset requires the same
  four checks as `main` (`Lint, typecheck, build`, Semgrep, TruffleHog, Dependency CVE
  Audit) — loosening or removing that ruleset silently turns Dependabot auto-merge into
  merge-on-open. Never `paths-ignore` a required check. Dependabot *security* updates
  are switched off on purpose (they always target `main`); `security-fix.yml` replaces
  them, so do not flag their absence or re-enable them.
- **Deploy only through the GitHub Actions robots** (`deploy-prod.yml` on push to `main`,
  `deploy-dev.yml` on push to `dev`). Never a manual `wrangler deploy` outside CI.
- **Date-only freshness proposals auto-apply by design** (Kyle, 2026-09-15) — not a
  finding. `/venue/<id>` routing (including the box-vs-venue split) is settled — don't
  re-litigate it absent a new bug report.

## Skip

Generated files, lockfiles, `dist/`, anything CI already enforces (lint, types,
format), `migrations/` files that are already applied (immutable history).
