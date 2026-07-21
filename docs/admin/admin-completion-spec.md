# Kickoff prompt — Make the Pueblo Food Map admin fully functional

> **How to use this:** paste this whole file as your first message in a new session.
> (Or, if the new session opens in the repo, tell it: "Read
> `docs/admin/admin-completion-spec.md` and build it.") It is self-contained — a
> fresh session has none of the context that produced it.

---

You are Atlas, picking up the **Pueblo Food Map (PFM)** — a LIVE food-resource map
at **pueblofoodmap.com** (a civic tool that helps people in Pueblo, CO find food
pantries, groceries, and benefits sites). Your job this session: take the **admin**
from a secure-but-empty shell to a **fully functional venue-management tool**.

**Do NOT start coding immediately.** First read the current code, produce a detailed
implementation plan (use plan mode), get Kyle's sign-off, then build slice-by-slice
with a review at the end of each step and Kyle's eyeball on anything visual before it
merges. Kyle is non-technical — explain in plain language, lead with a recommendation,
and surface one decision at a time.

## Repo & stack
- Local path: `C:\Users\kysbo\projects\pueblo-food-map`. Package manager: **npm** — a
  deliberate exemption from the Bun default. Do NOT use bun/bunx here.
- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript + Tailwind v4 + Mapbox,
  built with OpenNext (`@opennextjs/cloudflare`) → Cloudflare Workers. **This is NOT the
  Next.js in your training data — read `node_modules/next/dist/docs/` before any
  framework-level change.**
- **Deploy:** Cloudflare Workers Builds (configured in the CF dashboard, no GitHub
  Actions deploy file). Push to `main` → production auto-deploys. PRs → preview build.
  **NEVER run `wrangler deploy` against production from your local machine — the local
  build environment differs from CI and WILL silently break prod (it did on 2026-07-03,
  causing a real outage). Production deploys go through CI only.** After anything reaches
  prod, curl `https://pueblofoodmap.com/api/health` for HTTP 200.
- **Board:** GitHub Projects v2 #1 (owner `kr8vka0z`). It's a *user-owned* board, so
  board ops need the classic token: `GH_TOKEN=$(op read "op://<vault>/<gh-classic-pat>/credential") gh project ...`. Normal repo/issue/PR ops use the default `gh` login.
- **Secrets:** 1Password via `OP_SERVICE_ACCOUNT_TOKEN` (always in env). Cloudflare
  full-access key at `op://<vault>/<cf-global-api>` (headers `X-Auth-Email` +
  `X-Auth-Key`, NOT Bearer; account `8878836432b8b59274b8d0c711901d20`). Windows: use
  `curl.exe` for API calls.

## Current admin state (verified 2026-07-03 — re-verify before trusting)
- **Auth — built and security-audited, leave it working:** a Cloudflare Access
  application gates `admin.pueblofoodmap.com` (email allowlist) at the edge, AND every
  `/admin` page + `/api/admin` route re-verifies the `Cf-Access-Jwt-Assertion` header in
  app code (fails closed). The single choke point is `getAdminDb()` in
  `src/lib/adminDb.ts`, which calls `requireAccessIdentity()` (`src/lib/cfAccess.ts`)
  before handing back the D1 binding. `CF_ACCESS_AUD` + `CF_ACCESS_TEAM_DOMAIN` runtime
  secrets are set on prod. **Rule for all new admin code:** fetch D1 only through
  `getAdminDb()` (never `getCloudflareContext()` directly), and re-verify on every route
  (App Router layouts don't run on client-side navigation, so a layout-only guard leaks).
- **Database — D1 `ADMIN_DB` (id `d6ea5afd-…`):** `venues` table = 108 rows, ALL
  `status='published'`. `audit_log` = 0 rows (admin has never been used). A
  `change_proposals` table exists but is empty. **The public map does NOT read D1 at
  request time** — it reads a static file `src/data/published-venues.ts`. D1 is
  admin-only; "Publish" regenerates that static file.
- **Admin surface — this is ALL that exists today:** `src/app/admin/page.tsx` (one
  page), `src/app/api/admin/publish/route.ts` (+ `route.test.ts`), and
  `src/app/api/admin/whoami/route.ts`. So: a login-gated page, a whoami check, and a
  Publish endpoint. No add/edit/delete, no approval queue.
- **Publish flow — built but BLOCKED:** `POST /api/admin/publish` (logic in
  `src/lib/publishVenues.ts`) snapshots D1 venues → validates each against the `Venue`
  shape → writes `src/data/published-venues.ts` → commits it to a fixed `publish-bot`
  branch → opens/reuses that PR → enables auto-merge → *then* marks the drafts published
  and writes one `audit_log` row. The commit-BEFORE-D1-write ordering is load-bearing
  (see AGENTS.md "NB1"; the test asserts D1 `batch()` is never called if the GitHub step
  fails). **It's blocked because `GITHUB_PUBLISH_TOKEN` is not set on the prod worker.**
  Kyle must provision it before the first live publish: a fine-grained PAT scoped to ONLY
  `kr8vka0z/pueblo-food-map` with **Contents: R/W** + **Pull requests: R/W**, set as a
  runtime secret (`wrangler secret put GITHUB_PUBLISH_TOKEN` or the CF dashboard).
- **Full #237 design doc:** `docs/admin/cloudflare-native-admin-spec.md` — read it; this
  admin was "Phase 1" of that spec.

## What's MISSING — the work to spec and build
1. **Venue management (CRUD).** The admin can't add, edit, or delete venues. Build: a
   venue list/table in the admin (show draft + published, with search/filter), an
   Add-venue form + create route, an Edit form + update route, and a delete/archive
   route. All writes land in D1 as **drafts** (`status='draft'`); the existing Publish
   button then pushes them live. Every write appends an `audit_log` row (actor email,
   action, target).
2. **Suggestion approval queue.** The public "suggest a venue" form currently emails Kyle
   via Resend. A `change_proposals` table exists but is empty — **verify** whether the
   suggest form writes to it today. Build: public suggestions write into
   `change_proposals`, and an admin **review queue** screen lists pending proposals →
   **Approve** (creates a draft venue) or **Reject** (with a reason) — each writing to
   `audit_log`. Decide with Kyle whether "report a closure" and general "feedback" also
   route into this queue or stay email-only.
3. **Wire + test Publish end-to-end.** Kyle provisions `GITHUB_PUBLISH_TOKEN`, then test
   the whole path: add a draft → click Publish → `published-venues.ts` committed &
   auto-merged → CI deploys → the venue appears on the live public map.
4. **Admin UI/UX.** Build a real interface (list, forms, review queue). This is a UI
   build — follow the design playbook: read `DESIGN.md` and match the app's existing
   design language, run the design + accessibility review stages, and give Kyle a preview
   before merge. Do NOT invent a new visual style.
5. **Tests + docs.** Admin routes need vitest coverage (mock the CF Access identity — see
   existing admin test for the pattern). Update `AGENTS.md` / `ARCHITECTURE.md` per the
   repo's documentation standard (done = documented).

## Constraints / gotchas — bake these in
- All D1 access through `getAdminDb()`; every admin route re-verifies CF Access; fail
  closed. Never weaken the auth model.
- Preserve the Publish flow's commit-before-D1-write ordering (AGENTS.md NB1).
- **Reviewing admin UI before merge is a known wrinkle:** the private staging site
  (`dev.pueblofoodmap.com`) has NO admin secrets, so its admin is fail-closed — you can't
  exercise the admin UI there as-is. Plan how Kyle reviews admin changes: likely a local
  `op run --env-file=.env.local -- npm run dev` with a mocked/dev identity, or provision a
  staging admin Access app + `CF_ACCESS_*` on the staging worker. Decide this in the plan.
- Do NOT try to change the deploy pipeline in the repo — Cloudflare Workers Builds pins
  the deploy target via `WRANGLER_CI_OVERRIDE_NAME`, so retargeting is a dashboard-only
  operation (learned the hard way; see the repo's git history / PR #251).
- npm (not bun); Next-16-docs-first; LF line endings (`.gitattributes`); conventional
  commits with the session trailer; single CF build slot so merge PRs one at a time and
  let each build finish; squash-merge.

## How to run this build
1. **Zoom in:** read the files named above + the "Admin authentication" and "Publish →
   static" sections of `AGENTS.md` + `docs/admin/cloudflare-native-admin-spec.md`.
   Re-verify the current state (secrets, D1 row counts, admin routes) against this brief.
2. **Plan (plan mode):** turn the five work items into a phased plan — GitHub issues with
   acceptance criteria, the data-model changes (`change_proposals` schema, draft
   workflow), the UI approach, and the admin-review-before-merge decision. A sensible
   order: (P1) read-only venue list in the admin → (P2) add/edit/delete venues → (P3)
   suggestion approval queue → (P4) provision token + test Publish end-to-end. Present to
   Kyle for sign-off before writing code.
3. **Build:** one issue at a time — implementer (Sonnet) → a Fable-model reviewer at the
   end of each step → Kyle signs off on anything visual → merge one PR at a time → verify
   the live health check. File issues on board #1 with the classic token.

Start by reading the current admin code and the #237 spec, then come back to Kyle with
the plan.
