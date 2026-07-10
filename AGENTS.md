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
- **Direct Worker URL:** https://pueblo-food-map.kyle-boyd.workers.dev/ (fallback / bypass CDN)
- **HTTP/www redirect:** HTTP requests and `www.pueblofoodmap.com` both 301-redirect to `https://pueblofoodmap.com` via Cloudflare zone redirect rule + Always-Use-HTTPS.
- **Hosting:** Cloudflare Workers, project name `pueblo-food-map` (configured in `wrangler.jsonc`)
- **Adapter:** `@opennextjs/cloudflare` — translates Next.js App Router output into Worker format
- **CI/CD:** Cloudflare Workers Builds, connected to this GitHub repo via the CF dashboard. There is NO GitHub Actions YAML for deploys — wiring is entirely in the CF dashboard.
  - Push to `main` → production deploy (automatic)
  - Open a PR → unique preview deploy URL (posted as a check on the PR, visible in the CF dashboard under that build)
  - **Build command:** `npx opennextjs-cloudflare build`
  - **Deploy command:** `npx wrangler deploy` (CF default)

## Build and preview locally

```bash
npm run preview   # OpenNext build + local Worker emulator at http://127.0.0.1:8788
npm run deploy    # OpenNext build + wrangler deploy to production
                  # Requires `wrangler login` first; rarely needed — CI handles deploys
```

## Operational notes

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
first (JWT identity via the same choke point as every other admin route),
then `requireAdminOrigin()` (CSRF — this route mutates, so unlike the
read-only list page above it needs it). Either failure logs through
`logAdminAuthFailure()` and returns a `403`.

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
admin: the page re-verifies Cloudflare Access and renders the signed-in
email; the form itself holds no auth and is fully self-contained (owns its
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

**Provider: the free US Census Bureau geocoder, not Mapbox.** The app's
Mapbox public token (see "Mapbox Token Management" above) is
URL-restricted to the public hostnames and does **not** include
`admin.pueblofoodmap.com`, so a browser-side Mapbox geocoding call would
fail on the admin surface — and Mapbox's secret token must never reach a
Worker or client bundle just to add one more scope. The Census geocoder
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
action, but DESIGN.md reserves brand-orange ("ButtonPrimary") for exactly
two elements on the PUBLIC map (the splash CTA and the LocateButton pill),
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

**Not through `getAdminDb()`.** These are PUBLIC routes with no Cloudflare
Access identity to verify, so they reach the D1 binding directly —
`getCloudflareContext().env.ADMIN_DB` (imported from `@opennextjs/cloudflare`,
the same binding the admin surface uses) — never `getAdminDb()`
(src/lib/adminDb.ts), which gates on `requireAccessIdentity()` and exists
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
  serve the same URL. Crawlers only index the English version. Proper bilingual SEO (separate
  `/es/` URL tree or `hreflang` link tags) requires separate routes and is a deferred
  follow-up beyond #164.
- **Done: explicit homepage canonical** — `src/app/page.tsx` is now a Server Component and sets
  `export const metadata = buildPageMetadata({ path: "/", ... })` directly, giving `/` the same
  explicit self-canonical every other page already had (previously implicit/inherited).

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
