# Rollback

Moved verbatim from AGENTS.md, section "Hosting and deploys" > Rollback. "Above" and "below" in the text refer to AGENTS.md sections (Release schedule, "Stranded `main`", Promotion checklist).

Undo a bad release. Code and data roll back separately.

1. **Prod, fastest (code only):** Cloudflare Dashboard → Workers & Pages → `pueblo-food-map` → Deployments → pick the previous build → "Rollback to this deployment" (README.md "Rollback"). CLI equivalent: `bunx wrangler deployments list --name pueblo-food-map`, then `bunx wrangler rollback <id> --name pueblo-food-map -y`.
2. **Staging:** the same with the Worker `pueblo-food-map-staging`, or skip the rollback: a revert PR squash-merged into `dev` redeploys staging, since a push to `dev` runs `deploy-dev.yml`.
3. **Make it stick:** a rollback does not change git. `main` still holds the bad commit, and the next push to `main` redeploys it. Open a `git revert` PR into `dev`; it ships in the next Sunday release, or as a `hotfix/*` PR into `main` if prod is broken now (hotfix lane, Release schedule above). `deploy-prod.yml` redeploys on that merge.
4. **Database:** a rollback does not undo D1 migrations. Production migrations are applied by hand after the export in the Promotion checklist, so restore from that export or write a new forward migration; there is no automated down path.
5. If `main`'s tip differs from the last Deploy Prod run's `headSha`, see "Stranded `main`" above.
