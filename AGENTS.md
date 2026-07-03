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
- **Wrapper:** `src/components/MapWrapper.tsx` wires the map to SearchBar, LocateButton, geolocation state, and venue selection.
- **Token management:** see "Mapbox Token Management" section below.
- **Testing:** react-map-gl/mapbox requires a WebGL canvas unavailable in jsdom. Mock the module in tests — see `src/__tests__/Map.test.tsx` and `src/__tests__/VenueMarker.test.tsx` for the pattern.

# Hosting — Cloudflare Workers via OpenNext

- **Live production URL:** https://pueblofoodmap.com/ (primary)
- **Staging URL:** https://dev.pueblofoodmap.com/ — private, gated by
  Cloudflare Access (email-code/OTP, Kyle's emails only), not linked or
  indexed anywhere public. This is what a push to `main` deploys.
- **Direct Worker URL:** https://pueblo-food-map.kyle-boyd.workers.dev/ (production fallback / bypass CDN)
- **HTTP/www redirect:** HTTP requests and `www.pueblofoodmap.com` both 301-redirect to `https://pueblofoodmap.com` via Cloudflare zone redirect rule + Always-Use-HTTPS.
- **Hosting:** Cloudflare Workers. `wrangler.jsonc` defines two Worker
  configs (see its header comment for the full rationale) — **the
  top-level config is STAGING** (`pueblo-food-map-staging`), and
  **`env.production` is real production** (`pueblo-food-map`).
- **Adapter:** `@opennextjs/cloudflare` — translates Next.js App Router output into Worker format
- **CI/CD (#223 — deploy model inverted, main deploys staging):**
  Cloudflare Workers Builds, connected to this GitHub repo via the CF
  dashboard. There is NO GitHub Actions YAML for deploys — wiring is
  entirely in the CF dashboard, and it is **unchanged**: build command
  `npx opennextjs-cloudflare build`, deploy command `npx wrangler deploy`
  (CF default, no `--env`). Only the *target* of that unchanged pipeline
  moved, because the top-level `wrangler.jsonc` config it resolves is now
  staging.
  - Push to `main` → **staging** auto-deploy at `dev.pueblofoodmap.com` (automatic).
  - Open a PR → unique preview deploy URL (posted as a check on the PR, visible in the CF dashboard under that build) — unchanged.
  - **Production is a manual promote, never automatic:** `wrangler deploy --env production` (or `npm run deploy:prod`). No CI job and no CF dashboard trigger runs this — a human runs it deliberately, after checking staging.
  - **Footgun:** an unqualified `wrangler deploy` (no `--env`) now targets staging, not prod. If you mean prod, say so explicitly.

## Build and preview locally

```bash
npm run preview        # OpenNext build + local Worker emulator at http://127.0.0.1:8788
npm run deploy:staging # OpenNext build + wrangler deploy to staging (dev.pueblofoodmap.com)
                        # Same target a push to `main` deploys; requires `wrangler login` first
npm run deploy:prod    # OpenNext build + `wrangler deploy --env production` — promotes to
                        # pueblofoodmap.com. Manual and deliberate; confirm staging first.
```

## Operational notes

- **Build logs:** Cloudflare dashboard → Workers & Pages → `pueblo-food-map` (production) or `pueblo-food-map-staging` (staging) → Deployments tab
- **Rollback:** Cloudflare dashboard → Workers & Pages → `pueblo-food-map` (production — the `env.production` Worker) → Deployments tab → find a previous successful deployment → "Rollback to this deployment". Production traffic switches in ~30 seconds.
- **Environment variables — two kinds, two places.** (1) Build-time `NEXT_PUBLIC_*` are inlined by `next build` → set under **Settings → Build → Build variables**. (2) Runtime server secrets (`RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`) are read at request time → set under **Settings → Variables and Secrets**. **Workers Builds has ONE shared build-variable set and a single `production` environment — there is NO separate Preview environment** (that's Cloudflare Pages). The same build vars apply to production deploys and PR preview builds.

## Mapbox Token Management

### Public token (client-side, `pk.*`)

- **Purpose:** Used by the Next.js client bundle to render the map.
- **1Password:** `op://VPS/Mapbox  - PFP Public/credential` (note: double-space in item name is intentional — do not rename)
- **Env var:** `NEXT_PUBLIC_MAPBOX_TOKEN`
- **Local dev:** `.env.local` (gitignored — never commit this file)
- **Build variable:** Cloudflare dashboard → Workers & Pages → `pueblo-food-map` → Settings → Build → Build variables. Workers Builds has one shared build-variable set and a single `production` environment — there is NO separate Preview environment (that's Cloudflare Pages). The same build vars apply to prod deploys and PR preview builds. `NEXT_PUBLIC_*` vars are inlined into the client bundle by `next build`; they must be present at build time, not runtime.
- **Scopes:** `styles:read`, `fonts:read`, `tilesets:read`
- **URL restrictions (bare hostnames, no protocol, no wildcards):**
  - `pueblofoodmap.com`
  - `www.pueblofoodmap.com`
  - `localhost:3000`
  - `pueblo-food-map.kyle-boyd.workers.dev`
- **Preview deploy warning:** A PR's CF preview deploy is reachable at the URL Cloudflare posts as a check on the PR (do not guess a `<branch>-…workers.dev` subdomain — that pattern does not resolve and 404s). Its map throws "site not authorized" unless that exact subdomain is added to the token's URL restrictions (Mapbox dropped wildcard support), so for a quick demo it is usually easier to demo from production.

### Lighthouse CI build token (`pk.*`, GitHub secret only)

- **Purpose:** The Lighthouse CI job builds this commit's code and serves it on a local server (`next start` at `localhost:3000`), then audits that — so a PR is graded on its own changes, not on production (see `.github/workflows/lighthouse.yml`). This token is passed to that build as `NEXT_PUBLIC_MAPBOX_TOKEN` so the map renders during the audit instead of an "unauthorized" blank.
- **GitHub secret name:** `MAPBOX_PREVIEW_TOKEN` (legacy name — it is a build token, not a preview-URL token).
- **Type:** Public (`pk.*`) — same scopes as the production token (`styles:read`, `fonts:read`, `tilesets:read`). Must be created in the Mapbox Studio dashboard (cannot mint `pk` tokens via API).
- **URL restrictions:** MUST be unrestricted (or explicitly allow `localhost:3000`) so the map authorizes on the CI's local server. A prod-URL-restricted token would render "not authorized" and skew the audit.
- **If the secret is absent:** the build still succeeds and accessibility is still measured, but the map renders blank ("not authorized"), so the performance score is unrepresentative. There is **no** production fallback — the job always audits the local build of the commit under test.
- **Provisioning:** Mapbox Studio → Access tokens → Create token → Public, scopes above, no URL restrictions → copy → GitHub repo Settings → Secrets and variables → Actions → `MAPBOX_PREVIEW_TOKEN`.

### Secret token (backend / admin, `sk.*`)

- **Purpose:** Mapbox API operations — managing tokens, uploading tilesets, managing Studio styles.
- **1Password:** `op://VPS/Mapbox Access Token - Full Scope/credential`
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
2. Update value in 1Password at `op://VPS/Mapbox  - PFP Public/credential`.
3. Update the `NEXT_PUBLIC_MAPBOX_TOKEN` **build variable** in CF Workers Builds (single shared set; Settings → Build).
4. Update local `.env.local`.
5. Trigger a redeploy (push a commit or manually trigger from CF dashboard).

**Secret token:**

1. Mapbox Studio dashboard → Access tokens → revoke old token, create new with only the specific secret scopes needed.
2. Update value in 1Password at `op://VPS/Mapbox Access Token - Full Scope/credential`.
3. No CF env var to update (secret tokens must never go there).

## Resend Email Key Management

The three public forms (report a closure, suggest a venue, general feedback) send email via the
[Resend](https://resend.com) API from the Cloudflare Worker at **runtime** — not at build time.
The Worker reads `process.env.RESEND_API_KEY` server-side; the value is never exposed to the
client bundle or any `NEXT_PUBLIC_*` variable.

### Sending key — Worker runtime (`RESEND_API_KEY`)

- **Resend key name:** `Pueblo Food Map - Worker (sending)`
- **Permissions:** sending-only, domain-scoped to `pueblofoodmap.com`
- **1Password:** `op://VPS/Resend API - PFM Worker Sending/credential`
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
- **1Password:** `op://VPS/Resend API - Full access/credential`
- **NEVER** place this key in the Worker, client code, git, or any `NEXT_PUBLIC_*` / public env var.
- Use it only for Resend API management operations (create/list/delete keys and domains).
- **Resend API base:** `https://api.resend.com`. The list-keys endpoint returns metadata only — it
  never returns token values, so rotation is always create-new → swap → revoke-old.

### Local dev (no plaintext secrets)

`.env.local` holds a 1Password **reference**, not the secret value:

```
RESEND_API_KEY=op://VPS/Resend API - PFM Worker Sending/credential
```

Start the dev server through `op run` so the value is injected in memory only — it never touches disk:

```bash
op run --env-file=.env.local -- npm run dev
```

> **Note:** `TURNSTILE_SECRET_KEY` is also required for local form testing — the submit routes throw
> if it is missing (hardened in #160). Store it in 1Password and reference it the same way in
> `.env.local`.

### Rotation procedure

1. Resend dashboard → API Keys → create a new key with **sending** permission, domain `pueblofoodmap.com`.
2. Update the value in 1Password at `op://VPS/Resend API - PFM Worker Sending/credential`.
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
- **Uptime monitoring:** Point monitors at `https://pueblofoodmap.com/api/health` **and**
  `https://pueblofoodmap.com` (the homepage). A free UptimeRobot account supports both.
  > **Pending manual step for Kyle:** Create the free UptimeRobot account and add the two
  > monitors. This is NOT automated — it is a one-time human task.

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

# Admin authentication (Cloudflare Access) (#237)

Full design: `docs/admin/cloudflare-native-admin-spec.md` §3.1 (auth) and §8
(security). This section is the operational summary — set env vars, know the
choke point, don't relitigate the design here.

**Edge gate + why in-app verification is still required.** A Cloudflare
Access application (Google SSO + email allowlist) gates
`admin.pueblofoodmap.com` at Cloudflare's edge — an unauthenticated or
non-allowlisted visitor never executes a line of this app's code on that
hostname. But the admin route group (`src/app/admin/**`,
`src/app/api/admin/**`) ships inside the **same Worker** as the public app
(§3.4), and that Worker answers on hostnames an Access policy scoped to
`admin.pueblofoodmap.com` does **not** cover:

1. The bare fallback URL, `pueblo-food-map.kyle-boyd.workers.dev/admin`.
2. Any Workers **version preview URL** (`<version-prefix>-pueblo-food-map.
   kyle-boyd.workers.dev/admin`) — binds **production** D1.
3. The public apex itself, `pueblofoodmap.com/admin` — the one with the
   lowest bar to stumble onto by accident, since it's the site's own
   marketed domain.

Every `/admin/*` page and `/api/admin/*` route handler therefore
re-verifies the `Cf-Access-Jwt-Assertion` header in application code
(`src/lib/cfAccess.ts`, `jose`'s `jwtVerify` against Cloudflare's JWKS —
signature, issuer, audience, expiry), so a request to any of the three
hostnames above still fails without a real, current Access token.

**`getAdminDb()` (`src/lib/adminDb.ts`) is the single choke point.** It calls
`requireAccessIdentity()` before it will hand back the `ADMIN_DB` D1 binding
at all — there is no code path (page or route handler, first load or
client-side navigation) that can reach admin data without passing the
check. This exists because Next.js App Router layouts run once per mount,
not on every client-side navigation between sibling routes — a guard placed
only in a shared layout would miss a client-nav to another `/admin/*` page.
Any new admin code must fetch D1 through `getAdminDb()`, never
`getCloudflareContext()` directly.

**Two enforcement shapes, both required, both go through the same check:**
Server Component pages call Next 16's `forbidden()` (from `next/navigation`)
on `AccessDeniedError`, rendered by `src/app/forbidden.tsx` (a real HTTP
403 — requires `experimental.authInterrupts: true` in `next.config.ts`,
still an experimental Next API). Route handlers return an explicit
`new Response("Forbidden", { status: 403 })` instead — there is no
route-handler equivalent of `forbidden()`. Both paths log through
`src/lib/logger.ts`'s `logAdminAuthFailure()` (`event: "admin_auth_failure"`,
same PII-free single-line-JSON convention as `form_submit_failure` above).

**Env vars Kyle sets — after, and only after, creating the live CF Access
application** (Zero Trust dashboard → Access → Applications):

- `CF_ACCESS_TEAM_DOMAIN` — e.g. `https://<team-name>.cloudflareaccess.com`.
- `CF_ACCESS_AUD` — that Access application's audience tag.

Both are **runtime secrets** (not `NEXT_PUBLIC_*`) — set via
`wrangler secret put` or CF dashboard → Settings → Variables and Secrets,
same as `RESEND_API_KEY`/`TURNSTILE_SECRET_KEY` above. Until they're set,
`requireAccessIdentity()` fails closed (`AccessDeniedError("misconfigured")`)
on every request — this is intentional, not a bug to work around.

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
succeeds**, promotes the exact draft ids captured in step 1 to `published`
and writes one `audit_log` row, atomically via a single `db.batch()`. Once
the PR auto-merges, the existing Workers Builds pipeline (unmodified)
redeploys production like any other push to `main`.

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
`TURNSTILE_SECRET_KEY` / `CF_ACCESS_AUD` above (`wrangler secret put
GITHUB_PUBLISH_TOKEN` or via the CF dashboard). Until it's set, the publish
route throws immediately (matches the existing missing-secret convention in
`src/app/feedback/submit/route.ts`) rather than silently no-op'ing.

**No admin email in the published file.** `published-venues.ts`'s
auto-generated header comment carries only a publish timestamp, never the
publishing admin's email — that file lands in this **public** repo, and the
admin identity is already recorded where an audit trail belongs: D1's
private `audit_log.actor_email` / `venues.published_by`.

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
  convention. No `lastModified` field — the value was non-deterministic (`new Date()` on every
  request), which prevented stable caching and could confuse crawlers into treating every page
  as perpetually updated.
- **Robots** — `src/app/robots.ts` (allows `/`, disallows `/api/`, points to sitemap).
  Generates `/robots.txt` at runtime. No `host` field — Google ignores it.
- **Shared constants** — canonical origin, site name, and OG image metadata all live in
  `src/lib/site.ts` (single source of truth; reused by metadata, sitemap, robots).
- **Subpage metadata helper** — `/suggest`, `/feedback`, and `/privacy` use `buildPageMetadata`
  from `src/lib/site.ts` instead of a raw `metadata` literal. WHY: Next.js shallow-merges
  metadata — a child `openGraph` object REPLACES the parent's entirely (not deep-merged; see
  Next docs "Merging"). A subpage setting only `{title, url}` drops the inherited OG image and
  other brand fields. `buildPageMetadata` emits the full `openGraph`/`twitter` block (brand
  image, siteName, type, locale) so link previews on subpages retain the brand image.
- **Known bilingual limitation** — the EN/ES language toggle is cookie-based: both locales
  serve the same URL. Crawlers only index the English version. Proper bilingual SEO (separate
  `/es/` URL tree or `hreflang` link tags) requires separate routes and is a deferred
  follow-up beyond #164.
- **Deferred: explicit homepage canonical** — the client-component homepage would need a server
  wrapper to own `alternates.canonical`. Implicit self-canonical is acceptable (Google ignores
  `fbclid`/`utm` params); revisit if tracking-param duplicate indexing shows up in Search
  Console.

**PR2 (items 6.3 + 6.4) — shipped.**

- **Per-venue pages** — `src/app/venue/[id]/page.tsx` (dynamically rendered, `dynamicParams = false`).
  Each page carries a venue-specific `<title>` + `<meta description>` + OpenGraph/Twitter metadata
  via `buildPageMetadata`, and a `<script type="application/ld+json">` block with a
  `LocalBusiness` / `GroceryStore` / `FoodEstablishment` / `Place` `@type` mapped from the
  venue category. `generateStaticParams` restricts the route to known venue ids; unknown ids 404.
  WHY dynamically rendered: the `cookies()` call to read locale opts the route out of SSG.
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
  every page).
- **ItemList JSON-LD** — rendered client-side in `src/app/page.tsx` (homepage `/` only). Lists
  all venues by id/name/url/position for crawlers that read client-rendered markup.
  - **Deferred: server-render the homepage ItemList JSON-LD** — currently client-rendered
    (acceptable for Google, which renders JS, but weaker than SSR). Server-rendering requires
    splitting the homepage into a server wrapper + client map child; deferred because it risks
    the live map and `page.test.tsx` and pairs naturally with the deferred explicit-homepage-canonical
    refactor.
- **Sitemap** — `src/app/sitemap.ts` now includes all per-venue URLs (`changeFrequency:
  "monthly"`, `priority: 0.7`). The static-routes-only TODO comment was removed.

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

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
