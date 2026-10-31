# Secrets table and rotation notes

Moved verbatim from AGENTS.md, section Secrets. The hard rules stay in AGENTS.md.

## Secrets

| Secret | Lives in | Gotcha |
|---|---|---|
| `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_TURNSTILE_BOX_SITE_KEY` | GitHub Actions secrets | Build-time, inlined by `vite build` (vinext) on the runner. Not a Cloudflare Build variable. |
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
| `BETTER_AUTH_SECRET`, `ADMIN_ALLOWLIST` | Worker runtime | See AGENTS.md → "Admin authentication and data". |
| `HC_PING_URL` | Worker runtime, **prod only** | Never set it on staging. |
