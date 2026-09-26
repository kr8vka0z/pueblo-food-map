# Pueblo Food Map — Agent Operations

How it's built: [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md). This file holds only the rules and gotchas that aren't obvious from the code. It loads on every turn, so keep it short. Put mechanism in ARCHITECTURE.md; history belongs in git.

- **Pull requests:** make as few logical PRs as possible, and always target `dev`, never `main`. Put code, its tests, and its docs in one PR. Split only when a change needs its own review, staging check, or rollback, such as visual vs. docs-only work, or anything touching migrations or auth.
- **Issues:** before filing, triaging, or picking one up, read the board README: `gh project view 1 --owner kr8vka0z --format json --jq .readme`. It defines the Status, Priority, and Risk fields and the labels. Priority lives only in the board field.
- **Reviewing:** read [REVIEW.md](REVIEW.md) first. Repo review rules go in REVIEW.md, never in `.github/workflows/claude-code-review.yml`. That file must be byte-identical to `main`'s copy, or the CI reviewer silently stops running.
- **UI work:** read [DESIGN.md](DESIGN.md) first. `src/app/globals.css` `@theme` is the source of truth and DESIGN.md mirrors it; `npm run design:drift` blocks any mismatch. The CLI binary is `designmd`, never `design.md`.

---

## Hosting and deploys — Cloudflare Workers via OpenNext

- Prod: https://pueblofoodmap.com/. Staging: https://dev.pueblofoodmap.com/. The direct Worker, which bypasses the CDN, is https://pueblo-food-map.kyle-boyd.workers.dev/.
- **Deploys go only through GitHub Actions.** A push to `main` runs `deploy-prod.yml`; a push to `dev` runs `deploy-dev.yml`. Never run `npm run deploy` or `wrangler deploy` by hand. Workers Builds must stay disconnected, because reconnecting it double-deploys every push. `deploy-prod.yml` smoke-tests `/`, `/venues`, and one `/venue/<id>` after each deploy.
- **Stranded `main`:** if `main`'s tip ≠ the last Deploy Prod run's `headSha` (`gh run list --workflow "Deploy Prod" --limit 1 --json headSha`), run `deploy-prod.yml` via `workflow_dispatch`.
- **Branch sync:** Dependabot targets `dev`. After each squash promotion, true-merge `main` back into `dev` (recipe in REVIEW.md). Check that the branches match with `git diff --stat origin/dev origin/main`, never with a commit count.
- **Rollback (code only):** `bunx wrangler deployments list --name <worker>`, then `bunx wrangler rollback <id> --name <worker> -y`. The worker is `pueblo-food-map` for prod or `pueblo-food-map-staging` for staging. You can also use Dashboard → Workers & Pages → `pueblo-food-map` → Deployments, which also has the build logs. Rollback does not undo D1 migrations, and `main` still holds the bad commit, so follow up with a `git revert` PR into `dev` and promote it.
- **Discoverability / SEO traps — a green build doesn't prove a page works on this stack:**
  - Static pages with `dynamicParams = false` need `open-next.config.ts`'s `staticAssetsIncrementalCache` override. Without it every prerendered dynamic path 404s; this caused a 10-day outage.
  - Never add a server-side redirect on `/`. Next 16 `proxy.ts` fails the build, and a `next.config` `redirects()` `has` rule 500'd the live homepage. Legacy `?venue=`/`#venue=` links are handled client-side.
- **`env.staging` inherits almost nothing** from the top level of `wrangler.jsonc`. Every new binding, var or secret needs its staging twin. `triggers` is the exception: it does inherit (see Scheduled jobs).
- Don't run bare `wrangler types`, which corrupts the DOM types. Use `npx wrangler types --include-runtime=false`.
- Local preview: `npm run preview` (Worker emulator at http://127.0.0.1:8788).

## Secrets

The 1Password refs are in the gitignored `OPS-SECRETS.local.md`. This repo is public, so never commit a secret.

| Secret | Lives in | Gotcha |
|---|---|---|
| `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_TURNSTILE_BOX_SITE_KEY` | GitHub Actions secrets | Build-time, inlined by `next build` on the runner. Not a Cloudflare Build variable. |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | GitHub Actions secrets | Deploy workflows. |
| `CLOUDFLARE_D1_TOKEN` | GitHub Actions secrets | Refresh pipeline only, D1 Write only. Never share it with deploys, because that job parses untrusted HTML. |
| `JEV_API_KEY` | GitHub Actions secrets | Optional. Without it, refresh runs untriaged. |
| `RESEND_API_KEY` | Worker runtime (`wrangler secret put`) | Sending-only key, scoped to pueblofoodmap.com. The full-access Resend admin key never goes in the Worker. |
| `TURNSTILE_SECRET_KEY`, `TURNSTILE_BOX_SECRET_KEY` | Worker runtime | Kept separate so rotating one doesn't reset the other's rate-limit buckets. |
| `CHECKIN_RATE_LIMIT_SECRET` | Worker runtime | Dedicated HMAC key for the D1 rate limiters (box check-ins, public forms, CSP reports). Never reuse a Turnstile secret. |
| `GITHUB_PUBLISH_TOKEN` | Worker runtime | Fine-grained PAT (this repo only; Contents + Pull requests RW). If unset, Publish returns 503. |
| `BETTER_AUTH_SECRET`, `ADMIN_ALLOWLIST` | Worker runtime | See Admin. |
| `HC_PING_URL` | Worker runtime, **prod only** | Never set it on staging. |

- **Runtime reads:** use `process.env` inside a request. In `scheduled()`, and for any wrangler `var`, read the Cloudflare env **binding**, because OpenNext doesn't populate `process.env` there.
- **Local dev:** `op run --env-file=.env.local -- npm run dev`. The submit routes throw without `TURNSTILE_SECRET_KEY` and `CHECKIN_RATE_LIMIT_SECRET`.
- **Mapbox:** one URL-restricted `pk.*` token covers prod, dev, localhost, and the workers.dev URL. **Never create a second, unrestricted token** for CI or previews; one leaked for 45 days (#304). PR preview subdomains aren't on the allowlist, so demo from prod. The `sk.*` token is for API ops only and never goes in client code. New `pk` tokens can only be made in the Studio dashboard. Rotate: Studio → 1Password → the GitHub Actions secret → redeploy.
- **Resend rotation:** create a new sending-only key → 1Password → `wrangler secret put` → verify a live form send → revoke the old key.

## Admin authentication and data

- **Better Auth is the only gate** (magic link + passkey, one-email allowlist) on prod and staging. There is no Cloudflare Access.
- **`getAdminDb()` (`src/lib/adminDb.ts`) is the single choke point.** It checks the session before returning the `ADMIN_DB` binding. New admin code must fetch D1 through it, never through `getCloudflareContext()`. Public routes (suggest/report, `/api/public/**`) are the exception and read `getCloudflareContext().env.ADMIN_DB` directly.
- **`requireAdminOrigin()`** (CSRF protection) is required on every non-GET `/api/admin/*` route.
- **`ADMIN_ALLOWLIST`**: comma-separated emails; if unset it defaults to Kyle only. It must always fail toward "only Kyle", never toward "everyone".
- **Session cookie:** `useSecureCookies: false` is required. Otherwise better-auth double-prefixes `__Host-session_token` and the cookie silently drops. `secure: true` is set by hand instead.
- **`BETTER_AUTH_RP_ID`** is set on staging only (`wrangler.jsonc` `env.staging.vars`), so passkeys never cross environments. Read it via the binding.
- **Magic-link rate limit:** 5 per hour, enforced in-app (D1 `rateLimit`), plus one Cloudflare zone rule on `/api/auth/*` that lives in the dashboard, not in this repo.
- **Writes:** each write is one atomic `db.batch()` plus an `audit_log` row. Archive, never `DELETE`. The server re-validates every field (`adminVenueValidation.ts`). PATCH and archive carry the `updated_at` precondition (409 on a concurrent save); any new dependent write in the same batch must be `WHERE EXISTS`-gated on it.
- **Publish ordering is load-bearing:** the GitHub commit/PR/auto-merge must succeed *before* D1 marks drafts published. `isProductionWorker()` refuses Publish on staging (403).
- **One store:** everything lives in the `pueblo-food-map-admin` D1 database. There is no Workers KV, by design.

## Promotion checklist — D1 migrations

`deploy-dev.yml` applies migrations to staging automatically. **Production migrations are a manual step that Kyle approves.** Before promoting `dev` → `main`:

1. See what's pending: `npx wrangler d1 migrations list pueblo-food-map-admin --remote`.
2. **Export first:** `wrangler d1 export pueblo-food-map-admin --remote --output <file>`, saved to `~/Backups/pfm-prod-d1/` on the Mac. A rollback can't undo a migration.
3. Apply: `npx wrangler d1 migrations apply pueblo-food-map-admin --remote`. **Never use `d1 execute --file`**: it routes through the import API, and `0011`, `0012`, `0015`, and `0016` are not idempotent (they fail with "duplicate column" on a re-run).
4. Confirm the Worker has every runtime secret in the table above, then promote and back-merge.
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
- **Logs:** filter Cloudflare Workers Logs on `event: "form_submit_failure"` or `event: "csp_violation_report"`. Both are PII-free by construction. `POST /api/csp-report` is unauthenticated per the CSP spec but rate-limited (100/hr per IP, 1000/hr site-wide) and always returns 204.
- **Web Analytics:** the beacon comes only from Cloudflare's edge injection on the zone (no app code; see the CSP comment in `next.config.ts`). dev.pueblofoodmap.com is excluded by a zone Configuration Rule (host `dev.pueblofoodmap.com` → Disable RUM, #652), so no beacon on dev is correct. Web Analytics' own host rules can't do this: the free plan allows one, and narrowing it didn't stop dev visits being recorded. Check beacons with a browser user-agent plus `Accept: text/html`; bare `curl` never shows one.

## Code gotchas

- **Tests:** mock `react-map-gl/mapbox`, because jsdom has no WebGL.
- **Page metadata:** use `buildPageMetadata` (`src/lib/site.ts`), never a raw per-page `metadata` literal, which drops the inherited OG image.
- **JSON-LD:** always go through `serializeJsonLd`, which escapes `<`; a raw `JSON.stringify` lets `</script>` break out of the tag.
- **Blessing Boxes:**
  - Every interaction (check-in, photo, adopt) lives in the on-map venue card, never on a separate page (REVIEW.md has the one exception).
  - Boxes are live: admin edits show immediately, with no Publish.
  - Photos go to R2 (`pfm-box-photos`, with its own staging bucket). D1 holds metadata only.
  - Box alert sends never block a check-in.

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
