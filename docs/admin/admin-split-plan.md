# Admin isolation plan — split the Worker, not the repo (panel-revised)

> **DECISION (2026-07-21): NO SPLIT + RETIRE THE ADMIN SUBDOMAIN.** After the
> panel + the Rescue Ready precedent check, Kyle chose to keep the single shared
> app AND drop the `admin.pueblofoodmap.com` subdomain — admin serves at
> **`pueblofoodmap.com/admin`** (staging `dev.pueblofoodmap.com/admin`). Security
> is held by **path-scoped Cloudflare Access on `/admin*`** (the Rescue Ready
> booking-app pattern: one domain, public pages open, `/admin` edge-locked) — NOT
> a security downgrade vs the subdomain, provided the path lock is wired so the
> Better Auth login endpoints stay reachable. passkey rpID `pueblofoodmap.com`
> (eTLD+1) already covers the apex, so no passkey re-registration. No two-repo
> split, no two-Worker split.
>
> Follow-through: (1) rework the subdomain wiring set up earlier this session —
> retire `admin.pueblofoodmap.com` / `dev.admin.pueblofoodmap.com`, repoint CF
> Access from subdomain-scoped to path-scoped, update `ADMIN_ORIGIN` /
> `ADMIN_ALLOWED_HOSTS` / CSRF origin to the apex; (2) Stage B0 guard below (lint
> that public handlers never import auth/publish secrets). All via staging +
> Kyle's per-phase sign-off; prod untouched until then. Everything below Stage B
> is record-only.

**Status:** decided — no split; keep single app + add the Stage B0 guard.
**Owner:** Atlas. **Sign-off:** per phase, Kyle previews before any merge/cutover.
**Origin:** Kyle asked "does the admin need its own repo?" A full advisor panel
(two external models + adversarial dissenter + YAGNI / Cloudflare / security
specialist lenses, two rounds) reviewed the original two-repo plan and
**converged against it**. This doc is the revised result.

---

## What the panel concluded (the headline)

1. **The one real, defensible benefit is SECRET ISOLATION** — and it needs a
   separate **Worker**, not a separate **repo**. Today the two *public,
   unauthenticated* intake forms (`/suggest/submit`, `/report/submit`) run in the
   same Cloudflare Worker isolate, sharing the same `env`, as
   `BETTER_AUTH_SECRET`, `CF_ACCESS_AUD`, and the GitHub publish token. That's a
   least-privilege violation: the lowest-trust code sits next to the
   highest-trust secrets. Two Workers = two separate `env` sets; the public
   Worker holds none of the auth/publish secrets. **This is defense-in-depth, not
   a live hole** — env only leaks if a handler logs/reflects it, which is
   code-review-catchable — so it is worth doing, but it is **not urgent**.

2. **A second REPO is NOT justified.** Its only unique benefit over a
   two-Worker monorepo is restricting *who can see the admin source* (different
   developers, or an open-source public repo with a private admin). Kyle is a
   single maintainer, so that benefit is absent. A second repo would add
   permanent cost — duplicated `Venue` type, a new cross-repo GitHub token, a
   second CI pipeline, D1 migration ownership split across repos — for no
   corresponding gain.

3. **The clean URL is cosmetic** and doesn't justify anything on its own — it
   comes for free once the admin is its own Worker (served at root), or can be
   had without any split via a Cloudflare Transform Rule (with a minor Next
   client-router `basePath` caveat).

4. **Sequencing: finish Better Auth FIRST.** The panel was unanimous — do NOT
   stack a structural restructure on top of the unfinished, unsigned-off Better
   Auth prod cutover. Get auth working + signed off on the current single app,
   then restructure. Two hard migrations on the security-critical path at once is
   the real risk.

**Corrections to earlier assumptions:** the git-commit-to-publish flow is a
*deliberate good* design (zero-database static reads on the public path + free
git history of every publish) — do NOT replace it with D1/KV reads. The
publish already commits via the GitHub API to the same repo, so keeping it in a
**monorepo** means **no new cross-repo token is needed at all**.

---

## The revised shape: two Workers, one repo (monorepo)

```
pueblo-food-map/                 (one repo — today's repo, restructured)
├── apps/
│   ├── public/    -> Worker: pueblo-food-map  (pueblofoodmap.com)
│   │                 map, /suggest, /report, Turnstile, Resend, narrow D1 write.
│   │                 env: RESEND + TURNSTILE only. Zero auth code/secrets.
│   └── admin/     -> Worker: pueblo-food-map-admin  (admin.pueblofoodmap.com, root /)
│                     all admin, Better Auth, CF Access gate, the publish
│                     generator (commits published-venues.ts into apps/public — same repo).
│                     env: BETTER_AUTH_SECRET, CF_ACCESS_*, publish token, etc.
└── packages/
    └── shared/    -> Venue type + D1 schema, imported by both apps (no duplication).
```

- **Secret isolation:** delivered — two Workers, two `env` sets.
- **Clean URL:** delivered — admin Worker serves at root (`/login`, no `/admin/`).
- **No duplicated type, no cross-repo token, one repo, one place to reason about.**
- **Shared D1** still bound to both Workers (public still writes `public_submissions`).
  Note: this means the split isolates *secrets*, not the database — public-form
  DB-abuse risk is unchanged and still handled by Turnstile + rate-limit, as today.

Two repos remain an option ONLY if a future need appears: a second developer, or
wanting the public repo open-source while the admin stays private.

---

## The atomic ladder (revised order)

Each phase = one PR, leaves both sites working, revertible, Kyle previews before
merge/cutover. **CF Access stays ON until the very last step.**

### Stage A — finish Better Auth on the CURRENT single app (do this FIRST)
This is the in-flight work, unchanged. Land Phase 3 → prod behind the dual gate
(CF Access AND Better Auth), Kyle signs off, auth is proven in ONE place. No
restructure yet. *(If Kyle decides never to restructure, this is the whole job —
optionally plus the guard in Stage B0.)*

### Stage B — restructure into the two-Worker monorepo (only after A is signed off)
- **B0 (cheap insurance, can ship independently):** add a lint/CI guard that the
  public route handlers never import `BETTER_AUTH_SECRET` / the publish token /
  auth modules. This captures most of the secret-isolation benefit *today*,
  before any restructure, and is worth doing regardless.
- **B1:** introduce `apps/public`, `apps/admin`, `packages/shared` in the repo;
  move code; admin app served at root. Two `wrangler` targets + OpenNext builds.
  Deploy both to `*.workers.dev` "dark" hosts. Live sites untouched.
- **B2:** staging cutover — point `dev.admin.pueblofoodmap.com` at the new admin
  Worker, repoint the staging CF Access app. Kyle tests magic-link + passkey +
  CRUD + publish + a public-form submission end to end. **Big sign-off gate.**
- **B3:** prod cutover — deploy both Workers to prod, move
  `admin.pueblofoodmap.com` to the admin Worker, repoint the prod CF Access app.
  **CF Access STILL ON** (dual gate). Rollback = repoint the route back.
- **B4:** confirm the public Worker's `env` is pruned to RESEND + TURNSTILE only
  (verify explicitly — a blanket secret copy would negate the whole point).

### Stage C — remove CF Access (later, separate sign-off)
Remove the CF Access app so Better Auth is the sole admin gate. Keep an emergency
re-enable policy documented.

---

## Decisions for Kyle

1. **Do the restructure at all?** It's defense-in-depth (secret isolation) + a
   clean URL, not a fix for a live hole. Options: (a) do the two-Worker monorepo
   after auth sign-off; (b) skip it and just ship the Stage B0 lint guard; (c)
   defer until the "reusable auth standard" gets a real second consumer.
   **Recommend (a)** *if* the auth-standard reuse is genuinely coming soon;
   otherwise **(b) + revisit** is the lazy-correct call.
2. **Two repos** — rejected for now; revisit only on a second developer or an
   open-source-public/private-admin need.
3. **Sequencing** — finish Better Auth first, unanimous. Not negotiable.

## Non-goals
- No change to the public map render, the venue data model, or the
  git-commit-to-publish flow (keep it — it's good).
- No allowlist widening, no roles, no social/password. Unchanged.
