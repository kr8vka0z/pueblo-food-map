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
- **Environment variables:** Cloudflare dashboard → Workers & Pages → `pueblo-food-map` → Settings → Variables and Secrets. `NEXT_PUBLIC_*` vars are baked into the client bundle at build time (same model as Vercel). Set them in both the "Production" and "Preview" environments.

## Mapbox Token Management

### Public token (client-side, `pk.*`)

- **Purpose:** Used by the Next.js client bundle to render the map.
- **1Password:** `op://VPS/Mapbox  - PFP Public/credential` (note: double-space in item name is intentional — do not rename)
- **Env var:** `NEXT_PUBLIC_MAPBOX_TOKEN`
- **Local dev:** `.env.local` (gitignored — never commit this file)
- **Production/preview builds:** Cloudflare dashboard → Workers & Pages → `pueblo-food-map` → Settings → Variables and Secrets → Build variables. Set in both the **Production** and **Preview** environments. `NEXT_PUBLIC_*` vars are baked into the client bundle at build time; they must be present at build time, not just runtime.
- **Scopes:** `styles:read`, `fonts:read`, `tilesets:read`
- **URL restrictions (bare hostnames, no protocol, no wildcards):**
  - `pueblofoodmap.com`
  - `www.pueblofoodmap.com`
  - `localhost:3000`
  - `pueblo-food-map.kyle-boyd.workers.dev`
- **Preview deploy warning:** Per-branch preview deploys land on subdomains like `<branch>-pueblo-food-map.kyle-boyd.workers.dev`. Mapbox dropped wildcard URL support, so these will trigger "site not authorized" errors. If you need to demo a specific preview, add that exact subdomain to the token's URL restrictions (or demo from production instead).

### CI preview token (`pk.*`, GitHub secret only)

- **Purpose:** Lets the Lighthouse CI job target the CF Workers preview URL (with a working map) instead of production. Without it, preview maps render "not authorized" and Lighthouse a11y/perf scores collapse.
- **GitHub secret name:** `MAPBOX_PREVIEW_TOKEN`
- **Type:** Public (`pk.*`) — same scopes as the production token (`styles:read`, `fonts:read`, `tilesets:read`). Must be created in Mapbox Studio dashboard (cannot mint `pk` tokens via API).
- **URL restrictions:** Optional. Branch slugs follow `<branch-sanitized>-pueblo-food-map.kyle-boyd.workers.dev`; no wildcard support, so either omit restrictions or add per-branch. Omitting is pragmatic for a public map-tiles-only token.
- **Lighthouse fallback:** When this secret is absent, the Lighthouse workflow falls back to the production URL and emits a `::warning` in CI. The error-threshold gate still runs — just against prod, not preview.
- **Provisioning:** Mapbox Studio → Access tokens → Create token → Public, scopes above → copy → GitHub repo Settings → Secrets and variables → Actions → `MAPBOX_PREVIEW_TOKEN`.

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
3. Update `NEXT_PUBLIC_MAPBOX_TOKEN` in CF Workers Builds (both Production + Preview environments).
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
- **Known bilingual limitation** — the EN/ES language toggle is cookie-based: both locales
  serve the same URL. Crawlers only index the English version. Proper bilingual SEO (separate
  `/es/` URL tree or `hreflang` link tags) requires separate routes and is a deferred
  follow-up beyond #164.
- **Planned follow-up (PR2, issue #164 items 6.3 + 6.4):** JSON-LD structured data and
  per-venue `/venue/[id]` pages. The sitemap will be extended with venue URLs at that point.

---

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
