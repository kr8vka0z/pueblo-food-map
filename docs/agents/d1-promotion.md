# Promotion checklist: D1 migrations

Moved verbatim from AGENTS.md, section "Promotion checklist". The standing rule stays in AGENTS.md: production migrations are a manual step that Kyle approves, run before the release PR (or hotfix) merges into `main`.

1. See what's pending: `npx wrangler d1 migrations list pueblo-food-map-admin --remote`.
2. **Export first:** `wrangler d1 export pueblo-food-map-admin --remote --output <file>`, saved to `~/Backups/pfm-prod-d1/` on the Mac. A rollback can't undo a migration.
3. Apply: `npx wrangler d1 migrations apply pueblo-food-map-admin --remote`. **Never use `d1 execute --file`**: it routes through the import API, and `0011`, `0012`, `0015`, `0016`, `0017`, `0019`, `0020`, and `0028` are not idempotent (they fail with "duplicate column" on a re-run).
4. Confirm the Worker has every runtime secret in the table in [docs/agents/secrets.md](secrets.md), then merge the release (the sync back to `dev` is automatic).
5. If a migration changed published venue fields, the public map only updates at the next admin **Publish**. The Publish bar only shows when `updated_at > published_at`, so data migrations must set `updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')` on the rows they change.

To run wrangler against prod from the Mac (wrangler isn't logged in there):
- set `CLOUDFLARE_API_TOKEN` from `op://Atlas/Cloudflare - D1 Write Token - pueblo-food-map refresh/credential`;
- set `CLOUDFLARE_ACCOUNT_ID` from the `username` field of the 1Password item "Cloudflare - Account Token";
- run from a `dev` checkout.
