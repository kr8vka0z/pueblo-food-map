# Pueblo Food Map — Agent Operations

> **Start here for structural understanding:** [README.md](README.md) (human entry point) and [ARCHITECTURE.md](ARCHITECTURE.md) (mental model: data aggregator, refresh pipeline, scheduled jobs, MapWrapper state machine, i18n + the bilingual limitation, forms, hosting, Blessing Boxes, admin panel). This file covers operational details only — tokens, deploy, rollback, env vars, and runtime gotchas for AI coders.
>
> **Opening pull requests?** Kyle's standing preference: the **fewest logical PRs**. Group related work (code + its tests + its docs, a mechanical change applied everywhere) into one PR; split only when a change needs its own review, staging check, or independent rollback (e.g. a visual code change vs. a docs-only change, anything touching migrations/auth). PRs target `dev`, never `main`.
>
> **Reviewing a pull request?** Read [REVIEW.md](REVIEW.md) first and report Blocker / Important / Nit the way it defines them. Repo rules go in `REVIEW.md`, never in the CI reviewer's workflow file: `claude-code-action` refuses to run unless `.github/workflows/claude-code-review.yml` is byte-identical to the copy on `main`, so an edit to it on `dev` silently switches reviews off until the next promotion.

**Deeper history for every section below** (superseded designs, phase-by-phase build narration, incident write-ups) was moved out on 2026-09-19 to keep this file small — it reloads on every turn of every session. Pointers say where.

---

# Map library — Mapbox GL JS via react-map-gl

- `mapbox-gl` v3 + `react-map-gl` v8 (`react-map-gl/mapbox` import path). Basemap `mapbox://styles/mapbox/streets-v12`.
- `src/components/Map.tsx` (canvas, markers, popups) + `VenueMarker.tsx` (pin button). `MapWrapper.tsx` wires SearchBar/BottomNav/geolocation/selection.
- Token management: see "Mapbox Token Management" below.
- **Testing:** `react-map-gl/mapbox` needs a WebGL canvas jsdom doesn't have — mock the module (`src/__tests__/Map.test.tsx`, `VenueMarker.test.tsx`).

# Hosting — Cloudflare Workers via OpenNext

- **Prod:** https://pueblofoodmap.com/ · direct Worker (bypasses CDN): https://pueblo-food-map.kyle-boyd.workers.dev/ · `www` and HTTP both 301-redirect via a CF zone rule.
- **Deploys go ONLY through the GitHub Actions robots** — Workers Builds is disconnected (must stay that way; reconnecting double-deploys every push to `main`). Push `main` → `deploy-prod.yml`; push `dev` → `deploy-dev.yml` (staging, `dev.pueblofoodmap.com`). Neither has a schedule; a stranded `main` needs `deploy-prod.yml`'s `workflow_dispatch` recovery hatch (`deploy-dev.yml` has none). Detect one: `main`'s tip (`gh api repos/kr8vka0z/pueblo-food-map/commits/main -q .sha`) ≠ the last Deploy Prod run's `headSha` (`gh run list --workflow "Deploy Prod" --limit 1 --json headSha`).
  - Build: `npx opennextjs-cloudflare build` · Deploy: `npx opennextjs-cloudflare deploy`.
  - **`deploy-prod.yml` now smoke-tests itself post-deploy** — curls `/`, `/venues`, and one real `/venue/<id>` on the direct Worker URL, 6 retries (propagation lag is real, not a failure). This is what would have caught the 10-day 2026-08-24→09-02 outage (218/230 URLs 404ing) on deploy #1 instead of #19 — see "Discoverability / SEO" below.
- **Build-time `NEXT_PUBLIC_*` vars are GitHub Actions repo secrets now, NOT a Cloudflare dashboard Build variable.** That was true only while Workers Builds ran the build inside Cloudflare's own environment; moving the build to a GitHub runner (above) means `next build` inlines these from `${{ secrets.* }}` in `deploy-prod.yml`/`deploy-dev.yml`'s job `env:` block — `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_TURNSTILE_BOX_SITE_KEY`. Runtime server secrets (`RESEND_API_KEY` etc.) are unaffected — those are still `wrangler secret put` on the Worker, read at request time.
- **Dependabot targets `dev`, never `main`** (its rule + the ruleset it depends on are standing rules — see REVIEW.md). **Never verify `dev`/`main` sync with `git rev-list --count`** — squash-only merges rewrite SHAs, so content-identical branches still read non-zero. Use `git diff --stat origin/dev origin/main`.
- **After a squash promotion, `main` is true-merged back into `dev`** — see REVIEW.md's standing rules for the exact recipe and why.

## Build and preview locally

```bash
npm run preview   # OpenNext build + local Worker emulator at http://127.0.0.1:8788
npm run deploy    # OpenNext build + wrangler deploy — rarely needed, CI handles deploys
```

### Rollback

**Last rehearsed on dev: 2026-09-19** — by command, on `pueblo-food-map-staging`: `bunx wrangler deployments list --name <worker>` for the version ids, `bunx wrangler rollback <older-id> --name <worker> -y` to step back (site kept answering), same command with the newer id to step forward. The dashboard route does the same thing: Cloudflare dashboard → Workers & Pages → `pueblo-food-map` → Deployments → pick a prior successful deployment → "Rollback to this deployment" (~30s to switch). **Covers bad code only** — does NOT touch D1 (`pueblo-food-map-admin` prod / `-staging` dev) or an already-applied migration, and `main` still holds the bad commit, so follow with a `git revert` PR into `dev` → promote, or the next merge redeploys the break.

## Operational notes

- **CodeRabbit + Claude both review PRs** — see CONTRIBUTING.md (CodeRabbit, `@coderabbitai review` to trigger — <10 stars means it won't start itself) and REVIEW.md (the Claude CI reviewer's rules).
- **Build logs:** CF dashboard → Workers & Pages → `pueblo-food-map` → Deployments.
- History: atlas-kb note "PFM AGENTS History — Hosting, Tokens and SEO".

## Mapbox Token Management

1Password refs are gitignored in `OPS-SECRETS.local.md` (kept out of this public repo).

- **Public token (`pk.*`, `NEXT_PUBLIC_MAPBOX_TOKEN`):** scopes `styles:read`/`fonts:read`/`tilesets:read`. **One token covers prod AND dev** — URL-restricted to `pueblofoodmap.com`, `www.pueblofoodmap.com`, `dev.pueblofoodmap.com`, `localhost:3000`, `pueblo-food-map.kyle-boyd.workers.dev` (read back off Mapbox 2026-09-02, not transcribed — re-verify before trusting blindly). **Never a second, unrestricted token for CI/preview convenience** (#304: an unrestricted key leaked at dev.pueblofoodmap.com for 45 days this way — the token was deleted outright, not just documented as dangerous). A PR's CF preview subdomain isn't on the allowlist (Mapbox dropped wildcards) — demo from prod instead.
- **Secret token (`sk.*`):** Mapbox API ops only (`api.mapbox.com`, user `kr8vka0z`). NEVER in client code or a `NEXT_PUBLIC_*` var. The API cannot mint `pk` tokens — new public tokens are Studio-dashboard-only.
- **Rotate:** Studio dashboard → revoke/create → update 1Password → update the `NEXT_PUBLIC_MAPBOX_TOKEN` GitHub Actions repo secret (see "Hosting" above, NOT a CF dashboard Build variable) → redeploy.
- History: atlas-kb note "PFM AGENTS History — Hosting, Tokens and SEO".

## Resend Email Key Management

Public forms send via Resend from the Worker at **runtime** (`process.env.RESEND_API_KEY`), never build time.

- **`RESEND_API_KEY`** — key "Pueblo Food Map - Worker (sending)", sending-only, domain-scoped to `pueblofoodmap.com`. `wrangler secret put RESEND_API_KEY`.
- **Admin key** "Atlas Admin (full access)" — management only (create/list/revoke keys), NEVER in the Worker or client code.
- Local dev: `.env.local` holds an `op://` reference, run via `op run --env-file=.env.local -- npm run dev`. Also required locally: `TURNSTILE_SECRET_KEY` (submit routes throw without it) and `CHECKIN_RATE_LIMIT_SECRET` (a DEDICATED secret for the D1-backed rate limiter — never reuse `TURNSTILE_SECRET_KEY`, or rotating one resets the other's open rate-limit buckets). As of #587, `CHECKIN_RATE_LIMIT_SECRET` backs the box check-in rate limiter AND the three public submit forms' rate limiter (`src/lib/formRateLimit.ts`) — all three submit routes now also throw without it, same as `TURNSTILE_SECRET_KEY`.
- **Rotate:** Resend dashboard → new sending-only key → update 1Password → `wrangler secret put RESEND_API_KEY` → verify a live form send → revoke old.
- History: atlas-kb note "PFM AGENTS History — Hosting, Tokens and SEO".

## Observability

- **`GET /api/health`** (`src/app/api/health/route.ts`) — `{status:"ok", version, timestamp}`, `force-dynamic` + `no-store`. Deliberately calls nothing external (a dependency outage shouldn't read as this Worker being down).
- **Dead-man's-switch (Healthchecks.io), push not pull.** `custom-worker.ts` wraps the OpenNext-generated fetch handler and adds `scheduled()`, pinging HC.io every 5 min (`wrangler.jsonc` `triggers.crons: "*/5 * * * *"`, **PROD ONLY** — `env.staging.triggers.crons: []` is a REQUIRED explicit override, `triggers` is one of the few binding types that inherits by default). `HC_PING_URL` is a runtime secret, never committed (this repo is public) and never set on staging. `deploy-prod.yml` also pings HC.io's `/fail` endpoint directly on a failed deploy — belt-and-suspenders on top of the heartbeat.
- **Scheduled jobs ride the same prod-only cron** — email retention (#594, 09:00 UTC) and refresh-pipeline alerts (09:30 UTC), orchestrated in `src/lib/scheduledTasks.ts` (mechanism: ARCHITECTURE.md "Scheduled jobs"). Staging's `triggers.crons` is `[]`, so each job's first live run is production; its real-SQLite `.sql.test.ts` is the only pre-prod proof. Never put this logic back in `custom-worker.ts` — it imports `.open-next/worker.js`, which vitest can't resolve, so it can't be tested there.
- **Form-failure logging** — all 3 public form routes call `logFormFailure` (`src/lib/logger.ts`) on Turnstile/send failures: single-line JSON, `event: "form_submit_failure"`, PII-free by construction (typed fields only, never an IP/email/body). Filter CF Workers Logs on that event name.
- **CSP violation reporting (#593)** — `POST /api/csp-report`, the `report-uri` sink for `next.config.ts`'s enforcing `Content-Security-Policy` (report-only until 2026-09-24, flipped after a clean run on dev), calls `logCspViolation` (`src/lib/logger.ts`) on every report a browser POSTs: single-line JSON, `event: "csp_violation_report"`, each field capped at 500 chars, query strings stripped off `document-uri` (the `/alerts/*` subscription-token PII rule). Unauthenticated by design (CSP spec) but rate-limited — `checkAndIncrement`'s `box_checkin_rate_limit` D1 table, 100/hour per IP then 1000/hour site-wide, same two-tier shape as the public forms' `formRateLimit.ts`; exceeding a cap still returns 204 (fire-and-forget, no user-facing consequence), it just means that report goes unlogged. Filter CF Workers Logs on the event name — this is the only visibility into whether the report-only period actually ran clean before flipping to an enforcing CSP.
- History: atlas-kb note "PFM AGENTS History — Hosting, Tokens and SEO".

# Admin authentication — Better Auth is the sole gate (#237)

**Current state:** admin is gated by Better Auth ALONE — magic link + passkey, one-email allowlist — **on production as well as staging, since promotion #551 (2026-09-20, `main` `4584c51`)**. Cloudflare Access is gone from the admin path entirely: no Access app, no JWT header, no JWKS check, and `requireAccessIdentity()` no longer exists in the code.

The old note here said production cutover was still pending and would also require deleting the live Access application from Cloudflare's dashboard. **There was never an Access application on the pueblofoodmap.com zone** — the account's `access/apps` list was read at promotion time and holds only Rescue Ready, n8n, ToastHoster and paperclip entries. So that dashboard step was a no-op, and there is nothing left to remove. Verified after deploy: `https://pueblofoodmap.com/admin` returns 307 to the login page rather than sitting open.

- **`getAdminDb()` (`src/lib/adminDb.ts`) is the single choke point** — calls `requireAdminSession()` before handing back the `ADMIN_DB` D1 binding. No code path reaches admin data without a live, allowlisted session. Any new admin code fetches D1 through this, never `getCloudflareContext()` directly.
- **`requireAdminOrigin()`** (`src/lib/adminOrigin.ts`, renamed from `cfAccess.ts` #596) is CSRF, independent of identity — required on every non-GET `/api/admin/*` mutation.
- **Allowlist:** `ADMIN_ALLOWLIST` env var (comma-separated, lower-cased), defaults to `["kysboyd@gmail.com"]` if unset — fails toward "only Kyle," never toward "everyone." Enforced at 3 points in `adminAuthAllowlistPlugin.ts` (magic-link send, passkey registration, `user.create` DB hook).
- **Session cookie `__Host-session_token`** — `useSecureCookies: false` is REQUIRED (counterintuitive): better-auth auto-prepends `__Secure-` otherwise, producing a malformed double-prefixed name that silently drops the cookie. `cookies.session_token.attributes.secure: true` restores the flag by hand. Session: `expiresIn: 43200` (12h, rolling), `updateAge: 3600` (1h refresh cadence).
- **Rate limits, two layers:** app-level (Better Auth's own D1-backed `rateLimit`, migration `0004_rate_limit_table.sql`) caps `/sign-in/magic-link` at window 3600s/max 5. A second, edge-level Cloudflare zone rate limit (NOT in this repo — dashboard/zone config) blunts a volumetric flood of `/api/auth/*` before it reaches the Worker; the Free plan caps that ruleset at one rule.
- **`BETTER_AUTH_SECRET`** — runtime secret, `process.env`, same convention as `RESEND_API_KEY`. **`BETTER_AUTH_RP_ID`** — staging-ONLY, set via `wrangler.jsonc` `env.staging.vars` (so passkeys are isolated: a passkey registered on staging can never auth against prod, and vice versa). Read via the Cloudflare env BINDING, not `process.env` — a wrangler `var` isn't guaranteed to surface into `process.env` under OpenNext.
- **Retired, safe to remove wherever still set:** `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` — nothing reads them.
- **Don't run bare `wrangler types`** — its default type set collides `HTMLRewriter`'s `Element` with `lib.dom`'s, silently corrupting DOM types project-wide. Use `npx wrangler types --include-runtime=false`.
- Tables live in the same `pueblo-food-map-admin` D1 database as everything else — no Workers KV anywhere in this app, by design (one store, one backup surface). Migrations `0001` (core admin schema), `0003` (`user`/`session`/`account`/`verification`/`passkey`), `0004` (`rateLimit`).
- History (phase-by-phase build, Phases 1-4 + passkey isolation): atlas-kb note "PFM AGENTS History — Admin Auth".

## Admin panel — venue CRUD, publish, submissions

Mental model (surfaces, auth shape, Publish, queues): ARCHITECTURE.md "Admin panel". Full design: `docs/admin/cloudflare-native-admin-spec.md`. Operational residue only below.

- **Mutations:** every admin write is one atomic `db.batch()` + an `audit_log` row, archive never `DELETE`s, and the server re-validates every field (`src/lib/adminVenueValidation.ts`). PATCH and archive carry the #265 `updated_at` precondition — a concurrent save returns 409, and any new dependent write in the same batch must be `WHERE EXISTS`-gated on it too. Geocoding uses the free US Census geocoder — no key to manage.
- **Publish ordering is load-bearing** (regression-tested): the GitHub commit/PR/auto-merge sequence must succeed BEFORE drafts are promoted in D1, or D1 can mark rows published that never shipped. `GITHUB_PUBLISH_TOKEN` — fine-grained PAT scoped to this repo only, Contents RW + Pull requests RW — provisioned (#260); confirm it's set on the environment you're promoting to before relying on Publish there (unset → 503 `publish_not_configured`). **Production-only guard (#591):** `isProductionWorker()` (`src/lib/publishVenues.ts`) refuses with 403 `publish_not_production` — before any GitHub call, before even the token check — whenever `BETTER_AUTH_RP_ID` is set (i.e. staging). Read via the Cloudflare env binding, never `process.env`.
- **Public, unauthenticated routes** (suggest/report `public_submissions` inserts, `/api/public/**`) read `getCloudflareContext().env.ADMIN_DB` directly, never `getAdminDb()`.
- **`/admin/flags`** reviews the refresh pipeline's `change_proposals` — see "Automated venue-refresh pipeline" below.
- History (full build narrative): atlas-kb note "PFM AGENTS History — Admin Auth".

# Automated venue-refresh pipeline

**What it is:** `.github/workflows/refresh-proposals.yml` ("Venue Data Refresh", cron `0 6 * * 1` weekly since #543 + `workflow_dispatch`) re-scrapes Plentiful/OSM, diffs against D1 `venues`, link-checks every stored `url`, and writes one `change_proposals` row per difference — reviewed at `/admin/flags` above. It writes `venues` directly in exactly one case: a pure freshness ("date-only") update auto-applies (Kyle, 2026-09-15); everything else needs a human approval.

- **⚠️ Does nothing until the workflow file itself is on `main`** — GitHub only fires `schedule`/`workflow_dispatch` for a workflow file on the default branch. Promote BEFORE trying to trigger a run.
- **`--db-mode local|staging|remote`** picks the DATABASE, not just a flag — `remote` is PRODUCTION. Never a free-form `--database` flag, so a typo can't silently fall back to prod.
- **Remote writes are CHUNKED (≤24,000 chars) via `wrangler d1 execute --command`, never `--file`** (`--file` routes through D1's import API, which takes the database offline). A full run is ~45KB — over Windows' 32,767-char command-line limit — so this only ever worked on the Linux GitHub runner until chunking was added. A mid-sequence failure leaves earlier chunks committed; recover with a fresh `workflow_dispatch` (a re-run of the same run_id hits the idempotency guard and exits 0 without finishing).
- **Guardrails, all fail loud (non-zero exit), never a silent no-op:** zero-record abort (per source), abnormal-drop abort (≥max(5, 20% of that source's rows) missing), per-run cap of 150 combined proposals.
- **Credentials:** its own least-privilege `CLOUDFLARE_D1_TOKEN` (D1 Write only) — never the deploy workflows' token, since this job parses adversarial third-party HTML.
- **Jev triage + rename pairing (#543, `scripts/refresh/triage.ts` + `renamePairs.ts`), run only AFTER every guardrail above.** Each non-date-only, non-`link_health` proposal gets one batched TypeSafe Jev call (`jev-1.13.0`, pinned) and a lane stored on its row (`triage_lane`/`triage_json`/`triage_model`/`triage_at`, migration `0016`): updates → "same value, only written differently?" (> 0.8 = likely noise; the wording was picked by measurement, see `triage.ts`); removes → gone / temporarily missing / renamed-or-moved / unclear (always stays "needs a human"); adds → no call, always human. `/admin/flags` filters and sorts by lane (Likely noise / Needs a human / Likely rename). **Degrades, never fails:** `JEV_API_KEY` unset (Actions secret, step-scoped; 1Password `TypeSafe - Jev API Key`), a 5xx/timeout, or 3 failures in a row → the rest is written untriaged (NULL lane = "needs a human"). A 429/529 gets one retry. **Renames:** a same-source remove + add within 100m or with the same phone becomes ONE `update` of the old id (`proposed_diff.meta.rename`) — confirmed by Jev when it's on (same-place > 0.7; below that the two stay separate), on the distance/phone match alone when it's off. Approving it updates the old row in place (id and `/venue/<id>` link survive) and writes `venue_id_aliases` (new upstream id → old venue id); every run maps incoming ids through that table before diffing, which is what stops the same pair being proposed weekly. A rejected rename is never re-paired. **The only write Jev can unlock** is `REFRESH_AI_AUTO_APPLY` (workflow step env, **"false"** — flip only after a watched run's lanes have been checked against real decisions): a phone/url change that's formatting-only once normalised AND scored > 0.9 "same value" auto-applies like a date-only bump, actor `refresh-pipeline-ai`, full `audit_log`. Cost is logged per run (`triage: … cost=$…`) — cents. The LLM text-rewrite pass the issue describes is a hook only (`noopTextRewriter`), off: nothing the pipeline produces needs text written yet. If `0016` isn't on the database, the run skips pairing and triage and writes as before.
- Requires `python3` + `beautifulsoup4==4.14.3` locally (pinned to match CI). Self-check: `python3 scripts/scrape-plentiful.py --self-check` (no network, fixture-based) after touching the hours parser.
- **Source-owned fields** (`SOURCE_OWNED_FIELDS`, `scripts/refresh/diffEngine.ts`) are the only fields a run ever proposes changing; `notes` is deliberately never one. Plentiful owns `hours_irregular` too since #400 (mechanism — scraper emission, `DESTRUCTIVE_CLEAR_GUARD`, equality normalization: ARCHITECTURE.md "Automated venue-refresh pipeline"). **The run's `venues` SELECT names `hours_irregular`, so it fails loudly against any D1 without `0015` applied** — apply `0015` to production before promoting this code.
- **Alerts (#238 pending-age, #234 staleness)** — mechanism in ARCHITECTURE.md "Automated venue-refresh pipeline". Operational: emails `issues@pueblofoodmap.com` via Resend at most once a day per condition, reading `env.RESEND_API_KEY` from the Workers binding — NOT `process.env`, which OpenNext only populates inside a request, not in `scheduled()`.
- **A pending dead-link finding hides the URL only at the next Publish** (#234) — it doesn't light the Publish bar on its own, so nothing changes publicly until someone publishes for any reason. Mechanism: ARCHITECTURE.md.
- History (scraper internals, review-queue mechanics, bulk-approve): atlas-kb note "PFM AGENTS History — Venue-Refresh Pipeline".

# Discoverability / SEO (#164)

- OG/Twitter metadata (`src/app/layout.tsx`), per-page canonical via `buildPageMetadata` (`src/lib/site.ts` — Next shallow-merges metadata, so a raw per-page `metadata` literal drops the inherited OG image), sitemap (`src/app/sitemap.ts`: static pages + every venue + every live `/box/<id>`), robots (`src/app/robots.ts`: blocks bulk-training scrapers by name, leaves answer-engine crawlers on the permissive rule).
- JSON-LD (`src/lib/venueSchema.ts`) via `serializeJsonLd`, which escapes `<`/`>`/`&` to `\uXXXX` — `JSON.stringify` alone doesn't escape `<`, so an unescaped `</script>` inside any string field would break out of the tag.
- **Footgun (caused a 10-day, 218/230-URL outage 2026-08-24→09-02):** static + `dynamicParams = false` pages on this stack need `open-next.config.ts`'s `staticAssetsIncrementalCache` override, or every prerendered dynamic path 404s. Do not revert it or reintroduce `cookies()`/other dynamic APIs into a route depending on it without re-verifying.
- **Footgun:** no server-side redirect on `/` — Next 16 `proxy.ts` fails the build (Node-runtime only, OpenNext/CF can't run it), and a `next.config` `redirects()` `has`-query rule on `/` built clean, passed CI, and 500'd the live homepage in production (2026-06-20). Legacy `?venue=`/`#venue=` links are handled client-side instead. A green build/CF-check does NOT prove a page works on this stack — `deploy-prod.yml` now smoke-tests this automatically (see "Hosting" above).
- History: atlas-kb note "PFM AGENTS History — Hosting, Tokens and SEO".

# Blessing Boxes

Full design: `atlas-kb/projects/Pueblo Food Map/Blessing Boxes Build Plan.md`. **Every interaction (check-in, photo, adopt) lives in the on-map venue card — never a separate page** (the one exception, `/box/<id>/history`, is a read-only log — see REVIEW.md's standing rules, single source of truth for that rule).

- **`category: 'blessing_box'`** — an 8th `VenueCategory`, pin color raspberry `#C2447B` / `--color-cat-blessing` (checked by `npm run design:drift`).
- **Boxes are LIVE, not published** — an admin edit is visible immediately, no Publish click (mechanism: ARCHITECTURE.md "Blessing Boxes").
- **Migrations, in order:** `0005_blessing_boxes.sql` (schema + the `venues` CHECK-constraint widen), `0006_convert_routt_blessing_box.sql`, `0007_box_checkins.sql` (+ `box_checkin_rate_limit`), `0008_box_events.sql`, `0009_box_photos.sql`, `0010_box_adopters_alerts.sql`, `0011_alert_email_lang.sql`, `0012_box_checkin_needs.sql` (`box_checkins.needs`, the "what would help you next time?" ask) — **0011 and 0012 are each NOT idempotent** (`ALTER TABLE ADD COLUMN` has no `IF NOT EXISTS`; a second run fails "duplicate column name"). Apply with `wrangler d1 migrations apply` (tracked), never `d1 execute --file`, for anything not idempotent.
- **Photos → R2**, binding `BOX_PHOTOS`: bucket `pfm-box-photos` (prod, top level) / `pfm-box-photos-staging` (`env.staging`, dedicated, never shared). D1 holds metadata only, never bytes.
- **Dedicated secrets — never reuse the general ones:** `TURNSTILE_BOX_SECRET_KEY` (box check-ins/photos, invisible-mode — separate from `TURNSTILE_SECRET_KEY` so rotating one doesn't reset the other's rate-limit buckets) and `CHECKIN_RATE_LIMIT_SECRET` (HMAC key for the D1 rate-limit counters). Build-time: `NEXT_PUBLIC_TURNSTILE_BOX_SITE_KEY`.
- **Box alerts** (`src/lib/boxAlerts.ts`) — routing and cooldown rules: ARCHITECTURE.md "Blessing Boxes". Dispatch never blocks a check-in; a Resend outage only logs a console warning.
- History (slice-by-slice build, superseded UI iterations — map-first rework, card polish): atlas-kb note "PFM AGENTS History — Blessing Boxes".

## Promotion checklist — every migration + secret a `dev` → `main` promotion needs live in production

Run ALL migrations, in order, against prod D1 (`pueblo-food-map-admin`) BEFORE promoting — `0001_init_admin_schema.sql`, `0002_public_submissions.sql`, `0003_better_auth_schema.sql`, `0004_rate_limit_table.sql`, `0005_blessing_boxes.sql`, `0006_convert_routt_blessing_box.sql`, `0007_box_checkins.sql`, `0008_box_events.sql`, `0009_box_photos.sql`, `0010_box_adopters_alerts.sql`, `0011_alert_email_lang.sql`, `0012_box_checkin_needs.sql`, `0013_strip_plentiful_meta_notes.sql`, `0014_promote_benefit_flags_to_d1.sql`, `0015_venue_hours_irregular.sql`, `0016_proposal_triage.sql` (must follow `0010`/`0011` respectively, each run exactly once — see "Blessing Boxes" above). `npx wrangler d1 migrations apply pueblo-food-map-admin --remote`; `deploy-dev.yml` applies staging's copy automatically on every push to `dev`, `deploy-prod.yml` does NOT — production migration stays a manual, Kyle-gated step.

**`0001`–`0014` are all applied to production** — `0001`–`0012` as of 2026-09-20 (promotion #551), `0013` on 2026-09-23 just before promotion #583 (34 rows cleaned; it IS idempotent — every `UPDATE` is guarded on `id` + exact current `notes`), `0014` on 2026-09-25 just before promotion #645 (afterwards 50 venues have `accepts_snap` set, 49 `accepts_wic`). `d1_migrations` holds fourteen rows. `0014` (#597) is idempotent (every `UPDATE` is per-column NULL-guarded, so a re-run or an admin edit landing first is a safe no-op either way), copied the old benefit-flag overlay's 49 SNAP/WIC matches into D1's `accepts_snap`/`accepts_wic` (filling only a NULL column — an existing admin value always wins), and DOES bump `updated_at` on every row it actually changes. **`0015` is NOT yet applied to production** (outstanding, #400) — adds the one nullable `venues.hours_irregular` column (monthly schedules), no data. **NOT idempotent** (`ALTER TABLE ADD COLUMN`, same as `0011`/`0012`) — `migrations apply` only. No Publish needed for the column itself; one is needed only once a schedule is entered by hand or approved from a refresh proposal. The monthly refresh run fails against production until it's applied (see "Automated venue-refresh pipeline"). Re-running `migrations apply` is safe because it skips what's tracked; hand-applying `0011`, `0012` or `0015` with `d1 execute --file` is NOT, since none is idempotent. A data migration that touches published venue fields only reaches the public map at the next admin **Publish** (`POST /api/admin/publish`) — `src/data/published-venues.ts` is a snapshot regenerated from D1, not read live. **The Publish bar only appears when a row's `updated_at > published_at`**, so a migration that should prompt a publish must also set `updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')` on the rows it changes. `0013` didn't, so its cleaned notes ship with whatever the next Publish is (harmless: the UI already hides that boilerplate). **Before any prod migration, export first** — `wrangler rollback` reverts code and cannot undo a migration. Exports live in `~/Backups/pfm-prod-d1/` on the Mac (latest: `prod-20260925-full-pre-0014.sql`, a full export via `wrangler d1 export pueblo-food-map-admin --remote --output <file>`). **Running wrangler against prod D1 from the Mac:** wrangler isn't logged in there — set `CLOUDFLARE_API_TOKEN` from `op://Atlas/Cloudflare - D1 Write Token - pueblo-food-map refresh/credential` and `CLOUDFLARE_ACCOUNT_ID` (the `username` field of 1Password item "Cloudflare - Account Token"), and run from a checkout of `dev` so the new migration file exists.

**`0016` (#543) is NOT yet applied to production** — four `ALTER TABLE change_proposals ADD COLUMN triage_*` plus `CREATE TABLE IF NOT EXISTS venue_id_aliases`. **NOT idempotent** (the ADD COLUMNs fail "duplicate column name" on a second run — same as `0011`/`0012`): `migrations apply` only, never `d1 execute --file`. Schema only, no data change, no Publish needed. Apply it BEFORE promoting: the app's approve path writes `venue_id_aliases` on a rename approval and fails without it. The weekly refresh job itself probes for the table and runs untriaged if it's missing, so a late apply can't break a run. Also set the `JEV_API_KEY` Actions secret (below) — without it the job runs, just untriaged.

**`0014` landed on production and an admin clicked Publish on 2026-09-25** (verified: 50 venues show SNAP, 8 show WIC, matching `published-venues.ts` exactly) — `src/data/benefit-flags.ts`, its NULL-guarded application in `src/data/venues.ts` (`withBenefitFlagsOverlay`), and `scripts/match-benefits.py` were all dead code and were deleted (#597, follow-up PR). D1 is now authoritative for SNAP/WIC, permanently admin-editable, with no overlay left to fall back to. `venues.ts` is now a plain re-export of `published-venues.ts`.

**Runtime secrets required on the production Worker:** `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_BOX_SECRET_KEY`, `CHECKIN_RATE_LIMIT_SECRET`, `GITHUB_PUBLISH_TOKEN`, `BETTER_AUTH_SECRET`, `ADMIN_ALLOWLIST`, `HC_PING_URL`. **GitHub Actions repo secrets:** `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_TURNSTILE_BOX_SITE_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_TOKEN`, `JEV_API_KEY` (optional — refresh triage, #543).

**After the squash-merge promotion lands, back-merge `main` into `dev`** — exact recipe and why in REVIEW.md's standing rules (never trust a commit count to prove the branches match).

# Design system — DESIGN.md

[DESIGN.md](DESIGN.md) is the agent-facing visual-identity reference — read it before any UI work. `src/app/globals.css` `@theme` is the canonical token source; DESIGN.md mirrors it. Keep them in sync (`npm run design:drift`, a blocking CI gate on any mismatch). CLI binary is `designmd` (never `design.md` — Windows treats `.md` as a file extension).

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
