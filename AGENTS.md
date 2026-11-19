# Pueblo Food Map — Agent Operations

How it's built: [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md). This file holds only the rules and gotchas that aren't obvious from the code. It loads on every turn, so keep it short. Put mechanism in ARCHITECTURE.md; history belongs in git.

- **Pull requests:** make as few logical PRs as possible, and always target `dev`, never `main`. Put code, its tests, and its docs in one PR. Split only when a change needs its own review, staging check, or rollback, such as visual vs. docs-only work, or anything touching migrations or auth.
- **Issues:** before filing, triaging, or picking one up, read the board README: `gh project view 1 --owner kr8vka0z --format json --jq .readme`. It defines the Status, Priority, and Risk fields and the labels. Priority lives only in the board field.
- **Reviewing:** read [REVIEW.md](REVIEW.md) first. Repo review rules go in REVIEW.md. PRs are reviewed by a Codex review that the server's `pr-review` script posts as a PR comment, and the agents' pr-review guard refuses an agent's merge until the PR's latest commit has a clean review. It reads only the PR description, the diff, the spec issue the PR links (`Spec: #<n>`), REVIEW.md and this file, so every PR description follows `.github/pull_request_template.md`.
- **UI work:** read [DESIGN.md](DESIGN.md) first. `src/app/globals.css` `@theme` is the source of truth and DESIGN.md mirrors it; `npm run design:drift` blocks any mismatch. The CLI binary is `designmd`, never `design.md`.

---

## Release schedule — when Kyle says, usually Sunday

All work merges to `dev`. A release starts when Kyle says "cut the release", and only then: no timer does it (the Release Standard in atlas-kb sets the bar). An agent dispatches `release.yml`, which opens a `Release vX.Y.Z` PR from `dev` into `main`; Kyle merges it, which deploys prod, then tags `vX.Y.Z`, publishes the GitHub Release and records the `cut/vX.Y.Z` tag (`deploy-prod.yml`). If dev and main hold identical files the run stays green and opens nothing. Dispatching with a release PR open updates that PR in place, same link and version, or changes nothing if `dev` hasn't moved.

- **Only three things reach `main`:** the `release/*` PR, `hotfix/*` PRs, and `publish-bot` (venue data, no version). The `main-source-guard` check fails any other head branch.
- **Agents open a `dev` → `main` promotion only when Kyle says "cut the release", never propose one, and never ask Kyle to push to prod midweek.** Finished work "ships in the next Sunday release". Say that, nothing more.
- **PR titles into `dev` must be Conventional Commits** (`type(scope)!: description`; the `PR title` check enforces it). The squash title is what the release tooling reads.
- **Versions, changelog voice, hotfix lane, back-sync, manual cut:** [docs/agents/release-process.md](docs/agents/release-process.md). The hotfix lane is an emergency, only for something broken on the live site, said explicitly. A cut fails (red run) while a `sync/main-*` PR into `dev` is open: merge it, then dispatch `Cut release` again.
- **Merge methods:** feature PRs into `dev` = squash. `release/*` and `hotfix/*` into `main` = squash (`main` requires linear history). The automatic `main` → `dev` sync PR = **merge commit** (bot only; never squash it). Nobody else merges into `main` or `dev` with a merge commit.

---

## Hosting and deploys — Cloudflare Workers via vinext

- Prod: https://pueblofoodmap.com/. Staging: https://dev.pueblofoodmap.com/. The direct Worker, which bypasses the CDN, is https://pueblo-food-map.kyle-boyd.workers.dev/.
- **Deploys go only through GitHub Actions.** A push to `main` runs `deploy-prod.yml`; a push to `dev` runs `deploy-dev.yml`. Never run `wrangler deploy` by hand. Workers Builds must stay disconnected, because reconnecting it double-deploys every push. Both deploy workflows run `scripts/smoke.sh` against the deployed Worker and go red on failure, always against the workers.dev origin, never the zone host (Bot Fight Mode 403s GitHub runners there). What it checks: [docs/agents/smoke-tests.md](docs/agents/smoke-tests.md).
- **Stranded `main`:** if `main`'s tip ≠ the last Deploy Prod run's `headSha` (`gh run list --workflow "Deploy Prod" --limit 1 --json headSha`), run `deploy-prod.yml` via `workflow_dispatch`.
- **Branch sync:** Dependabot version updates target `dev`, and `security-fix.yml` patches security advisories on `dev` daily. Dependabot *security* updates are off on purpose (they always target `main`, where `main-source-guard` rejects them): do not re-enable them. After every push to `main`, `deploy-prod.yml` opens the auto-merging `main` → `dev` sync PR (see Release schedule). Check that the branches match with `git diff --stat origin/dev origin/main`, never with a commit count.
- **Actions policy for `pull_request_target`** (repo setting, invisible in diffs): a repo Actions policy allows that event for exactly `dependabot-auto-merge.yml` and `request-review.yml`. Adding another trigger to either file is blocked, deleting the policy stops both workflows, and a new workflow needing `pull_request_target` must be added to the policy's file list. Policy id, API call and dates: [docs/agents/actions-policy.md](docs/agents/actions-policy.md).
- **Discoverability / SEO traps — a green build doesn't prove a page works on this stack:**
  - Pages with `generateStaticParams` + `dynamicParams = false` (venue, `/es` venue, report) are not prerendered: vinext renders each on its first request in a Worker and serves it from memory after. Under OpenNext (before vinext, 2026-10) this pairing 404'd every venue in production for 10 days.
  - **A green build does not prove those pages serve** (OpenNext 404'd them twice with green builds: the outage above, and staging after a 2026-10-05 `next` bump). `ci.yml` runs `scripts/check-pages-serve.sh` (`vite build`, local workerd, real and unknown ids) so a breaking `next` / `vinext` / `vite` bump goes red on its PR. Run it by hand after bumping any of them.
  - Only `pueblofoodmap.com` may be indexed: `custom-worker.ts` noindexes every other host (`src/lib/indexingHost.ts`), and `deploy-prod.yml` fails if the canonical host ever gets the header. Keep venue pages reachable through server-rendered links, not just the sitemap (ARCHITECTURE.md "Crawlability and indexing").
  - Never add a server-side redirect on `/`. Next 16 `proxy.ts` fails the build, and a `next.config` `redirects()` `has` rule 500'd the live homepage. Legacy `?venue=`/`#venue=` links are handled client-side.
- **`env.staging` inherits almost nothing** from the top level of `wrangler.jsonc`. Every new binding, var or secret needs its staging twin. `triggers` is the exception: it does inherit (see Scheduled jobs).
- The Worker env types are hand-written in `cloudflare-env.d.ts`: add every new binding, var or secret there. Don't run `wrangler types`; its runtime types corrupt the DOM types, and without them it can't type the bindings.
- Local preview: `npm run preview` (`vite build`, then the built Worker in local workerd at http://127.0.0.1:8788, local D1/R2 under `.wrangler/state`). `vite.config.ts` keeps remote bindings off, so nothing local reaches Cloudflare.
- Admin preview for the owner (signed in, made-up data, one public link): `scripts/admin-preview/start.sh`; rules in [docs/agents/admin-preview.md](docs/agents/admin-preview.md).
- **One environment per build.** `vite build` reads `wrangler.jsonc` and writes a flattened `dist/server/wrangler.json` for ONE environment (`CLOUDFLARE_ENV=staging` picks staging) plus `.wrangler/deploy/config.json` pointing at it, so `wrangler deploy` takes no `--env`. `wrangler d1 ...` still reads `wrangler.jsonc`.

### Rollback

Code and data roll back separately; a rollback does not change git or undo D1 migrations. Steps for prod, staging, making it stick and the database: [docs/agents/rollback.md](docs/agents/rollback.md).

## Secrets

The 1Password refs are in the gitignored `OPS-SECRETS.local.md`. This repo is public, so never commit a secret.

- **Never** commit a secret, reuse one secret for two jobs, or send a Worker secret to the browser. `CLOUDFLARE_D1_TOKEN` (D1 Write, refresh pipeline only) is never shared with deploys; `CHECKIN_RATE_LIMIT_SECRET` is never a Turnstile secret; the full-access Resend key never goes in the Worker; `HC_PING_URL` is prod only, never staging. Which secret lives where, and each gotcha: [docs/agents/secrets.md](docs/agents/secrets.md).

- **Runtime reads:** use `process.env` for secrets inside a request. In `scheduled()`, and for any wrangler `var`, read the Cloudflare env **binding** (through `src/lib/cloudflareContext.ts`). Under vinext workerd also mirrors secrets and vars into `process.env` everywhere (`nodejs_compat`, compatibility date after 2025-04-01), but the binding is where vars are defined and the one source `scheduled()` is handed, and the code relies on it (the staging-only `BETTER_AUTH_RP_ID` must never silently read undefined).
- **Local dev:** `CLOUDFLARE_INCLUDE_PROCESS_ENV=true op run --env-file=.env.local -- npm run dev` (`vite dev` runs the Worker in workerd, which sees shell variables only with that flag; a `.dev.vars` file works too). The submit routes throw without `TURNSTILE_SECRET_KEY` and `CHECKIN_RATE_LIMIT_SECRET`.
- **Mapbox:** one URL-restricted `pk.*` token covers prod, dev, `http://localhost:3000` (no other local port: the map stays blank on `npm run preview`'s :8788), and the workers.dev URL. **Never create a second, unrestricted token** for CI or previews; one leaked for 45 days (#304). PR preview subdomains aren't on the allowlist, so demo from prod. The `sk.*` token is for API ops only and never goes in client code. New `pk` tokens can only be made in the Studio dashboard. Rotate: Studio → 1Password → the GitHub Actions secret → redeploy.
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

`deploy-dev.yml` applies migrations to staging automatically. **Production migrations are a manual step that Kyle approves.** Before merging the release PR (or a hotfix) into `main`:

Steps (list pending, export first, apply with `migrations apply`, never `d1 execute --file`, confirm runtime secrets, publish-bar `updated_at` rule) and how to run wrangler against prod from the Mac: [docs/agents/d1-promotion.md](docs/agents/d1-promotion.md). Export before every production migration: a rollback can't undo one.

## Automated venue-refresh pipeline

This is `.github/workflows/refresh-proposals.yml` (weekly). The mechanism is described in ARCHITECTURE.md.

- It only runs from `main`, because GitHub fires `schedule`/`workflow_dispatch` only for workflow files on the default branch.
- **`--db-mode remote` is PRODUCTION.**
- Remote writes are chunked `wrangler d1 execute --command` calls, never `--file`. If a chunk fails partway, recover with a fresh `workflow_dispatch`, not a re-run, because a re-run exits early on the idempotency guard.
- Guardrails must fail loudly (non-zero exit), never silently do nothing.
- Only date-only updates auto-apply, plus the source switch (`src/lib/sourceSwitch.ts`) for plain changes after Kyle approved 5 in a row unedited. Never adds, removals, clears or `needs_review` cards; a field the venue told us (`venue_direct` pin) never auto-applies through any lane. `REFRESH_AI_AUTO_APPLY` stays `"false"` until Kyle has checked a watched run's triage lanes against real decisions. Full text: [docs/agents/venue-refresh-and-security-fix.md](docs/agents/venue-refresh-and-security-fix.md).
- **Care and Share is read slowly or not at all** (Kyle): one request every 3.5 s, and any refusal/non-2xx/timeout stops that source for the run with zero writes — never add a retry loop. Never store or log its contact names, emails or phones (`toCasLocation` drops them), and never contact venues.
- It only proposes changes to `SOURCE_OWNED_FIELDS` (Care and Share: address, phone, website, hours — `scripts/refresh/careAndShare.ts`), and never to `notes`.
- **Website reader (`--only website`)** runs only on the server (`ops/systemd/`), never in GitHub Actions: this repo is public. Page text is untrusted: never give `agy` a file path or a working directory with files in it, never start it with any `CLOUDFLARE_*`/`OP_*` variable, and never fetch through a browser. A field counts only if its quote is on our fetched copy of the page; a Gemini failure aborts the source with zero writes; a failed page never means closed. Full text: [docs/agents/venue-refresh-and-security-fix.md](docs/agents/venue-refresh-and-security-fix.md).
- **SNAP/WIC list check** (`refresh-snap-wic.yml`, monthly, `--only snap_wic`) writes cards only: a store missing from a list never becomes "doesn't accept", and there is no auto-apply or switch lane for `usda_snap`/`cdphe_wic`. If coloradowic.gov links a new map, the run fails on purpose: check the new map and update `WIC_MAP_ID` (`scripts/refresh/benefitLists.ts`).
- Scraper self-check after touching the hours parser: `python3 scripts/scrape-plentiful.py --self-check` (needs `beautifulsoup4==4.14.3`).

## Scheduled jobs and observability

- **The cron runs in prod only:** `env.staging.triggers.crons: []` is a required explicit override, because `triggers` is inherited by default. That means each job's first live run is production, and its `.sql.test.ts` is the only proof before prod.
- Job logic lives in `src/lib/scheduledTasks.ts`, never in `custom-worker.ts`, which vitest can't import.
- `/api/health` deliberately calls nothing external.
- **Daily security fix (`security-fix.yml`):** its branch `fix/security-advisories` is bot-owned and force-pushed every run: never push to it. Dependabot *security* updates stay OFF on purpose (a repo setting, invisible in diffs): do not re-enable them. An open "Security check is failing and cannot be fixed automatically" issue means every PR into `dev` is blocked; it carries the hand-fix recipe. An advisory after a cut turns the open release PR red: dispatch `release.yml` again once `dev` is fixed. Full text: [docs/agents/venue-refresh-and-security-fix.md](docs/agents/venue-refresh-and-security-fix.md).
- **Logs, Web Analytics, PostHog:** `invocation_logs` stays `false` (it would store request headers and client IPs); never log an IP, email or form content. Unique-visitor counts come only from Cloudflare Web Analytics, never PostHog. Keep `ANALYTICS_EXCLUDED_IPS` and the Cloudflare "Disable RUM" zone rule in sync. A new `track()` event goes in the `EVENTS` allowlist first. The `/ingest` relay must keep sending our `Origin` and `CF-Connecting-IP` as `X-Forwarded-For`, or replay and city silently stop (#919). Details: [docs/agents/observability.md](docs/agents/observability.md).

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
  - Rules for flyers (R2 `EVENT_FLYERS`), migration `0018_events` ordering, "Suggest Spanish", Denver-time entry, shared events and the event pages (`/event/[id]` stay `force-dynamic`): [docs/agents/events.md](docs/agents/events.md). Events are live like boxes, never in the Publish snapshot.

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
