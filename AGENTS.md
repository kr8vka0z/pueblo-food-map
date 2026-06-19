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

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
