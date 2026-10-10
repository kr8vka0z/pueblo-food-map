# Pueblo Food Map — Agent Operations

How it's built: [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md). This file holds only the rules and gotchas that aren't obvious from the code. It loads on every turn, so keep it short. Put mechanism in ARCHITECTURE.md; history belongs in git.

- **Pull requests:** make as few logical PRs as possible, and always target `dev`, never `main`. Put code, its tests, and its docs in one PR. Split only when a change needs its own review, staging check, or rollback, such as visual vs. docs-only work, or anything touching migrations or auth.
- **Issues:** before filing, triaging, or picking one up, read the board README: `gh project view 1 --owner kr8vka0z --format json --jq .readme`. It defines the Status, Priority, and Risk fields and the labels. Priority lives only in the board field.
- **Reviewing:** read [REVIEW.md](REVIEW.md) first. Repo review rules go in REVIEW.md, never in `.github/workflows/claude-code-review.yml`. That file must be byte-identical to `main`'s copy, or the CI reviewer silently stops running.
- **UI work:** read [DESIGN.md](DESIGN.md) first. `src/app/globals.css` `@theme` is the source of truth and DESIGN.md mirrors it; `npm run design:drift` blocks any mismatch. The CLI binary is `designmd`, never `design.md`.

---

## Release schedule — weekly, Sunday

All work merges to `dev` all week. Saturday night (`release.yml`, Sun 02:00 UTC) a `Release vX.Y.Z` PR is opened from `dev` into `main`; Kyle walks dev.pueblofoodmap.com on Sunday and merges it, which deploys prod, then tags `vX.Y.Z` and publishes the GitHub Release (`deploy-prod.yml`).

- **Only three things reach `main`:** the weekly `release/*` PR, `hotfix/*` PRs, and `publish-bot` (venue data, no version). The `main-source-guard` check fails any other head branch.
- **Agents never propose or open a `dev` → `main` promotion, and never ask Kyle to push to prod midweek.** Finished work "ships in the next Sunday release". Say that, nothing more.
- **PR titles into `dev` must be Conventional Commits** (`type(scope)!: description`; the `PR title` check enforces it). The squash title is what the release tooling reads.
- **Versions (semver):** major = something users relied on was removed or changed, set by hand only (`--version` or the workflow's `version` input; a `!` title never bumps major on its own); minor = any `feat`; patch = everything else.
- **Changelog voice** (the prompt in `release.yml` says the same): Keep a Changelog headings, plain language for food-bank partners and the public. `### New`, `### Improved`, `### Fixed` only. One short sentence per bullet saying what a visitor or admin notices, PR link at the end. Leave out dependency bumps, CI, docs and refactors unless visible; roll security updates into one "Security updates." bullet. No jargon.
- **Merge methods:** feature PRs into `dev` = squash. `release/*` and `hotfix/*` into `main` = squash (`main` requires linear history). The automatic `main` → `dev` sync PR = **merge commit** (bot only; never squash it). Nobody else merges into `main` or `dev` with a merge commit.
- **Hotfix lane — an emergency, only for something broken on the live site; say so explicitly.** Branch `hotfix/<slug>` from `main`, fix + test, run `node scripts/release/prepare.mjs --out /tmp/prs.md` (patch bump from the newest `v*` tag), add a `## [X.Y.Z] - date` section to CHANGELOG.md under `## [Unreleased]`, squash-merge the PR into `main`. Same tag/release path on merge; the fix reaches `dev` through the automatic sync below. If a weekly release PR is open, close it and re-run `release.yml` after the sync lands, or the two changelogs collide.
- **Back-sync (`main` → `dev`):** after ANY push to `main` (release, hotfix, or `publish-bot` venue data), `deploy-prod.yml`'s `sync-dev` job opens a `sync/main-<sha>` PR into `dev` and enables auto-merge with a merge commit, unless `dev` already contains `main`. That is what puts hotfix code and venue data on staging, brings the version bump and changelog to `dev`, and stops the next release PR from conflicting (squash releases leave the two histories diverged). If the sync PR shows conflicts, resolve them on the `sync/*` branch and keep the merge commit. Nobody edits CHANGELOG.md by hand on `dev`. **The weekly cut fails (red run, no release PR) while a `sync/main-*` PR into `dev` is still open:** it should have auto-merged within minutes, so an open one is stuck on a conflict or a failing check, and a green skip would hide that the release didn't happen. Get the sync PR merged, then dispatch the `Weekly release` workflow again. An open `release/*` PR is different: the cut skips with a warning and stays green, since that is just last week's release awaiting Kyle.
- **First release / manual cut** (`schedule`/`workflow_dispatch` only run once `release.yml` is on `main`): from a `dev` checkout run `node scripts/release/prepare.mjs --version X.Y.Z`, write the CHANGELOG section per the voice above (`bash scripts/release/section.sh X.Y.Z` proves it parses), push `release/vX.Y.Z`, open the PR into `main`, and push the lightweight tag `cut/vX.Y.Z` on the dev commit you cut from. `prepare.mjs` starts next week's PR list at the newest `cut/*` tag; without one it falls back to the newest `v*` tag.

---

## Hosting and deploys — Cloudflare Workers via OpenNext

- Prod: https://pueblofoodmap.com/. Staging: https://dev.pueblofoodmap.com/. The direct Worker, which bypasses the CDN, is https://pueblo-food-map.kyle-boyd.workers.dev/.
- **Deploys go only through GitHub Actions.** A push to `main` runs `deploy-prod.yml`; a push to `dev` runs `deploy-dev.yml`. Never run `npm run deploy` or `wrangler deploy` by hand. Workers Builds must stay disconnected, because reconnecting it double-deploys every push. `deploy-prod.yml` smoke-tests `/`, `/venues`, one `/venue/<id>`, `/es`, `/es/venues`, one `/es/venue/<id>`, the four SEO hubs (`/food-pantries`, `/snap-wic-stores`, `/community-gardens`, `/blessing-boxes`) and their `/es` twins, `/sitemap.xml`, `/robots.txt` and `/llms.txt` (200), the `/es` pages for `<html lang="es">` in the response body, an unmatched URL (404), and the noindex header policy after each deploy.
- **Stranded `main`:** if `main`'s tip ≠ the last Deploy Prod run's `headSha` (`gh run list --workflow "Deploy Prod" --limit 1 --json headSha`), run `deploy-prod.yml` via `workflow_dispatch`.
- **Branch sync:** Dependabot version updates target `dev`, and `security-fix.yml` patches security advisories on `dev` daily. Dependabot *security* updates are off on purpose (they always target `main`, where `main-source-guard` rejects them): do not re-enable them. After every push to `main`, `deploy-prod.yml` opens the auto-merging `main` → `dev` sync PR (see Release schedule). Check that the branches match with `git diff --stat origin/dev origin/main`, never with a commit count.
- **Actions policy for `pull_request_target`:** from 2026-11-02 GitHub blocks that event in public repos unless an Actions policy allows it. Repo policy id 6930, "Allow pull_request_target for the two API-only workflows" (Settings → Actions → Policies; REST `repos/kr8vka0z/pueblo-food-map/actions/policies`, header `X-GitHub-Api-Version: 2026-03-10`; created 2026-10-08), covers exactly `dependabot-auto-merge.yml` and `request-review.yml` and allow-lists only `pull_request_target`. Adding another trigger (e.g. `workflow_dispatch`) to either file is blocked until the policy's allowed events change; deleting the policy stops both workflows; a new workflow that needs `pull_request_target` must be added to the policy's file list. It is a repo setting, so it is invisible in diffs.
- **Rollback (code only):** `bunx wrangler deployments list --name <worker>`, then `bunx wrangler rollback <id> --name <worker> -y`. The worker is `pueblo-food-map` for prod or `pueblo-food-map-staging` for staging. You can also use Dashboard → Workers & Pages → `pueblo-food-map` → Deployments, which also has the build logs. Rollback does not undo D1 migrations, and `main` still holds the bad commit, so follow up with a `git revert` PR into `dev`; it ships in the next release, or as a `hotfix/*` if prod is broken now.
- **Discoverability / SEO traps — a green build doesn't prove a page works on this stack:**
  - Static pages with `dynamicParams = false` need `open-next.config.ts`'s `staticAssetsIncrementalCache` override. Without it every prerendered dynamic path 404s; this caused a 10-day outage.
  - Only `pueblofoodmap.com` may be indexed: `custom-worker.ts` noindexes every other host (`src/lib/indexingHost.ts`), and `deploy-prod.yml` fails if the canonical host ever gets the header. Keep venue pages reachable through server-rendered links, not just the sitemap (ARCHITECTURE.md "Crawlability and indexing").
  - Never add a server-side redirect on `/`. Next 16 `proxy.ts` fails the build, and a `next.config` `redirects()` `has` rule 500'd the live homepage. Legacy `?venue=`/`#venue=` links are handled client-side.
- **`env.staging` inherits almost nothing** from the top level of `wrangler.jsonc`. Every new binding, var or secret needs its staging twin. `triggers` is the exception: it does inherit (see Scheduled jobs).
- Don't run bare `wrangler types`, which corrupts the DOM types. Use `npx wrangler types --include-runtime=false`.
- Local preview: `npm run preview` (Worker emulator at http://127.0.0.1:8788).

## Secrets

The 1Password refs are in the gitignored `OPS-SECRETS.local.md`. This repo is public, so never commit a secret.

| Secret | Lives in | Gotcha |
|---|---|---|
| `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_TURNSTILE_BOX_SITE_KEY` | GitHub Actions secrets | Build-time, inlined by `next build` on the runner. Not a Cloudflare Build variable. |
| `POSTHOG_PROJECT_KEY` (build var `NEXT_PUBLIC_POSTHOG_KEY`) | GitHub Actions secrets | #485. Empty/unset is supported — `src/lib/analytics.ts` never loads posthog-js without a key. |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions secrets | Deploy workflows. |
| `CLOUDFLARE_D1_TOKEN` | GitHub Actions secrets | Refresh pipeline only, D1 Write only. Never share it with deploys, because that job parses untrusted HTML. |
| `JEV_API_KEY` | GitHub Actions secrets | Optional. Without it, refresh runs untriaged. |
| `RESEND_API_KEY` | Worker runtime (`wrangler secret put`) | Sending-only key, scoped to pueblofoodmap.com. The full-access Resend admin key never goes in the Worker. |
| `TURNSTILE_SECRET_KEY`, `TURNSTILE_BOX_SECRET_KEY` | Worker runtime | Kept separate so rotating one doesn't reset the other's rate-limit buckets. |
| `CHECKIN_RATE_LIMIT_SECRET` | Worker runtime | Dedicated HMAC key for the D1 rate limiters (box check-ins, public forms, CSP reports). Never reuse a Turnstile secret. |
| `GITHUB_PUBLISH_TOKEN` | Worker runtime | Fine-grained PAT (this repo only; Contents + Pull requests RW). If unset, Publish returns 503. |
| `CF_ANALYTICS_API_TOKEN` | Worker runtime (`wrangler secret put`) | Account-scoped "Account Analytics: Read" only. Missing/failing → the admin Dashboard's Visitors section (`src/lib/cfAnalytics.ts`) shows "unavailable"; the rest of the page still renders. Never sent to the browser. |
| `POSTHOG_PERSONAL_API_KEY` | Worker runtime (`wrangler secret put`) | Read-only query scope, PostHog Query API (`src/lib/posthogQuery.ts`), admin Dashboard's "What people do on the map" section (#681). Missing/failing → that section alone shows "unavailable"; the rest of the page still renders. `POSTHOG_PROJECT_ID` (630731) is a plain `vars` entry, not a secret — see `wrangler.jsonc`. Never sent to the browser. |
| `BETTER_AUTH_SECRET`, `ADMIN_ALLOWLIST` | Worker runtime | See Admin. |
| `HC_PING_URL` | Worker runtime, **prod only** | Never set it on staging. |

- **Runtime reads:** use `process.env` inside a request. In `scheduled()`, and for any wrangler `var`, read the Cloudflare env **binding**, because OpenNext doesn't populate `process.env` there.
- **Local dev:** `op run --env-file=.env.local -- npm run dev`. The submit routes throw without `TURNSTILE_SECRET_KEY` and `CHECKIN_RATE_LIMIT_SECRET`.
- **Mapbox:** one URL-restricted `pk.*` token covers prod, dev, localhost, and the workers.dev URL. **Never create a second, unrestricted token** for CI or previews; one leaked for 45 days (#304). PR preview subdomains aren't on the allowlist, so demo from prod. The `sk.*` token is for API ops only and never goes in client code. New `pk` tokens can only be made in the Studio dashboard. Rotate: Studio → 1Password → the GitHub Actions secret → redeploy.
- **Resend rotation:** create a new sending-only key → 1Password → `wrangler secret put` → verify a live form send → revoke the old key.

## Admin authentication and data

- **Better Auth is the only gate** (6-digit email code + passkey, one-email allowlist) on prod and staging. There is no Cloudflare Access, and no magic link (#684).
- **The allowlist gate is `adminAuthAllowlistPlugin.ts`**, on `/email-otp/send-verification-otp` (non-admin email or non-`sign-in` type → identical `{success:true}`, no code row, no email) and `/sign-in/email-otp`; every other emailOTP endpoint 404s. Its tests (`adminAuthAllowlistPlugin.test.ts`) are the security boundary — never weaken them.
- **`getAdminDb()` (`src/lib/adminDb.ts`) is the single choke point.** It checks the session before returning the `ADMIN_DB` binding. New admin code must fetch D1 through it, never through `getCloudflareContext()`. Public routes (suggest/report, `/api/public/**`) are the exception and read `getCloudflareContext().env.ADMIN_DB` directly.
- **`requireAdminOrigin()`** (CSRF protection) is required on every non-GET `/api/admin/*` route.
- **`ADMIN_ALLOWLIST`**: comma-separated emails; if unset it defaults to Kyle only. It must always fail toward "only Kyle", never toward "everyone".
- **`ADMIN_OWNER_EMAIL`** (wrangler var, prod + staging) is the one account that sees `/admin/activity` (#679). Everyone else gets a 404 and no nav item; unset falls back to Kyle (`src/lib/adminOwner.ts`). Sign-ins/failures are recorded in `auth_events` by `src/lib/authEvents.ts`, whose writes must never block a sign-in.
- **Session cookie:** `useSecureCookies: false` is required. Otherwise better-auth double-prefixes `__Host-session_token` and the cookie silently drops. `secure: true` is set by hand instead.
- **`BETTER_AUTH_RP_ID`** is set on staging only (`wrangler.jsonc` `env.staging.vars`), so passkeys never cross environments. Read it via the binding.
- **Sign-in rate limits:** sending a code 5/hour and typing one 10/15 min per IP, enforced in-app (D1 `rateLimit` `customRules`), plus 3 tries per code and one Cloudflare zone rule on `/api/auth/*` that lives in the dashboard, not in this repo.
- **Writes:** each write is one atomic `db.batch()` plus an `audit_log` row carrying `identity.sessionId` in `session_id` (the Activity log groups by it). Archive, never `DELETE`. The server re-validates every field (`adminVenueValidation.ts`). PATCH and archive carry the `updated_at` precondition (409 on a concurrent save); any new dependent write in the same batch must be `WHERE EXISTS`-gated on it.
- **Publish ordering is load-bearing:** the GitHub commit/PR/auto-merge must succeed *before* D1 marks drafts published. `isProductionWorker()` refuses Publish on staging (403).
- **One store:** everything lives in the `pueblo-food-map-admin` D1 database. There is no Workers KV, by design.

## Promotion checklist — D1 migrations

`deploy-dev.yml` applies migrations to staging automatically. **Production migrations are a manual step that Kyle approves.** Before merging the weekly release PR (or a hotfix) into `main`:

1. See what's pending: `npx wrangler d1 migrations list pueblo-food-map-admin --remote`.
2. **Export first:** `wrangler d1 export pueblo-food-map-admin --remote --output <file>`, saved to `~/Backups/pfm-prod-d1/` on the Mac. A rollback can't undo a migration.
3. Apply: `npx wrangler d1 migrations apply pueblo-food-map-admin --remote`. **Never use `d1 execute --file`**: it routes through the import API, and `0011`, `0012`, `0015`, `0016`, and `0017` are not idempotent (they fail with "duplicate column" on a re-run).
4. Confirm the Worker has every runtime secret in the table above, then merge the release (the sync back to `dev` is automatic).
5. If a migration changed published venue fields, the public map only updates at the next admin **Publish**. The Publish bar only shows when `updated_at > published_at`, so data migrations must set `updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')` on the rows they change.

To run wrangler against prod from the Mac (wrangler isn't logged in there):
- set `CLOUDFLARE_API_TOKEN` from `op://Atlas/Cloudflare - D1 Write Token - pueblo-food-map refresh/credential`;
- set `CLOUDFLARE_ACCOUNT_ID` from the `username` field of the 1Password item "Cloudflare - Account Token";
- run from a `dev` checkout.

## Automated venue-refresh pipeline

This is `.github/workflows/refresh-proposals.yml` (weekly). The mechanism is described in ARCHITECTURE.md.

- It only runs from `main`, because GitHub fires `schedule`/`workflow_dispatch` only for workflow files on the default branch.
- **`--db-mode remote` is PRODUCTION.**
- Remote writes are chunked `wrangler d1 execute --command` calls, never `--file`. If a chunk fails partway, recover with a fresh `workflow_dispatch`, not a re-run, because a re-run exits early on the idempotency guard.
- Guardrails must fail loudly (non-zero exit), never silently do nothing.
- Only date-only updates auto-apply. `REFRESH_AI_AUTO_APPLY` stays `"false"` until Kyle has checked a watched run's triage lanes against real decisions.
- It only proposes changes to `SOURCE_OWNED_FIELDS`, and never to `notes`.
- Scraper self-check after touching the hours parser: `python3 scripts/scrape-plentiful.py --self-check` (needs `beautifulsoup4==4.14.3`).

## Scheduled jobs and observability

- **The cron runs in prod only:** `env.staging.triggers.crons: []` is a required explicit override, because `triggers` is inherited by default. That means each job's first live run is production, and its `.sql.test.ts` is the only proof before prod.
- Job logic lives in `src/lib/scheduledTasks.ts`, never in `custom-worker.ts`, which vitest can't import.
- `/api/health` deliberately calls nothing external.
- **Daily security fix (`security-fix.yml`, about 17:00 UTC, GitHub Actions, not a Worker cron):** patches production dependencies in `package-lock.json` on `dev` through an auto-merging `fix/security-advisories` PR. That branch is bot-owned and force-pushed every run: never push to it. Build-tool-only advisories are not auto-fixed (weekly Dependabot version updates cover them). If an open issue titled "Security check is failing and cannot be fixed automatically" exists, dev's own lockfile fails the required "Dependency CVE Audit" check and every PR into `dev` is blocked; the usual cause is an exact-pinned direct dependency that Monday's Dependabot update normally bumps, and the issue carries the hand-fix recipe. Dependabot *security* updates stay OFF on purpose: that is a repo setting, invisible in diffs, so do not re-enable it. An advisory published after Saturday's cut turns the open release PR red: close it and re-run `release.yml` once `dev` is fixed. Like `release.yml`, the job only runs once the file is on `main`.
- **Logs:** filter Cloudflare Workers Logs on `event: "form_submit_failure"` or `event: "csp_violation_report"`. Both are PII-free by construction. `POST /api/csp-report` is unauthenticated per the CSP spec but rate-limited (100/hr per IP, 1000/hr site-wide) and always returns 204.
- **Web Analytics:** the beacon comes only from Cloudflare's edge injection on the zone (no app code; see the CSP comment in `next.config.ts`). dev.pueblofoodmap.com is excluded by a zone Configuration Rule (host `dev.pueblofoodmap.com` → Disable RUM, #652), so no beacon on dev is correct. Web Analytics' own host rules can't do this: the free plan allows one, and narrowing it didn't stop dev visits being recorded. Check beacons with a browser user-agent plus `Accept: text/html`; bare `curl` never shows one.
- **PostHog (#485):** `custom-worker.ts` proxies `/ingest/*` to PostHog (`persistence: "memory"`, never `cookieless_mode`, which disables session replay; `person_profiles: never`; session replay ON with `maskAllInputs`). Every page load is a new PostHog visitor, so **unique-visitor counts come only from Cloudflare Web Analytics, never PostHog**. The proxy drops any request whose `CF-Connecting-IP` matches the Worker var `ANALYTICS_EXCLUDED_IPS` (`wrangler.jsonc`, both prod and `env.staging` — same list, `src/lib/ipMatch.ts` does the matching). **Keep that list in sync with the Cloudflare Web Analytics "Disable RUM" zone Configuration Rule** covering the same IPs (dashboard/zone config, not in this repo) — a home-network IP change needs both updated together, or one of the two analytics surfaces keeps recording Kyle's own visits. Admin devices additionally self-exclude via a `pfm_internal` localStorage flag (`src/lib/analytics.ts`), set on admin sign-in (`AdminLoginForm.tsx`) and cleared by `/?internal=off`. `NEXT_PUBLIC_POSTHOG_KEY` unset is a fully supported no-op (see the Secrets table above). Named `track()` calls (the `EVENTS` allowlist in `src/lib/analytics.ts`) are wired into the public components as of #485 PR 2 — `near_me_clicked` (`source: "splash" | "map"`), `location_permission` (`result: "granted" | "denied" | "timeout" | "unavailable"` plus `ms` from request to outcome; only code 1 is "denied", a timeout/unavailable failure retries once at low accuracy and is logged on every failed request, #738), `venue_opened`, `directions_clicked`, `call_clicked`, `website_clicked`, `share_clicked`, `favorite_added`, `report_opened`, `filter_toggled`, `locale_switched`, `search_used` (sent when the search is committed by Enter/leaving the box or after 2 s idle, never the same term twice in a row, term passed through `sanitizeSearchTerm`, #738). `FORM_SUBMITTED` is defined in the allowlist but has no caller yet.

## Code gotchas

- **Lockfile writes use npm 11:** anything that re-resolves dependencies (install, update, audit fix) runs `npx -y npm@11.21.0 ...`, never Node 22's bundled npm 10. npm 10 flags production-reachable packages as dev and blinds the `npm audit --omit=dev` check (#752/#753). (`release.yml`'s `npm version` under npm 10 only touches version lines and is fine.) Bumping an exact-pinned package by hand: `npx -y npm@11.21.0 install --save-exact --package-lock-only --ignore-scripts <package>@<version>`; without `--save-exact` npm rewrites the pin as a caret range.
- **Tests:** mock `react-map-gl/mapbox`, because jsdom has no WebGL.
- **Page metadata:** use `buildPageMetadata` (`src/lib/site.ts`), never a raw per-page `metadata` literal, which drops the inherited OG image.
- **JSON-LD:** always go through `serializeJsonLd`, which escapes `<`; a raw `JSON.stringify` lets `</script>` break out of the tag.
- **Blessing Boxes:**
  - Every interaction (check-in, photo, adopt) lives in the on-map venue card, never on a separate page (REVIEW.md lists the read-only exceptions).
  - Boxes are live: admin edits show immediately, with no Publish.
  - Photos go to R2 (`pfm-box-photos`, with its own staging bucket). D1 holds metadata only.
  - Box alert sends never block a check-in.
- **Events (#156, slice 1 #757):**
  - Live like boxes, never in the Publish snapshot. Mechanism: ARCHITECTURE.md "Events".
  - **Migration `0018_events` reaches a database before the code that uses it.** Staging gets it from `deploy-dev.yml`; production is the manual step above. Until then `/api/public/events` returns an empty 200 and the admin Events tab shows "Couldn't load", by design.
  - **"Suggest Spanish"** uses the Workers AI binding `AI` (`wrangler.jsonc`, prod and `env.staging`; no secret). A missing binding is a clean 503, never a crash. Suggestions are machine-made and unreviewed; the form fills only empty Spanish boxes.
  - Times are entered in America/Denver and converted to UTC on the server (`src/lib/eventTime.ts`); never use the browser's timezone for an event.

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
