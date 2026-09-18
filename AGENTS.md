# Pueblo Food Map — Agent Operations

> **Start here for structural understanding:** [README.md](README.md) (human
> entry point) and [ARCHITECTURE.md](ARCHITECTURE.md) (mental model: data
> aggregator, MapWrapper state machine, i18n, form-route triad, hosting).
> This file covers operational details only — tokens, deploy, rollback, env
> vars, and runtime gotchas for AI coders.

---

# Map library — Mapbox GL JS via react-map-gl

- **Libraries:** `mapbox-gl` v3 + `react-map-gl` v8 (react-map-gl/mapbox import path).
- **Basemap style:** `mapbox://styles/mapbox/streets-v12` (demo). Custom Studio brand basemap is a post-demo polish pass.
- **Map components:** `src/components/Map.tsx` (the main map canvas, markers, popups, user-location dot) and `src/components/VenueMarker.tsx` (the interactive Lucide MapPin button rendered inside each Mapbox Marker).
- **Wrapper:** `src/components/MapWrapper.tsx` wires the map to SearchBar, BottomNav (its Near me button replaced LocateButton), geolocation state, and venue selection.
- **Token management:** see "Mapbox Token Management" section below.
- **Testing:** react-map-gl/mapbox requires a WebGL canvas unavailable in jsdom. Mock the module in tests — see `src/__tests__/Map.test.tsx` and `src/__tests__/VenueMarker.test.tsx` for the pattern.

# Hosting — Cloudflare Workers via OpenNext

- **Live production URL:** https://pueblofoodmap.com/ (primary)
- **Direct Worker URL:** https://pueblo-food-map.kyle-boyd.workers.dev/ (fallback / bypass CDN)
- **HTTP/www redirect:** HTTP requests and `www.pueblofoodmap.com` both 301-redirect to `https://pueblofoodmap.com` via Cloudflare zone redirect rule + Always-Use-HTTPS.
- **Hosting:** Cloudflare Workers, project name `pueblo-food-map` (configured in `wrangler.jsonc`)
- **Adapter:** `@opennextjs/cloudflare` — translates Next.js App Router output into Worker format
- **CI/CD:** both envs deploy via GitHub Actions robots — Cloudflare Workers
  Builds is disconnected (see [`deploy-prod.yml`](.github/workflows/deploy-prod.yml)'s
  file header for why the two must never both be connected). Push to `main` →
  [`deploy-prod.yml`](.github/workflows/deploy-prod.yml) builds and deploys the
  top-level `wrangler.jsonc` config. Push to `dev` →
  [`deploy-dev.yml`](.github/workflows/deploy-dev.yml) deploys the staging
  worker at dev.pueblofoodmap.com. Neither workflow has a manual re-run
  trigger — a deploy only happens as a side effect of a push landing on that
  branch. See [ARCHITECTURE.md](ARCHITECTURE.md), "Hosting — Cloudflare
  Workers via OpenNext", for the historical gap where an auto-merge could land
  a commit on `main` with no deploy firing at all — closed for Dependabot in
  #375, but still live for any future workflow that pushes with `GITHUB_TOKEN`.
  - **Build command:** `npx opennextjs-cloudflare build`
  - **Deploy command:** `npx wrangler deploy` (CF default)
- **Dependency updates land on `dev` first, like everything else (#375).**
  [`dependabot.yml`](.github/dependabot.yml) sets `target-branch: dev` on both
  ecosystems, so Dependabot opens its weekly PRs against `dev` and
  [`dependabot-auto-merge.yml`](.github/workflows/dependabot-auto-merge.yml)
  squashes patch/minor bumps there; they reach production only via the normal
  `dev` → `main` promotion PR. Before this, Dependabot defaulted to the
  repository's default branch and merged straight into `main` with nothing
  flowing back — a one-way valve that left `dev` 20 commits behind `main` by
  2026-09-01, so anything branched off `dev` was built and graded against a
  three-week-stale base.
  - **The `dev` branch ruleset is load-bearing for this, not decoration.** It
    requires the same four status checks `main` does — `Lint, typecheck, build`,
    `SAST Code Analysis (Semgrep)`, `Secret Leak Scan (TruffleHog)`,
    `Dependency CVE Audit` — all of which already run on PRs into `dev`
    ([`ci.yml`](.github/workflows/ci.yml),
    [`weekly-security-audit.yml`](.github/workflows/weekly-security-audit.yml)).
    `gh pr merge --auto` only waits for green CI when the base branch has
    required checks; on a branch with none it merges the moment auto-merge is
    enabled. Delete that ruleset and Dependabot auto-merge silently becomes
    merge-on-open.
  - **Do NOT verify this with `git rev-list --count origin/dev..origin/main`.**
    The repo allows squash merges only (merge commits and rebase are both
    disabled and `main` requires linear history), so a `dev` → `main` promotion
    rewrites the promoted commits into one new SHA. The two branches end up
    content-identical but permanently SHA-divergent, and a commit count will
    read non-zero even when nothing is actually missing. Compare content
    instead: `git diff --stat origin/dev origin/main`.

## Build and preview locally

```bash
npm run preview   # OpenNext build + local Worker emulator at http://127.0.0.1:8788
npm run deploy    # OpenNext build + wrangler deploy to production
                  # Requires `wrangler login` first; rarely needed — CI handles deploys
```

## Operational notes

- **CodeRabbit review:** after opening a PR, comment `@coderabbitai review` — the repo has fewer than 10 stars, so CodeRabbit never starts a review by itself. Read its findings (inline comments plus the "Other comments" block in its review body) and address or answer them before merging. See CONTRIBUTING.md.
- **Build logs:** Cloudflare dashboard → Workers & Pages → `pueblo-food-map` → Deployments tab
- **Rollback:** Cloudflare dashboard → Workers & Pages → `pueblo-food-map` → Deployments tab → find a previous successful deployment → "Rollback to this deployment". Production traffic switches in ~30 seconds.
- **Environment variables — two kinds, two places.** (1) Build-time `NEXT_PUBLIC_*` are inlined by `next build` → set under **Settings → Build → Build variables**. (2) Runtime server secrets (`RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`) are read at request time → set under **Settings → Variables and Secrets**. **Workers Builds has ONE shared build-variable set and a single `production` environment — there is NO separate Preview environment** (that's Cloudflare Pages). The same build vars apply to production deploys and PR preview builds.

## Mapbox Token Management

> **1Password references are intentionally omitted from this public repo.** Each secret below maps to an `op://...` reference in the gitignored `OPS-SECRETS.local.md` (create it locally from the team vault). This keeps the credential inventory out of public view.

### Public token (client-side, `pk.*`)

- **Purpose:** Used by the Next.js client bundle to render the map.
- **1Password:** see `OPS-SECRETS.local.md` (gitignored -- 1Password refs are kept out of this public repo)
- **Env var:** `NEXT_PUBLIC_MAPBOX_TOKEN`
- **Local dev:** `.env.local` (gitignored — never commit this file)
- **Build variable:** Cloudflare dashboard → Workers & Pages → `pueblo-food-map` → Settings → Build → Build variables. Workers Builds has one shared build-variable set and a single `production` environment — there is NO separate Preview environment (that's Cloudflare Pages). The same build vars apply to prod deploys and PR preview builds. `NEXT_PUBLIC_*` vars are inlined into the client bundle by `next build`; they must be present at build time, not runtime.
- **Scopes:** `styles:read`, `fonts:read`, `tilesets:read`
- **URL restrictions (bare hostnames, no protocol, no wildcards)** — read back off Mapbox 2026-09-02, not transcribed:
  - `pueblofoodmap.com`
  - `www.pueblofoodmap.com`
  - `dev.pueblofoodmap.com`
  - `localhost:3000`
  - `pueblo-food-map.kyle-boyd.workers.dev`
- **This one token covers BOTH deploys.** `dev.pueblofoodmap.com` was added to the
  allowlist on 2026-07-03 but never written down here, so `deploy-dev.yml` went on
  reusing the unrestricted Lighthouse token on the belief that the real token would
  401 on staging (#304). It does not. Both
  [`deploy-prod.yml`](.github/workflows/deploy-prod.yml) and
  [`deploy-dev.yml`](.github/workflows/deploy-dev.yml) now read the same
  `NEXT_PUBLIC_MAPBOX_TOKEN` GitHub secret. **A `NEXT_PUBLIC_*` value is inlined
  into the client bundle by `next build` and both bundles are served publicly, so
  neither workflow may ever be pointed at an unrestricted token** — Cloudflare
  Access gates dev's pages, never its static JS.
- **Verifying which token an environment actually serves** (do this rather than
  trusting this file — that is exactly how #304 happened): fetch the site's JS
  chunks, grep for `pk\.`, then base64-decode the token's middle segment. The `a`
  field is the Mapbox token id, which
  `curl "https://api.mapbox.com/tokens/v2/kr8vka0z?access_token=$SK"` lists
  alongside that token's real `allowedUrls`.
- **Preview deploy warning:** A PR's CF preview deploy is reachable at the URL Cloudflare posts as a check on the PR (do not guess a `<branch>-…workers.dev` subdomain — that pattern does not resolve and 404s). Its map throws "site not authorized" unless that exact subdomain is added to the token's URL restrictions (Mapbox dropped wildcard support), so for a quick demo it is usually easier to demo from production.

### Lighthouse CI build token — RETIRED (#304). There is exactly ONE public token now.

`.github/workflows/lighthouse.yml` used to read its own separate
`MAPBOX_PREVIEW_TOKEN` secret, holding a deliberately **URL-unrestricted** `pk.*`
token. It now reads the same restricted `NEXT_PUBLIC_MAPBOX_TOKEN` secret both
deploys use, which authorizes on the CI's local server because `localhost:3000`
is on that token's Mapbox allowlist.

**WHY the separate token is gone rather than merely documented as dangerous:** an
unrestricted key sitting in the repo's secret store is one careless
`${{ secrets.… }}` reference away from a publicly served bundle, and a
`NEXT_PUBLIC_*` value is inlined into the client bundle by `next build` — the
reference and the leak are the same act, with nothing in between to catch it.
That is not hypothetical here: `deploy-dev.yml` made exactly that reference and
published an any-domain Mapbox key at dev.pueblofoodmap.com for 45 days (#304).
The file-header comment warning about it had been sitting directly above the
offending line the whole time. Removing the token removes the footgun; keeping it
with a better warning would not have.

**Consequences to preserve:**

- **Do not reintroduce an unrestricted token for CI convenience.** If a future job
  needs the map to render on some hostname, add that hostname to the one public
  token's URL allowlist in Mapbox Studio — and write it into the allowlist above,
  because a stale copy of that list is precisely what kept #304 alive for 45 days.
- **If the secret is absent,** the Lighthouse build still succeeds and
  accessibility is still measured, but the map renders blank ("not authorized"),
  so the performance score is unrepresentative. There is **no** production
  fallback — the job always audits the local build of the commit under test.

### Secret token (backend / admin, `sk.*`)

- **Purpose:** Mapbox API operations — managing tokens, uploading tilesets, managing Studio styles.
- **1Password:** see `OPS-SECRETS.local.md` (gitignored -- 1Password refs are kept out of this public repo)
- **NEVER** put this in client code, browser-exposed env vars, or git.
- Used by agents performing API-side Mapbox work (token management, tileset uploads, style edits).
- **Mapbox API base:** `https://api.mapbox.com`, username: `kr8vka0z`
- Example API call:

  ```bash
  curl "https://api.mapbox.com/tokens/v2/kr8vka0z?access_token=$SK"
  ```

- **Important:** The Mapbox API cannot mint `pk` tokens — every token created via API is `sk` regardless of scopes. To create new public tokens, use the Mapbox Studio dashboard, not the API.

### Rotation procedure

**Public token:**

1. Mapbox Studio dashboard → Access tokens → revoke old token, create new (check only `styles:read`, `fonts:read`, `tilesets:read`; copy URL restrictions from old token).
2. Update the value in 1Password (reference in `OPS-SECRETS.local.md`).
3. Update the `NEXT_PUBLIC_MAPBOX_TOKEN` **build variable** in CF Workers Builds (single shared set; Settings → Build).
4. Update local `.env.local`.
5. Trigger a redeploy (push a commit or manually trigger from CF dashboard).

**Secret token:**

1. Mapbox Studio dashboard → Access tokens → revoke old token, create new with only the specific secret scopes needed.
2. Update the value in 1Password (reference in `OPS-SECRETS.local.md`).
3. No CF env var to update (secret tokens must never go there).

## Resend Email Key Management

The three public forms (report a closure, suggest a venue, general feedback) send email via the
[Resend](https://resend.com) API from the Cloudflare Worker at **runtime** — not at build time.
The Worker reads `process.env.RESEND_API_KEY` server-side; the value is never exposed to the
client bundle or any `NEXT_PUBLIC_*` variable.

### Sending key — Worker runtime (`RESEND_API_KEY`)

- **Resend key name:** `Pueblo Food Map - Worker (sending)`
- **Permissions:** sending-only, domain-scoped to `pueblofoodmap.com`
- **1Password:** see `OPS-SECRETS.local.md` (gitignored -- 1Password refs are kept out of this public repo)
- **CF env type:** Runtime secret (`secret_text`) — set via CF dashboard → Workers & Pages →
  `pueblo-food-map` → Settings → Variables and Secrets, or:
  ```bash
  wrangler secret put RESEND_API_KEY
  ```
  This is a **runtime** secret. Unlike `NEXT_PUBLIC_*` build variables, it does not need to be
  present at build time — it is injected into the Worker process at request time.
- **WHY sending-only + domain-scoped:** The form handler is internet-exposed. Limiting the key to
  send-only on one domain caps the blast radius if the key leaks — an attacker can send mail from
  `pueblofoodmap.com`, but cannot read, delete, or manage the Resend account or other domains. Full
  account takeover requires the admin key (below), which never touches the Worker.

### Admin key — management only, NOT for the Worker

- **Resend key name:** `Atlas Admin (full access)`
- **Permissions:** `full_access`
- **1Password:** see `OPS-SECRETS.local.md` (gitignored -- 1Password refs are kept out of this public repo)
- **NEVER** place this key in the Worker, client code, git, or any `NEXT_PUBLIC_*` / public env var.
- Use it only for Resend API management operations (create/list/delete keys and domains).
- **Resend API base:** `https://api.resend.com`. The list-keys endpoint returns metadata only — it
  never returns token values, so rotation is always create-new → swap → revoke-old.

### Local dev (no plaintext secrets)

`.env.local` holds a 1Password **reference**, not the secret value:

```
RESEND_API_KEY=op://<vault>/<item>/credential   # real reference in gitignored OPS-SECRETS.local.md
```

Start the dev server through `op run` so the value is injected in memory only — it never touches disk:

```bash
op run --env-file=.env.local -- npm run dev
```

> **Note:** `TURNSTILE_SECRET_KEY` is also required for local form testing — the submit routes throw
> if it is missing (hardened in #160). Store it in 1Password and reference it the same way in
> `.env.local`.
>
> **The staging/dev Worker was missing `TURNSTILE_SECRET_KEY` entirely — fixed 2026-09-17.**
> Every dev form (suggest a place, report closure, feedback, box check-ins) was silently failing
> Turnstile verification on dev.pueblofoodmap.com because no secret had ever been set on that
> Worker (production was never affected — it had its own key all along). Set via `wrangler secret
> put TURNSTILE_SECRET_KEY` from `op://Atlas/Turnstile - Pueblo Food Map/credential`. **Dev
> deliberately shares production's Turnstile SITE key** (the client-side `NEXT_PUBLIC_*` widget
> key — Turnstile site keys are not URL-restricted the way the Mapbox public token is, so one site
> key already covers both hostnames), which means the real SECRET key is required on dev too, not
> a test/always-pass key — there is no dev-only Turnstile keypair in use here.
>
> **`CHECKIN_RATE_LIMIT_SECRET` (2026-09-17, Blessing Boxes slice 2) is required for the
> check-in write path** — `POST /api/public/blessing-boxes/[id]/checkins` throws if it's missing.
> A DEDICATED secret, not `TURNSTILE_SECRET_KEY`: rotating Turnstile for an unrelated reason must
> not silently reset every open rate-limit bucket. Set the same way (`wrangler secret put
> CHECKIN_RATE_LIMIT_SECRET`, 1Password reference in `.env.local`) — see
> `src/lib/checkinRateLimit.ts`'s own header and the "Blessing boxes — promotion checklist" below
> for the production requirement.

### Rotation procedure

1. Resend dashboard → API Keys → create a new key with **sending** permission, domain `pueblofoodmap.com`.
2. Update the value in 1Password (reference in `OPS-SECRETS.local.md`).
3. Update the CF Worker runtime secret (`wrangler secret put RESEND_API_KEY` — requires a CF token
   with Workers edit permission) or via the CF dashboard under Variables and Secrets.
4. Verify: submit a test message through a live form, confirm delivery in the Resend dashboard.
5. Revoke the old key in the Resend dashboard.

### History

Originally the Worker ran on a full-access key kept in plaintext `.env.local`. Rotated to this
least-privilege arrangement on 2026-06-19 (#160, item 1.6); the full-access admin key was also
rotated at the same time.

# Observability (#163)

## Health endpoint — `GET /api/health`

- **Route:** `src/app/api/health/route.ts`
- **Response shape:** `{ status: "ok", version: string, timestamp: string }`
  - `status` — always the literal `"ok"` (HTTP 200)
  - `version` — imported from `package.json` at build time; aids deploy verification
  - `timestamp` — `new Date().toISOString()` at request time; confirms freshness
- **No external calls** — intentional. A health probe that calls Resend, Mapbox, or any
  third party fails alongside that dependency, turning a single-service outage into a
  cascading alert storm. This endpoint proves only that the Worker process is up.
- **Caching:** `export const dynamic = "force-dynamic"` + `Cache-Control: no-store` — uptime
  monitors must see live availability, not a CDN-cached copy.
- **Uptime monitoring (external pull-check, still pending):** Point monitors at
  `https://pueblofoodmap.com/api/health` **and** `https://pueblofoodmap.com` (the
  homepage). A free UptimeRobot account supports both.
  > **Pending manual step for Kyle:** Create the free UptimeRobot account and add the two
  > monitors. This is NOT automated — it is a one-time human task.

## Uptime dead-man's-switch (Healthchecks.io) — robot-deploy Phase 2 slice 2

Complementary to the pull-check above, not a replacement — this is a PUSH check: the
Worker itself proves it's alive by pinging out, rather than waiting for an external
monitor to poll in. `custom-worker.ts`'s `scheduled()` handler pings a Healthchecks.io
check (`pueblo-food-map-prod`, 5-min period, 3-min grace) every 5 minutes; HC.io alerts
Kyle's Telegram (via the same n8n webhook channel ToastHoster's own uptime check already
uses) if no ping arrives within period+grace — mirrors ToastHoster's
`src/index.ts`/`wrangler.toml` design exactly (see that repo's `scheduled()` WHY
comments for the full rationale: dead-man's-switch alerts on absence, not presence, of a
signal; a bare heartbeat is used instead of a self-fetch of the site's own domain, which
trips a Cloudflare loop-guard and reports a false "down").

- **`custom-worker.ts`** (repo root) wraps `.open-next/worker.js`'s generated fetch
  handler and adds `scheduled()` — `@opennextjs/cloudflare` only exports a fetch handler
  by default (https://opennext.js.org/cloudflare/howtos/custom-worker). `wrangler.jsonc`
  `main` points here instead of directly at the generated worker.
- **`HC_PING_URL` — a RUNTIME SECRET, never a committed var.** Set on the prod worker
  via `wrangler secret put HC_PING_URL` (done at the robot-deploy flip; value in
  1Password). ToastHoster commits its ping URL as a plain var, but that repo is
  private — THIS repo is public, and a committed ping URL lets anyone ping the
  success endpoint during a real outage and keep the dead-man's-switch green
  (PR #305 review). **Staging never gets the secret** — a missing value must never
  throw out of the cron handler (`custom-worker.ts` guards with `if
  (!env.HC_PING_URL) return;`).
- **`wrangler.jsonc` top-level `triggers.crons`** — `*/5 * * * *`, PROD ONLY.
  `env.staging.triggers.crons: []` is a REQUIRED explicit override, not tidiness —
  verified against this repo's own installed wrangler
  (`node_modules/wrangler/wrangler-dist/cli.js`: `triggers: inheritable(...)`) that
  `triggers` uniquely inherits into named environments, unlike `vars`/`assets`/
  `services`/`d1_databases` (all `notInheritable`). Left undeclared, `env.staging` would
  silently inherit the prod cron.
- **Deploy-failure belt-and-suspenders — `deploy-prod.yml` ONLY.** It ends with an
  `if: failure()` step that pings `${{ secrets.HC_PING_URL }}/fail` (Healthchecks.io's
  explicit-failure endpoint), so a broken prod deploy alerts immediately instead of
  waiting for the next missed heartbeat. `deploy-dev.yml` deliberately has NO such
  step: the only check is the prod dead-man's-switch, and a staging-only deploy
  failure must not page the prod alert channel — a red Actions run is the right
  signal for dev (PR #305 review).
- **Reading `ExecutionContext`/`ExportedHandler`/`ScheduledController` types** —
  `custom-worker.ts` imports these three by name from
  `@cloudflare/workers-types/experimental`, the same narrow-import pattern
  `cloudflare-env.d.ts` already uses for `D1Database` (see "Typing `ADMIN_DB`" above) —
  never a bare `wrangler types` full-runtime include, which would reintroduce the
  `Element`/DOM collision that section documents.

## Form-failure structured logging

All three form routes (`suggest`, `report`, `feedback`) call `logFormFailure` from
`src/lib/logger.ts` on Turnstile rejections and email send failures.

**Log shape (single-line JSON, emitted to Cloudflare Workers Logs):**

```json
{ "event": "form_submit_failure", "form": "suggest|report|feedback", "reason": "turnstile_failed|send_failed", "message": "Resend API error 502: …" }
```

- `message` is included on the `send_failed` path only (it carries the Resend error text + status code). The `turnstile_failed` path logs no `message`. The logger also supports an optional numeric `status` field, currently reserved for future use — no caller passes it yet.
- `reason: "turnstile_failed"` → `console.warn` (bot traffic — high volume, low signal).
- `reason: "send_failed"` → `console.error` (real outage — warrants alerting).
- **PII-free by design.** The logger accepts only typed structured fields — no IPs, emails,
  names, addresses, or message bodies ever appear in these log entries.
- **Filter/alert:** In CF Workers Logs, filter on `form_submit_failure` for a full failure
  stream, or narrow to `send_failed` for actionable outage alerts.

# Admin authentication — Better Auth is the sole gate (#237, post-cutover)

Full original design: `docs/admin/cloudflare-native-admin-spec.md` §3.1
(auth) and §8 (security) — written when Cloudflare Access was the gate;
read it for historical context on the multi-hostname problem, not as the
current auth model. This section is the operational summary of the
**current** state — set env vars, know the choke point, don't relitigate
the design here.

**Current state (`auth/betterauth-sole-gate`): admin is gated by Better
Auth ALONE — magic link + passkey, one-email allowlist (see "Admin
authentication — Better Auth engine/Phase 2/Phase 3" sections below for how
that engine was built up in phases). Cloudflare Access has been removed
from the admin path entirely — no Access application, no
`Cf-Access-Jwt-Assertion` header, no JWKS re-verification.** This state is
live on the `dev`/staging line as of this cutover; **production is cut over
separately** by a later, explicit change (removing the live CF Access
application from Cloudflare's dashboard is also a parent-owned
infrastructure step outside this repo's code, done in lockstep with that
prod cutover).

**Why in-app re-verification was needed under the old CF-Access model, and
why that's now moot:** admin lives at the apex `/admin` path — prod
`pueblofoodmap.com/admin`, staging `dev.pueblofoodmap.com/admin`. The admin
route group (`src/app/admin/**`, `src/app/api/admin/**`) ships inside the
**same Worker** as the public app (§3.4), and that Worker answers admin
routes on hostnames a PATH-scoped CF Access application never covered
anyway (the bare `pueblo-food-map.kyle-boyd.workers.dev/admin` fallback,
and every Workers version-preview URL — both of which still bind
**production** D1). Under Better Auth, this problem doesn't need a
per-hostname workaround: a session cookie is checked the same way
regardless of which hostname served the request, so there is no equivalent
"bypass hostname" gap to re-verify against.

**`getAdminDb()` (`src/lib/adminDb.ts`) is the single choke point.** It
calls `requireAdminSession()` (`src/lib/adminSession.ts`) before it will
hand back the `ADMIN_DB` D1 binding at all — there is no code path (page or
route handler, first load or client-side navigation) that can reach admin
data without a live, allowlisted Better Auth session. This exists because
Next.js App Router layouts run once per mount, not on every client-side
navigation between sibling routes — a guard placed only in a shared layout
would miss a client-nav to another `/admin/*` page. Any new admin code must
fetch D1 through `getAdminDb()`, never `getCloudflareContext()` directly.

**Two enforcement shapes, both required, both go through the same check:**
Server Component pages call Next 16's `forbidden()` (from `next/navigation`)
on `AccessDeniedError` reasons other than `"no_session"` (a missing session
instead `redirect()`s to `/admin/login` — see "Better Auth Phase 3" below
for the full redirect-vs-403 / 401-vs-403 split, unchanged by this
cutover), rendered by `src/app/forbidden.tsx` (a real HTTP 403 — requires
`experimental.authInterrupts: true` in `next.config.ts`, still an
experimental Next API). Route handlers return an explicit
`new Response("Forbidden", { status: 403 })` (or a `401` for `no_session`)
instead — there is no route-handler equivalent of `forbidden()`. Both paths
log through `src/lib/logger.ts`'s `logAdminAuthFailure()`
(`event: "admin_auth_failure"`, same PII-free single-line-JSON convention
as `form_submit_failure` above).

**`CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD` — retired, not read by any code
path anymore.** `requireAccessIdentity()` (the JWT verifier that read these)
was deleted from `src/lib/cfAccess.ts` in this cutover; the two secrets can
be removed wherever they were set (`wrangler secret put` / CF dashboard) —
nothing in this repo consults them. `src/lib/cfAccess.ts` now hosts only
the CSRF check (`requireAdminOrigin()`, unaffected by this cutover — see
below) and the shared `AccessDeniedError`/`AdminIdentity`/`HeaderSource`
types the whole admin-auth stack imports; it keeps its historical filename
despite no longer verifying Cloudflare Access.

**CSRF (`requireAdminOrigin()`) is untouched by this cutover** — it's an
independent defense against a browser's ambient session cookie being
ridden cross-site, applying to every non-GET `/api/admin/*` mutation
regardless of what proves the caller's identity. See its own header comment
in `src/lib/cfAccess.ts`.

**Typing `ADMIN_DB` — don't run bare `wrangler types`.** This app targets
the DOM (`lib: ["dom", ...]` — Mapbox, forms). Wrangler's default
`wrangler types` bundles the full Workers runtime type set, which includes
Cloudflare's HTMLRewriter `Element` type — it collides with lib.dom's
`Element` and silently corrupts unrelated DOM types project-wide (observed:
every `as HTMLSelectElement` cast in the form tests broke). Regenerate
`worker-configuration.d.ts` with `npx wrangler types --include-runtime=false`
after any `wrangler.jsonc` binding change; `cloudflare-env.d.ts` imports just
the specific runtime types this project's code actually references (e.g.
`D1Database`) from `@cloudflare/workers-types/experimental` instead.

## Admin venue list (#253)

`/admin` (src/app/admin/page.tsx) renders every `venues` row — draft,
published, archived — as a searchable/filterable table (`VenueListView`,
src/components/VenueListView.tsx). See ARCHITECTURE.md's "Admin —
read-only venue list" section for the full picture; this note just anchors
the operational facts. Data still flows through the same `getAdminDb()`
choke point as the rest of this section — `SELECT * FROM venues ORDER BY
name COLLATE NOCASE ASC`, never `getCloudflareContext()` directly. This
page itself still issues no mutation (it only SELECTs), so it skips
`requireAdminOrigin()` (that guard is for non-GET `/api/admin/*` routes
only) — but since #254 it links to `/admin/venues/new` via an "Add place"
button, the admin's first mutation path.

## Admin venue creation (#254)

`POST /api/admin/venues` (src/app/api/admin/venues/route.ts) is the admin's
first mutation route — everything before this inserted rows only via
`scripts/seed-admin-db.ts`, a one-time offline script, not a live endpoint.

**Auth — both checks, same order as `/api/admin/publish`:** `getAdminDb()`
first (Better Auth session identity via the same choke point as every other
admin route), then `requireAdminOrigin()` (CSRF — this route mutates, so
unlike the read-only list page above it needs it). Either failure logs
through `logAdminAuthFailure()`; a missing session returns `401`, every
other denial (including a bad Origin) returns `403` — see "Admin
authentication" above.

**Validation is authoritative here, not just a courtesy mirror of the
client.** `src/lib/adminVenueValidation.ts` re-checks every field
server-side (required fields, the 7-value category enum, lat/lng finite
and in real-world range, the `hours_weekly` JSON shape, the
accepts_snap/accepts_wic tri-state) and collects every violation in one
pass, returning a field-name-keyed error map on failure (`422`) — SQLite's
own CHECK constraints only cover `category`/`status`/`source_type`, so
lat/lng bounds and the hours shape have no DB-level backstop otherwise.

**Every create is one atomic `db.batch()`:** an INSERT into `venues` with
`id = manual-${crypto.randomUUID()}`, `status='draft'`,
`source_type='manual'`, `created_by`/`updated_by` set to the caller's
verified email, `published_at`/`published_by` left `NULL` — plus one
`audit_log` row (`action='create'`, `before_json` NULL, `after_json` the
new row). `created_at`/`updated_at` are deliberately omitted from the
INSERT's column list so D1's own `DEFAULT (strftime(...))` fills them,
matching `scripts/seed-admin-db.ts`'s established convention — for the same
reason, the audit row's `after_json` doesn't echo those two columns either
(this process never observes their DB-assigned value within the request).
A created row is a plain draft: nothing here touches the public map until
an explicit Publish (previous section).

**The form** (`/admin/venues/new`, src/app/admin/venues/new/page.tsx +
`AddVenueForm`, src/components/AddVenueForm.tsx) follows the same
Server-Component-gate / Client-Component-form split as the rest of the
admin: the page re-verifies the Better Auth session and renders the
signed-in email; the form itself holds no auth and is fully self-contained (owns its
own field state, client-side validation, and the POST call), so it's
renderable in isolation with sample `initialValues` for a design preview.
On a `201`, it calls `router.push("/admin")` + `router.refresh()` so the
new draft appears in the list immediately. The per-day hours editor is
deliberately basic (one comma-separated text field per day, not a
scheduler) — see the file header for why. Lat/lng are plain number
inputs, editable by hand and also auto-fillable via the geocode lookup
below — the manual path stays available as the precise source of truth and
the fallback when geocoding can't help.

**Address → map coordinates (geocoding).** `GET /api/admin/geocode?q=<address>`
(src/app/api/admin/geocode/route.ts) lets an admin type a street address and
auto-fill lat/lng instead of hand-typing coordinates. `AddVenueForm`'s "Find
location from address" button (a secondary, sage-bordered action — not the
primary sage-filled submit) calls this route with the current Address field
value:

- **One match** — fills lat/lng and shows a confirmation
  (`Found: <matchedAddress>`).
- **Multiple matches** — renders each as a real `<button>` in a labeled
  pick list (native buttons are inherently keyboard-reachable, so no custom
  ARIA widget is needed); picking one fills lat/lng.
- **Zero matches, a non-200 response, or a network failure** — shows an
  inline fallback message ("check the address or enter coordinates below")
  and never blocks the form; lat/lng stay manually editable throughout.

**Provider: the free US Census Bureau geocoder, not Mapbox.** Admin now
serves at the apex `/admin` path, which the app's Mapbox public token (see
"Mapbox Token Management" above) does cover — but Mapbox's secret token
must never reach a Worker or client bundle just to add one more scope. The
Census geocoder
(`geocoding.geo.census.gov`) needs no key, token, or URL allowlist to
provision or rotate, and covers US street addresses (Pueblo is US) — a
clean fit with nothing new to rotate or leak. It also sends no CORS
headers, so the lookup happens **server-side** in the route handler, not as
a direct browser fetch from `AddVenueForm`.

**Auth is the read-only shape, like `/api/admin/whoami`:** `getAdminDb()`
only — no `requireAdminOrigin()`. That CSRF guard exists for non-GET
`/api/admin/*` mutations (an ambient session cookie ridden cross-site);
this route mutates nothing, so there's nothing for CSRF to protect.

## Admin venue edit & archive (#255)

Slice 2 of the admin Phase 2 build (#254 above is slice 1). Two new
mutation routes, both nested under the venue's id:

- **`PATCH /api/admin/venues/[id]`** (src/app/api/admin/venues/[id]/route.ts)
  — full-field edit. Auth mirrors create: `getAdminDb()` then
  `requireAdminOrigin()`. Validation reuses `validateCreateVenuePayload()`
  (src/lib/adminVenueValidation.ts) **verbatim** — an edit submits the same
  full field set a create does (same form component, see below), so no
  separate edit/partial validator was written. On success, one atomic
  `db.batch()` runs an `UPDATE venues SET ...` and writes an `audit_log` row
  (`action='update'`, `before_json` = the row exactly as it was fetched,
  `after_json` = the row after the edit). A missing id returns `404`.
  **`status` is never in the UPDATE column list** — that's what guarantees
  editing a `published` venue leaves it `published`: not a runtime check,
  a structural one (there is no code path in that file that can touch
  `status` at all). `created_at`/`created_by`/`published_at`/`published_by`/
  `source_type` are likewise never touched by an edit.
- **`POST /api/admin/venues/[id]/archive`** (src/app/api/admin/venues/[id]/archive/route.ts)
  — "Remove from map." Same auth pair as edit. Sets `status='archived'` via
  an `UPDATE` (never `DELETE FROM venues` — the row and its full audit
  history are retained) and writes an `audit_log` row (`action='archive'`).
  An archived row simply stops being selected by the Publish flow's
  `fetchPublishSnapshot()` (`WHERE status IN ('draft','published')`,
  previous section) — so it silently drops off the public map on the next
  Publish without ever being destroyed. Idempotent: archiving an
  already-archived venue succeeds and writes another audit row rather than
  erroring. Kept as its own action-shaped route (mirroring
  `POST /api/admin/publish`'s own convention) rather than a `status` field
  on the PATCH body, precisely so the edit route above never has to reason
  about status transitions.

**One form, two modes.** `AddVenueForm` (src/components/AddVenueForm.tsx,
#254) was generalized rather than forked: an optional `venueId` prop is the
mode switch — absent means create (`POST /api/admin/venues`, "Add venue"
button); present means edit (`PATCH /api/admin/venues/<venueId>`, "Save
changes" button). Both modes share every field, all client-side validation,
and the same post-success `router.push("/admin")` + `router.refresh()`.

**The edit page** (`/admin/venues/[id]/edit`,
src/app/admin/venues/[id]/edit/page.tsx) follows the same
Server-Component-auth-gate pattern as `/admin/venues/new`, but also has a
row to `SELECT` — `getAdminDb()` serves both the auth check and the read.
An unknown id calls Next's `notFound()` (same convention as
`/venue/[id]/page.tsx`). `src/lib/adminVenueForm.ts`'s
`mapVenueRowToFormValues()` converts the stored `AdminVenueRow` (tri-state
integers, JSON `hours_weekly`, nullable text columns) into the
`Partial<AddVenueFormValues>` shape the form's `initialValues` prop already
accepted — the inverse of the form's own `buildHoursWeekly()`. This mapper
is a plain, framework-free function (not exported from the "use client"
form module) specifically so the Server Component page can call it
directly. Below the form, a "Danger zone" section renders
`ArchiveVenueButton` (src/components/ArchiveVenueButton.tsx) — a small,
separate Client Component (kept out of `AddVenueForm` for the same reason
the form wasn't forked: archive-only UI has no business inside the
shared create/edit form). It gates the archive call behind a native
`window.confirm()` dialog (AC2's "confirm dialog," no new dependency, no
existing modal component in this codebase to reuse) and, on success,
redirects to `/admin` the same way the form does. Its "Remove from map"
button reaches for the semantic `--color-danger` design token
(globals.css `@theme` / DESIGN.md) — defined since #237 checkpoint c but
unused until now — rather than a literal Tailwind red utility, since this
is the app's one genuinely destructive admin action.

**Row `Edit` link.** `VenueListView` (previous "read-only venue list"
section) gained one more table column: a per-row `Edit` link to
`/admin/venues/<id>/edit`, styled as a plain sage text link matching the
"Back to venue list" link already used on the create/edit pages. The list
itself still issues no mutation and stays read-only.

## Publish → static (#237)

Full design: `docs/admin/cloudflare-native-admin-spec.md` §3.3 (why the
public map stays static), §3.5 (the PUBLISH PATH sequence), §8 (the NB1
ordering note). This section is the operational summary.

**The flow, end to end:** an admin's D1 edits (drafts) never reach the
public map until an explicit "Publish" click. `POST /api/admin/publish`
(`src/app/api/admin/publish/route.ts`, logic in `src/lib/publishVenues.ts`)
then: (1) snapshots every `draft`+`published` row from D1, (2) validates
each row against the `Venue` shape and strips the admin-only columns
(`status`, `source_type`, `outside_county`, every audit column), (3)
serializes the result to `src/data/published-venues.ts`'s source text, (4)
commits that file via the GitHub Contents API to a fixed bot branch
(`publish-bot`, force-reset to `main`'s tip on every publish), opens or
reuses that branch's PR, and enables auto-merge via the GraphQL API (the
REST API has no "enable future auto-merge" endpoint — only the GraphQL
`enablePullRequestAutoMerge` mutation does), (5) **only once step 4
succeeds**, promotes the exact draft ids captured in step 1 to `published`,
**also re-stamps `published_at`/`published_by` on every already-published
row in the snapshot edited since its last publish** (#284 —
`fetchPublishSnapshot`'s `editedPublishedIds`), and writes one `audit_log`
row, atomically via a single `db.batch()`. Once the PR auto-merges, the
existing Workers Builds pipeline (unmodified) redeploys production like
any other push to `main`.

**The publish-bot PR itself skips part of the merge gate — a scoped, not
general, bypass (`ci.yml` / `weekly-security-audit.yml`, #336).** Step 4
above opens a real PR that has to pass the same required checks any other
PR does, but two of those checks carve out a `data_only` fast path so a
routine data publish isn't held to a UI-code review bar. `ci.yml`'s "Lint,
typecheck, build" job skips `lint`, the `design:lint`/`design:drift` token
gates, and the full `test:coverage` suite (replaced by a narrower
published-data/venue-shape subset — row shape, benefit-flag overlay wiring,
every venue's lat/lng inside the county bbox, hours parsing, JSON-LD).
`weekly-security-audit.yml`'s "Dependency CVE Audit" job skips the
blocking production `npm audit`. **`typecheck` and `build` are never
skipped, on any publish PR, no exception** — they're what proves the
regenerated file still type-checks against the `Venue` shape and still
statically generates every venue page. Semgrep (`SAST Code Analysis`) and
TruffleHog (`Secret Leak Scan`) also always run — neither job has a
`data_only` branch at all. The whole carve-out rests on one invariant:
`data_only` only ever goes `true` when the PR's full diff — computed from
the merge-base of base/head, not a raw two-dot diff (a two-dot diff can
falsely include base's own commits if base has moved, see the `detect`
step's own WHY comment in both workflow files) — touches EXACTLY
`src/data/published-venues.ts`. A second file changing alongside it, a
workflow file, or any code change on that branch fails the check and gets
the full pipeline. `src/__tests__/publishedVenues.test.ts` additionally
proves the file's BODY is actually a JSON data literal (not just correctly
named/pathed) by reading its raw source and `JSON.parse`-ing the slice
after the `export const publishedVenues: Venue[] = ` declaration — a file
that fails to parse as JSON there fails that test, which runs even in the
scoped-down publish-PR test subset.

**`published-venues.ts` is now the public map's data source, not the three
source arrays.** `src/data/venues.ts` imports `publishedVenues` from
`src/data/published-venues.ts` and applies the `benefit-flags.ts`
SNAP/WIC overlay on top — `pfpVenues`, `groceryOsmVenues`, and
`plentifulPantries` no longer feed the public build directly (they still
exist; `published-venues.ts` — and, before checkpoint b/c wiring, the seed
script — read them, but the public app doesn't). This is a build-time
static ESM import exactly like before checkpoint d's refactor: zero fetch,
zero D1, zero KV on the public request path. Nothing about `next build` or
`opennextjs-cloudflare build` talks to D1 — only the live Publish button
does, decoupled from any build, so a D1 outage can never silently ship an
empty map.

**NB1 — commit before promote, not the other way around.** The GitHub
commit/PR/auto-merge call is attempted BEFORE any D1 write. If it fails,
the route returns `502` and D1 is untouched: every draft stays a draft, and
nothing is falsely marked `published`. Only after that whole GitHub
sequence resolves does `promotePublishedDrafts()` run its one atomic
`db.batch()`. This ordering is load-bearing — `src/app/api/admin/publish/route.test.ts`
asserts D1's `batch()` is never called when any step of the GitHub call
fails, and IS called exactly once when it succeeds. Getting this backwards
(as the spec's own v1.0 draft did) can mark drafts "published" in D1 even
when the file never actually shipped.

**#284 fix — editing an already-published venue must also advance its
`published_at`.** Before this fix, `promotePublishedDrafts()` only ever
touched `draftIds` — a `published` row's `published_at` never moved past
its FIRST publish, so `summarizePublishChanges()` (`src/lib/adminVenues.ts`,
`updated_at > published_at`) kept counting an already-shipped edit as
"edited since publish" forever: `PublishPanel` never returned to "up to
date," and every further click shipped a byte-identical file. Fixed by
having `fetchPublishSnapshot()` also compute `editedPublishedIds` (rows
with `status='published'` whose `updated_at > published_at`) alongside
`draftIds`, and `promotePublishedDrafts()` re-stamps `published_at`/
`published_by` on BOTH sets, still inside the same post-commit
`db.batch()` — the NB1 ordering above is unchanged, this just widened
which rows step 6 touches.

**Concurrent publishes — "last snapshot wins" via a fixed bot branch.**
Every publish resets the SAME `publish-bot` branch to `main`'s current tip
and force-pushes its own snapshot, so two publishes landing close together
collapse into whichever GitHub call completes last — no separate D1
publish-lock needed. Opening a PR when one's already open for that branch
fails with GitHub's own `422` "already exists" response; that specific case
is treated as reuse (fetch the existing open PR and continue) rather than
a failure. This 422-string-match reuse detection is a deliberate
simplification (`ponytail:` comment at `PUBLISH_BOT_BRANCH`'s declaration
in `publishVenues.ts`) — a pre-check GET call is the upgrade path if it
ever proves fragile.

**`GITHUB_PUBLISH_TOKEN` — Kyle must provision this before the first live
publish.** A fine-grained PAT scoped to *only* `kr8vka0z/pueblo-food-map`,
with both **Contents: Read/Write** and **Pull requests: Read/Write**
permissions (Contents alone covers the commit but not opening/auto-merging
the PR). Set as a runtime secret the same way as `RESEND_API_KEY` /
`TURNSTILE_SECRET_KEY` above (`wrangler secret put GITHUB_PUBLISH_TOKEN` or
via the CF dashboard). Until it's set, the publish
route throws immediately (matches the existing missing-secret convention in
`src/app/feedback/submit/route.ts`) rather than silently no-op'ing.

**No admin email in the published file.** `published-venues.ts`'s
auto-generated header comment carries only a publish timestamp, never the
publishing admin's email — that file lands in this **public** repo, and the
admin identity is already recorded where an audit trail belongs: D1's
private `audit_log.actor_email` / `venues.published_by`.

## Admin publish button (#256)

Full design: this file's own "Publish → static" section above (the engine);
this section is the UI wired on top of it. `PublishPanel`
(src/components/PublishPanel.tsx, rendered by src/app/admin/page.tsx above
`VenueListView`) is the admin's only way to trigger a publish — a plain
change-summary, a native `window.confirm()` gate, then `POST
/api/admin/publish`.

**Change-summary counts, no new query.** `summarizePublishChanges()`
(src/lib/adminVenues.ts) computes `{ newDrafts, editedSincePublish,
archived }` from the exact same `SELECT *` rows `/admin` already loads for
`VenueListView` — `newDrafts` = every `draft` row; `editedSincePublish` =
`published` rows edited since their last publish; `archived` = `archived`
rows that were **previously published** (`published_at !== null`) and will
therefore actually disappear from the public map on the next publish. A
draft that gets archived without ever publishing does NOT count — it was
never live, so archiving it changes nothing the public map shows. All
three at zero disables the Publish button (a publish would just re-ship an
identical file) and shows "The public map is up to date" instead of the
counts.

**`GITHUB_PUBLISH_TOKEN` unset -> `503`, not a `500`.** Before #256, a
missing token made the route `throw`, surfacing to any caller as a bare
HTTP 500 with no readable body. `POST /api/admin/publish`
(src/app/api/admin/publish/route.ts) now returns
`{ ok: false, error: "publish_not_configured" }` at `503` instead, placed
at the exact same spot in the handler (after auth, before the snapshot) —
nothing about the snapshot/validate/serialize/commit/promote sequence or
the NB1 commit-before-D1-write ordering changed. `PublishPanel` maps this
to a calm "the publish key isn't set up yet" message rather than a scary
generic error — expected and normal until Kyle provisions the PAT (#260).

**Response -> message mapping** (`PublishPanel`'s `friendlyErrorMessage`):
`200` -> success banner with the published count and a link to the PR
(`target="_blank" rel="noopener noreferrer"`), plus a note that the public
map can take a minute to update; `503 publish_not_configured` -> the
not-set-up-yet message above; `502 github_commit_failed` -> "couldn't
reach GitHub, nothing was changed, try again"; `422` -> a validation
message (includes the server's error string); `403` -> "session expired,
reload and sign in again" (this route returns plain-text `Forbidden` on
403, not JSON — the mapping keys off `status`, not a parsed error field,
for this one case); anything else (including a network-level throw) -> a
generic friendly retry message. No branch ever claims success unless the
response is exactly `200` with `{ ok: true, ... }`.

**Button color: sage, not orange.** Publish is this screen's primary
action, but DESIGN.md reserves brand-orange ("ButtonPrimary") for the splash CTA alone (the
LocateButton pill that also used it was replaced by BottomNav's Near me),
with an explicit Don't against using it anywhere else. Sage is documented
as this design system's general primary-interactive color, and filled
sage-500/sage-600-hover is already the admin surface's established
"primary submit" treatment (`AddVenueForm`'s submit button, `/admin`'s "Add
place" link) — the strongest tier this system offers here. `PublishPanel`
reuses those exact classes rather than inventing a new, bolder button.

**On success, `router.refresh()`.** By the time the `200` response
returns, D1's `promotePublishedDrafts()` has already run (NB1 ordering) —
the drafts are already `published` rows in D1. Refreshing re-runs the
Server Component page so `summarizePublishChanges()` recomputes against
the new rows immediately, instead of leaving stale non-zero counts
visible right after a successful publish. The success message itself
persists underneath (same DOM position, component doesn't unmount).

**Confirm step: native `window.confirm()`**, same convention as
`ArchiveVenueButton` (#255) — no modal dependency in this codebase, and
none is needed for one confirmation. The message states the counts and
that this opens an auto-merging change request, e.g. `Publish 2 new places
and 1 edited place to the public map? 0 places will be removed. This opens
a change request that auto-merges.`

## Public submissions queue (#258)

`migrations/0002_public_submissions.sql` adds a `public_submissions` table
to the SAME `pueblo-food-map-admin` D1 database the admin surface above
uses. `POST /suggest/submit` and `POST /report/submit` (the two PUBLIC,
unauthenticated form routes — see "Resend Email Key Management" and
"Form-failure structured logging" above) each insert one pending row here,
placed AFTER their existing anti-abuse guards (Turnstile -> honeypot ->
rate-limit) and field validation already pass — so a row is only ever
written for an accepted submission, never for a bot or an invalid one.

**Not through `getAdminDb()`.** These are PUBLIC routes with no admin
identity to verify, so they reach the D1 binding directly —
`getCloudflareContext().env.ADMIN_DB` (imported from `@opennextjs/cloudflare`,
the same binding the admin surface uses) — never `getAdminDb()`
(src/lib/adminDb.ts), which gates on `requireAdminSession()` and exists
specifically for AUTHENTICATED `/admin/**` routes. Both routes write only
`public_submissions`, via the shared `insertPublicSubmission()` helper
(src/lib/publicSubmissions.ts, a fully parameterized `.bind(...)` INSERT) —
never `venues` or `audit_log`.

**Best-effort, never blocking.** The insert is wrapped in its own
try/catch, placed BEFORE the (unchanged) Resend email send. A D1 failure —
or a missing/misconfigured Cloudflare context, the same code path — logs
`db_write_failed` via `logFormFailure` (src/lib/logger.ts, see
"Form-failure structured logging" above) and execution continues to the
email exactly as it did before this feature existed: the email stays the
incumbent reliable channel; this table is the new best-effort durable
record on top of it. Both routes build one `sanitized` fields object
shared by the D1 payload and the email call, so the two can never observe
different values for the same submission.

**`kind` / `target_venue_id` mapping:** `/suggest/submit` writes
`kind='new_venue'`, `target_venue_id=NULL` (no existing venue to target).
`/report/submit` writes `kind='closure'`, `target_venue_id=<the reported
venue's id>` — the same `body.venueId` the route's own `validate()` already
confirmed exists in `src/data/venues.ts` before this point, so it is never
NULL for a closure report. `submitter_email` is nullable at the schema
level because `/report/submit`'s contact email is optional (unlike
`/suggest/submit`'s, which is required).

**No review UI yet.** This migration and the two write paths are the whole
of #258 — nothing in the app reads from `public_submissions`. The admin
review screen (approve -> create/edit the target venue, reject -> dismiss)
is a separate, later slice (#259).

**Applying the migration — NOT part of a Worker deploy.** Unlike
`published-venues.ts` (a build-time static import — "Publish -> static"
above), a D1 schema migration is a database operation, independent of
`wrangler deploy` / Workers Builds — there is no `migrations_dir`
configured in `wrangler.jsonc`, so a deploy never auto-applies a migration
file. Apply explicitly; the table must exist in production D1 BEFORE the
deployed routes' writes can succeed against it (a D1 failure is caught and
logged per above, so a deploy that lands ahead of the migration degrades
gracefully rather than breaking submissions — but the queue silently drops
every row until the migration is applied):

```bash
npx wrangler d1 migrations apply pueblo-food-map-admin --local   # local dev/testing only
npx wrangler d1 migrations apply pueblo-food-map-admin --remote  # production — run at merge time
```

## Public submissions review queue (#259)

`/admin/submissions` (src/app/admin/submissions/page.tsx +
src/components/SubmissionsReviewView.tsx) is the review screen the previous
section's "No review UI yet" note deferred: it lists every
`public_submissions` row `WHERE status = 'pending' ORDER BY created_at DESC`
(newest first) as a card — not a dense table like `VenueListView`, since a
submission carries far more per-row prose (address, hours, a closure's
description) than that table's columns fit — and lets an admin approve or
reject each. `payload` is parsed PER ROW (`parseSubmissionRow` in the page)
so one malformed row degrades to that single card's own "couldn't read
details" state (`SubmissionsReviewView`'s `parseError` branch) rather than
blanking the whole queue or 500ing the page. Same auth gate as every other
admin page: `getAdminDb()` -> `forbidden()` fail-closed on
`AccessDeniedError`; this page only `SELECT`s, so — like `/admin` itself —
it has no `requireAdminOrigin()` CSRF check of its own.

**Approve reuses the existing create/archive routes — it does not write a
parallel mutation path.** Both `POST /api/admin/venues` (#254) and
`POST /api/admin/venues/[id]/archive` (#255) gained an OPTIONAL
`submissionId` field. When present, each route appends a THIRD statement to
the SAME atomic `db.batch()` that already inserts the venue (create) or
flips its status (archive) — flipping the originating `public_submissions`
row to `status = 'approved'`. Riding the existing batch, rather than a
second separate write, is what guarantees the venue mutation and the
submission's approval commit together or not at all — there is no window
where a venue exists but its originating submission still shows as
pending, or vice versa. Neither route's pre-existing behavior changes when
`submissionId` is absent (the plain "Add place" and `ArchiveVenueButton`
call shapes both still work unmodified — the archive route's own body
parse is fully defensive so a bodyless call, ArchiveVenueButton's real
one, never throws trying to read a JSON body that isn't there).

**The approve UPDATE's WHERE clause matches on kind (and, for archive,
target) — not just id + pending — closing a cross-kind approval gap.** A
crafted `submissionId` naming an unrelated pending row used to be able to
mark that row approved while the venue create/archive acted on a
completely different venue. `POST /api/admin/venues`'s statement is now
`UPDATE public_submissions SET status = 'approved', reviewed_by = ?,
reviewed_at = ? WHERE id = ? AND status = 'pending' AND kind = 'new_venue'`
— a create can only ever legitimately approve a `new_venue` submission.
`POST /api/admin/venues/[id]/archive`'s statement is now `UPDATE
public_submissions SET status = 'approved', reviewed_by = ?, reviewed_at =
? WHERE id = ? AND status = 'pending' AND kind = 'closure' AND
target_venue_id = ?`, binding the archived venue's `id` (the `[id]` route
param) as `target_venue_id` — a closure approval must target the very
venue being archived. On a mismatch (wrong kind, or wrong target for an
archive), the venue is still created/archived — that's the admin's
explicit action — but the approve statement now affects 0 rows instead of
silently marking the wrong submission approved. The happy path (matching
kind/target) is unchanged.

- **new_venue approve is a two-step hand-off, not a single click.** The
  card's "Review & approve" is a plain navigation `Link` to
  `/admin/venues/new?submission=<id>` — NOT a fetch. That page
  (src/app/admin/venues/new/page.tsx) fetches the still-pending row itself
  (`WHERE id = ? AND kind = 'new_venue' AND status = 'pending'`), parses its
  `payload` (`NewVenuePayload`, src/lib/publicSubmissions.ts), maps it via
  `src/lib/adminVenueForm.ts`'s new `mapSubmissionPayloadToFormValues()` to
  `AddVenueForm`'s `initialValues`, and threads the id through as
  `AddVenueForm`'s new `submissionId` prop. Any failure mode — the param
  absent, non-numeric, unknown id, wrong kind, already reviewed, or
  malformed stored JSON — silently falls back to exactly the same blank
  form this page rendered before #259; a stale or mistyped link never 404s
  or 500s, it just can't pre-fill. The admin still reviews/edits every
  field and clicks "Add venue" themselves — approval only actually commits
  when that create POST fires (with `submissionId` in its body), same as
  any other venue create.
- **closure approve now opens the edit screen first, matching new_venue
  (#270).** The card's "Review & approve" is now a plain navigation `Link`
  to `/admin/venues/<target_venue_id>/edit?submission=<id>` — not a
  one-click archive — because a closure report doesn't always mean "this
  place is gone"; it might only mean the hours or contact info changed.
  That edit page (src/app/admin/venues/[id]/edit/page.tsx) accepts the same
  `?submission=<id>` convention `/admin/venues/new` established for
  new_venue, but matches it against the venue actually being edited
  (`target_venue_id === id`, not just id + kind + pending) before accepting
  it — a sanity check with no new_venue equivalent, since new_venue has no
  existing venue to cross-check against. When accepted, it renders a
  clay-accented context banner (the report's issue type + description,
  parsed defensively — a malformed payload degrades to generic copy without
  losing the submissionId, same `parseError`-tolerant philosophy as
  `SubmissionsReviewView`'s own closure card) and threads the id through as
  `ArchiveVenueButton`'s new optional `submissionId` prop
  (src/components/ArchiveVenueButton.tsx). Archiving from that screen POSTs
  the SAME existing archive route with `{ submissionId }` — no new mutation
  route, riding that route's existing atomic batch (previous bullet) — and
  redirects back to `/admin/submissions` instead of `/admin` afterward.
  Editing the venue WITHOUT clicking archive leaves the submission
  `pending` — the admin corrects the venue's details (e.g. new hours) and
  simply doesn't archive; the report itself is dismissed by rejecting it
  from the queue if it was wrong, exactly like any other submission.

**The `AND status = 'pending'` clause is a deliberate idempotency ceiling,
not an oversight.** `ponytail:` comments at both call sites name it: a
double-approve (two admins, or one admin double-clicking) affects 0 rows on
the submission side and is silently a no-op there, while the venue
create/archive itself still succeeds either way. Acceptable for this
single-admin internal tool; the upgrade path if it ever isn't is surfacing
`D1Result.meta.changes` back to the client so a stale/already-actioned card
can be flagged instead of quietly re-succeeding.

**`POST /api/admin/submissions/[id]/reject`** (new route, #259) is the one
genuinely new mutation this slice adds — a standalone `UPDATE
public_submissions SET status = 'rejected', review_reason = ?, reviewed_by
= ?, reviewed_at = ? WHERE id = ? AND status = 'pending'`, used by BOTH
card kinds (the reject flow is identical regardless of `kind`). Same auth
pair as every other mutation (`getAdminDb()` then `requireAdminOrigin()`).
`D1Result.meta.changes === 0` (unknown id, or already reviewed) returns
`404`, not a silent `200` — the one place this slice DOES surface that
D1 count to the caller, since a reject has no atomic-batch partner to fall
back on. **Rejecting writes no `audit_log` row** — unlike every venue
mutation on this admin surface, a reject touches no `venues` row at all, so
there is nothing for that table's audit trail to describe; the
`public_submissions` row's own `status`/`reviewed_by`/`reviewed_at`/
`review_reason` columns are its complete history.

**Category reconciliation in the payload->form mapper.** The public suggest
form's category comes from `VENUE_CATEGORIES` / `VenueCategoryKey`
(src/lib/suggestTypes.ts) — a separately-maintained 7-value map that
matches `VenueCategory` (src/types/venue.ts) key-for-key today, but the two
share no import, so nothing enforces that they stay in sync.
`mapSubmissionPayloadToFormValues()` checks the submitted category against
the real `VenueCategory` enum and falls back to `""` (the form's own
"select a category" empty state) on anything unrecognized, rather than
ever passing through a value that could fail `validateCreateVenuePayload()`
outright. The mapper's notes prefill is deliberately lossy-but-safe:
`hours`/`contact`/`submitterEmail` have no dedicated `AddVenueForm` fields
of their own (the submitter's free-text hours aren't the structured
per-day shape the form's hours grid edits), so they're folded into the
free-text notes field under a labeled separator instead of silently
dropped — the admin reviews and edits notes before saving regardless.

**Nav link from `/admin` to `/admin/submissions`.** `/admin`
(src/app/admin/page.tsx) links to the review queue via a "Review queue"
link in its header, styled as the same secondary sage-underline link this
admin shell already uses elsewhere (e.g. "Back to venue list") so "Add
place" stays the header's one primary action — shipped as a follow-up
after this slice, not folded into #259's original scope.

# Automated venue-refresh pipeline

Full design: `docs/admin/cloudflare-native-admin-spec.md` §6 (auto-refresh &
the change-approval queue). This section covers what actually shipped — a
scoped INGESTION slice, not the full doc — plus the operational facts (run
it, read its output, provision it in production). See ARCHITECTURE.md's own
"Automated venue-refresh pipeline" section for the mental-model summary and
why this exists (the venue data staleness gap).

**What it is, in one sentence:** a monthly (+ manual-dispatch) GitHub Action
(`.github/workflows/refresh-proposals.yml`) that re-scrapes Plentiful and
OSM, diffs the result against Cloudflare D1's current `venues` rows, runs an
outbound link-health pass over every stored `url`, and writes ONE
`change_proposals` row (`migrations/0001_init_admin_schema.sql`) per
detected difference. It writes to `venues` in exactly ONE bounded case — a
"date-only" freshness-only proposal auto-applies (Kyle, 2026-09-15: "If the
only proposed change is just the 'last checked date' that doesn't need a
manual approval" — see "Bulk-approve date-only updates" below and
scripts/refresh-ingest.ts's file header for the exact scope). Every other
proposal (a real field change, an add, a remove, any link_health finding)
only changes `venues` when a human approves it, via the `/admin/flags`
review queue (spec §6.6, #390 — see "Change-proposal review queue (#390)"
below).

**Running it locally** (safe — never touches production D1 unless you pass
`--remote`):

```bash
npx wrangler d1 migrations apply pueblo-food-map-admin --local   # once, if not already applied
npx tsx scripts/seed-admin-db.ts                                 # generates scripts/generated/seed-admin.sql
npx wrangler d1 execute pueblo-food-map-admin --local --file=scripts/generated/seed-admin.sql
npx tsx scripts/refresh-ingest.ts --db-mode local
```

**`--db-mode` has three values, and the mode picks the DATABASE, not just a
wrangler flag:**

| Mode | Database | Where |
|---|---|---|
| `local` | `pueblo-food-map-admin` | Miniflare's on-disk SQLite (`npm run preview`) |
| `staging` | `pueblo-food-map-admin-staging` | the real Cloudflare database `dev.pueblofoodmap.com` binds |
| `remote` | `pueblo-food-map-admin` | **PRODUCTION** |

`staging` exists so the `/admin/flags` review queue can be exercised against
genuine pipeline output — real scrapes, real diffs, real proposal rows — with
zero risk to production. It is a fixed mode rather than a free-form
`--database <name>` flag on purpose: the one thing this script must never do
by accident is write to production, and a name flag makes production the
default that a typo falls back to. A bad `--db-mode` value exits 1.

**Seeding staging with real venues first.** Staging's own `venues` rows are
fake seed data, so diffing a real scrape against them produces nonsense (and
trips the abnormal-drop guard). Copy production's venue rows across first —
this reads production and writes only staging:

```bash
npx wrangler d1 export pueblo-food-map-admin --remote --table venues --no-schema --output /tmp/prod-venues.sql -y
# prepend: DELETE FROM change_proposals; DELETE FROM audit_log; DELETE FROM venues;
npx wrangler d1 execute pueblo-food-map-admin-staging --remote --file /tmp/prod-venues.sql -y
npx tsx scripts/refresh-ingest.ts --db-mode staging
```

**The remote apply is CHUNKED, and that is load-bearing.** Both `staging` and
`remote` write via `wrangler d1 execute --command` (never `--file`, which
routes to D1's import API and takes the database offline — see
`d1ApplyFile`'s own header). A full run is ~45 KB of SQL, which exceeds
Windows' 32,767-character command-line limit and dies with `ENAMETOOLONG`
before wrangler starts; it survives on a Linux GitHub runner (ARG_MAX ~2 MB),
so this failed on every local Windows run while the production path worked.
`d1ApplyFile` now splits the run into ≤24,000-character batches. The tradeoff:
a run is a SEQUENCE of atomic batches, not one — a mid-sequence failure leaves
earlier chunks committed, and re-running that Action under the SAME run_id
(GitHub's "Re-run jobs") would hit the idempotency guard and exit 0 without
finishing. Recover with a fresh `workflow_dispatch` run, which gets a new
run_id.

Requires `python3` on PATH with `beautifulsoup4` installed
(`pip install beautifulsoup4==4.14.3` — pinned to match
`.github/workflows/refresh-proposals.yml`'s exact version, so local runs
and CI runs use the same parser) and network access (Plentiful, Overpass,
Nominatim, and every venue's stored `url` for the link-health pass — expect
this to take 1-2 minutes; the delays are deliberate politeness, not a bug).

**Plentiful changed its detail-page markup, 2026-09-02 — the hours parser
was rewritten, not just patched.** `scrape-plentiful.py`'s
`_infer_weekly_hours()` used to regex-match dated upcoming-service lines
("2026-05-14 10:00 AM - 12:00 PM") off the page's flat text. Measured that
day against all 35 live Pueblo detail pages: that form appears on ZERO of
them. Plentiful now renders a recurring schedule as real markup instead
(`<h2>Hours</h2>` + one or more `<p class="schedule-freq">`/
`<table class="hours-table">` pairs — "Every week" or "Once a month" + an
ordinal weekday like "4th Tuesday"). `_parse_hours_card()` (same file)
replaces the old function: "Every week" rows still populate `hours_weekly`
(the WeeklyHours Monday-Sunday grid `src/lib/hours.ts` consumes); any other
recurrence ("Once a month", an ordinal weekday) has no slot in that grid, so
it's rendered as an English sentence appended to `notes` instead (e.g.
"Open the 4th Tuesday of each month, 11:00 AM – 12:00 PM.") rather than
silently dropped — `src/lib/venueNotes.ts`'s boilerplate suppression was
checked and does NOT swallow this text (its exact-suffix match no longer
applies once real prose follows). Of the 35 pages measured: 27 have no
"Hours" card at all (a real fact, not a parse failure), 4 are weekly, 3 are
monthly/ordinal, 1 has an empty `<table class="hours-table">` with no rows.

**Offline self-check — run this after touching `_parse_hours_card()` or
anything it calls:**

```bash
python3 scripts/scrape-plentiful.py --self-check
```

No network, no D1 — asserts the parser against real HTML fixtures saved in
`scripts/fixtures/plentiful/*.html` (captured from live Pueblo detail pages
on 2026-09-02, one per shape found above). This is the one runnable proof
for this parser; the repo has no Python test runner configured and
deliberately doesn't get one for one script.

**A new FATAL guard closes the exact failure mode that motivated this
fix.** The old parser breaking silently returned `hours_weekly=None` for
every venue — indistinguishable from "these venues just have no listed
hours," so nobody noticed until a human spotted a new venue with no hours
at all. `main()` now tallies, across all fetched detail pages, how many
yielded ANY schedule data (weekly or the monthly/ordinal notes text). If at
least 5 detail pages were fetched and NOT ONE yielded a schedule, that's
almost certainly a markup change (not coincidence — even a fully-working
parser only finds a schedule on ~20% of real Pueblo venues, measured
2026-09-02), so the script prints `FATAL: 0/N fetched detail pages yielded
any parseable Hours data` and exits 1 BEFORE writing any output — same
"abort rather than silently ship a lie" shape as the directory-page `FATAL:
No pantry cards parsed` guard above, and same downstream effect as any
other scraper PROCESS failure (see "This does NOT apply to a scraper
PROCESS failure" below: `refresh-ingest.ts`'s `execFileSync` throws on the
non-zero exit, so neither Plentiful nor OSM writes anything that run). The
floor of 5 exists so a small run can't trip this on sample-size noise alone.

Inspect what it wrote:

```bash
npx wrangler d1 execute pueblo-food-map-admin --local --json --command "SELECT source, change_type, COUNT(*) FROM change_proposals GROUP BY source, change_type"
```

**Guardrails — all three fail loud (non-zero exit), never a silent no-op:**

- **Zero-record guard** (per source): an empty scrape aborts that source's
  writes entirely rather than proposing to remove every active row for it.
- **Abnormal-drop guard** (per source): `>=` max(5, ceil(20% of that
  source's active row count)) of its rows missing from a fresh scrape
  aborts that source's writes entirely. **Deliberately stricter than the
  design doc's §6.4**, which still writes flagged removal proposals for a
  human to see — this pipeline runs unattended with no review UI live yet,
  so a scraper glitch writing nothing is safer than writing half a run for
  nobody to catch.
- **Per-run cap** (whole run): more than 150 combined proposals aborts the
  entire run — nothing is written, for any source.

A source-level **guardrail** abort (the zero-record or abnormal-drop guard
above, both evaluated per source AFTER that source's scrape already
succeeded) still lets the OTHER source (and the link-health pass) write
their own good proposals — `main()` in `scripts/refresh-ingest.ts` loops
`diffSource()` once per source, and one source's `result.aborted` doesn't
stop that loop from reaching the next source.

**This does NOT apply to a scraper PROCESS failure** (fix: this file
previously conflated the two). `scrapePlentiful()`/`scrapeOsm()` run
sequentially, each shelling out to a Python script via `execFileSync`,
which throws on a non-zero exit — e.g. `scrape-plentiful.py`'s own `FATAL:
No pantry cards parsed` guard, or `fetch-osm-grocery.py`'s `remark`-key
guard (see "Automated venue-refresh pipeline" above). Either scraper
crashing throws BEFORE either source ever reaches `diffSource()`, so
`main()`'s top-level `.catch()` fires and NEITHER source writes anything —
there is no "other source" left running by that point to write good
proposals. Both failure modes leave the job's exit code non-zero (a
rejected promise or a source's `aborted: true` both fail `main()`), so the
Actions run goes red either way — but only the guardrail case actually
produces good proposals for the healthy source; a scraper crash produces
none at all.

**Credentials — its own least-privilege token, not the deploy token
(#403).** This job's `CLOUDFLARE_API_TOKEN` env var (what `wrangler d1
execute`, which `scripts/refresh-ingest.ts` shells out to, reads — there's
no Cloudflare Worker binding available from a plain GitHub Actions runner)
maps from its own `CLOUDFLARE_D1_TOKEN` repo secret — D1 Write only,
account-scoped — never from the `CLOUDFLARE_API_TOKEN` secret
`deploy-prod.yml` / `deploy-dev.yml` use for `wrangler deploy`. This job
parses adversarial third-party HTML, so a least-privilege credential
bounds what a compromised scrape can reach; it shares only
`CLOUDFLARE_ACCOUNT_ID` with the deploy workflows. This is a deliberate
departure from
`docs/admin/cloudflare-native-admin-spec.md` §6.3/§6.8's design, which
specs a NEW authenticated HTTP route (`POST /api/admin/refresh/ingest`)
behind a Cloudflare Access Service Token + a new `REFRESH_INGEST_TOKEN`
bearer secret — that design predates the Better Auth cutover (Cloudflare
Access no longer gates anything on this admin surface, see "Admin
authentication — Better Auth is the sole gate" above) and would have meant
standing up a whole new authenticated API surface for a job that can reach
the database directly. No UI, no new route — just one narrowly-scoped
credential (`CLOUDFLARE_D1_TOKEN`, #403) added later once the reused
deploy token was identified as too broad — smaller surface area than the
spec's design either way.

**Production checklist — NOT run as part of building this pipeline (no
production credentials held during implementation); a human runs these at
merge time:**

**⚠️ This workflow does NOTHING until it reaches `main` — merging to `dev`
alone looks like a broken job, not a delayed one.** Both `schedule` and
`workflow_dispatch` (`.github/workflows/refresh-proposals.yml`'s two
triggers) are GitHub Actions features that "only trigger a workflow run if
the workflow file exists on the default branch" (GitHub's own docs,
verbatim) — this repo's default branch is `main` (see "Hosting" above: push
to `dev` deploys staging via `deploy-dev.yml`; `main` is the one that's
default AND production). That's the same trap #375's Dependabot fix closed
for dependency PRs — the fix there was routing target branches correctly;
here the fix is sequencing: promote BEFORE trying to trigger a run, not
after.

```bash
# 1. Promote this branch to `main` first — steps 4/5 below are no-ops
#    (nothing to dispatch, nothing written) until this workflow file is on
#    the default branch. Normal dev -> main promotion PR, squash-merged
#    (this repo's branch protection allows squash only — "do NOT verify
#    with git rev-list" note under "Hosting" above explains why).

# 2. Apply the schema this pipeline depends on, if not already live —
#    change_proposals already exists in migrations/0001_init_admin_schema.sql
#    (shipped with the original #237 admin cutover), so this is very likely
#    already applied; confirm before assuming either way:
npx wrangler d1 migrations apply pueblo-food-map-admin --remote

# 3. Confirm CLOUDFLARE_D1_TOKEN (D1 Write only, #403) and the shared
#    CLOUDFLARE_ACCOUNT_ID are set as GitHub Actions repo secrets — done
#    as of #403; this job no longer reads the deploy workflows' token.

# 4. First real run — either wait for the 1st-of-month cron (now enabled,
#    #403), or trigger by hand from the Actions tab (workflow_dispatch) to
#    verify without waiting. Only works now that step 1 has landed:
gh workflow run "Venue Data Refresh"

# 5. Read what it proposed:
npx wrangler d1 execute pueblo-food-map-admin --remote --json --command "SELECT source, change_type, COUNT(*) FROM change_proposals WHERE status='pending' GROUP BY source, change_type"
```

**Historical note — what used to be deferred here is now built (#390).**
Prior revisions of this section said the `/admin/flags` review queue and the
stale-apply guard were deferred to a later slice; both now exist — see
"Change-proposal review queue (#390)" below for the full picture. This
ingestion job's own write-time mechanisms — auto-supersede (§6.10a: a
fresher run's proposal for the same `(source, target_venue_id)` retires an
earlier run's still-pending one) and rejection memory (§6.10b: a diff
identical to one a human already explicitly rejected is not re-proposed) —
are unchanged by that slice; it only reads and acts on what this job
already writes.

## Change-proposal review queue (#390)

`/admin/flags` (`src/app/admin/flags/page.tsx` + `src/components/ProposalsReviewView.tsx`)
is the review UI the previous section's ingestion pipeline was writing into
with nothing to read it — the same Server-Component-auth-gate /
Client-Component-interaction split as `/admin/submissions`, and closely
modeled on it (`getAdminDb()` → `handlePageAuthError()`, per-row defensive
`parseProposalRow()` so one malformed `proposed_diff` degrades to that
card's own error state rather than blanking the queue or 500ing the page,
same as `parseSubmissionRow` there). Lists every `status='pending'` row,
newest first, with source/change-type filter chips (only rendered once more
than one distinct value is actually present) so a 100+ row queue stays
workable. Each card shows the target venue's name (via one batched
`WHERE id IN (...)` lookup against `venues`, not a per-row query) and a
`<dl>` before/after of exactly the fields `fields_changed` names
(`last_verified` and `id` are filtered out of that list — a freshness stamp
and an already-shown identifier, not worth eyeballing).

**Two new mutation routes, `src/app/api/admin/proposals/[id]/approve` and
`.../reject`**, same auth pair as every other admin mutation
(`getAdminDb()` then `requireAdminOrigin()`). Approve applies the proposal
to `venues` via the SAME shape of atomic `db.batch()` (venue mutation +
`audit_log` INSERT) every other admin mutation route already uses — nothing
new to `venues.status` semantics or `audit_log.action`'s enum, per spec
§6.7. Reject is a standalone `UPDATE change_proposals SET status =
'rejected', ... WHERE id = ? AND status = 'pending'`, deliberately touching
only `status`/`reviewed_by`/`reviewed_at` — `source`, `target_venue_id`, and
`diff_hash` are left untouched so the next pipeline run's rejection-memory
lookup (§6.10b, `scripts/refresh/diffEngine.ts`) still finds this exact row.

**The three correctness requirements the issue named, all load-bearing:**

1. **Supersede race** — a later pipeline run's auto-supersede (§6.10a) can
   flip a pending row while an admin is mid-review. The approve route
   re-`SELECT`s the proposal fresh at request time (never trusts a
   page-load snapshot), returns `409 stale` if it's no longer `pending`,
   AND carries `AND status = 'pending'` on its own `change_proposals`
   UPDATE inside the batch, checking `D1Result.meta.changes === 0`
   afterward as a second belt against a true concurrent race in the
   few-hundred-ms window between the pre-check and the batch (documented as
   an accepted residual, same tolerance already given to
   `public_submissions`' own idempotency ceiling — see that section above).
   Reject uses the same `AND status = 'pending'` + `meta.changes === 0 →
   404` shape `POST /api/admin/submissions/[id]/reject` already established.
2. **Stale-apply** (§6.10c) — `src/lib/adminProposals.ts`'s
   `checkStaleApply()`, a pure function re-verifying a proposal's `before`
   snapshot against a FRESH read of the current `venues` row, scoped to
   exactly what that proposal type asserts (not a whole-row check — see
   that file's own header for the "#235 reconciliation" case a coarse check
   would misfire on: two independent proposals from different sources can
   legitimately target the same venue at once). Reuses
   `diffEngine.ts`'s own exported `currentFieldValue()`/`valuesEqual()`
   rather than re-deriving field equality, so the two comparisons can never
   silently drift apart (e.g. `hours_weekly`'s day-key-sorted JSON
   normalization). A stale proposal is marked `superseded`, not applied,
   and the admin sees why.
3. **Rejection memory** (§6.10b) — proved structurally: the reject route's
   UPDATE statement's WHERE/SET clauses never reference `source`,
   `target_venue_id`, or `diff_hash`, so diffEngine's own
   `SELECT source, target_venue_id, diff_hash FROM change_proposals WHERE
   status = 'rejected'` lookup is guaranteed to find whatever this route
   just rejected on the next run. Regression-guarded in
   `src/app/api/admin/proposals/[id]/reject/route.test.ts`.

**`link_health` proposals are never blindly applied.** A dead-URL finding
isn't a field edit safe to auto-apply — the approve route rejects a
`link_health` source outright (`400`), and `ProposalsReviewView`'s card
shows no Approve button for one at all, only a real navigation `Link` to
`/admin/venues/<id>/edit?proposal=<id>`. That page (see "Admin venue edit &
archive" above) resolves the proposal via a new
`resolveLinkHealthProposalContext()` — same match-against-THIS-venue
defensive shape as `resolveClosureReportContext()` — shows the dead URL +
last-seen HTTP status in a banner, and threads the proposal id through as
`AddVenueForm`'s new `proposalId` prop (edit-mode-only, mirror image of
`submissionId` above, which is create-mode-only). Saving that edit approves
the proposal in the SAME atomic `db.batch()` as the venue update
(`PATCH /api/admin/venues/[id]`'s new optional `proposalId` body field) —
deliberately the loose "route to edit, let the admin fix whatever they see
fit" convenience path, not the strict stale-apply-guarded one the flags
queue's own approve route uses for `add`/`update`/`remove`.

**Removal proposals are never single-click.** A `change_type='remove'`
card's action button reaches `ArchiveVenueButton`'s own established
`window.confirm()` convention (see "Admin venue edit & archive" above) and,
like every other admin removal, only ever sets `status='archived'` — never
`DELETE`.

**Now that this UI exists, `.github/workflows/refresh-proposals.yml`'s
`schedule` trigger has been re-enabled (#403, 2026-09-07)** — it had been
deliberately disabled (commit `f9226c7`) specifically because proposals
had nowhere to be reviewed; that condition, plus a least-privilege
credential replacing the reused deploy token, are both now met. See
"Automated venue-refresh pipeline" above, "Credentials" for the token
swap.

## Flags queue usability fixes — clickable links + resulting-card preview

Two fixes from Kyle's first real review of 104 live proposals on staging.
Both live in `ProposalsReviewView.tsx`; see that file's own header for the
full WHY.

**Website/phone values are real links, not plain text.** Every field-value
render in this queue (`AddDetails`' Website/Phone rows, `FieldDiff`'s
"after" diff value, `LinkHealthDetails`' dead-link banner) routes through
one shared `renderFieldValue()` — a `url` field becomes an `http(s)`-only
link (reuses `safeUrl`, src/lib/safeUrl.ts — the same untrusted-OSM-data
guard BottomSheet/DesktopVenueWindow already apply to `venue.url`), a
`phone` field becomes a `tel:` link. Only the "after" side of a `FieldDiff`
row links — the struck-through "before" value is being replaced, not worth
clicking through to.

**A right-hand preview shows the RESULTING public venue card** — Kyle:
"it would be nice if there was a full preview on the right hand side that
showed what the new venue card was going to look like. easier to catch
errors that way." Renders the real `VenueCard` component
(src/components/VenueCard.tsx, the same one `ListView.tsx` uses for the
public `/list` row) fed `buildPreviewVenue()`'s merge of the proposal's
`after` diff over the current venue row — never a hand-rolled lookalike.
`add`/`update` preview the resulting card; `remove` previews TODAY's card
under a dimmed, `inert` treatment (native `inert`, not `aria-hidden` — the
card's root is a real focusable `<button>`, and `aria-hidden` on a
focusable descendant is the exact WCAG anti-pattern `inert` exists to
avoid) plus a real, announced "will no longer appear" sentence — a plain
undimmed card here would misrepresent the outcome. `link_health` renders no
preview panel at all: that source has no proposed field change (a dead-link
finding isn't an edit), and the "Review & fix link" button already routes
to the one place — the venue edit screen — that shows the real thing.

**`page.tsx`'s `venueLookup` widened again** (id/name/status only ->
`+category/address/phone/url/last_verified/status` for the first review
pass -> `+lat/lng/hours_weekly/accepts_snap/accepts_wic/source` for this
one) — the preview needs everything `VenueCard` actually renders, which the
narrower "recognise the place" shape from the first pass didn't carry.
Still deliberately not every `AdminVenueRow` column (no notes/operator/
email/audit fields — `VenueCard` doesn't render any of those).

## Bulk-approve date-only updates (issue: 89 of 107 real proposals)

The first real venue-refresh pipeline run wrote 107 pending proposals; 89
were pure freshness confirmations — `change_type: 'update'`,
`fields_changed` exactly `["last_verified"]` — one Approve click each was
never going to happen monthly. `ProposalsReviewView` now shows one
`Approve all N date-only updates` button in the queue header (near "N of M
pending proposals") whenever the currently FILTERED list contains at least
one qualifying proposal; a native `window.confirm()` states the count and
that real changes are excluded, then POSTs the exact visible ids to
`POST /api/admin/proposals/approve-date-only`.

**One predicate, shared by client and server** —
`isDateOnlyUpdateProposal()` (`src/lib/adminProposals.ts`): `change_type`
must be `'update'`, `source` must be `osm` or `plentiful` (never
`link_health` — that source is always shaped as an `update` by
`diffEngine.ts` but is source-gated out here too, same carve-out as the
single-approve route; never `gtfs`, which the pipeline doesn't emit this
way today but is excluded by an explicit allowlist rather than "everything
but link_health" so a future new source doesn't silently qualify), and
`fields_changed` must be EXACTLY `["last_verified"]` — a proposal that
moves `last_verified` alongside a real field never qualifies. The client
uses this to compute the button's count; the bulk route re-runs the exact
same check against a FRESH D1 read of each requested id, so the two can
never quietly diverge on what "date-only" means.

**The single-proposal apply engine was extracted, not re-copied.**
`applyApprovedProposal()` (`src/lib/adminProposals.ts`) is the entire
add/update/remove branching + stale-apply guard (§6.10c) + atomic
`db.batch()` body that used to live inline in
`POST /api/admin/proposals/[id]/approve`; that route now just does its own
id-parsing and supersede-race pre-check, then delegates. The bulk route
calls the same function once per validated id — same audit-trail identity,
same 409-on-double-approve belt, same everything — so a date-only proposal
approved in bulk is indistinguishable in `audit_log` from one approved by
hand.

**Never partial-fails.** Every id in the request is independent: an id
that's gone stale, not date-only, not found, or already reviewed is
recorded in the response's `skipped: {id, reason}[]` array and every other
valid id still applies. Response shape: `{ approved: number, skipped:
{id, reason}[] }`. Capped at 200 ids per request (400 above that, or on a
malformed body) — comfortably above any real queue's date-only subset
while still bounding one request's worth of sequential `db.batch()` calls.

**D1's 100-bound-parameter ceiling (#397) is reused, not re-hit.** The
bulk route's own `SELECT * FROM change_proposals WHERE id IN (...)`
pre-fetch chunks at 100 ids via `src/lib/d1.ts`'s `chunkArray()` /
`D1_MAX_BOUND_PARAMS` — extracted from this same page's `loadVenueLookup()`
(which now imports from there too, no behavior change) so the constant and
the chunking loop live in exactly one place for both call sites.

**Client:** `ProposalsReviewView`'s own local `bulkState` (not a prop)
holds the "Approved N. Skipped K." result line (`aria-live="polite"`) so it
survives the `router.refresh()` triggered on success — the same
Server-Component re-fetch the single-approve flow already relies on to
drop acted-on cards, which re-renders this client component's props
without unmounting it.

**Superseded for future runs, still needed for leftovers (Kyle, 2026-09-15).**
`scripts/refresh-ingest.ts` now auto-applies a date-only proposal at
INGESTION time (same `isDateOnlyUpdateProposal()` predicate, see
scripts/refresh/proposalSql.ts) — so a run after this change writes zero
date-only rows into `/admin/flags` for this button to act on. The button
itself is NOT removed: any date-only row a PRIOR run already left pending
still needs it (or a single Approve click) to clear, and it's the correct
fallback if the ingestion-time auto-apply is ever disabled.

# Discoverability / SEO (#164)

Site-level SEO ships in two PRs. **This section covers PR1 (items 6.1 + 6.2).**

- **OG + Twitter metadata** — lives in `src/app/layout.tsx` (`metadata` export). Uses the
  App Router `Metadata` type. `metadataBase` is set so any future relative paths resolve to
  absolute URLs for crawlers and social platforms.
- **Canonical strategy** — the root layout deliberately sets **no** canonical. A root-level
  `alternates.canonical` propagates to every child route via Next.js metadata inheritance,
  causing `/suggest`, `/feedback`, and `/privacy` to all report `"/"` as their canonical
  (de-index risk). Instead, each utility page sets its own canonical via `alternates.canonical`
  in its own `export const metadata`.
- **Preview image** — `public/og-image.png` (1200 × 630). `OG_IMAGE.url` in `src/lib/site.ts`
  is absolute (`${SITE_URL}/og-image.png`). Do not move or rename the file without updating
  the constant.
- **Sitemap** — `src/app/sitemap.ts` (static public routes only: `/`, `/suggest`, `/feedback`,
  `/privacy`). Generates `/sitemap.xml` at runtime via the App Router `MetadataRoute.Sitemap`
  convention. The static routes above still carry no `lastModified` field — there's no per-page
  last-modified source for them, and a non-deterministic value (`new Date()` on every request)
  would prevent stable caching and could confuse crawlers into treating every page as perpetually
  updated. (Per-venue routes DO carry a real `lastModified` — see PR2 below.)
- **Robots** — `src/app/robots.ts` (allows `/`, disallows `/api/` and `/admin/`, points to
  sitemap). Generates `/robots.txt` at runtime. No `host` field — Google ignores it. A second
  rule explicitly blocks named bulk-training scrapers (`CCBot`, `Bytespider`, `Amazonbot`,
  `Applebot-Extended`, `meta-externalagent`) while leaving citation/answer-engine crawlers
  (GPTBot, ClaudeBot, Google-Extended, PerplexityBot, Bingbot, Googlebot) uncovered by any
  disallow-all rule, so they fall through to the permissive `"*"` rule — issue #164 quick win
  (S7b). This re-establishes in version-controlled code a bot policy that previously lived only
  as a Cloudflare dashboard bot-management rule.
- **Shared constants** — canonical origin, site name, and OG image metadata all live in
  `src/lib/site.ts` (single source of truth; reused by metadata, sitemap, robots).
- **Subpage metadata helper** — `/suggest`, `/feedback`, and `/privacy` use `buildPageMetadata`
  from `src/lib/site.ts` instead of a raw `metadata` literal. WHY: Next.js shallow-merges
  metadata — a child `openGraph` object REPLACES the parent's entirely (not deep-merged; see
  Next docs "Merging"). A subpage setting only `{title, url}` drops the inherited OG image and
  other brand fields. `buildPageMetadata` emits the full `openGraph`/`twitter` block (brand
  image, siteName, type, locale) so link previews on subpages retain the brand image.
- **Known bilingual limitation** — the EN/ES language toggle is cookie-based: both locales
  serve the same URL. Static utility pages (`/about`, `/venues`, `/suggest`, `/feedback`, `/privacy`)
  keep English `<title>` and `<meta>` tags (decision recorded in #287) so they remain 100%
  statically cacheable on Cloudflare without per-request `cookies()` reads forcing dynamic execution.
  Crawlers index the English metadata. Proper bilingual SEO (separate `/es/` URL tree or `hreflang`
  link tags) requires separate routes and is a deferred follow-up beyond #164.
- **Done: explicit homepage canonical** — `src/app/page.tsx` is now a Server Component and sets
  `export const metadata = buildPageMetadata({ path: "/", ... })` directly, giving `/` the same
  explicit self-canonical every other page already had (previously implicit/inherited).

**PR2 (items 6.3 + 6.4) — shipped.**

- **Per-venue pages** — `src/app/venue/[id]/page.tsx` (statically generated, `dynamicParams = false`
  — since PR #351, 2026-08-24; the route previously read `cookies()` for locale, which forced
  dynamic rendering, but that call is gone and the route is fully static now).
  Each page carries a venue-specific `<title>` + `<meta description>` + OpenGraph/Twitter metadata
  via `buildPageMetadata`, and a `<script type="application/ld+json">` block with a
  `LocalBusiness` / `GroceryStore` / `FoodEstablishment` / `Place` `@type` mapped from the
  venue category. `generateStaticParams` restricts the route to known venue ids; unknown ids 404.
  **A static + `dynamicParams = false` route on this stack depends on `open-next.config.ts`'s
  incremental cache actually serving the prerendered HTML** — the default "dummy" cache never
  populates, so every prerendered dynamic path 404s (`NoFallbackError` on a cache miss). This
  caused a 10-day production outage (2026-08-24 to 2026-09-02, 218/230 public URLs down) before
  `open-next.config.ts` was set to the `staticAssetsIncrementalCache` override. Do not revert that
  override, and do not reintroduce `cookies()`/other dynamic APIs into this route without
  re-verifying the pairing still holds.
- **Legacy `?venue=` links — handled CLIENT-SIDE (no server redirect).** New shares use the
  canonical `/venue/<id>`. Old `/?venue=<id>` links still work: the homepage reads the `venue`
  query param client-side and opens that pin. There is intentionally **no** server-side redirect
  — see the OpenNext routing traps below. A proper OpenNext-compatible legacy redirect (so old
  links also get the rich preview for crawlers) is a deferred follow-up.
  - **⚠️ OpenNext/Cloudflare routing traps on `/` — BOTH server-side approaches we tried failed:**
    1. **`proxy.ts` (Next 16's renamed middleware) fails the BUILD.** It defaults to the Node.js
       runtime; the `runtime` option throws in proxy files, so Edge is not an escape hatch; and
       OpenNext/CF cannot run Node-runtime middleware (`opennextjs-cloudflare build` errors out).
    2. **`next.config` `redirects()` with a `has` query rule on `source: "/"` fails at RUNTIME.**
       It builds clean AND passes the CF "Workers Builds" check, but **500'd every homepage
       request on the live worker** (2026-06-20 prod incident; removed in hotfix). Other routes
       were unaffected.
  - **LESSON: a green build / CF-check does NOT prove the page works on this stack. After every
    deploy, curl the LIVE homepage** (`https://pueblo-food-map.kyle-boyd.workers.dev/` bypasses
    CDN cache) for HTTP 200 — not just the build. Avoid server-side routing rules scoped to `/`.
- **Fragment for in-app deep links** — the "View on the map" CTA on each venue page uses
  `/#venue=<id>` (a URL fragment, not a query param). The homepage `useEffect` reads both
  `window.location.search` (`?venue=`) and `window.location.hash` (`#venue=`) so both forms open
  the right pin.
- **`venueShareUrl` canonical form** — updated in `src/lib/share.ts` from `/?venue=<id>` to
  `/venue/<id>`. Legacy `/?venue=` links still resolve via the homepage's client-side query read.
- **Structured data helpers** — `src/lib/venueSchema.ts` (pure, no Next server deps): exports
  `getVenueById`, `venuePath`, `buildVenueJsonLd`, `buildVenueListJsonLd`, `buildWebSiteJsonLd`,
  and `serializeJsonLd`.
- **`serializeJsonLd`** — all three JSON-LD blocks (venue, WebSite, ItemList) are injected via
  this helper, which escapes `<`, `>`, and `&` to `\uXXXX` Unicode sequences. WHY: `JSON.stringify`
  does not escape `<`, so a `</script>` in any string field (e.g. a future user-suggested venue
  name fed through #133) would terminate the `<script>` element early — a markup-injection/XSS
  vector. The escaping keeps the JSON valid (parsers decode back to the original characters) while
  making break-out impossible.
- **WebSite JSON-LD** — rendered server-side in `src/app/layout.tsx` body (sitewide; 1 tag on
  every page). Shipped as an `@graph` of `WebSite` + `Organization` (linked by
  `publisher`/`@id`), not a flat `WebSite` object — gives the site itself a
  linkable schema.org entity, with a `sameAs` back to its own canonical
  presences (pueblofoodproject.org, pueblofoodmap.com).
- **Venue opening hours in JSON-LD** — `buildVenueJsonLd` (`src/lib/venueSchema.ts`) adds an
  `openingHoursSpecification` array (one entry per parseable hours slot, omitted entirely when
  a venue has no `hours_weekly` or no slot parses) plus `address.addressCountry: "US"`.
  `src/lib/hours.ts`'s `slotToIsoTimes` converts a slot string to ISO 8601 `"HH:MM"` open/close
  times, reusing the same private `parseSlot` minutes-since-midnight logic `computeOpenStatus`/
  `formatSlot` already rely on — one parser, three consumers.
- **ItemList JSON-LD** — rendered server-side in `src/app/page.tsx` (homepage `/` only). It's now
  a synchronous Server Component that emits the JSON-LD `<script>` directly in the server
  response body (with `HomePageClient` holding the interactive splash/map body as a child), so
  even crawlers that don't execute JS see the full venue index — not just crawlers that read
  client-rendered markup.
  - **Done: server-render the homepage ItemList JSON-LD** — `src/app/page.tsx` splits the
    homepage into a synchronous Server Component wrapper (JSON-LD script + a sr-only `<h1>`,
    both unconditional) and `src/app/HomePageClient.tsx` (the former homepage's splash-gate/map
    logic, now a client child). Pairs with the explicit-homepage-canonical fix above (PR1) — both
    land in the same server wrapper.
- **Sitemap** — `src/app/sitemap.ts` now includes all per-venue URLs (`changeFrequency:
  "monthly"`, `priority: 0.7`). The static-routes-only TODO comment was removed. Each venue
  entry also carries `lastModified: v.last_verified` — issue #164 quick win (S6) — a real,
  deterministic per-venue signal (unlike the static routes above, which have no equivalent
  per-page source and so still omit the field).
- **`sitemap()` is `async` as of Blessing Boxes slice 1** — it also appends every live
  `/box/<id>` route (`changeFrequency: "daily"`, `priority: 0.6`), read straight off D1 via
  `loadLiveBoxes()` (src/lib/blessingBoxes.ts) since boxes skip the published-venues.ts
  build-time snapshot entirely (see "Blessing Boxes — live box layer" below). The D1 read is
  wrapped in its own try/catch (never the whole function) so `next build` still succeeds with
  zero box entries — this file still never touches D1 at build time, only at request time.
- **Venue description uniqueness** — `generateMetadata` in `src/app/venue/[id]/page.tsx` builds
  each venue's `<meta description>` from that venue's own name + address (not just its category),
  e.g. `"${name} — ${category} in Pueblo, CO. ${address}."` — issue #164 quick win (S4). Before
  this, every venue sharing a category got a byte-identical description string (a duplicate-
  content SEO problem); see `src/app/venue/[id]/page.test.tsx` for the regression guard.
- **`/venues` directory page** — `src/app/venues/page.tsx`, a server-rendered, crawlable index of
  every venue grouped by category (`groupVenuesByCategory`, category order matches
  `categoryLabels`, items name-sorted within each group), each row linking to its own
  `/venue/<id>` page. Registered in `src/app/sitemap.ts` at priority 0.7. Exists for the same
  reason the ItemList JSON-LD above does — the homepage map is JS-only — but as readable HTML a
  crawler or answer engine can scan directly, not just structured data.
- **`/about` FAQ + FAQPage JSON-LD** — `src/app/about/page.tsx` renders a 6-question FAQ and
  injects a schema.org `FAQPage` `<script type="application/ld+json">` (built by `buildFaqJsonLd`
  in `src/lib/venueSchema.ts`, serialized via `serializeJsonLd`). FAQ content is localized — the
  JSON-LD is built from the same request-locale `about.faq.*` strings the page renders, so
  structured data and visible text never diverge. The page also carries a live venue-count line
  (`venues.length`) and a cited Feeding America (Map the Meal Gap, 2023) food-insecurity stat —
  AEO item S8.

---

# Admin authentication — Better Auth engine (#314, Phase 1)

Self-hosted [Better Auth](https://better-auth.com) replaces Cloudflare
Access on the admin surface, rolled out in phases. **Phase 1 (this
section) provisions the auth ENGINE only** — no login UI, no route
gating, no cutover. **Cloudflare Access still gates `/admin/**` and
`/api/admin/**` completely unmodified** (see "Admin authentication
(Cloudflare Access)" above) through this phase and every phase after it,
until an explicit later cutover. Nothing about how the admin is actually
protected has changed yet.

**Why replace Access at all:** out of scope for this section — see issue
#314 for the rationale. This section covers only what Phase 1 built.

## What Phase 1 provisions

- **`src/lib/auth-options.ts`** — `buildAuthOptions(database)`, the shared
  config (secret, `baseURL`, plugins) both the runtime and the CLI build on.
  Returned via `satisfies BetterAuthOptions`, not a `: BetterAuthOptions`
  annotation — the explicit annotation would widen the return type and
  erase the literal `plugins` tuple `betterAuth()`'s generic inference needs
  to type `auth.api.signInMagicLink` etc. (see the file's own WHY comment).
- **`src/lib/auth.ts`** — `getAuth()`, a lazy async accessor mirroring
  `adminDb.ts`'s `getAdminDb()` pattern: constructs the Better Auth instance
  against the live `ADMIN_DB` D1 binding via `getCloudflareContext()`
  (unavailable at module-import time on Workers), cached per-isolate.
- **`src/app/api/auth/[...all]/route.ts`** — mounts Better Auth's own
  handler via `toNextJsHandler()`. Boots the engine; nothing in the app
  calls it yet, and it is NOT gated by `requireAccessIdentity()` (it IS the
  auth system's own endpoints — sign-in/session/passkey ceremonies an
  unauthenticated visitor must be able to reach — a separate concern from
  the admin data `getAdminDb()` protects).
- **`migrations/0003_better_auth_schema.sql`** — `user`, `session`,
  `account`, `verification`, `passkey` tables, in the SAME
  `pueblo-food-map-admin` D1 database every other admin table lives in.
  **No Workers KV anywhere** — all auth state (sessions, magic-link/
  verification tokens, passkey challenges) stays in D1, by design (one
  store, one backup surface, no second binding).
- **`scripts/auth-cli.config.ts`** — CLI-only config for
  `@better-auth/cli generate`/`migrate`, never imported by runtime code.

## Database adapter — core `better-auth`, no third-party package

Core `better-auth` (via its bundled `@better-auth/kysely-adapter`
dependency) has native, first-party D1 support: it structurally
auto-detects a raw `D1Database` and dispatches to its own
`D1SqliteDialect`, which uses D1's `batch()` API — never raw
`BEGIN`/`COMMIT` (D1 disallows interactive transactions). Verified against
better-auth's own installed source, not assumed from docs. The third-party
`better-auth-cloudflare` package is NOT a dependency of this repo — it
isn't needed.

## `@better-auth/cli` schema generation — a real gotcha

**Not a standing devDependency as of 2026-08-28** — its bundled
`better-auth@1.4.21` copy carried 14 open Dependabot alerts (including the
repo's only CRITICAL) with no newer `@better-auth/cli` release available to
fix them. Removed from `package.json`; run it on demand via `npx
@better-auth/cli@latest generate ...` (see command below) instead of a
pinned install — same capability, no standing vulnerable copy on disk.

`@better-auth/cli@1.4.21` bundles its OWN pinned copy of
`better-auth@1.4.21` in its own `node_modules` — a version released
BEFORE D1 support existed. Its internal `getAdapter()`/`getMigrations()`
resolve `better-auth/db` against that nested old copy, not this project's
top-level `better-auth@1.6.23`, regardless of what's installed at the
project root. Handing it a `D1Database` (real or stubbed) always throws
`"Failed to initialize database adapter"` — a real gap in the CLI tool,
not a config mistake.

**Workaround (`scripts/auth-cli.config.ts`):** generate against an
in-memory `better-sqlite3` database instead. This is safe because Better
Auth's schema/migration generator branches on the coarse `databaseType`
enum (`"sqlite" | "mysql" | "pg" | "mssql"`), not the specific physical
driver — D1 IS SQLite-compatible SQL, so the generated CREATE TABLE output
is identical either way. `better-sqlite3` + `@types/better-sqlite3` are
pinned exact devDependencies for this reason; never imported by runtime
app code, never bundled into the Worker.

**Regenerating the schema after a future plugin/config change:**

```bash
npx @better-auth/cli@latest generate --config scripts/auth-cli.config.ts --output migrations/000N_<name>.sql -y
```

Review the output for `BEGIN`/`COMMIT` before committing (D1 rejects
interactive transactions) — Phase 1's generation had none, but re-verify
on every regeneration since the CLI's behavior isn't within this repo's
control.

## Applying the migration

Same convention as 0001/0002 (see "Public submissions queue" → "Applying
the migration" above) — a D1 schema migration is independent of `wrangler
deploy`, never auto-applied by a deploy.

```bash
npx wrangler d1 migrations apply pueblo-food-map-admin --local   # local dev/testing
npx wrangler d1 migrations apply pueblo-food-map-admin --remote  # production — NOT run in Phase 1, see Handoff below
```

## `BETTER_AUTH_SECRET`

Runtime, server-only — same convention as `RESEND_API_KEY`/
`CF_ACCESS_TEAM_DOMAIN` (read via `process.env`, never declared in
`wrangler.jsonc`). Local dev value lives in gitignored `.env.local`
(generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).
Production value is set via `wrangler secret put BETTER_AUTH_SECRET` — a
later-phase handoff, not done in Phase 1 (see Handoff below).

## Multi-hostname `baseURL`

`ADMIN_ALLOWED_HOSTS` in `auth-options.ts` mirrors the exact hostname set
`cfAccess.ts`'s header comment documents the admin surface answering on
(staging apex, public apex, bare workers.dev fallback — admin is a path on
these hosts, not a separate subdomain). NOT included: Workers
version-preview URLs (dynamic per-deploy, can't be exact-matched) — a
wildcard pattern is a Phase 2/3 decision once real login traffic needs it.

## Plugins registered, not yet wired to any UI

- **`magicLink`** — `sendMagicLink` throws (marked `// Phase 2:` in
  `auth-options.ts`); registered so its schema (the `verification` table
  shape) is correct now. Phase 2 wires a real Resend-backed implementation.
- **`passkey`** (`@better-auth/passkey`) — `rpID`/`rpName`/static `origin`
  array set; no registration/authentication UI exists yet.

## Handoff — NOT done in Phase 1 (explicit, for a later phase)

- **Production `BETTER_AUTH_SECRET`** — `wrangler secret put
  BETTER_AUTH_SECRET` was NOT run. Requires Cloudflare deploy credentials
  this phase's implementer didn't hold.
- **Remote migration** — `0003_better_auth_schema.sql` was applied to
  **local** D1 only and verified there. It was NOT applied to remote/
  production D1, and no remote dry-run proof exists: the installed
  wrangler (4.107.0) has no `--dry-run` flag on `d1 execute`/`d1 migrations
  apply` (verified against its bundled CLI source — only `wrangler deploy`
  has that flag), and no `CLOUDFLARE_API_TOKEN` was available to even
  attempt a read-only remote check. Apply at whichever later phase's merge
  actually cuts the admin over.
- **Login UI, route gating, Access removal** — Phases 2, 3, and 5
  respectively. Nothing in this phase changes how an admin actually signs
  in. (Login UI + magic link + passkey now shipped in Phase 2, next
  section — route gating and Access removal are still Phases 3/5.)

# Admin authentication — Better Auth Phase 2 (#315): login, magic link, passkey, allowlist

Builds the actual login experience on top of Phase 1's engine. **Still no
route gating and no Access removal** — Cloudflare Access continues to gate
`/admin/**`/`/api/admin/**` completely unmodified through this phase (see
"Admin authentication (Cloudflare Access)" above). `/admin/login` is a new,
intentionally UNGATED page — the one admin surface page that must render
for an unauthenticated visitor.

## The CRITICAL allowlist gate — `src/lib/adminAllowlist.ts` + `src/lib/adminAuthAllowlistPlugin.ts`

Better Auth has no first-party "restrict sign-in to a fixed email list"
option — this is bespoke, and it is the one piece of Phase 2 that must be
correct. `getAdminAllowlist()`/`isAllowlistedEmail()`
(`adminAllowlist.ts`) read `ADMIN_ALLOWLIST` (comma-separated, trimmed,
lower-cased; defaults to `["kysboyd@gmail.com"]` if unset or empty —
deliberately fails toward "only Kyle," never toward "everyone"). A custom
Better Auth plugin (`adminAuthAllowlistPlugin.ts`) enforces it at every
point a session or account could be minted, registered last in
`auth-options.ts`'s `plugins` array (hook execution doesn't depend on
array position — Better Auth flat-maps every plugin's `hooks` — kept last
purely so the file reads top-to-bottom as "engine, then the gate on top of
it"):

1. **`hooks.before` matched on `/sign-in/magic-link`** — rejects a
   non-allowlisted email BEFORE `magicLink`'s handler runs, so no
   `verification` row is ever created and no email is ever sent for a
   rejected address. Returns `ctx.json({ status: true })` — the exact same
   response shape a real send produces — so the endpoint can never be used
   to enumerate which emails are admins. `AdminLoginForm.tsx` mirrors this
   in its own copy ("If `<email>` is registered..., a sign-in link is on
   its way") for the same reason.
2. **`hooks.before` matched on the two passkey-registration endpoints**
   (`/passkey/generate-register-options`, `/passkey/verify-registration`)
   — layers on top of, not instead of, `@better-auth/passkey`'s own
   `freshSessionMiddleware` (confirmed in the installed plugin's own
   source: both routes already require a session). Reads the caller's
   session via `getSessionFromCtx`; throws `APIError("FORBIDDEN")` if
   there's no session or its email isn't allowlisted.
3. **`databaseHooks.user.create.before`** — defense-in-depth. Returns
   `false` (blocking the DB write) for any non-allowlisted email, so even
   a future code path that creates a `user` row through some endpoint the
   two path-matched hooks above don't cover still can't mint one.

`emailAndPassword.enabled: false` is set explicitly in `auth-options.ts`
(Better Auth already defaults to disabled when the block is omitted, but
the task calls for stating it, and `signUpEmail` throwing `BAD_REQUEST` is
asserted directly in `adminAuthAllowlistPlugin.test.ts`) — there is no
password-based path to create an account at all, allowlisted or not.

**Tests:** `src/lib/adminAllowlist.test.ts` (plain-logic unit tests of the
comparison) and `src/lib/adminAuthAllowlistPlugin.test.ts` (integration —
boots a real `betterAuth()` instance against a `better-sqlite3`-migrated
copy of `migrations/0003_better_auth_schema.sql` and calls the actual
`auth.api.*` endpoints, including a full real magic-link → verify →
session-cookie → passkey-registration-options round trip proving an
allowlisted session is NOT blocked). 15 tests, all passing.

## Real magic-link send — `src/lib/adminMagicLinkEmail.ts`

Replaces Phase 1's throwing `sendMagicLink` stub. Same Resend
sending-key convention as the public forms (see "Resend Email Key
Management" above) — reads `RESEND_API_KEY` at request time, plain-text +
HTML body with DESIGN.md's hex tokens hardcoded (email clients don't load
CSS custom properties, so the `--color-*` variables `globals.css` defines
can't be referenced directly). Throws on a missing key or a non-2xx Resend
response; `sendMagicLink` in `auth-options.ts` does not swallow that
throw, so a real send failure surfaces to the client as `result.error`
(see the `AdminLoginForm.tsx` note below), not a false "sent" state.

## Login page — `/admin/login`

`src/app/admin/login/page.tsx` (Server Component shell, no auth logic) +
`src/components/AdminLoginForm.tsx` (Client Component, owns the whole
flow) + `src/lib/authClient.ts` (`createAuthClient` with `magicLinkClient`
+ `passkeyClient`, same-origin `baseURL`). One component switches views on
`authClient.useSession()`: signed-out shows the email form + "use a
passkey" button; signed-in shows a "set up a passkey" prompt (WebAuthn
`userVerification: "required"`, set on `passkey()`'s
`authenticatorSelection` in `auth-options.ts`) + a link to `/admin`.

**better-auth's client resolves `{ data, error }` rather than throwing on
a non-2xx response** (verified against `@better-fetch/fetch`'s default
`throw: false`) — `handleMagicLinkSubmit` checks `result?.error` before
showing the "sent" confirmation, exactly like the passkey handlers already
did. Missing this check was caught live: a fake dev `RESEND_API_KEY`
correctly 401s, and the API-level allowlist gate correctly let the request
through and hit Resend — but the client, before this check was added,
silently showed the "sent" confirmation anyway. Regression-guarded in
`AdminLoginForm.test.tsx` ("an API-level error... shows the error state,
not 'sent'").

## Applying the migration / secrets — carried forward from Phase 1, still pending

`0003_better_auth_schema.sql` is still applied to **local** D1 only.
Production `BETTER_AUTH_SECRET` and remote migration are still NOT set —
see Phase 1's Handoff list above, unchanged by this phase. Additionally,
production needs `RESEND_API_KEY` confirmed to cover magic-link send (the
existing key already covers the public forms' domain-scoped sending
permission — verify it also authorizes this admin flow before the cutover
that actually routes real traffic here).

---

# Admin authentication — Better Auth Phase 3 (#316-ish): dual-auth gate

Layers a Better Auth session requirement ON TOP of Cloudflare Access —
**logical AND, never OR.** After this phase, reaching any admin data
requires BOTH a valid CF Access JWT AND a valid Better Auth session; either
alone is refused. This is strictly MORE restrictive than Phase 2, which
left Access as the only real gate (Better Auth existed but nothing
required a session). Access is still NOT removed — that's a later,
separate phase.

## `getAdminDb()` — still the single choke point, now two checks

`src/lib/adminDb.ts`'s `getAdminDb()` calls `requireAccessIdentity()`
(CF Access — cheaper, pre-existing check) FIRST, then
`requireAdminSession()` (`src/lib/adminSession.ts`, new) SECOND. Either
throws `AccessDeniedError` and neither the D1 binding nor a Better Auth
session lookup happens until Access has already passed — a caller with no
CF Access JWT never even reaches the Better Auth check. `requireAdminSession`
reads `auth.api.getSession({ headers })` (a fresh `Headers` object carrying
only the caller's `cookie` header — better-auth's session-read path never
consults anything else) and re-runs the SAME `isAllowlistedEmail()` check
Phase 2's plugin already enforces at session-creation time — defense in
depth, not redundant: a session created before an admin's email is removed
from `ADMIN_ALLOWLIST` would otherwise stay valid until it expires.

## Redirect-vs-403 / 401-vs-403 — one shared helper per call shape

`src/lib/adminAuthErrors.ts` is the single place this branching logic
lives, replacing what was a copy-pasted catch block per page/route:

- **Server Component pages** — `handlePageAuthError(err)`: on
  `reason === "no_session"`, `redirect("/admin/login")` (send them to sign
  in); any other `AccessDeniedError` reason (e.g. `not_allowlisted`, or a
  Phase 2-era reason) still calls `forbidden()` (a real 403), same as
  before this phase.
- **Route handlers** — `adminAuthErrorResponse(err)`: `no_session` → `401`;
  every other reason → `403` (plain-text `Forbidden`, same body shape as
  before). Both helpers still log through `logAdminAuthFailure()` first —
  the PII-free convention is unchanged, only the branching moved into one
  place.

All 4 admin Server Component pages and all 7 `/api/admin/*` route handlers
that call `getAdminDb()` were updated to call one of these two helpers
instead of duplicating the `AccessDeniedError` catch. CSRF (`requireAdminOrigin()`
on the 5 mutation routes) is unchanged — this phase only added a second
identity check ahead of it, never touched origin verification.

## `__Host-` session cookie

`auth-options.ts`'s `advanced` block names the session cookie
`__Host-session_token` explicitly. The `__Host-` prefix requires the
browser see `Secure`, `Path=/`, and NO `Domain` attribute on the
`Set-Cookie` line, or it silently drops the cookie — verified against the
installed `better-auth` source (`node_modules/better-auth/dist/cookies/index.mjs`),
not assumed from docs:

- `useSecureCookies: false` — counterintuitive, but required: left at its
  default in production, better-auth's own `createCookieGetter` auto-
  prepends `__Secure-` ahead of any custom `.name`, producing a malformed
  double-prefixed cookie name. Setting this `false` stops that
  auto-prepend so the literal `__Host-session_token` name is used as-is.
- `cookies.session_token.attributes.secure: true` — restores the `Secure`
  flag by hand, since turning off the auto-prepend above also turns off
  the attribute it would have set.
- `Path=/` and no `Domain` are better-auth's defaults already — nothing
  else needed for those two.

`auth-options.test.ts` asserts the resolved config via better-auth's own
`getCookies(options)` introspection (no live HTTP round trip needed to
check the name/attributes it will produce). **What that test can't
prove:** whether a real browser actually accepts and persists the
resulting `Set-Cookie` header end to end — that requires a live preview
(see Verification below).

## Login-event logging — `databaseHooks.session.create.after`

`auth-options.ts`'s top-level `databaseHooks.session.create.after` calls
`logAdminAuthEvent("login")` (`src/lib/logger.ts`, new) — a single-line
`{"event":"admin_auth_event","type":"login"}`, same PII-free convention as
`logAdminAuthFailure`. Verified in better-auth's own context-creation
source that plugin-level `databaseHooks` (Phase 2's
`adminAuthAllowlistPlugin`'s `databaseHooks.user.create.before`) and this
phase's new top-level `databaseHooks.session.create.after` are collected
into one array and both run — no ordering conflict, no override.

## Verification — what's headless-provable vs. what needs Kyle's live preview

`lint` / `design:drift` / `typecheck` / `test:ci` / `opennextjs-cloudflare
build` are all clean as of this phase (including new tests:
`adminSession.test.ts`'s no_session/not_allowlisted/success/cookie-
forwarding cases, and `auth-options.test.ts`'s `__Host-` cookie
assertion). **NOT verifiable headlessly:** whether a real browser actually
sets and sends the `__Host-session_token` cookie correctly through a full
magic-link login round trip, and whether the redirect-to-`/admin/login`
vs. 403 behavior renders as expected live. Needs Kyle's live preview
before this phase is considered fully proven.

**Superseded:** the "later, separate phase" that removes Cloudflare Access
mentioned throughout this section has now happened
(`auth/betterauth-sole-gate`) — see "Admin authentication — Better Auth is
the sole gate (#237, post-cutover)" near the top of this file for the
current state. `requireAccessIdentity()` no longer exists; `getAdminDb()`
now calls only `requireAdminSession()`. This section is kept as the
historical record of how the dual-auth gate it built was structured.

---

# Admin authentication — Better Auth Phase 4 (#318): rate limit + short sessions

Two auth-hardening additions on top of the sole-gate cutover above, both in
`src/lib/auth-options.ts`'s `buildAuthOptions()`. No login-UI, route-gating,
or plugin-registration changes — this phase only tightens two existing
config surfaces.

**Item 1 — D1-backed rate limit on `/sign-in/magic-link`.** Reuses Better
Auth's own native `rateLimit` engine (`storage: "database"`, no Workers KV
— same one-store rule as everywhere else in this file) rather than a
hand-rolled limiter; `src/lib/rateLimit.ts`'s in-process limiter is
untouched (it covers the three public forms only, a separate surface).
`enabled` is explicitly `process.env.NODE_ENV === "production"` — Better
Auth's own default already gates rate limiting to production only, but
this repo states it, mirroring `emailAndPassword.enabled: false`'s own
"don't rely on an invisible default" precedent above. A `customRules`
entry for the exact `/sign-in/magic-link` path sets window 3600s (1h) /
max 5, overriding the magicLink plugin's own shorter 60s default — see
`auth-options.ts`'s own WHY comment for the full source trace (every
option pinned to an installed `node_modules/better-auth` file/line).
**`migrations/0004_rate_limit_table.sql`** adds the `rateLimit` table this
storage mode needs — same D1 database, same "not part of a Worker deploy"
apply convention as 0001-0003.

**Item 2 (spec item 5) — 12h rolling session, replacing the 7-day
default.** `session: { expiresIn: 43200, updateAge: 3600 }` — an idle
admin session expires within 12h of its last activity; an active one is
refreshed (re-extended, one DB write) at most once an hour. Better Auth
1.6.23 has no first-party option that adds a true absolute lifetime cap
*on top of* this rolling window — the only related option
(`disableSessionRefresh`) replaces the rolling behavior rather than adding
to it (turns `expiresIn` into a fixed lifetime from account creation, with
no idle-based extension at all) — so this rolling 12h window is the
accepted floor, not a placeholder for a stricter mechanism that was simply
skipped.

**Handoff, same shape as every prior phase:** these are config-only
changes, verified against installed source and by extending
`auth-options.test.ts` (config introspection — no live request, no D1
round trip). `migrations/0004_rate_limit_table.sql` was hand-derived from
the installed generator source rather than produced by
`npx @better-auth/cli generate` (the session that authored it had no
working shell) — regenerate and diff against it before applying to remote
D1, per that file's own header. Applying 0004 to remote/production D1 is
NOT done as part of this phase, same convention as every prior migration.

## Item 2 — Cloudflare edge rate limit (NOT in this repo — zone config)

A second, complementary limiter lives at the Cloudflare **edge**, in front
of the Worker — distinct from item 1's app-level Better Auth limiter and
NOT expressed in this codebase (it's zone config, managed via the
Cloudflare API/dashboard, not `wrangler.jsonc`). It blunts a volumetric
flood of the admin auth surface before a request ever reaches the app.

- **Zone:** `pueblofoodmap.com` (zone id `557eb74d0048cb71251282b82e99926e`),
  `http_ratelimit` phase entrypoint ruleset `ebccb17e51e841e5976788756b9ca8dc`.
- **Rule:** expression `starts_with(http.request.uri.path, "/api/auth/")`,
  action `block`, count per `ip.src`+`cf.colo.id`, **>10 requests / 10s →
  block 10s**. Only the Better Auth endpoints are scoped; the public map
  and every visitor page are untouched.
- **WHY these blunt numbers:** the zone is on the **Free** plan, which caps
  the `http_ratelimit` phase at **one** rule, forces `mitigation_timeout`
  to equal-or-exceed the counting `period` (so the block window is
  effectively the 10s period), and allows IP-only counting. A single
  path+IP rule is all Free permits — documented so nobody mistakes the
  bluntness for a config error. Pro (2 rules) / Business (5) would allow a
  longer block window and keeping a second rule; deliberately not purchased
  (see the swap note next).
- **The one free slot previously held a "Leaked credential check" rule**
  (`cf.waf.credential_check.password_leaked`, block). It was **removed** at
  #318 to free the slot: this admin is passwordless (magic link + passkey,
  `emailAndPassword.enabled: false`), so no request ever submits a password
  for that field to match — the rule was inert here. Net swap: an inert
  stolen-password rule → an active auth-flood rule.
- **To change it:** Cloudflare dashboard → Security → WAF → Rate limiting
  rules, or the rulesets API on the zone/ruleset ids above (Global API key
  — `op://Atlas/Cloudflare - Global API Key`, header-auth `X-Auth-Email` /
  `X-Auth-Key`).

---

# Admin authentication — passkey isolation (#318): staging gets its own identity

Staging (`dev.pueblofoodmap.com`) now runs a **live** Better Auth engine
with its OWN `BETTER_AUTH_SECRET` (a staging-worker secret, isolated from
prod) and its OWN passkey **rpID**, `dev.pueblofoodmap.com` — set via
`wrangler.jsonc`'s `env.staging.vars.BETTER_AUTH_RP_ID`.

**Why a separate rpID:** WebAuthn credentials are bound to the rpID the
relying party presented at registration time, not just to an origin URL.
Giving staging a distinct rpID means a passkey registered on the test site
can never authenticate against production, and vice-versa — by design, you
register a NEW passkey on staging; your prod passkey simply won't work
there. (The passkey `origin` allow-list is unaffected by this change — it
already covered `https://dev.pueblofoodmap.com` via `ADMIN_ALLOWED_HOSTS`;
only `rpID` needed a per-environment value.)

**Prod is unchanged.** `buildAuthOptions()`'s `rpID` parameter
(`src/lib/auth-options.ts`) defaults to `"pueblofoodmap.com"`, and prod's
`wrangler.jsonc` config sets no `BETTER_AUTH_RP_ID` — so production's
passkey config is byte-for-byte identical to before this change.

**Where the override is read from — the Cloudflare env BINDING, not
`process.env`.** `src/lib/auth.ts`'s `getAuth()` reads
`env.BETTER_AUTH_RP_ID` off the object `getCloudflareContext()` returns
(same binding `ADMIN_DB` comes through), not `process.env`. WHY: a
wrangler `var`'s surfacing into `process.env` under OpenNext isn't
guaranteed, and a silently-`undefined` override would break staging
passkey isolation without ever throwing an error — the env binding is
100% reliable. The type is declared as an optional field on
`CloudflareEnv` in `cloudflare-env.d.ts` (unset/`undefined` on prod, a
real string only on staging).

**Stale secrets, safe to ignore or clean up:** `CF_ACCESS_AUD` /
`CF_ACCESS_TEAM_DOMAIN` may still exist on the staging Worker from the
pre-cutover Cloudflare Access era — they're dead (`cfAccess.ts` is
CSRF-only now, reads neither), so leaving them set is harmless; deleting
them is also safe.

---

# Admin authentication — passkey isolation (#318): staging gets its own identity

Staging (`dev.pueblofoodmap.com`) now runs a **live** Better Auth engine
with its OWN `BETTER_AUTH_SECRET` (a staging-worker secret, isolated from
prod) and its OWN passkey **rpID**, `dev.pueblofoodmap.com` — set via
`wrangler.jsonc`'s `env.staging.vars.BETTER_AUTH_RP_ID`.

**Why a separate rpID:** WebAuthn credentials are bound to the rpID the
relying party presented at registration time, not just to an origin URL.
Giving staging a distinct rpID means a passkey registered on the test site
can never authenticate against production, and vice-versa — by design, you
register a NEW passkey on staging; your prod passkey simply won't work
there. (The passkey `origin` allow-list is unaffected by this change — it
already covered `https://dev.pueblofoodmap.com` via `ADMIN_ALLOWED_HOSTS`;
only `rpID` needed a per-environment value.)

**Prod is unchanged.** `buildAuthOptions()`'s `rpID` parameter
(`src/lib/auth-options.ts`) defaults to `"pueblofoodmap.com"`, and prod's
`wrangler.jsonc` config sets no `BETTER_AUTH_RP_ID` — so production's
passkey config is byte-for-byte identical to before this change.

**Where the override is read from — the Cloudflare env BINDING, not
`process.env`.** `src/lib/auth.ts`'s `getAuth()` reads
`env.BETTER_AUTH_RP_ID` off the object `getCloudflareContext()` returns
(same binding `ADMIN_DB` comes through), not `process.env`. WHY: a
wrangler `var`'s surfacing into `process.env` under OpenNext isn't
guaranteed, and a silently-`undefined` override would break staging
passkey isolation without ever throwing an error — the env binding is
100% reliable. The type is declared as an optional field on
`CloudflareEnv` in `cloudflare-env.d.ts` (unset/`undefined` on prod, a
real string only on staging).

**Stale secrets, safe to ignore or clean up:** `CF_ACCESS_AUD` /
`CF_ACCESS_TEAM_DOMAIN` may still exist on the staging Worker from the
pre-cutover Cloudflare Access era — they're dead (`cfAccess.ts` is
CSRF-only now, reads neither), so leaving them set is harmless; deleting
them is also safe.

---

# Blessing Boxes — live box layer (slice 1)

Full design: `atlas-kb/projects/Pueblo Food Map/Blessing Boxes Build Plan.md`
(8 phased slices) and `...Blessing Boxes Epic - Discovery.md`. This section
covers what slice 1 (box identity) actually shipped.

**Architecture call: boxes are live, not published.** Every other place on
this map flows through the draft → publish → static-snapshot pipeline
(`src/data/published-venues.ts`, "Publish → static" above) — a box
deliberately skips it. An admin's box create/edit is visible on the public
map and at `/box/<id>` immediately, with no Publish click, because
`src/lib/blessingBoxes.ts`'s `loadLiveBoxes()`/`loadLiveBoxById()` read D1
directly at request time. This exists so Kyle's dev-only practice boxes
(below) can never leak onto the live map via an ordinary publish — there is
no code path connecting the two.

**`category: 'blessing_box'`** is a real 8th `VenueCategory` (was 7),
fanned out the same way every other category is: `categoryLabels`/
`categoryColors`/`categoryIcon` (src/data/venues.ts), `VenueMarker.tsx`'s
own duplicate color map (see DESIGN.md's "Category colors" section, now an
8-color palette, for why this is a 3-place duplication, not 1), `CategoryChips.tsx`
/`CategoryDropdown.tsx`'s category lists, `searchVenues.ts`'s two
category-keyed Records, `src/lib/i18n.ts` (EN+ES `category.*`/
`category.full.*`/`splash.cat.*`/`suggest.category.*`/`marker.category.*`),
and `adminVenueValidation.ts`'s enum. Pin color: `catBlessing` /
`#C2447B` (raspberry) — DESIGN.md's frontmatter + `--color-cat-blessing` in
`globals.css`, checked by `bun run design:drift`.

**`migrations/0005_blessing_boxes.sql`** — a full `venues` table rebuild
(SQLite has no `ALTER TABLE ... ALTER CONSTRAINT`; see the migration's own
header for the verified-safe rebuild recipe) to widen the `category` CHECK,
plus a new `blessing_boxes` table: `venue_id` TEXT PRIMARY KEY matching
`venues.id` by convention (no declared FK, same as `change_proposals`),
`host_name`/`host_note`/`most_needed`/`installed_on`/`removed_on` (all
public), `host_contact` (**PRIVATE — never SELECTed by the public read
endpoint or `/box/<id>`**, enforced by naming columns explicitly at every
public read site, never `SELECT *`), and `qr_code_id` (reserved, unused
until slice 8). **Applied to STAGING (`pueblo-food-map-admin-staging`) and
local dev only, 2026-09-17 — production is a later, explicit, Kyle-gated
step**, same convention as every other migration in this file.

**Public read surface, both request-time, both best-effort (a D1 failure
degrades to "no boxes" rather than a 500):**
- `GET /api/public/blessing-boxes` — every non-archived box, `host_contact`
  stripped, held at the Cloudflare edge ~60s via the Workers Cache API
  (`caches.default` — a bare `Cache-Control` response header does nothing
  on a Worker response; this repo had no prior Cache API example, built
  fresh from Cloudflare's documented pattern). `useBoxVenues()`
  (src/lib/useBoxVenues.ts) is the client hook that fetches this and feeds
  the result into `useMapFilters`'s new optional `extraVenues` param
  (`MapWrapper.tsx`) — boxes merge into the same count/filter/search/sort/
  marker pipeline every other venue already flows through, with zero
  category-specific branching needed there (see `useMapFilters.ts`'s own
  WHY comment).
- `/box/[id]` — **SUPERSEDED by the map-first rework (2026-09-18) — see
  that section, far below, for what this route and box click-handling
  actually do now.** At slice-1 ship time this was a `force-dynamic` page
  (no `generateStaticParams` — there is no fixed build-time id list, unlike
  `/venue/[id]`) rendering a now-deleted `BoxContent.tsx`, and box clicks on
  the map routed straight to it (`router.push`) instead of opening the
  ordinary `BottomSheet`/`DesktopVenueWindow` card. Kept here only as the
  historical record of slice 1's original scope call.

**The one real box converted:** the Routt St venue
(`plentiful-blessing-box-216-w-routt-plentiful-1454`, née a plain `pantry`
sourced from Plentiful) is now `category='blessing_box'` on staging D1 —
lat/lng/address/phone/url/notes untouched, still the real Plentiful data;
its `blessing_boxes` row starts empty (no real host info known yet — an
admin fills it in later). Its old `/venue/<id>` URL keeps working via a
**plain path** `redirects()` entry in `next.config.ts` (NOT the `has`-query
kind that 500'd production on 2026-06-20 — see that file's own header) to
`/box/<id>`; `dynamicParams = false` means `/venue/[id]/page.tsx` itself
can never run this redirect (a static route 404s an unknown id before any
page code executes), so it has to live in `next.config.ts`. It was also
removed by hand from `src/data/published-venues.ts` (that file is normally
auto-generated by `POST /api/admin/publish` and never hand-edited — see
"Publish → static" above — but a live publish is an outward,
production-affecting action outside a dev-only slice's scope; the next real
publish naturally re-excludes it forever via `fetchPublishSnapshot()`'s new
`AND category != 'blessing_box'` filter).

**The refresh pipeline never touches a box.** `excludeBlessingBoxes()`
(scripts/refresh/diffEngine.ts) strips box rows from BOTH sides of every
diff — existing D1 rows already `category='blessing_box'`, and any freshly
scraped record sharing a box's id regardless of what category the SCRAPE
itself assigns it (Plentiful's own site still lists Routt as a plain
pantry; it has no idea we recategorized it) — called from
`scripts/refresh-ingest.ts` right before `diffSource()`, once per source.

**Admin:** `AddVenueForm.tsx`'s existing create/edit screens gained a
conditional `<fieldset>` (rendered only when `category === 'blessing_box'`)
for the 6 box-only fields, validated server-side by
`adminVenueValidation.ts`'s `validateBoxFields()`. No new permission tier —
every admin write, box or not, continues through the existing atomic
`db.batch()` + `audit_log` path (`POST /api/admin/venues`,
`PATCH /api/admin/venues/[id]`) — an edit's blessing_boxes row is
delete-then-reinsert, but ONLY when the edit actually touches a box (still
a box, or changing to/from one); an ordinary pantry/garden/etc. edit adds
zero box statements to the batch.

**Dev-only practice data — `scripts/seed-blessing-boxes.ts`.** Generates
(never applies) two throwaway SQL files under the gitignored
`scripts/generated/`: 4 obviously-fake boxes (`fake-blessing-box-practice-*`
ids, "(TEST DATA)" in every name) for `seed-blessing-boxes.sql`, and the
matching `DELETE`s for `remove-blessing-boxes.sql`. Apply either with
`wrangler d1 execute pueblo-food-map-admin-staging --remote --file=...`
(never against `pueblo-food-map-admin`, i.e. production) — see the script's
own header for the exact commands. Both are currently seeded on staging
alongside the real Routt box.

**Deferred, not built in this slice** (out of the acceptance criteria,
listed so a later slice doesn't assume otherwise): check-ins, a real
computed status, photos, adopt-a-box, alerts, stats, QR stickers, an
activity-log page, and a "Plentiful lists a box we don't have" detection —
none of these fell out cheaply from `excludeBlessingBoxes()` alone.

---

# Blessing Boxes — check-ins and live status (slice 2)

Full design: `atlas-kb/projects/Pueblo Food Map/Blessing Boxes Build Plan.md`
and `...Blessing Boxes Epic - Discovery.md`. This section covers what slice
2 (check-ins and live status) actually shipped, on top of slice 1's box
identity work above.

**`migrations/0007_box_checkins.sql`** adds two tables. `box_checkins` —
`id` (autoincrement PK), `venue_id`, `kind` (CHECK IN
`'filled'|'took'|'low'|'empty'|'problem'`), `note` (nullable, capped at
`FIELD_LIMITS.BOX_CHECKIN_NOTE = 280` chars via `src/lib/fieldLimits.ts`),
`visibility` (CHECK `'visible'|'hidden'`, default `'visible'`), `hidden_by`/
`hidden_at` (nullable), `created_at`. **Stores no name, no email, no IP
address — ever.** `box_checkin_rate_limit` — `key` (an HMAC-SHA256 hash,
never the raw box id or client token — see below), `bucket` (an
hour-number, not a timestamp), `count`. Applied to **staging and local dev
only, 2026-09-17** — same "production is a later, explicit, Kyle-gated
step" convention as 0005/0006 above (see the updated promotion checklist
below, which now includes this migration).

**Status is computed, never typed in — one function, `computeBoxStatus()`**
(`src/lib/blessingBoxes.ts`), implementing the state diagram exactly:
latest visible `filled` → `stocked`; latest visible `low` → `low`; latest
visible `empty` → `empty`; no visible status-setting check-in within the
last **7 days** → `unknown`; `removed_on` set on the box's `blessing_boxes`
row → `out_of_service` (wins over any check-in, including a fresh
`filled`).

**`out_of_service` is currently unreachable from the admin UI — 2026-09-17
review correction to a false claim this section previously made.** It used
to say `out_of_service` "reuses the same admin-pause signal slice 1's
Danger-zone archive already writes." That was never true: the admin archive
route (`Danger zone` on a venue's edit page) only ever sets
`venues.status = 'archived'` — it never touches `blessing_boxes.removed_on`.
And archiving doesn't degrade a box to a status at all: every live box query
(`SELECT_LIVE_BOXES_SQL`/`SELECT_LIVE_BOX_BY_ID_SQL` in
`src/lib/blessingBoxes.ts`) filters `v.status != 'archived'`, so an archived
box's row is excluded before it ever reaches `computeBoxStatus()` — the pin
disappears from the map and its `/box/<id>` page 404s, the same way any
other archived venue does. **The only way a box currently reads
`out_of_service` is `blessing_boxes.removed_on` being set directly**
(hand-edited via `AddVenueForm`'s box fieldset, or by hand in D1) — **there
is no admin "pause this box without archiving it" button yet.** That's a
real gap, not a bug in what's built; a future slice would need to wire an
admin control to `removed_on` if "paused but still visible on the map" is
ever wanted. `took` and `problem` never set status by themselves — they're
excluded from the status-setting kind map entirely, not merely
deprioritized. **This is a deliberately chosen reading of the Build Plan's
looser "no check-ins for 7 days" wording, not the only valid one** — see
`computeBoxStatus()`'s own header comment in `src/lib/blessingBoxes.ts` for
the full reasoning; flagged here so it's visible without opening that file,
since it's a real deviation being reported to Kyle as shipped, not a bug.
`computeLastFilledAt()` is a
second, separate pure function (latest visible `filled`, **no 7-day
window** — "last filled 3 weeks ago" should still say so, unlike the status
badge which fades to Unknown). Both are exhaustively unit-tested in
`src/lib/blessingBoxes.test.ts` (hidden check-ins never count, exactly-7-
days-old still counts, 8-days-old fades, `took`/`problem` never move the
needle, `out_of_service` beats a same-day `filled`).

**Public write path — `POST /api/public/blessing-boxes/[id]/checkins`**
(`src/app/api/public/blessing-boxes/[id]/checkins/route.ts`). Guard order,
same convention as `/suggest/submit`/`/report/submit`: Content-Type check →
Turnstile (`src/lib/turnstile.ts`, reused, not reimplemented) → honeypot →
rate limit → field validation. Reaches D1 directly via
`getCloudflareContext()` (a public route, not `getAdminDb()` — same
"public routes reach the binding directly" convention "Public submissions
queue" documents above). `note` is only accepted (and only capped) for
`filled`/`problem` — `took`/`low`/`empty` silently drop any submitted note,
matching the panel's own one-tap UI (below), which never shows a note field
for those three kinds.

**Rate limiting — a NEW D1 table, a shared atomic counter, not the
in-process limiter and not Better Auth's `rateLimit` table.**
`src/lib/checkinRateLimit.ts`'s `checkAndIncrement()` is the whole
mechanism: bucket the current time to the hour, HMAC-SHA256 (Web Crypto
`crypto.subtle`, keyed off the dedicated `CHECKIN_RATE_LIMIT_SECRET` runtime
secret — see "Secrets" below; **not** `TURNSTILE_SECRET_KEY`, 2026-09-17
review correction, see that bullet) `${scope}:${id}:${bucket}` into a
64-hex-char key, then
`INSERT ... ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING
count` — one atomic upsert, no read-then-write race window. A stale-bucket
sweep (`DELETE WHERE bucket < currentBucket - 2`) runs best-effort on every
call so the table doesn't grow unbounded; a failed sweep never fails the
rate-limit check itself. **Fails CLOSED** — any D1 error returns "blocked,"
never "allowed," on the theory that a rate limiter that fails open under
load is not a rate limiter.
- **Why a new table, not `src/lib/rateLimit.ts`:** that module's counter
  lives in a plain in-process `Map` — correct for the three public forms'
  volume, but Cloudflare Workers run one isolate per edge colo (and
  sometimes more than one per colo under load), so each isolate keeps its
  own independent `Map`. An abuser hitting different isolates sails past
  the "5 per hour" limit multiple times over; this is exactly the weakness
  the slice's task named as needing fixed.
  - **Why a new table, not Better Auth's existing `migrations/0004
    rateLimit` table:** that table's schema and query shape are Better
    Auth's own internal implementation detail (its `storage: "database"`
    rate-limit engine, "Admin authentication — Better Auth Phase 4" above)
    — reusing it for an unrelated public write path means matching its
    exact column contract with no guarantee Better Auth won't change it
    later, and it's designed for one endpoint's auth flow, not per-box
    variable caps. A same-shaped-but-independent table costs one migration
    and keeps the two rate limiters from ever silently coupling.
- **Two caps, both checked, both atomic — visitor checked FIRST, then box
  (2026-09-17 review correction; this used to run box-then-visitor):**
  per-visitor-per-box (`scope: "visitor-box"`,
  `MAX_PER_VISITOR_PER_BOX_PER_HOUR = 6`, "a handful of check-ins per box
  per hour from one visitor" per the task) is checked and can reject a
  request BEFORE the per-box counter (`scope: "box"`,
  `MAX_PER_BOX_PER_HOUR = 300`, catches an automated flood against one box
  regardless of who) is ever touched. Checking box-first used to mean a
  single over-tapping visitor burned the SHARED box-wide quota on every one
  of their own rejected attempts, which could lock out every other visitor
  at that box — including the host trying to log "filled" — even though the
  box itself never saw genuine high traffic. The per-visitor check only runs
  when a `clientToken` is present in the request body — its absence (an old
  cached page, a blocked script) still leaves the per-box cap standing, so
  no submission goes entirely unlimited. **`MAX_PER_BOX_PER_HOUR` was raised
  60 → 300 the same review pass**, because 60 shared across every visitor at
  a box meant a real crowd at a distribution event — or even one
  Turnstile-passing person tapping repeatedly — could lock out the whole
  box for the rest of the hour; 300 still catches a scripted flood (which
  blows past it in well under a minute) while comfortably covering up to 50
  distinct visitors each maxing out their own per-visitor cap in one hour.
  The two failure modes also now return distinct error codes
  (`rate_limit_visitor` vs. `rate_limit_box`) so `BoxCheckinPanel.tsx` can
  show copy that names which scope tripped, instead of one generic message
  that misdirected blame either way.
- **No IP ever persisted — a client token instead.**
  `src/lib/checkinClientToken.ts`'s `getCheckinClientToken()` mints a
  `crypto.randomUUID()` on first use and persists it in `localStorage`
  (key `pfm-checkin-client-token`) — this is the "visitor" identity the
  per-visitor cap keys on, not an IP address. It identifies a BROWSER, not
  a PERSON — clearing storage or switching devices resets it — a
  deliberate ceiling given v1's "fully anonymous" rule (no accounts, no
  server-side visitor identity at all); HMAC-hashing it before it ever
  touches D1 means even the rate-limit table itself never stores the raw
  token.

**`problem` reports are admin-only — enforced structurally, not just by
convention.** `SELECT_VISIBLE_CHECKINS_SQL`/`selectVisibleCheckinsForVenuesSql`
(`src/lib/blessingBoxes.ts`) filter `kind != 'problem'` at the SQL level —
belt-and-suspenders alongside `toPublicCheckinEvents()`'s own filter, same
"never even fetch the private data" guarantee migrations/0005 already gives
`host_contact`. A `problem` submission best-effort emails
issues@pueblofoodmap.com via Resend (same sending-key convention as the
three public forms — see "Resend Email Key Management" above); the email
send is wrapped in its own try/catch so a Resend outage degrades to "the
check-in still saved, the admin just isn't emailed about it" rather than
failing the whole request — the admin check-ins panel (below) is the
durable record either way.

**~1-minute freshness without waiting out the list endpoint's 60s edge
cache.** Slice 1's `GET /api/public/blessing-boxes` is cached at the
Cloudflare edge via the Workers Cache API (`caches.default`) for ~60s. A
fresh check-in achieves visible freshness two ways, not one: (1) the POST
handler's response body already carries the box's newly recomputed
`status`/`lastFilledAt` (`loadVisibleCheckins()` + `computeBoxStatus()`/
`computeLastFilledAt()`, re-run synchronously after the INSERT) — so
`BoxCheckinPanel`'s `onCheckinSuccess` updates `BoxContent`'s badge
instantly, with zero dependency on the cache at all, for the person who
just checked in; (2) for every OTHER visitor reading the list endpoint,
`bustListCache()` best-effort `caches.default.delete()`s that GET's cache
entry for the current colo right after the write, so the very next list
read past this point re-executes the D1 query instead of serving a stale
60s-old snapshot. The Cache API is per-colo, not zone-wide, so a visitor on
a different edge colo can still see the old cached response for up to the
remaining ~60s — accepted, since "about a minute" was the task's own
freshness bar, not "instant everywhere."

**Admin hide/unhide — `POST /api/admin/box-checkins/[id]/visibility`**
(`src/app/api/admin/box-checkins/[id]/visibility/route.ts`). Same auth pair
as every other admin mutation (`getAdminDb()` then `requireAdminOrigin()`).
Flips `visibility` and, atomically in the same `db.batch()`, writes an
`audit_log` row — reusing `action='update'` (widening that column's CHECK
constraint for one more enum value is a full table rebuild, disproportionate
here; see the route's own header) with a new `entity='box_checkin'` (a
plain TEXT column, no schema change needed). No permission levels (Kyle's
decision, same as every other admin surface in this app) — any admin can
hide/unhide any check-in; the audit_log row is the accountability
mechanism, not a role check. `BoxCheckinsAdminPanel.tsx`, rendered on
`/admin/venues/[id]/edit` only when `venue.category === 'blessing_box'`,
lists EVERY check-in for that box — hidden rows and `problem` reports
included, unlike the public feed — via `loadAllCheckinsForBox()`
(`src/lib/blessingBoxes.ts`, a separate query from the public
visible/non-problem one, not a flag on it, so the public path can never
accidentally start returning hidden/problem rows through a future
refactor).

**Public UI:** `BoxCheckinPanel.tsx` — five buttons
(`took`/`filled`/`low`/`empty`/`problem`), `took`/`low`/`empty` submit
immediately with no note field ever shown; `filled`/`problem` expand a
small optional-note form first. Turnstile mount/reset mirrors
`ReportForm.tsx`'s own widget lifecycle with one deliberate difference:
this panel resets the widget after EVERY submit (success or failure), not
only a failed one — a visitor can tap more than once in the same page view
(e.g. "took" now, "empty" later), and a Turnstile token is single-use, so a
second tap would otherwise silently fail verification on a stale, already-
consumed token. `BoxContent.tsx` lifts `status`/`lastFilledAt` into local
state seeded from the server-rendered box prop, so `onCheckinSuccess`
updates the badge and "last filled" line instantly with no refetch (see the
freshness point above). "Last filled" renders via
`src/lib/relativeTime.ts`'s `formatRelativeTime()` — a thin wrapper over
`Intl.RelativeTimeFormat`, no new date library.

**i18n:** all new `box.status.*`/`box.lastFilled*`/`box.checkin.*` keys
carry both EN and ES strings (`src/lib/i18n.ts`), the new Spanish marked
`// [CHECK]` per this repo's established unreviewed-translation convention.

**Out of scope for this slice, deliberately not built** (so a later slice
doesn't assume otherwise): photos, adopt-a-box, alerts, stats, QR stickers,
an activity-log page, and closest-box — per the task's own explicit
exclusion list. No photo column was added to `box_checkins`, left for
slice 5.

**Blessing boxes — promotion checklist.** Run ALL FOUR migrations —
`0005_blessing_boxes.sql` (schema), `0006_convert_routt_blessing_box.sql`
(the Routt data conversion), `0007_box_checkins.sql` (check-ins +
rate-limit tables), AND `0008_box_events.sql` (the activity-log lifecycle
table, slice 3 — see "Blessing Boxes — activity log (slice 3)" below) —
against the **production** D1
(`pueblo-food-map-admin`) **BEFORE** promoting `dev` → `main`, not after.
**Slice 5 (photos, below) adds a FIFTH required migration,
`0009_box_photos.sql`, plus an R2 binding check — see "Blessing Boxes —
photos (slice 5)"'s own updated checklist further down for the full,
current list.**
This is NOT optional cleanup: `next.config.ts`'s `/venue/<Routt-id>` →
`/box/<Routt-id>` redirect and `publishVenues.ts`'s
`category != 'blessing_box'` snapshot filter both ship on the Worker deploy
itself, unconditionally, regardless of what production D1 currently
contains — a promotion that lands before the production data catches up
means the redirect target (`/box/<id>`) 404s (no row to read) and the box
pin silently vanishes from the live map (its `venues` row still reads
`category='pantry'` with no `blessing_boxes` row, so it's neither a public
box nor findable at its old URL). **A promotion landing after `0006` but before `0007` is applied is worse
than "status absent" — 2026-09-17 review correction to a previous
understatement here.** `loadVisibleCheckins()`/`loadVisibleCheckinsForVenues`
have no try/catch of their own; the missing-table D1 error they throw
propagates straight up through `loadLiveBoxes()`/`loadLiveBoxById()` to
`loadBoxesBestEffort()` (`src/app/api/public/blessing-boxes/route.ts`) and
`loadBox()` (`src/app/box/[id]/page.tsx`) — both of which catch it and
degrade, but at the "give up on the whole box" level, not a per-box
"status absent" level, because the exception fires before any individual
box's row is ever mapped to a response. The observable result:
**EVERY blessing-box pin disappears from the live map** (the list endpoint
returns `[]`, not a partial list with missing statuses) **and every
`/box/<id>` page 404s** (`loadBox()` returns `null` → `notFound()`) — not
merely "quiet" or "no check-ins yet," but the whole feature going dark
site-wide until `0007` lands. Whoever runs the promotion should treat a
missing `0007` as a full outage of the feature, not a cosmetic gap.
`0006` and `0007` are both idempotent (`0007` genuinely so as of this
review pass — see its own migration-file header) and safe to run on any
database in any order after `0005` — including production, where neither
has ever been applied — so there is no reason to defer either once `dev` is
ready to promote.

**Also required before promoting: the `CHECKIN_RATE_LIMIT_SECRET` runtime
secret must be set on the production Worker** (`wrangler secret put
CHECKIN_RATE_LIMIT_SECRET`, same convention as `RESEND_API_KEY`/
`TURNSTILE_SECRET_KEY` — see "Secrets" above and `.env.example`) —
`src/app/api/public/blessing-boxes/[id]/checkins/route.ts` throws on every
request if it's unset, so a promotion without it means every check-in
(not just the rate-limit path) fails immediately in production.

**Also required before promoting: set the prod worker secret
`TURNSTILE_BOX_SECRET_KEY`** from `op://Atlas/Turnstile - Pueblo Food Map
box check-ins/credential` (`wrangler secret put TURNSTILE_BOX_SECRET_KEY`)
— the dedicated invisible-mode Turnstile keypair for check-ins only (see
"Blessing Boxes — card polish" below for why a second key exists). The
route reads this instead of `TURNSTILE_SECRET_KEY` and throws on every
check-in request if it's unset, same failure shape as a missing
`CHECKIN_RATE_LIMIT_SECRET` above.

---

# Blessing Boxes — activity log (slice 3)

Full design: `atlas-kb/projects/Pueblo Food Map/Blessing Boxes Build Plan.md`
and `...Blessing Boxes Epic - Discovery.md` (stories D1-D3). This section
covers what slice 3 (the activity log) actually shipped, on top of slice
1's box identity and slice 2's check-ins/status work above.

**`migrations/0008_box_events.sql`** adds one table, `box_events` — `id`
(autoincrement PK), `venue_id`, `kind` (CHECK IN
`'added'|'moved'|'renamed'|'paused'|'removed'`), `detail` (nullable free
text, e.g. `"Old Name → New Name"`), `created_at`. Two indexes:
`(venue_id, created_at)` for the per-box embed (below) and `(created_at)`
alone for the global feed's cross-venue ordering. Applied to **staging and
local dev only, 2026-09-17** — same "production is a later, explicit,
Kyle-gated step" convention as 0005-0007 (see the updated promotion
checklist above, now covering four migrations through 0008).

**A missing `0008` is a split picture, not uniformly graceful — 2026-09-17
review correction to an overclaim this section previously made.** It used
to say a missing `box_events` table "degrades gracefully, not a full
outage." That is true for the READ path only: `box_events` is read only by
`boxActivity.ts`'s UNION ALL query (below), wrapped in the SAME best-effort
try/catch `blessing-boxes/route.ts` established for the box list
(`loadActivityBestEffort()`), so a missing table degrades the activity page
and the per-box embed to their empty states, not a 404 or a blank map — the
box list/detail endpoints slice 2's checklist warns about are untouched by
this slice. **It is FALSE for the WRITE path.** `INSERT INTO box_events`
rides the SAME atomic `db.batch()` as the venue write + its `audit_log` row
(next paragraph) — D1's `batch()` is all-or-nothing, so on an environment
without migration `0008`, that INSERT throws a missing-table error and the
ENTIRE batch rolls back: every admin create or edit of a blessing-box venue
fails outright, not just its activity-log row. `0008` is therefore
**mandatory before promotion, same as `0005`-`0007`**, not an optional
nicety just because its read side degrades gracefully — see the updated
promotion checklist above, which already lists it as required for exactly
this reason.

**Events are written from the existing admin mutation routes, riding the
SAME atomic `db.batch()` as the venue write + its `audit_log` row — never a
separate write.** `src/lib/boxEvents.ts` is pure decision logic, no D1
calls of its own:

- `boxEventsForCreate()` — `POST /api/admin/venues`
  (`src/app/api/admin/venues/route.ts`): a NEW blessing-box venue writes one
  `added` event. A non-box create writes none.
- `computeBoxEventWrites()` — `PATCH /api/admin/venues/[id]`
  (`src/app/api/admin/venues/[id]/route.ts`): compares the row as it was
  fetched pre-edit against the submitted fields and can emit
  `renamed` (name changed), `moved` (address changed — both can fire on the
  same edit), and `removed` (the box's `removed_on` field transitions from
  unset to set). Becoming a box for the first time on an edit (was a plain
  pantry, now `category='blessing_box'`) writes `added`, short-circuiting
  the rename/move/removed comparisons entirely — there's no "old box state"
  to diff against. **Leaving box-hood** (was a box, edited to a different
  category) writes NOTHING — seeded here, see the paused/archive note
  below.
- **`paused` is defined in the CHECK constraint but never written by
  anything in this slice** — reserved for a future "pause without
  archiving" admin control (see slice 2's own note above: no such control
  exists yet, `removed_on` is the only way a box currently reads
  `out_of_service`). Listed in `ACTIVITY_KINDS`/the kind filter dropdown
  now so that control can start writing it later with zero read-path
  changes.
- **Archiving a box (`POST /api/admin/venues/[id]/archive`) writes NO
  event, and this is deliberate, not an oversight.** `boxActivity.ts`'s
  read-side JOIN filters `v.status != 'archived'` on every row (a
  self-defeat problem — visibility logic that says "hide anything on an
  archived venue," the same JOIN condition slice 2's own live-box queries
  already use). Writing a `removed`-shaped event at archive time would
  therefore immediately become invisible to every reader the moment it's
  written — the exact rows a "this box is gone" event exists to surface
  would be the ones structurally excluded from ever showing it. The
  `removed_on` field (slice 1/2, distinct from archiving) is the correct
  and reachable "this box is out of service but still visible on the map"
  signal, and IS covered by the `removed` event above. Symmetric case,
  same reasoning: leaving box-hood via a category-changing edit also skips
  the venue-JOIN filter the same way, so it also writes nothing.

**Read path — `src/lib/boxActivity.ts`, a `UNION ALL` merge of
`box_checkins` (slice 2) and `box_events` (this slice), not two separate
queries and not a new dedicated table duplicating either.** Each half is
independently filtered (checkins: `visibility='visible' AND kind !=
'problem'` — a problem report is never public, same structural guarantee
slice 2 already gives it — via the SQL, not just app code; events: no
extra filter beyond the venue JOIN) and both are JOINed against `venues ON
v.category = 'blessing_box' AND v.status != 'archived'`, so archived boxes
and non-box venues can never surface here regardless of table. Ordered
`ORDER BY created_at DESC, source DESC, row_id DESC` — the `source`/
`row_id` tiebreakers make ordering fully deterministic even when two rows
share the same timestamp (checkins and events are independent autoincrement
sequences, so `id` alone can't interleave them). Filters: `venueId`, `kind`
(any value from `ACTIVITY_KINDS`, spanning both checkin and event kinds —
an unrecognized kind matches nothing rather than silently matching
everything), `from`/`to` (UTC calendar-day boundaries — a
`ponytail:` comment on the date-boundary helpers names the known Mountain
Time skew this introduces near midnight as the accepted ceiling, with "read
the filter's date range in the visitor's own timezone" as the upgrade
path), and pagination (`page`/`pageSize`, default 25, fetches `pageSize+1`
rows to compute `hasMore` without a second COUNT query).

**Public route — `GET /api/public/blessing-boxes/activity`**
(`src/app/api/public/blessing-boxes/activity/route.ts`) mirrors slice 1's
list endpoint exactly: `getCloudflareContext()` direct D1 read (never
`getAdminDb()` — this is a public route), 60s Cloudflare edge cache via the
Workers Cache API, and a best-effort try/catch degrading to `{items: [],
hasMore: false, page: 1}` on any D1 failure (missing table, outage, or
otherwise) rather than a 500.

**`/boxes/activity`** (`src/app/boxes/activity/page.tsx` +
`BoxesActivityContent.tsx`) — the public global feed (Discovery D1/D2).
Static English-metadata server shell wrapping a client component (same
`buildPageMetadata` split every other page in "Discoverability / SEO"
above uses) inside a `<Suspense>` boundary — required because the content
component reads the initial `?box=<id>` query param via
`useSearchParams()`. Filter controls (box, kind, from, to — real
`<label htmlFor>` on every one, not placeholder-only) are plain local React
state, **not synced back to the URL as they change** — a deliberate slice-3
scope cut (see "Open questions for Kyle" below). Pagination is Prev/Next
(not "Load more" — avoids needing an accumulated-items state) via
`useBoxActivity.ts`, a client fetch hook mirroring `useBoxVenues.ts`'s
established `useEffect`+`fetch`+`cancelled`-flag+empty-state-fallback
shape.

**Per-box embed (Discovery D3)** — `BoxContent.tsx` (slice 1/2) gained a
"Recent activity" section below the check-in panel, reusing the exact same
`BoxActivityList` rendering component the global feed uses
(`showVenueName={false}` — the box's own name is already the page's `<h1>`,
so the shared component substitutes "This box" instead of repeating it),
filtered to `{ venueId: box.id, pageSize: 5 }`, with a "See full activity"
link to `/boxes/activity?box=<id>` — the one URL param the global feed DOES
read (once, on initial load only, per the scope cut above).

**Nav entry.** `HamburgerMenu.tsx` gained one more top-menu item ("Box
activity" / `nav.boxActivity`), linking to `/boxes/activity`, inserted
between the existing "Browse all venues" and "Food help programs" items,
same `HamburgerMenuItem` pattern as every other internal link in that list
— judged mechanical (an ordinary list insertion, not a new layout or visual
decision) rather than a design question needing Kyle's sign-off.

**Deliberately NOT built in this slice** (out of the acceptance criteria,
so a later slice doesn't assume otherwise): photos, adopt-a-box, alerts,
stats/numbers, QR, closest-box, and D4's weekly summary digest — per the
task's own explicit exclusion list.

**Open questions for Kyle** (flagged in the PR body, not guessed at):
whether the global feed's filters should round-trip into the URL (so a
filtered view is shareable/bookmarkable) — this slice deliberately cut that
to plain local state for a simpler build; and whether an admin "pause
without archiving" control (writing `paused`, wiring `removed_on` outside
an edit) is worth building now that the kind exists in the schema and the
filter UI.

---

# Blessing Boxes — directory page, closest-to-me, map entry point (slice 4)

**SUPERSEDED by the map-first rework (2026-09-18) — see that section, far
below, for what actually ships today.** The `/boxes` directory page this
section describes was REMOVED entirely (map + category filter + List view
replaces it — "closest to me" now lives in `useMapFilters`' existing
distance sort, applied to boxes the same as every other venue). The B4
map-entry-point A/B scaffolding below (`boxEntryVariant.ts`,
`BlessingBoxesMapButton.tsx`, `showBoxesItem`) was deleted outright — Kyle's
answer to "which entry point" turned out to be neither candidate: the
existing category filter chip is the entry point, no new nav item or
floating button. Kept below as the historical record of what slice 4
originally shipped and why; none of the file paths or components it names
still exist.

Full design: `atlas-kb/projects/Pueblo Food Map/Blessing Boxes Build Plan.md`
and `...Blessing Boxes Epic - Discovery.md` (stories B2-B6). This section
covers what slice 4 shipped, on top of slices 1-3 above. **No new
migration** — this slice is read-side UI only, built entirely on the
`statusSince` field (below) and the public box shape slices 1-3 already
expose.

**`statusSince` — a new field on `PublicBlessingBox.box`, computed by
`computeStatusSince()` (`src/lib/blessingBoxes.ts`), mirroring
`computeBoxStatus()`'s own status-setting-check-in search but returning the
TIMESTAMP instead of the mapped status string.** Exists because "needs
filling most" (next paragraph) has to rank *within* the empty/low group by
how long a box has sat in that state, which `lastFilledAt` can't answer —
a box last filled three months ago and one last filled yesterday can both
currently read `empty`, and only `statusSince` distinguishes "just went
empty" from "been empty a while." `null` for `out_of_service` or a box with
no status-setting signal at all, same "no signal" convention
`lastFilledAt`/`computeBoxStatus()` already use.

**Two pure comparators, also in `blessingBoxes.ts`, fully unit-tested
(ties, nulls, determinism) in `blessingBoxes.test.ts`:**

- `compareBoxesByNeedsFillingMost()` — the default `/boxes` sort. Ranks by
  status group first (`empty` → `low` → `unknown` → `stocked` →
  `out_of_service`, `NEEDS_FILLING_RANK`), then within `empty`/`low` breaks
  ties on `statusSince` ascending (older = more urgent; a missing
  `statusSince` sorts as MOST urgent, `""` treated as earliest), then
  within `unknown`/`stocked` breaks ties on `lastFilledAt` ascending (same
  null-sorts-first-as-most-urgent treatment), then falls back to
  `name.localeCompare` then `id.localeCompare` for full determinism (a
  stable sort still needs a real tiebreak once two boxes share every other
  field — two `Array.prototype.sort` calls on the same input can otherwise
  reorder ties differently across engines).
- `compareBoxesByRecentlyFilled()` — `lastFilledAt` descending, but a null
  sorts LAST here (the opposite end from the same field's treatment in the
  needs-filling comparator above — "recently filled" and "needs filling"
  are asking opposite questions about the same missing data: never-filled
  is the LEAST recent, not the most urgent, in this ordering). Same
  name/id tiebreak.

**`STATUS_BADGE_CLASS`** (the Tailwind class map behind each status badge)
moved from a private const in `BoxContent.tsx` into `blessingBoxes.ts` and
is now exported — both `BoxContent.tsx` (the per-box page) and
`BoxesDirectoryContent.tsx` (this slice's directory page) render the same
badge styling from one place instead of a second copy drifting from the
first.

**`/boxes`** (`src/app/boxes/page.tsx` + `BoxesDirectoryContent.tsx`, the
server-shell/client-content split every other directory page in this repo
uses — see `/venues` and `/boxes/activity` above) — lists every live box
(`useBoxesList()`, the full-`PublicBlessingBox`-shape sibling of
`useBoxVenues.ts`; that existing hook only returns the map's lighter marker
shape, so a second hook was added rather than widening the first and
forcing every map render to carry fields it never uses) fetched from the
SAME `GET /api/public/blessing-boxes` slice 1 already ships (no new route,
no new cache).

- **Sort control** (`<select>`, real `<label htmlFor>`, not icon-only) —
  three options: `needsFilling` (default, B6), `closest` (B2), and
  `recentlyFilled`.
- **B3 "prefer boxes not reported empty"** — one labeled checkbox
  ("Hide boxes reported empty"), not a filter panel, per the task's own
  instruction. Filters the empty-status boxes out of the list entirely
  when checked; combines with any sort.
- **B2 "closest to me," one tap, no location required to use the page** —
  picking `closest` in the sort `<select>` IS the one tap: it calls
  `useGeolocation()`'s `request()` right there (no separate button).
  Distance is `haversineMiles()` (straight-line, `src/lib/distance.ts`,
  already documented in that file as NOT a walking route) computed
  entirely client-side against the already-fetched box array — **the fetch
  to `/api/public/blessing-boxes` carries no query string, body, or header
  derived from the visitor's coordinates, ever; the position is read only
  to sort the array already in memory.** Regression-guarded in
  `BoxesDirectoryContent.test.tsx` ("the visitor's coordinates never
  appear in the outbound fetch"): asserts the fetch is called exactly
  once, with no `init` argument and no lat/lng/latitude/longitude
  substring in the URL. Without location (denied, not yet granted, or
  unavailable), the page falls straight back to the default needs-filling
  order with an honest inline message — never a blank or broken page; the
  task's own "must work without location too... or just the full list"
  requirement is met by the simpler of two valid readings (full-list
  fallback) rather than building address/neighborhood-entry geocoding
  infrastructure this repo has no existing public-facing capability for
  (flagged as a scope decision in the PR, not assumed).
- **B6 most-needed** — surfaced on every row that has one (`box.mostNeeded`,
  already public since slice 1), same field `BoxContent.tsx`'s own page
  already shows.
- **A11y** — the sort control and the checkbox both carry real
  `<label>`/accessible-name text; the ONE `aria-live="polite"` region is a
  single result-count status line (`"N boxes"`), never the list itself —
  same "narrow the live region" convention `BoxesActivityContent.tsx`
  (slice 3) already established, so a filter/sort change announces a count
  instead of re-reading 30+ rows to a screen-reader user.
- **Registered in `src/app/sitemap.ts`** at priority 0.7 / hourly — shares
  `/venues`' priority tier as a real browse/discovery page, not
  `/boxes/activity`'s lower watcher-tier 0.5.

**B4 — the map entry point is a REAL, undecided design choice, so both
candidates are built and live behind one query-param switch rather than
either being picked unilaterally:**

- **No `?boxEntry=` param is a NEUTRAL, third state — not an alias for
  either candidate.** `resolveBoxEntryVariant()` (`src/lib/boxEntryVariant.ts`,
  a small pure module with no map-related imports, extracted specifically
  so it's unit-testable — see the next bullet) maps the query string to
  `"nav" | "map" | null`; an absent or unrecognized `boxEntry` value
  resolves to `null`, which renders NEITHER candidate — today's exact
  4-item `BottomNav` and no floating button. **This corrects a real bug
  found in review on PR #473:** the first version of this switch defaulted
  the no-param case to `"nav"`, so every ordinary visitor with no
  `?boxEntry=` at all silently got the 5-item bar — the opposite of
  opt-in, and a silent override of the finalized 4-item design below.
  `MapWrapper.tsx` reads this ONCE via a lazy `useState` initializer over
  `window.location.search` — safe only because `MapWrapper` is always
  dynamically imported with `ssr: false` (confirmed via
  `HomePageClient.tsx`) and therefore never renders server-side, so there
  is no server/client markup mismatch to worry about from reading
  `window` directly.
- **Candidate "nav"** (`?boxEntry=nav`, explicit opt-in only) —
  `BottomNav.tsx` gained a 5th, OPT-IN item (`showBoxesItem` prop, default
  `false`) linking to `/boxes`. Default `false` is load-bearing: `BottomNav`
  is documented elsewhere in this file as a finalized 4-item design (Near
  me/Saved/Resources/Menu, Kyle 2026-09-16) — this slice does not silently
  grow it; the item only appears when `MapWrapper` explicitly resolves to
  `"nav"`. Regression-guarded in `BottomNav.test.tsx`: the default renders
  exactly 4 items with no "Boxes" text; `showBoxesItem: true` renders 5, in
  order, with a visible (non-sr-only) label.
- **Candidate "map"** (`?boxEntry=map`, explicit opt-in only) —
  `BlessingBoxesMapButton.tsx`, a new floating pill button (bottom-right,
  above `BottomNav`'s own height via the shared `BOTTOM_NAV_HEIGHT_PX`
  constant, `--color-cat-blessing` raspberry fill per DESIGN.md's existing
  category-color token, `--radius-full`, the shared `PRESS_FEEDBACK`
  interaction class) linking to `/boxes`. No new dependency — reuses
  existing tokens/classes exactly as DESIGN.md prescribes.
- **Preview URLs for Kyle to compare** (dev, once merged and deployed):
  `https://dev.pueblofoodmap.com/?boxEntry=nav` (bottom-nav candidate) and
  `https://dev.pueblofoodmap.com/?boxEntry=map` (floating map-button
  candidate). `https://dev.pueblofoodmap.com/` with NO param shows neither
  — today's unmodified 4-item bar.
- **`boxEntryVariant.test.ts` is the MapWrapper-level regression coverage**
  the fix above needs: no param -> `null`, `?boxEntry=nav` -> `"nav"`,
  `?boxEntry=map` -> `"map"`, an unrecognized value -> `null`. This repo has
  no `MapWrapper.test.tsx` harness anywhere (Mapbox's WebGL canvas
  requirement makes it untestable in jsdom, same limitation this file's own
  "Map library" section at the top documents), so the resolver was
  extracted into its own map-import-free module precisely so the
  param-to-variant mapping — the actual bug's location — has a real,
  headless test rather than only each CANDIDATE component being tested in
  isolation (`BottomNav.test.tsx`'s own describe block,
  `BlessingBoxesMapButton.test.tsx`).
- **All of this — `boxEntryVariant.ts`, `BlessingBoxesMapButton.tsx`,
  `MapWrapper.tsx`'s `boxEntryVariant` state, and `BottomNav.tsx`'s
  `showBoxesItem` prop — is TEMPORARY scaffolding for Kyle's B4 choice, not
  a permanent feature flag.** It MUST be deleted and collapsed to whichever
  single placement he picks BEFORE this feature is ever promoted to `main`.
  **Done, 2026-09-18 — all of it deleted, see the map-first rework section
  below for what replaced it.**

**Deliberately NOT built in this slice** (out of the acceptance criteria,
per the task's own explicit exclusion list, so a later slice doesn't
assume otherwise): photos, adopt-a-box, alerts, stats/numbers, QR
stickers, accounts.

---

# Blessing Boxes — map-first card rework (2026-09-18)

Kyle, 2026-09-18: "I really wanted all of the interaction to still happen
on the map... when you click on a blessing box icon, I don't want it to
take you to a page. I want it to just happen on the map: check in, submit
a picture, all that stuff... like a venue card, not take you to a
different page." Same day, a scope addition: the card shows only the
CURRENT snapshot (latest check-in, not a list), with a "History" link to a
separate full-timeline page. Supersedes slice 1's box-click routing and
all of slice 4's `/boxes` directory + B4 entry-point scaffolding above —
both sections are kept only as historical record; this section is the
current, accurate description.

**Entry point — the existing category filter chip, nothing new.** No 5th
`BottomNav` item, no floating map button. Toggle the blessing-box category
(search-focus dropdown or the filter chip) the same way as any other
category; `useMapFilters`' existing distance sort (already nearest-first by
default) covers "closest box to me" for free once boxes are in the merged
venue list — no new sort logic was needed. `BottomNav.tsx`'s `showBoxesItem`/
`onBoxesPage` props, `src/lib/boxEntryVariant.ts`, and
`BlessingBoxesMapButton.tsx` are all DELETED, along with their tests —
`BottomNav` is back to exactly 4 items (Near me/Saved/Resources/Menu),
unconditionally.

**Tapping a box pin (or picking one from search results / List view) opens
the SAME card every other venue uses** — `BottomSheet` (mobile) /
`DesktopVenueWindow` (desktop) — never a separate page. Both components
gained an `isBox = venue?.category === "blessing_box"` branch: the
hours-today badge, the venue notes paragraph, and (desktop/expanded-only)
the address/hours-table/phone/SNAP-WIC/Plentiful-link/report-venue section
are all skipped for a box (none apply); `ShareButton`'s share link becomes
`/box/<id>` instead of `/venue/<id>` (a box id was never in `/venue/[id]`'s
static `generateStaticParams` set — see `share.ts`'s own header). In their
place, `BoxCardBody.tsx` (new) renders the box-specific content: status +
last filled, the single most recent check-in, most-needed, the check-in
panel (all five choices), the host's note, and the History link — see the
scope-addition paragraph below for why it's one check-in, not a list.
**SUPERSEDED by the card-polish follow-up (2026-09-18b, below): `BoxCardBody`
no longer has an expanded/collapsed split at all** — the "expanded/mobile
only" gating on the host note and History link described here, and the
`boxCollapsedBody`/`boxExpandedBody`/`showExpandedDetails` mechanics in the
next sentence, are historical record only. See that section for the current,
accurate description. Name/address-row/category-badge/directions stay owned
by the caller (the
same header every other venue card renders) — `BoxCardBody` starts below
that. `DesktopVenueWindow`'s Escape-key handler also gained a guard: Escape
no longer closes the whole window while focus is inside an `<input>`/
`<textarea>` in it (the check-in panel's note field), matching normal
browser expectations instead of losing an in-progress note.

**Scope addition (Kyle, same day, sent mid-build): the card shows ONLY the
current snapshot, never a list.** `BoxCardBody` renders
`box.box.recentCheckins[0]` — one line ("Filled · 2 hours ago"), not
`BoxActivityList`. `BoxCheckinPanel`'s `onCheckinSuccess` payload gained a
`kind` field (the POST response never echoed back which kind was just
submitted, and the card needs it to update that one line without a
refetch). Two bounded extension points sit in `BoxCardBody`, deliberately
rendering NOTHING today (no placeholder image, no "coming soon" text) until
their data exists: a most-recent-**photo** slot (slice 5, `box_photos`) and
a current-**sponsor** ("Cared for by…") slot (slice 6, `box_adopters`).

**"History" link → `/box/<id>/history` (new page, `BoxHistoryContent.tsx`).**
Full chronological check-in + lifecycle log for ONE box, newest first,
paginated — reuses `useBoxActivity`/`BoxActivityList` filtered to
`venueId`, the exact same slice-3 read path `/boxes/activity` uses (not a
second query), so it inherits the same structural privacy guarantee
(`problem` reports and hidden check-ins excluded at the SQL level — see
"Blessing Boxes — activity log (slice 3)" above). A "Back to the map" link
returns to `/?venue=<id>` directly (not `/box/<id>`, to skip that route's
own redirect hop). `/boxes/activity` (the town-wide log) is unchanged.

**`/box/[id]` is no longer a destination page — it redirects to the map.**
`BoxRedirectClient.tsx` (new): the page's `generateMetadata` is UNCHANGED
(still reads the box from D1 server-side, still emits box-specific
title/description/OG tags — a shared link's preview still works), but the
page body is now a small Client Component that calls
`router.replace('/?venue=<id>')` on mount, showing "<box name> — Loading…"
during the brief flash (and as the permanent state for a JS-disabled
visitor, who is never redirected). Rendering server-side metadata then
client-redirecting — rather than a server `redirect()` — is deliberate: a
server redirect would skip rendering the page (and its `<head>`) entirely
for a non-JS crawler, defeating the point of keeping `generateMetadata`.
The Routt St box's `next.config.ts` legacy redirect
(`/venue/<Routt-id>` → …) now points straight at `/?venue=<Routt-id>`
instead of `/box/<Routt-id>`, skipping the extra hop for that one link — a
plain query string on a redirect DESTINATION is fine (only a `has` query
MATCHER on the SOURCE ever broke on this stack, see that file's own
header).

**Deep links (`MapWrapper.tsx`'s two `?venue=<id>`-reading effects).** The
map-ready effect no longer existence-checks `initialVenueId` against
`allVenues` before selecting it — a box's data arrives async from
`useBoxesList`, so a check at that exact instant could reject a valid box
id before its own fetch resolves; `selectedVenue`/`getBoxById` both already
return null/undefined gracefully for an unresolved id, and `Map.tsx`'s
flyTo effect re-fires once `venues`/the live box list populate (a new array
reference), so there was nothing for the check to protect against. The
`mapUnavailable` variant (map can't mount at all) still needs an explicit
destination since there's no card to open there: a box id now routes to
`/box/<id>/history` (the one still-standalone page a box has), a plain
venue id to `/venue/<id>` as before. The same box-vs-venue split was
applied to `handleSelectSavedVenue`/`handleSelectVenueFromPopover`/
`handleSelectFromList`'s own `mapUnavailable` branches. `handleSelectVenueFromMap`
(the plain map-pin tap) correctly has no such branch — Map.tsx never renders
while `mapUnavailable`, so there are no pins to tap in the first place, a
genuinely unreachable path. `handleSearchKeyDown`'s Enter branch is
different and was fixed (2026-09-18, PR review) to match the other three:
SearchBar itself renders unconditionally regardless of `mapUnavailable` (see
its render call in MapWrapper.tsx), so Enter on a box result stayed
reachable — and without the branch it silently did nothing, since
`showVenueOnMap()` no-ops while `mapUnavailable` (useMapUI.ts) and both card
components only render when `viewMode === "map"`. It now carries the same
box-vs-venue `router.push` the other three use.

**MapWrapper's box data — one fetch, not two.** `useBoxesList()` (the FULL
`PublicBlessingBox[]` shape, slice 4's own hook) replaces `useBoxVenues()`
in `MapWrapper.tsx`; `boxVenues` (the plain-`Venue[]` shape the
filter/marker pipeline needs) is now derived locally via
`useBoxVenues.ts`'s now-exported `toVenue()` mapper, so the SAME
`GET /api/public/blessing-boxes` response feeds both the pin/filter
pipeline AND the open card's full record — `useBoxVenues()` itself is
unchanged and still used elsewhere (`BoxesActivityContent.tsx`'s box
filter dropdown). `boxesById` (a `Map<string, PublicBlessingBox>`) plus a
`boxOverrides` state layer (patched by `handleBoxCheckinSuccess` on a
successful check-in — status/lastFilledAt/a prepended, 5-capped
`recentCheckins` entry) are what `getBoxById(selectedVenueId)` reads,
passed to both `BottomSheet`/`DesktopVenueWindow` as their new `box` prop
— this is what lets the open card update instantly on check-in without a
refetch, the same freshness story slice 2's `BoxContent` used to provide
for the old standalone page.

**Category autozoom now includes boxes.** The blessing-box category chip
used to compute `fitBounds` over `allVenues` alone — since boxes never
live in that static, build-time snapshot (they're a live D1 layer, see
"Blessing Boxes — live box layer" above), selecting that chip fit an empty
array and never zoomed at all. Both the "clear filter" and "single category
selected" branches of that effect now compute bounds over
`[...allVenues, ...boxVenues]`, and `boxVenues` was added to the effect's
own dependency array so a chip activated before the async box fetch
resolves still zooms once it does. The Walk-resume effect (`#207`,
resuming a walking-direction request after a geolocation prompt resolves)
picks the target venue from `allVenues` OR `boxVenues` for the same
reason — a box card now shares `DirectionButtons`/Walk with every other
venue.

**Sitemap / metadata — unchanged, and still accurate.** `sitemap.ts` still
lists every live `/box/<id>` URL (daily, priority 0.6) — that route still
resolves (to the redirect-with-metadata page above), so the entry stays
correct. `/box/<id>/history` is NOT added to the sitemap — it's a
secondary, deep page (analogous to `/boxes/activity`, which is also
unlisted) rather than a primary discovery surface.

**Tests.** `BoxCardBody.test.tsx` (new) covers the one-recent-check-in
render (not a list), the History link's href, and conditional sections.
`BottomSheet.test.tsx`/`DesktopVenueWindow.test.tsx` cover the `isBox`
branch rendering `BoxCardBody` and skipping the venue-only sections.
`BoxHistoryContent`/the history route's tests confirm `problem`/hidden
check-ins never surface (inherited structurally from `useBoxActivity`'s
existing SQL-level guarantee — no new filtering to test). `MapWrapper` has
no test harness at all (WebGL/jsdom — see "Map library" at the top of this
file), so the deleted `boxEntryVariant.test.ts`/`BlessingBoxesMapButton.test.tsx`
have no direct replacement; the box-vs-venue selection logic itself no
longer needs one, since it no longer branches to a different destination
on an ordinary map tap.

**Review fixes (2026-09-18, same PR).** A ship-it review of the above found
four real gaps, all fixed on top of it:

- **No-WebGL check-in gap (real regression).** `BoxHistoryContent.tsx` now
  also renders `BoxCardBody` (status, check-in panel, host note) above the
  history list, seeded from the full `PublicBlessingBox` the route's
  `page.tsx` already loads for `generateMetadata` — not just `{boxId,
  boxName}` as before. A `mapUnavailable` visitor is routed straight to this
  page with no other way to open a card, so without this the check-in panel
  (and the map card's whole snapshot) was simply unreachable on that device
  — a real loss versus the pre-rework standalone `/box/<id>` page. Local
  `liveBox` state mirrors `MapWrapper.tsx`'s own `handleBoxCheckinSuccess`
  patch (same 'problem'-skip, same 5-item cap) so a check-in here updates
  the badge/last-filled/recent-check-in line instantly, no refetch.
- **Desktop check-in note used to be lost on toggle.** `DesktopVenueWindow.tsx`'s
  box body was two separate JSX trees (`boxCollapsedBody`/`boxExpandedBody`),
  each with its own `<BoxCardBody>`, swapped by the `expanded` ternary — so
  `BoxCheckinPanel`'s in-progress note textarea remounted (and its typed text
  vanished) every time the header's Show/Hide details toggle fired. Replaced
  with one `boxBody` at a stable tree position (only its wrapper class and
  `BoxCardBody`'s `showExpandedDetails` prop vary with `expanded`); the
  ordinary-venue `collapsedBody`/`expandedBody` pair is untouched — those
  genuinely render different sections per state, so unifying them would be a
  much larger change than this box-only fix.
- **Search-Enter on a box while mapUnavailable used to do nothing.** Unlike
  a map-pin tap (no pins exist to tap when `Map.tsx` never renders —
  correctly branch-free), `SearchBar` itself renders unconditionally, so
  pressing Enter on a box result stayed reachable when the map can't mount —
  but `showVenueOnMap()` no-ops in that state and neither card component
  renders outside `viewMode === "map"`, so the keystroke silently did
  nothing. `handleSearchKeyDown`'s Enter branch now carries the same
  box-vs-venue `router.push` the other three selection handlers already use.
- **No-JS visitor stuck on "Loading…" forever.** `/box/[id]`'s redirect
  (`BoxRedirectClient.tsx`) depends on a `useEffect` that never runs without
  JS. It now also renders a plain `<Link>` (a real `<a href>`, works with JS
  off) to the same `/?venue=<id>` destination.
- Also corrected: the `boxOverrides` comment in `MapWrapper.tsx` had the
  override-precedence and refetch claims backwards (`getBoxById` checks the
  override FIRST, and `useBoxesList()` never refetches at all — it fetches
  once on mount, so nothing today ever clears a stale override).

# Blessing Boxes — card polish (2026-09-18b)

Dev-tested by Kyle same day: "When I click show details, nothing shows up"
(the box collapsed/expanded split gated the host note and History link
behind a toggle whose only visible effect on most boxes — no host note set
— was nothing) and "Do we need to show the Cloudflare check?" (Turnstile's
default `appearance: "always"` showed its widget and a "Verifying…" line
under the check-in buttons even on the common pass-through case). Both
fixed; supersedes the "expanded/mobile only" / `showExpandedDetails`
mechanics described in the map-first rework section above.

**`BoxCardBody` has no expand/collapse state at all now.** The
`showExpandedDetails` prop is gone. Status, the most-recent check-in,
most-needed, the host's note (when set), and the check-in panel all render
unconditionally — a box card was already short enough post-rework (no
activity list) that there was nothing left to hide behind a toggle. A new
`showHistoryLink` prop (default `true`) replaces it, but only to suppress
the in-body History link where a caller already renders an equivalent one
elsewhere — DesktopVenueWindow's header (below) and the history page itself
(BoxHistoryContent, self-linking a page to itself is dead weight). The
History link itself moved near the TOP of the card (right under the status
row), not after the check-in panel, so it's reachable without scrolling
past five buttons and a note form — mobile's version of "not buried at the
bottom."

**DesktopVenueWindow: no Show/Hide details toggle for a box either.**
`VenuePopupHeader` gained an optional `historyHref` prop — when set, it
renders a "History" link in the toggle's own order-1 slot (same classes,
same visual weight/position) instead of the Show/Hide button;
`expanded`/`onToggle` are simply unused in that branch. A box's window also
always sizes like an ordinary venue's *expanded* state
(`WINDOW_EXPANDED_W`/`_H`) regardless of the `expanded` prop, since there's
no more collapsed box body to size for — `boxBody` is one scrollable tree at
a stable position, same "no remount, note survives" guarantee the map-first
rework already built, just without the `expanded`-conditioned class swap.

**Turnstile now renders `appearance: "interaction-only"`** in
`BoxCheckinPanel.tsx` (confirmed against Cloudflare's Turnstile
render-options docs: valid values are `always` / `execute` /
`interaction-only`) — the widget stays invisible unless Cloudflare decides a
real interactive challenge is needed; the site key, and the other three
forms that still use the default `always` appearance (ReportForm,
SuggestForm, FeedbackForm), are untouched. `src/types/turnstile.d.ts` (the
one shared `window.turnstile` declaration all four forms import) gained the
`appearance` option to type it.

**SUPERSEDED (2026-09-18, same day, real-phone regression): a managed-mode
key still shows its checkbox on a real device even under
`appearance: "interaction-only"`.** `interaction-only` only suppresses the
widget's OWN chrome — it doesn't change which Cloudflare **widget mode**
the site key was provisioned in, and the check-in key had stayed a managed
(checkbox-capable) key throughout the paragraph above. Fixed by
provisioning a SECOND, dedicated Turnstile site key
(`NEXT_PUBLIC_TURNSTILE_BOX_SITE_KEY`) in Cloudflare's own **invisible**
widget mode — a mode that structurally never renders a checkbox, so
`appearance` no longer matters and is dropped from the render call.
Check-ins only; every other public form (ReportForm, SuggestForm,
FeedbackForm) keeps the original managed-mode `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
unchanged. The matching server-side secret is also now its own dedicated
`TURNSTILE_BOX_SECRET_KEY` (not `TURNSTILE_SECRET_KEY`) — same "a rotation
of one must never silently affect the other" reasoning already applied to
`CHECKIN_RATE_LIMIT_SECRET` above. See the "Blessing boxes — promotion
checklist" above for the required production secret.

Check-in buttons are no longer gated on `turnstileToken` existing — they're
tappable immediately, disabled only while an actual submit is in flight or
one is queued. A tap before the invisible check resolves is queued
(`pendingSubmit` state) rather than dropped or submitted with an empty
token; an effect fires the queued submit the instant `turnstileToken`
arrives (first mount, or after `expired-callback` clears a stale token and
hands back a fresh one — token expiry was already wired, nothing new
needed there). The tapped button shows the same "Sending…" label a real
in-flight submit uses while it waits — no separate "Verifying…" line, which
is deleted along with the `!turnstileToken` render branch that produced it.

**Fallback to a visible checkbox when the invisible check doubts a visitor
(2026-09-18, later same day).** The invisible box widget's own
`error-callback` used to leave a visitor with no way through at all — a red
"please retry" error that just re-ran the same check and failed the same
way again. `BoxCheckinPanel.tsx` now swaps in a SECOND widget, rendered
into the same container, using the ordinary managed
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` every other public form already uses
(default visible "Verify you are human" checkbox) — the swap also triggers
if the invisible widget never calls back at all within
`PENDING_SUBMIT_TIMEOUT_MS`. It flips at most once per page view and never
flips back. A tap queued when the invisible check fails is NOT failed — it
stays queued and fires the moment the fallback widget produces a token; the
POST body now carries `turnstileKey: "box" | "fallback"` so the server
knows which secret to verify against. **No new production secret is
needed for this** — the fallback attempt verifies against
`TURNSTILE_SECRET_KEY`, which already exists on both Workers (see
"Resend Email Key Management" → local dev note, and the "Blessing boxes —
promotion checklist" above, whose `TURNSTILE_BOX_SECRET_KEY` line is
unaffected and still required for the invisible-mode default path). Only
if the FALLBACK widget's own `error-callback` fires does the panel fall
through to the pre-existing `failQueuedSubmit` path (red error, note
restored) — see `BoxCheckinPanel.tsx`'s own header, "Fallback to a visible
checkbox," for the full state-machine reasoning.

**`/box/<id>/history` had two "Back to map" links** — `PageNav`'s own
chrome-level link (pointed at the bare `/`) plus `BoxHistoryContent`'s own
inline link (pointed at `/?venue=<id>`, so it reopened the exact box card).
`PageNav` gained an optional `backHref` prop (default `"/"`) so a caller can
point the ONE chrome link at a richer destination instead of duplicating
it — `BoxHistoryContent` now passes `backHref={`/?venue=${liveBox.id}`}` and
its own inline link is deleted. (`SiteFooter`'s separate, site-wide "Back to
map" link — present on every utility page's footer, not specific to this
one — is untouched; it's pre-existing shared chrome, not the page-chrome/
content duplicate this fixes.) The now-unused `box.history.back` i18n key
(EN + ES) was deleted.

---

# Blessing Boxes — photos (slice 5)

Full design: `atlas-kb/projects/Pueblo Food Map/Blessing Boxes Build Plan.md`,
"Slice 5 — Photos." First use of Cloudflare R2 in this repo — every other
binary-ish asset (venue photos never existed; the public form email bodies
are plain text) had no precedent to follow.

**Storage.** Two R2 buckets, bound as `BOX_PHOTOS` in `wrangler.jsonc`:
`pfm-box-photos` (production, top-level binding) and `pfm-box-photos-staging`
(`env.staging`, never the production bucket — same "dedicated, never shared"
convention as every other per-env resource in this repo). Object key shape:
`box-photos/<venueId>/<uuid>.jpg`. D1 holds metadata only, never the bytes —
`migrations/0009_box_photos.sql` (see its own header for the full column
rationale) adds `box_photos` (`status` CHECK `pending|approved|rejected|
flagged`, `flag_count`, `width`/`height`/`bytes` read from the JPEG itself
server-side, `checkin_id` nullable — set only when a photo rides a "filled"
check-in). **Applied to staging and local dev only, 2026-09-18 — production
is the usual later, explicit, Kyle-gated step; see the updated promotion
checklist below, now covering FIVE migrations.**

**Upload — `POST /api/public/blessing-boxes/[id]/photos`** (same file also
serves the approved-photo list, `GET`, below). Same guard order as every
other public write in this app: Content-Type/size pre-gate → honeypot →
Turnstile (reused from `src/lib/boxTurnstile.ts` — the SAME dedicated
invisible-mode box key + managed-mode fallback check-ins already use, not a
third key) → two D1-shared-counter rate-limit scopes
(`photo-visitor-box`: 3/visitor/box/hour; `photo-box`: 30/box/hour — both via
`checkinRateLimit.ts`, entirely separate budgets from a check-in's own caps
so a burst of one never eats the other's) → JPEG-magic-byte check (never
trusts `Content-Type` alone) → `MAX_PHOTO_BYTES` (2 MB) size gate → EXIF/APPn
strip (`src/lib/jpegSegments.ts`, server-side and authoritative — the client
shrink below already drops EXIF as a side effect of re-encoding, but this
route never assumes that happened) → R2 `put` → `box_photos` INSERT
(`status='pending'`, the column default — nothing in this route can set any
other status). A `checkinId` in the form body is looked up and checked
`venue_id = boxId` before being trusted, so a photo can never attach to
another box's check-in via a tampered id. Best-effort admin alert email
(Resend, same sending-key convention as every other form) on a new upload;
a Resend outage never fails an otherwise-successful upload.

**Client-side shrink — `src/lib/imageResize.ts`.** `shrinkImageToJpeg(file)`
decodes via `createImageBitmap(file, { imageOrientation: "from-image" })`
(EXIF-aware — the orientation is baked into the pixels, not left for a
consumer to reapply), redraws onto a `<canvas>` capped at 1600px on the
longest side, and re-encodes to JPEG at quality ~0.8 via `toBlob()` — the
canvas round-trip drops EXIF as a side effect, but the server strips again
regardless (previous paragraph). `fitWithin(width, height, maxSide)` is a
pure helper extracted specifically so the sizing math is unit-testable
without a real canvas (jsdom has none).

**Upload UI — `BoxCheckinPanel.tsx`.** A 6th grid choice, "Add a photo,"
opens a standalone photo picker (`PhotoPickerField`, shared presentational
component: file input, preview, Remove, disclosure text). A photo can ALSO
ride the existing "filled" note form — `KIND_WITH_PHOTO_ATTACH = "filled"`
only, per the task. Both paths reuse one `usePhotoAttach()` hook (select →
shrink → preview, or a localized error for an unsupported format/processing
failure). **Attaching a photo to a "filled" check-in reuses the SAME,
already-consumed single-use Turnstile token slot via a generalized
`pendingSubmit` queue** — `type: "checkin" | "photo"`, a discriminated union
—  rather than mounting a second widget: Turnstile's default
`execution: "render"` mode means `turnstile.reset()` after the check-in
submit auto-re-executes and eventually calls back with a FRESH token, and
the existing queue/timeout/fallback machinery (`PENDING_SUBMIT_TIMEOUT_MS`,
`switchToFallback()`, `failQueuedSubmit()`) already exists to wait on
exactly that. The standalone "Add a photo" flow posts its own multipart
`FormData` (`photo`, `turnstileToken`, `turnstileKey`, `clientToken`,
optional `checkinId`) via a separate `submitPhoto()` call, independent of
the check-in POST.

**Serving — `GET /api/public/box-photos/[id]`.** APPROVED ONLY, enforced at
the SQL level (`loadApprovedBoxPhotoById`, `src/lib/boxPhotos.ts`) — a
pending/rejected/flagged photo's row, and therefore its R2 bytes, is never
even read. Workers Cache API, `Cache-Control: public, max-age=300` (5
minutes, tightened from 1 hour 2026-09-18 per PR #490 review — not
`immutable` — a photo can be flagged/rejected later and must stop serving
promptly; the approve/reject/flag routes all `bustEdgeCache()` this exact
path, but that purge is per-colo, so the 5-minute TTL is the real cross-colo
bound: a hidden photo can linger up to 5 minutes on another data centre or in
a visitor's own browser cache). A 404 (bad id, no approved row, missing R2
object) is never itself cached.

**Admin preview — `GET /api/admin/box-photos/[id]/preview`.** Same shape as
the public serve route but `getAdminDb()`-gated, ANY status (an admin must
be able to see a still-pending photo to review it) — never cached.

**Admin moderation — `POST /api/admin/box-photos/[id]/approve|reject`.**
Same auth pair as every other admin mutation (`getAdminDb()` then
`requireAdminOrigin()`). Each is one atomic `db.batch()`: `UPDATE box_photos
SET status = ..., reviewed_by, reviewed_at [, review_reason]` +
`audit_log` INSERT (`action='update'`, `entity='box_photo'` — a plain TEXT
column, no schema change needed, same convention slice 2's check-in
visibility route established), then `bustEdgeCache()` on the serve route,
the box's photo-list route, and the box list route (3 paths — a photo's
status can affect the public serve response, the history-page list, AND
the card's `latestPhoto` field). Approving works from EITHER `pending` OR
`flagged` (re-publishing a flagged photo keeps its `flag_count` as history,
never resets it). **Reject writes to D1 first, THEN best-effort deletes the
R2 object — this order is load-bearing and regression-tested**
(`route.test.ts` asserts the call order): if R2 delete ran first and then
the D1 write failed, the row would still read `pending`/`flagged` while its
bytes were already gone, an unrecoverable inconsistency; the reverse order
just leaves an orphaned R2 object on a rare R2 failure, harmless since the
serve route requires an approved D1 row to exist at all.

**Public "report this photo" — `POST /api/public/box-photos/[id]/flag`.**
No Turnstile (a flag has no free-text field for a bot to abuse — the
per-visitor rate limit, 5/hour via the same `checkinRateLimit.ts` module,
`scope: "photo-flag-visitor"`, only checked when a `clientToken` is
present, is the real anti-abuse control here). Looks the photo up via
`loadApprovedBoxPhotoById` (same structural privacy guarantee as the serve
route — a flag request can't be used to probe a non-approved photo's
existence), sets `status='flagged'` and `flag_count = flag_count + 1`
immediately (no admin action needed to hide it), `bustEdgeCache()`s the same
3 paths as approve/reject, and sends a best-effort admin alert email. No
`audit_log` row — a public action, not an admin one; the row's own
`flag_count`/`status` are the record. `ReportPhotoButton.tsx` (shared by the
card slot and the history grid, below) gates the call behind a native
`window.confirm()`.

**Admin review queue — `/admin/box-photos`.** Lists every `pending` +
`flagged` row (`loadReviewQueue`, `src/lib/boxPhotos.ts`), newest first,
mirroring `/admin/submissions`'s Server-Component-auth-gate /
Client-Component-interaction split exactly (`BoxPhotosReviewView.tsx`).
Each card shows the image (via the admin preview route), a "New upload"
(sage) or "Reported (N×)" (clay) badge, Approve, and Reject-with-optional-
reason. `/admin` (`src/app/admin/page.tsx`) gained a "Photo review (N)" nav
link, `N` from `countPendingReview()` — best-effort, degrades to omitting
the count rather than failing the page on a D1 hiccup.

**Public display — the card's most-recent-photo slot.** `BoxCardBody.tsx`'s
photo extension point (previously deliberately empty, see the map-first
rework section above) now renders `box.box.latestPhoto` when set: the image
via the public serve route, a "Shared {relative time}" caption, and
`ReportPhotoButton`. `latestPhoto` is a new field on `PublicBlessingBox.box`
(`src/lib/blessingBoxes.ts`), populated from `loadLatestApprovedPhotosForVenues`
(`src/lib/boxPhotos.ts`) inside the box list/detail loaders — same
best-effort-if-D1-fails posture every other box field already has. Renders
nothing when null (never uploaded, or nothing approved yet) — no
placeholder image, no "coming soon" text, unchanged from the
extension-point convention this slot replaces.

**Public display — the history page's photo grid.** `/box/<id>/history`
(`BoxHistoryContent.tsx`) gained a "Photos" section below the current-
snapshot card: `useBoxPhotos.ts` (new client hook, mirrors `useBoxVenues.ts`'s
fetch-on-mount/best-effort/cancel-flag shape) fetches
`GET /api/public/blessing-boxes/[id]/photos` (already capped server-side at
`MAX_HISTORY_PHOTOS = 24`) and renders it via `BoxPhotoGrid.tsx` — an
8-photo initial view with a "Show more photos" button that reveals the rest
of the already-fetched array (no second fetch, no page param — the route has
none). Each tile carries its own `ReportPhotoButton`. Reuses the exact same
public serve route the card slot uses, never a direct R2 URL.

**`ReportPhotoButton.tsx` — one shared component, not two copies.** Owns
the confirm-then-POST flow for both the card slot and the history grid;
`t("box.photo.reportConfirm"/"reportThanks"/"reportError")` and the
`clientToken` read (`getCheckinClientToken()`, the same opaque
localStorage token the check-in rate limiter already uses — never an IP)
live in exactly one place.

**i18n.** All new `box.photo.*` keys (upload-picker: `addButton`,
`attachLabel`, `chooseLabel`, `disclosure`, `processing`, `processError`,
`unsupportedFormat`, `previewAlt`, `remove`, `send`, `sending`, `success`,
`error`; display: `heading`, `caption`, `altText`, `report`, `reporting`,
`reportConfirm`, `reportThanks`, `reportError`, `morePhotos`, `none`,
`galleryHeading`) carry both EN and ES strings, Spanish marked `// [CHECK]`
per this repo's established unreviewed-translation convention.

**Deliberately NOT built in this slice** (explicitly optional in the task,
"skip if it bloats" — so a later slice doesn't assume otherwise): an inline
photo panel on a box's admin EDIT page (`/admin/venues/[id]/edit`) showing
that box's photos without navigating to the review queue. The review queue
(`/admin/box-photos`) already covers moderation end to end; this would only
have been a convenience shortcut.

**Blessing boxes — promotion checklist, updated.** Run ALL FIVE migrations
now — `0005` through `0008` (see the original checklist above, unchanged)
PLUS **`0009_box_photos.sql`** — against production D1
(`pueblo-food-map-admin`) before promoting `dev` → `main`. Also confirm the
production Worker's `BOX_PHOTOS` R2 binding points at the **production**
`pfm-box-photos` bucket (already declared at the top level of
`wrangler.jsonc`, not `env.staging` — nothing further to wire, but verify
against the live deploy rather than assuming). **No new Turnstile or
rate-limit secret is required** — photo upload/flag reuse
`TURNSTILE_BOX_SECRET_KEY`/`TURNSTILE_SECRET_KEY` (the existing box +
fallback keypair) and `CHECKIN_RATE_LIMIT_SECRET` (the existing shared
rate-limit HMAC key), the same three secrets check-ins already require in
production per the checklist above.

---

# Design system — DESIGN.md

[DESIGN.md](DESIGN.md) is the agent-facing visual-identity reference. Read it before
any UI work — it documents the token palette, typography rules, spacing scale, elevation,
motion, component shapes, and explicit Do's/Don'ts for this design language.

**Token source of truth:** `src/app/globals.css @theme` is canonical. Tailwind v4 reads
it directly. DESIGN.md mirrors the token values and adds prose rationale; it does NOT
generate or override `globals.css`.

**Keeping them in sync:** when you change a token in `globals.css`, also update the
matching value in DESIGN.md and run `npm run design:drift` locally. CI runs this check
as a blocking gate — a mismatch fails the build.

**CLI note:** the binary is `designmd` (never `design.md` — Windows treats `.md` as a
file extension). The `design:lint` script runs the alpha CLI in report-only mode
(`continue-on-error: true` in CI); the `design:drift` script is the real gate and uses
only Node built-ins so it is not affected by CLI version changes.

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
