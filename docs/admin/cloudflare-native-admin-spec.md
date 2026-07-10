# Pueblo Food Map — Cloudflare-Native Admin System (Proposal)

**Status:** v2.0 — **ACCEPTED 2026-07-01.** `#178`-`#181` were closed
not-planned the same day, each citing this document by name as their
replacement (§1).
Supersedes v1.0 same-day: scope expanded from the ~10 curated PFP records to
**all current venues**, and a new auto-refresh **change-approval queue**
replaces silent script-regeneration as the update path for the auto-generated
OSM/Plentiful data (§6).
**Author:** Atlas (Claude), 2026-07-01.
**Scope:** A complete Cloudflare-native alternative to the Firebase/Firestore
admin plan ([#178](https://github.com/kr8vka0z/pueblo-food-map/issues/178),
[#179](https://github.com/kr8vka0z/pueblo-food-map/issues/179),
[#180](https://github.com/kr8vka0z/pueblo-food-map/issues/180),
[#181](https://github.com/kr8vka0z/pueblo-food-map/issues/181)), built on the
original Cloudflare-native blueprint
([#73](https://github.com/kr8vka0z/pueblo-food-map/issues/73), closed
2026-06-19 in favor of Firebase) — and, in this revision, also unifying the
automated-refresh and data-freshness-monitoring work from
[#133](https://github.com/kr8vka0z/pueblo-food-map/issues/133) and
[#234](https://github.com/kr8vka0z/pueblo-food-map/issues/234). See §1.
**Deliverable:** Kyle read this alongside #178-181 and decided this stack —
Cloudflare-native, not Firebase — is what the admin section gets built on
(`#178`-`#181` closed not-planned 2026-07-01, each citing this document).
This is now the accepted build spec, not a proposal awaiting comparison.
Nothing in it has been implemented yet: no schema exists, no CF Access
application exists, no code has changed.

**Why this file exists:** the Firebase plan was decided over D1 on 2026-06-19
and is authored/owned by a volunteer (@rspraymond). It has not progressed in
over two weeks. Firebase's structural requirement — a Google Cloud/Firebase
*project* that a specific person must permanently own and administer — is a
feasibility risk independent of who writes the code: if the owning volunteer
becomes unavailable, Kyle has no path to recover admin access to the app's own
data without recreating the backend from scratch. This document exists to give
Kyle a concrete, equally-detailed alternative that removes that single point
of failure by keeping every piece of new infrastructure inside an account he
already owns. **Ownership, not technology preference, is the reason this
document exists** — see [§9](#9-ownership--accounts) for the full argument.

---

## Table of contents

1. [Purpose & context](#1-purpose--context)
2. [Goals / non-goals](#2-goals--non-goals)
3. [Architecture overview](#3-architecture-overview)
4. [D1 schema](#4-d1-schema)
5. [Draft → publish workflow](#5-draft--publish-workflow)
6. [Auto-refresh & the change-approval queue](#6-auto-refresh--the-change-approval-queue)
7. [Migration & cutover plan](#7-migration--cutover-plan)
8. [Security](#8-security)
9. [Ownership & accounts](#9-ownership--accounts)
10. [Cost](#10-cost)
11. [Phased implementation plan](#11-phased-implementation-plan)
12. [Firebase-plan parity table](#12-firebase-plan-parity-table)
13. [Tradeoffs, risks & open questions](#13-tradeoffs-risks--open-questions)

---

## 1. Purpose & context

Pueblo Food Map's venue data is currently 100% static: `src/data/venues.ts`
aggregates three TypeScript arrays — `pfpVenues` (10 hand-curated Pueblo Food
Project gardens/edible landscapes, written inline in that file), `groceryOsmVenues`
(841 lines / **60 records**, auto-generated from OpenStreetMap Overpass by
`scripts/ingest-osm-grocery.py`), and `plentifulPantries` (499 lines / **38
records**, auto-generated from the Plentiful directory by
`scripts/scrape-plentiful.py`) — then overlays SNAP/WIC flags from
`benefit-flags.ts`. **108 venues total today** — confirmed both by direct
count (`grep -c "id:"` against each file) and by `src/data/pueblo-bbox.ts`'s
own comment ("All 108 venues in src/data/venues.ts fall within this bbox").
Every edit today requires a human to hand-edit a `.ts` file, open a PR, and
wait for CI + a Cloudflare Workers Build. There is no way for a non-developer
PFP staffer to correct an address or add a new pantry — and no way for
*anyone* to correct an auto-generated OSM/Plentiful record without waiting for
the next full script re-run to overwrite it.

`#73` proposed a 5-phase Cloudflare-native fix in May/June 2026: D1 for
storage, Cloudflare Access + Google SSO + an email allowlist for auth, and —
this is worth stating precisely, because the original draft of this document
got it wrong (see the correction below) — **the public app reading from D1 at
request time, edge-cached, with the static file kept only as an
outage fallback** (`#73`'s own Phase 0 checklist: "Refactor the public app to
read venues from D1 instead of the static file. Cache aggressively at the
edge..."; and later, "Whether to keep the static TS data file as a fallback in
case D1 has an outage. My take: yes, ship it as a build-time snapshot that the
app falls back to if D1 read fails."). On 2026-06-19, `#73` was closed in
favor of the Firebase/Firestore plan Ray Spraymond authored across
`#178`-`#181`, with this stated rationale (quoting the closing comment
verbatim):

> "Rationale: keeps the public site fully static (no change to the live read
> path = lower risk), it's already sliced into shippable increments, and it's
> authored/owned by @rspraymond."

**Correction from v1.0 of this document:** the earlier draft claimed `#73`
itself already proposed "a sync path that regenerates the static data so the
public map never queries a database at request time" — that is not what `#73`
proposed; that description is what *this* document's §3.3 recommends. Getting
this right changes how the three closure reasons should be weighed:

- **"Keeps the public site fully static" was a *fair* critique of `#73` as
  actually written.** `#73`'s own design had a live, edge-cached D1 read on
  the public hot path; the Firebase plan (`#178` AC2: "Public map data remains
  static at runtime") genuinely did not. That reason was a real, valid
  differentiator in Firebase's favor — over `#73`'s specific design.
- **It is not a reason to prefer Firebase over *this* proposal**, because this
  proposal does not resurrect `#73`'s live-read design. §3.3 recommends the
  build-time regenerate-and-redeploy model — the same static-at-runtime
  pattern the Firebase plan itself commits to, applied to D1 instead of
  Firestore. This repairs the actual flaw that made "keeps it static" a valid
  reason to close `#73`, rather than re-proposing that flaw under a different
  database.
- **"Sliced into shippable increments"** is not specific to either datastore
  — this design is sliced the same way (§11).
- **"Authored/owned by @rspraymond"** — ownership — is the one this document
  exists to neutralize. At the time this argument was first made, `#178`-
  `#181` had zero comments beyond Ray's own issue bodies, no linked PRs, and
  had been open for 12 days with no visible progress — that argument carried
  the day: Kyle accepted this proposal, and `#178`-`#181` were closed
  not-planned on 2026-07-01 (each issue's only comment is that closure,
  linking back to this document by name). Its own acceptance criteria
  (`#179` AC3: "Firestore role lookup controls access with env fallback
  super admin recovery") had already anticipated a scenario where the
  primary access path fails and a human has to intervene — exactly the
  ownership risk this document was about.

This spec is **not** a recommendation to abandon Firebase outright. It is the
detailed alternative Kyle asked for so the two can be compared on equal
footing before more time is sunk into either.

### This proposal now unifies three previously-separate board issues

Kyle's scope decision for this revision (§2, §6) has a structural
consequence worth stating plainly: **this document now covers the ground of
three previously-separate issues, and describes them as one workflow.**

- **`#133` (automated data refresh pipelines — Plentiful, OSM, GTFS)**
  becomes the *feeder* into this proposal's change-approval queue instead of
  a standalone pipeline that writes committed files directly. `#133`'s own
  tracking comment already independently arrived at the same constraint this
  document designs for: *"Monthly scheduled GitHub Action runs the Plentiful
  + OSM scrapers and opens a PR with the diff — human reviews before anything
  ships. (No silent auto-publish.)"* This proposal's queue (§6) is a more
  capable version of that same idea — a structured, per-record, D1-backed
  review inbox with approve/reject and a before/after diff, instead of one
  all-or-nothing GitHub PR diff a reviewer has to read line-by-line.
- **`#234` (data freshness & drift monitoring)** — its reconciliation-review
  for removals, sanity guardrails, and outbound link-health checks become
  literal features of this same queue (§6.4, §6.5) rather than a separate
  monitoring layer bolted on afterward. `#234`'s acceptance criteria already
  describe almost exactly this mechanism: diff-based updates, "abnormal
  drops... held + alerted, not applied," and "broken outbound links... detected
  automatically and surfaced for fix." `#235` (a live, intentionally-unfixed
  dead Plentiful link — "🐤 INTENTIONAL CANARY," decided 2026-07-01) is
  `#234`'s own acceptance test for the link-health check this document specs
  in §6.5.
- **The admin CRUD work itself** (`#178`-`#181`) was always going to need a
  data store covering every venue an admin might touch. Once that store is
  D1 holding *all* venues (§2), the refresh pipeline, the freshness
  monitoring, and the admin's own create/edit/archive actions are all just
  different ways of proposing or making the same kind of change to the same
  table — there is no longer a technical reason to keep them as three
  separate efforts.

Practically: if this proposal is accepted, `#133` and `#234` should be closed
or converted into checklist items under this document rather than tracked as
independent work — their acceptance criteria are satisfied by §6, not
duplicated elsewhere. That's a process call for Kyle, not something this
document can do on its own.

---

## 2. Goals / non-goals

### Goals

- Let Kyle (and, if he chooses, named PFP staff) add, edit, and hide **any**
  venue through a web UI — no code commit, no PR, no developer required per
  edit. This now covers all 108 current venues, not just the 10 hand-curated
  ones — see the next goal.
- **Seed all current venues into D1 as the single published source of truth
  for the whole map:** the 10 hand-curated `pfpVenues` records plus the 60
  OpenStreetMap-derived (`grocery-osm.ts`) and 38 Plentiful-derived
  (`pantries-plentiful.ts`) records — 108 total today. D1 stops being an
  "admin working copy of a curated subset" and becomes the one place every
  venue on the public map lives (§4, §7).
- **Replace silent script-regeneration with a human-reviewed change-approval
  queue (§6) for every automated source refresh (OSM, Plentiful, and — once
  built — GTFS).** An automated refresh run never writes to `venues`
  directly; it proposes add/update/remove changes, and a human approves or
  rejects each one. This is a new core feature of this revision, not a
  preserved decision from Ray's issues — it exists because bringing OSM and
  Plentiful into D1 (above) would otherwise mean the next scrape run could
  silently clobber a hand-correction an admin just made. **One automated
  source-refresh writer is explicitly excepted from the queue:**
  `scripts/match-benefits.py` (re-matches OSM venues against the USDA SNAP
  and CDPHE WIC lists and regenerates `benefit-flags.ts`) keeps silently
  overwriting its own output on every re-run, same as today — it is not
  routed through `change_proposals`. Reason: unlike OSM/Plentiful, its
  output can no longer override an admin-set value once §7 step 1's
  NULL-guard fix ships (fixes NB4) — an admin's explicit SNAP/WIC edit in D1
  is a non-NULL value, and the overlay only ever fills a NULL. The exact
  clobber risk that motivates the queue for full venue records is
  structurally closed for these two fields by the guard itself, not by
  review, so routing two nullable booleans through a full per-record
  approval queue would be scope with no corresponding safety gain.
- Keep the public map's runtime architecture exactly as static and fast as it
  is today. Zero new request-time dependency on a database for
  `pueblofoodmap.com` visitors.
- Put every new piece of infrastructure under Kyle's **existing** Cloudflare
  account (`8878836432b8b59274b8d0c711901d20`) and **existing** 1Password VPS
  vault. Zero new third-party accounts. Zero dependency on any specific
  volunteer to provision, own, or recover the system.
- Preserve every product decision already agreed in `#178`-`#181`: draft →
  publish workflow, ID-matched override of the static baseline, soft delete
  via hidden status, outside-county warning + explicit confirmation, audit
  trail on every write, ~10-minute go-live window, single admin role in v1,
  full-field v1 editor, stable-ID seed, preview/production separation, phased
  overlay cutover, stakeholder sign-off before final cutover.
- Ship in the same shippable-increment shape as `#178`-`#181` so this is a
  drop-in alternative rollout, not a different process — even though the
  total scope is now larger (§11).

### Non-goals

- **A general-purpose bulk CSV/spreadsheet upload UI.** Bulk changes to the
  auto-generated data flow through the change-approval queue (§6), which is
  reviewed per-record (or per-run, in bulk) — not through a separate
  hand-upload tool. *(This replaces v1.0's non-goal of "bulk import/edit of
  the OSM/Plentiful records" — Part A of this revision brings exactly that
  data into D1; what stays out of scope is a bulk-upload UI as a distinct
  feature, not admin management of those records at all.)*
- **Per-source or per-change-type auto-apply of refresh proposals.** Every
  auto-refresh change requires human approval in v1 — no exceptions. Noted in
  §6 as a plausible future refinement once the queue has a track record.
- Building GTFS ingestion itself. GTFS is named as a future `source` value in
  the change-proposal schema (§4, §6.2) so the design doesn't need to change
  when it arrives, but no GTFS scraper exists yet — `#133` already lists it as
  roadmap/post-demo, and building one is out of scope here.
- New venue category taxonomy (`#178`'s **out-of-scope list** explicitly
  excludes this — not its decision log).
- Multi-role/permission tiers. Single admin role in v1 — the CF Access
  allowlist *is* the role store (§8).
- Sub-minute publish latency. The ~10-minute go-live window is an accepted
  product decision (`#180` AC7), not a target to beat — and per §3.5/§8, ~10
  minutes is honestly the *floor* for the mechanism recommended here, not
  something it typically beats.
- Hard delete of any venue record, ever.
- A general-purpose, paginated, filterable **audit-log viewer UI**. The
  change-approval queue (§6.6) needs — and gets, in Phase 2 — its own
  before/after diff view for pending proposals; that's a narrower, purpose-
  built piece pulled forward from what `#73` originally deferred wholesale.
  The full standalone `audit_log` browsing/search page stays deferred exactly
  as `#73` deferred it (§11).
- Notification banners and site statistics — still `#73` Phases 2-4,
  deferred here exactly as `#73` deferred them (§11).
- Photo upload, bulk seasonal-hours edits, an issues/suggestions inbox triage
  view — `#73` explicitly deferred these; unchanged here.

---

## 3. Architecture overview

### 3.1 Auth — Cloudflare Access

**Design:** a Cloudflare Access (Zero Trust) application gates
`admin.pueblofoodmap.com` — a new subdomain in the CF zone Kyle already owns
for `pueblofoodmap.com`. The Access policy allows a specific list of admin
email addresses, authenticating via Google as the identity provider (per the
brief) with an email allowlist as the actual authorization boundary. Access
enforces this **at Cloudflare's edge, before any request reaches the Worker**
— an unauthenticated or non-allowlisted visitor never executes a line of this
app's code; they see Cloudflare's own login/denial page.

Because enforcement happens at the edge, the app itself needs **no login
UI, no session cookies, no password reset flow, and no OAuth callback route**.
This is also why Next 16's `proxy.ts`/middleware — confirmed dead on this
stack (AGENTS.md: it defaults to the Node.js runtime, and OpenNext/Cloudflare
cannot run Node-runtime middleware; the build itself fails) — is a non-issue
here. The gate is Cloudflare Access, not application middleware, so the
Next-16-on-OpenNext middleware trap is sidestepped entirely rather than worked
around.

**Verification is still required in application code, and this is not
optional — and there are three bypass surfaces to defend against, not
one.**

1. **The bare Worker URL.** AGENTS.md documents a second, always-on URL for
   this exact Worker: `https://pueblo-food-map.kyle-boyd.workers.dev/`
   ("fallback / bypass CDN"), actively used today for a documented operational
   practice (curling the live homepage after deploy to prove the OpenNext
   routing traps didn't resurface — AGENTS.md's SEO section). Cloudflare
   Access applications are scoped by hostname; a policy on
   `admin.pueblofoodmap.com` does not automatically cover
   `pueblo-food-map.kyle-boyd.workers.dev/admin/*` unless a second Access
   application is explicitly configured for it.
2. **Workers version preview URLs**
   (`<version-prefix>-pueblo-food-map.kyle-boyd.workers.dev`) are a *second*,
   distinct bypass surface — easy to miss because it's a different hostname
   pattern than the one AGENTS.md already documents. Every version Cloudflare
   Workers Builds uploads gets its own preview URL of this shape, and — per
   the Workers-Builds preview-environment gap already identified in §7 step
   4/§4 — that preview URL binds the **production** D1 database, not an
   isolated one. It is not covered by an Access policy scoped to
   `admin.pueblofoodmap.com` for the same hostname-scoping reason as (1).
3. **The public apex, `pueblofoodmap.com` itself (fixes Important-3 — this
   was missing from earlier drafts).** §3.4 recommends the admin route group
   ship inside the *same* Worker as the public app — which means the exact
   same `/admin/*` and `/api/admin/*` route handlers also answer at
   `https://pueblofoodmap.com/admin` (and `www.pueblofoodmap.com`, which
   redirects there), with **no Access policy at all**, because Access is
   only ever configured for the new `admin.pueblofoodmap.com` hostname
   above. This is the most dangerous of the three precisely because it needs
   no special knowledge to find — it's the site's own marketed domain plus
   `/admin`, not a bypass URL someone has to already know about.
   `getAdminDb()` (below) already defends it exactly like the other two —
   this was a gap in the document's own count and test plan (§8), not in
   the code design.

If the admin route group ships inside the same Worker as the public app
(recommended, §3.4), all three of these are real, reachable paths to the
admin routes' code unless the Worker itself refuses to trust an absent or
forged identity. So every `/admin/*` page and `/api/admin/*` route handler verifies
the `Cf-Access-Jwt-Assertion` header itself — and does so through a single
gated data-access helper, not just a shared layout guard (details below).

```ts
// src/lib/cfAccess.ts — illustrative, not final implementation
import { jwtVerify, createRemoteJWKSet } from "jose";

const TEAM_DOMAIN = "https://<team-name>.cloudflareaccess.com";
const AUD = process.env.CF_ACCESS_AUD; // this Access application's audience tag

// createRemoteJWKSet caches the JWKS response internally — no per-request
// fetch to Cloudflare's certs endpoint on the hot path.
const JWKS = createRemoteJWKSet(new URL(`${TEAM_DOMAIN}/cdn-cgi/access/certs`));

export class AccessDeniedError extends Error {}

export interface AdminIdentity {
  email: string;
}

// Accepts anything with a Headers-like `.get()` — both a route handler's
// `Request.headers` and a Server Component's `next/headers` `headers()`
// result satisfy this, so one function covers both call sites (see
// getAdminDb() below, and why that matters).
interface HeaderSource {
  get(name: string): string | null;
}

export async function requireAccessIdentity(
  headers: HeaderSource,
): Promise<AdminIdentity> {
  const token = headers.get("Cf-Access-Jwt-Assertion");
  if (!token) throw new AccessDeniedError("missing_assertion");

  // jwtVerify checks the signature against Cloudflare's real public keys,
  // plus issuer, audience, and expiry in one call. A forged header (someone
  // crafting their own Cf-Access-Jwt-Assertion value and hitting a bypass
  // URL directly) fails here — they don't have Cloudflare's private signing
  // key.
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: TEAM_DOMAIN,
    audience: AUD,
  });

  const email = payload.email as string | undefined;
  if (!email) throw new AccessDeniedError("no_email_claim");
  return { email };
}
```

**The gap this closes (I2): layouts don't re-run on client-side navigation.**
Next.js App Router layouts execute once per layout mount, not on every
client-side navigation between sibling routes under that layout — a guard
placed only in `/admin/layout.tsx` authenticates the *first* page view but not
a subsequent client-side navigation to another `/admin/*` page. That's not a
gap for `/api/admin/*` route handlers (every `fetch()` is a fresh request,
independently checked), but it is exactly the gap that would leave an
`/admin/*` **page** exposed — specifically a Server Component that reads D1
directly to render (the venue list, the review queue). The fix is a single
**gated data-access helper** that verifies identity *before* it will hand back
the D1 binding at all, so there is no code path — page or route handler — that
can reach data without passing the check:

```ts
// src/lib/adminDb.ts — illustrative, not final implementation
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireAccessIdentity, type AdminIdentity } from "./cfAccess";

/**
 * The ONLY sanctioned way any server-side code — a /admin/* Server
 * Component OR a /api/admin/* route handler — obtains the admin D1
 * binding. Verifies Cf-Access-Jwt-Assertion BEFORE returning the binding,
 * so a page that imports getAdminDb() and forgets an explicit auth check
 * still cannot read D1 unauthenticated. Closes the gap a layout-only guard
 * leaves on client-side navigation (I2).
 */
export async function getAdminDb(headers: HeaderSource): Promise<{
  db: D1Database;
  identity: AdminIdentity;
}> {
  const identity = await requireAccessIdentity(headers); // throws AccessDeniedError
  const { env } = await getCloudflareContext({ async: true });
  return { db: env.ADMIN_DB, identity };
}
```

Every `/admin/*` page calls `getAdminDb(await headers())` (App Router's
`next/headers` helper) before its first D1 read; every `/api/admin/*` route
handler calls `getAdminDb(req.headers)`. Both paths run the identical check —
defense in depth without two implementations to keep in sync.

**Single source of truth for "who's an admin":** the CF Access policy
allowlist, edited only in the Cloudflare Zero Trust dashboard, is authoritative.
The app does **not** keep a second, duplicate allowlist in code — that would
be two places to update on every admin onboarding/offboarding, a drift risk
`#73`'s own acceptance criteria explicitly warns against ("AGENTS.md updated
with... how to onboard a new admin (email allowlist edit)" — singular). The
`email` claim from the verified JWT is used only to (a) confirm the token is
real and (b) stamp `actor_email`/`created_by`/`updated_by`/`reviewed_by` on
`venues`, `change_proposals`, and `audit_log` rows — never re-checked against
a second list.

**Contrast with Firebase's approach:** `#179` AC1-3 requires the app to
verify Bearer-token issuer/audience/expiry/identity by hand, **and** run a
Firestore role lookup with an "env fallback super admin recovery" path for
when that lookup is unavailable. That's real application code: a Google
ID-token verifier, a Firestore round-trip on every authenticated request, and
a hand-rolled recovery mechanism for when the role store itself is
unreachable. Cloudflare Access replaces all three: the OAuth exchange with
Google happens entirely inside Cloudflare (the app never talks to a Google
API), "roles" collapse to the one allowlist Access already enforces, and
"recovery" is Kyle editing a policy in a dashboard he owns outright — no
fallback code path is needed because there is no scenario where Kyle is
locked out of his own Cloudflare account's Zero Trust settings.

**Alternatives considered for the edge-gate mechanism itself (I4).** Two
Cloudflare-native options could, in principle, gate the *entire* Worker
hostname without any in-app JWT check at all: the workers.dev "Enable
Cloudflare Access" dashboard toggle, and setting `workers_dev = false` to
disable the `*.workers.dev` route entirely. Both were considered and
rejected for this design. They gate the **whole hostname**, not just
`/admin/*` — which would break the documented, actively-used bypass-CDN
`curl` practice in AGENTS.md (verifying a live deploy against
`pueblo-food-map.kyle-boyd.workers.dev/` when CDN cache might be masking a
broken change) and any quick PR-preview demo that relies on the same
mechanism. Losing that operational tool to gain a login wall this proposal
already builds a stronger version of (in-app JWT verification, defending
*all three* named bypass surfaces, §3.1 items 1-3, not just one) is a bad
trade. It's also not just this document's preference: **Cloudflare's own
Access documentation recommends validating the token inside the Worker
regardless** of which edge controls are in place, for exactly the
defense-in-depth reason argued above. `jose` — flagged as a new dependency
below — is the tool that documentation itself points to.

**A third, narrower alternative — adopted, but only for the refresh-ingest
route (§6.3, §6.8), not as a hostname-wide gate (fixes Important-4b):** a
**Cloudflare Access Service Token** (a Client ID + Client Secret pair Access
itself issues and validates at the edge) lets a non-interactive caller pass
an *existing* Access application's policy without completing Google SSO.
This is a different tool than the two rejected above — it doesn't gate a
whole hostname differently, it adds a machine-credential path *into* the
same `admin.pueblofoodmap.com` Access application humans already use.
Layered with the route's own `REFRESH_INGEST_TOKEN` bearer check (§6.3),
this lets `/api/admin/refresh/ingest` live on the protected admin hostname —
authenticated at the edge *and* in-app — instead of having to sit on one of
the three bypass hostnames this section otherwise spends its effort
defending against. The GitHub Action presents `CF-Access-Client-Id` /
`CF-Access-Client-Secret` headers (new repo secrets, 1Password-sourced, same
pattern as `REFRESH_INGEST_TOKEN` — §8) alongside its normal bearer token;
Cloudflare validates the service-token headers before the request reaches
the Worker at all. The alternative this replaces — simply pointing the
Action at the apex or bare workers.dev host instead — was rejected once the
service-token option was on the table: it would mean deliberately routing a
credentialed, automated write path through the very hostnames §3.1 item 3
and §8 identify as the weakest links.

### 3.2 Data — Cloudflare D1

A new D1 (SQLite-at-the-edge) database, `pueblo-food-map-admin`, holds
**every** venue record — today, all 108 (10 hand-curated PFP + 60
OpenStreetMap + 38 Plentiful) — plus the change-approval queue (§6) and the
audit trail. Full schema in [§4](#4-d1-schema). D1 is **server-side only** —
it is bound to the Worker via `wrangler.jsonc`, never exposed to the client
bundle, and (per §3.3) never queried by the public-facing request path at
all, only by `/api/admin/*` route handlers, the refresh-ingest endpoint
(§6.3), and the publish job.

D1 is not a novel or unproven binding in this exact stack: the installed
`@opennextjs/cloudflare` adapter (1.20.1) already ships a D1-backed tag-cache
override (`dist/api/overrides/tag-cache/d1-next-tag-cache.js`) as one of its
own supported ISR-cache backends. Binding access from Next.js route
handlers/Server Components goes through the adapter's own
`getCloudflareContext()` API (verified against the installed package's type
declarations, `dist/api/cloudflare-context.d.ts`) — shown above in
`getAdminDb()`.

No ORM. The schema is three tables in v1 (four counting the phase-later
`banners` table) — raw `db.prepare(...).bind(...).run()` / `.all()` and
`db.batch([...])` (D1's native atomic multi-statement transaction primitive)
are sufficient. Drizzle/Kysely were considered and rejected for v1: a query
builder earns its keep on a large, evolving schema, not a handful of
admin-scale tables holding a few hundred rows (ponytail rung 3: the
platform's own client already does this).

### 3.3 Public-static publish model — the load-bearing decision

**This is the single requirement that most directly answers `#73`'s own
closure rationale ("keeps the public site fully static").** The public map
must not read D1 (or anything else) at request time. Two mechanisms were
evaluated:

| | (a) Publish → regenerate static file → redeploy | (b) Publish → write snapshot to KV/R2 → Worker serves it |
|---|---|---|
| Public read path | Unchanged: a build-time ESM import, exactly like today | New: a runtime KV/R2 read (with fallback) on every request |
| Publish latency | ~10 min floor (two real, serial CI/Workers-Build runs — §3.5, §8) | Seconds (KV writes propagate globally in well under a minute) |
| New runtime dependency for public traffic | None | Yes — KV binding becomes part of the public hot path |
| Failure mode if the store is unreachable | Publish button fails; site keeps serving the last successful publish (nothing in the git tree changed) | Every page load needs an explicit fallback branch (`kv.get() ?? bundledFallback`) — larger blast radius |
| Effect on per-venue SEO pages (`/venue/[id]`, `generateStaticParams`, `dynamicParams = false`, `#164`) | None — `generateStaticParams` still enumerates ids from the same static import it reads today | Breaks: a brand-new venue published via KV would have no static param entry and would 404 on `/venue/<id>` until the next real code deploy, unless `dynamicParams` is relaxed to `true` with its own runtime lookup — a second code path to build and keep correct |
| Consumes the single Workers-Builds build slot (Free plan) | Yes, twice per publish (§3.5, §8) | No |
| New secrets | A GitHub PAT (§8) + a refresh-ingest bearer token (§6.8) | A KV namespace binding (no secret, but a new binding + cache-invalidation logic) |

**Recommendation: (a).** Reasoning, beyond the table:

1. **It is the truest structural mirror of what Ray's own plan does.** `#179`
   AC4 is "Sync script generates static output from published Firestore
   records" — a script that reads the database and regenerates a static
   artifact. Option (a) is exactly that pattern with D1 in place of
   Firestore. Recommending (a) means this spec can claim static-runtime
   parity with the Firebase plan without qualification — not "equally static
   modulo a KV read," but identically static.
2. **The "safe empty-fallback" requirement (`#179` AC5) is structurally
   satisfied, not just handled.** Ray's plan needs an explicit empty-fallback
   code path because their sync script runs *at build time* and calls out to
   Firestore — a Firestore outage during a build could ship an empty venue
   list unless guarded. Under (a), nothing about `next build` or
   `opennextjs-cloudflare build` talks to D1 at all — only the live "Publish"
   button does, decoupled from any build. If D1 is unreachable when an admin
   clicks Publish, the action fails visibly and no commit is made; the
   previously-published file is untouched and keeps shipping. There is no
   window in which a build can silently produce an empty map. This holds
   just as well now that D1 holds all 108 venues instead of 10 — the
   mechanism doesn't care how many rows are in the table.
3. **It doesn't touch the SEO investment from `#164`.** Per-venue pages use
   `generateStaticParams` with `dynamicParams = false`, restricting the route
   to build-time-known ids. Option (b) would either 404 newly-published
   venues until the next code deploy, or require relaxing `dynamicParams` and
   adding a second, KV-aware `getVenueById` path — real new surface area for
   a feature that shipped three weeks ago. Option (a) needs no change here:
   new venues simply become "build-time-known" the moment the publish commit
   lands, before the next deploy even finishes.
4. **With D1 as the single source, the old dual-source seam disappears
   (fixes B2).** The v1.0 draft of this document had `pfpVenues` in D1
   merged at publish-time with two untouched, script-owned TypeScript arrays
   — a design where a hypothetical id collision between D1 and one of the
   static arrays was theoretically possible even though unlikely. Now that
   *all* venues live in one D1 table with `id TEXT PRIMARY KEY`, the database
   itself makes a duplicate id structurally impossible — there is only one
   source, not three to reconcile. `getVenueById` (`src/lib/venueSchema.ts`,
   currently `venues.find((v) => v.id === id)`) cannot return a duplicate
   because its input array — the publish snapshot — can no longer contain
   one; `find()` doesn't need to change at all.

**Concrete mechanism for (a):** the publish handler (`POST /api/admin/publish`,
CF Access-gated) does not push straight to `main`. It commits the regenerated
file to a bot branch via the GitHub Contents API (plain `fetch()` — no new
HTTP client dependency, following the exact pattern already used for Resend
and Turnstile in this codebase) and opens a PR, which auto-merges once the
existing required checks — **"Lint, typecheck, build"** and **"Workers
Builds: pueblo-food-map"** — pass (verified via the repo's active ruleset,
`gh api repos/kr8vka0z/pueblo-food-map/rulesets/17480895`: exactly these two
contexts are required, squash-merge only, 0 required approving reviews —
consistent with a bot-authored PR needing no human click to merge). This is a
deliberate choice over pushing directly to `main`: Workers Builds is a system
independent of GitHub Actions CI (ARCHITECTURE.md: "A green CI run is
necessary but not sufficient... a separate system with its own build logs"),
so a direct push would let a malformed generated file reach production
without ever running `tsc` or `vitest` against it. Routing every publish
through the same PR + required-checks gate every human-authored change
already goes through means a broken publish is caught before it ships, with
zero extra process for the admin (auto-merge still requires no click).
**Prerequisite, already satisfied:** auto-merge is enabled on the repo
(verified `2026-07-01`: `gh api repos/kr8vka0z/pueblo-food-map -q
'.allow_auto_merge'` → `true`) — this exact gap has bitten other repos in
Kyle's GitHub org before, so it was worth checking rather than assuming.

**Option (b) is not wrong, and remains available as a v2 upgrade** if a
publish latency in the seconds range ever becomes an actual product
requirement (unlikely for a civic map that gets edited rarely). It is not
recommended for v1 given the SEO regression it introduces and the fact that
Ray's own plan already treats a ~10-minute go-live window as acceptable, not
as a gap to close.

### 3.4 Admin app shape

**Recommendation: one Next.js app, an `/admin` route group, served on
`admin.pueblofoodmap.com` via the same Worker** — matching `#73`'s own stated
lean ("one app, separate route group... less infra, same security boundary").

A single Cloudflare Worker can answer on multiple custom domains/routes; this
is a standard, well-supported pattern, not a workaround. Attaching
`admin.pueblofoodmap.com` as a second route on the existing `pueblo-food-map`
Worker means:

- Zero new deploy pipeline. The existing Workers Builds wiring, the existing
  `ci.yml` (lint/typecheck/test/build/audit), and the existing rollback
  procedure (CF dashboard → Deployments → "Rollback to this deployment")
  cover the admin routes automatically.
- Direct reuse of `src/types/venue.ts` (the `Venue` interface and
  `VenueCategory` union become the admin form's schema with zero
  duplication), `src/lib/logger.ts` (structured JSON logging, same PII
  discipline), and `DESIGN.md`/`globals.css` tokens (the admin UI looks like
  it belongs to the same product instead of a bolted-on tool).
- The real security boundary is Cloudflare Access at the hostname level, not
  process isolation — splitting into a second Worker would not meaningfully
  shrink the admin routes' blast radius (Access already blocks unauthenticated
  requests before either Worker's code runs), but it would double the
  infrastructure to own: a second Workers Builds pipeline, a second secrets
  set, and either a shared package or copy-pasted types to keep the two in
  sync. That's the opposite of this document's ownership goal.

A separate Worker was considered and rejected for v1 for exactly that reason
— more moving parts with no corresponding security gain.

### 3.5 Deploy / publish flow

```
┌──────────────────────────────────────────────────────────────────────┐
│ ADMIN WRITE PATH — draft edits, never touch the public runtime        │
│                                                                        │
│  Browser → admin.pueblofoodmap.com                                    │
│    │  Cloudflare Access (Google SSO + email allowlist) — edge gate    │
│    ▼                                                                  │
│  Next.js /admin route group (same Worker as the public app)           │
│    │  getAdminDb() verifies Cf-Access-Jwt-Assertion, THEN returns the │
│    │  D1 binding — pages and API routes both call this, not just a    │
│    │  shared layout guard (§3.1, I2)                                  │
│    ▼                                                                  │
│  Route handler: validate payload → db.batch([venues UPDATE/INSERT,    │
│                 audit_log INSERT])  — one atomic D1 transaction       │
│    ▼                                                                  │
│  D1 "pueblo-food-map-admin" — SINGLE source of truth for every venue. │
│  NEVER read by the public request path.                               │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ REFRESH FEEDER PATH — automated, proposes only, never writes venues   │
│ directly (§6)                                                         │
│                                                                        │
│  Scheduled GitHub Action (monthly OSM / weekly Plentiful — §6.2)      │
│    │  runs the scrapers PLUS the enrichment steps folded into the     │
│    │  feeder (hours/address parsing, §6.3 — fixes NB2), mints run_id  │
│    ▼                                                                  │
│  POST /api/admin/refresh/ingest, targeting admin.pueblofoodmap.com     │
│    (CF Access Service Token at the edge + bearer REFRESH_INGEST_TOKEN  │
│    in-app — NOT interactive Google SSO; §6.8. Exempt from the CSRF/    │
│    Origin check, §8 — no ambient cookie, not a browser call)          │
│    │  validate + cap the incoming batch (§6.9), then diff against      │
│    │  current ACTIVE (non-archived) D1 rows for that source_type, on  │
│    │  source-owned fields only (§6.3)                                 │
│    ▼                                                                  │
│  change_proposals INSERT (status='pending') — add / restore / update /│
│  remove — after the lifecycle rules in §6.10: auto-supersede prior    │
│  pending proposals for the same (source, target_venue_id); suppress   │
│  an exact repeat of a previously-rejected diff; no-op if run_id was    │
│  already processed. Abnormal removal batches are flagged (anomaly=1), │
│  never auto-applied                                                   │
│    ▼                                                                  │
│  Admin reviews at /admin/flags → approve or reject (§6.6, §6.7)       │
│    │  approve → stale-apply guard re-checks the proposal's assumption │
│    │  still holds (§6.10c), THEN the SAME db.batch() venues +          │
│    │  audit_log write a manual create/edit/archive would make — zero  │
│    │  new audit_log actions                                           │
│    ▼                                                                  │
│  D1 "pueblo-food-map-admin" (same table, same as any other write)     │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ PUBLISH PATH — explicit action, separate from Save (#180 AC6)         │
│                                                                        │
│  Admin clicks "Publish"                                               │
│    ▼                                                                  │
│  POST /api/admin/publish (CF Access-gated)                            │
│    1. SELECT * FROM venues WHERE status IN ('draft','published')      │
│       ORDER BY id — snapshot candidates. Drafts ARE included: they're │
│       what's about to go live (fixes NB1 — the old step 2 queried     │
│       status='published' only, silently dropping every pending draft) │
│    2. Validate every row against the Venue shape; strip admin-only    │
│       columns (status, source_type, outside_county, audit columns);   │
│       abort + surface an error to the admin on any mismatch (never    │
│       write a bad file, never touch venues.status)                    │
│    3. Serialize to src/data/published-venues.ts — no merge step: D1   │
│       is the ONLY source now (fixes B2 — see §3.3 point 4)            │
│    4. Commit via GitHub Contents API → branch → PR → auto-merge once  │
│       "Lint, typecheck, build" + "Workers Builds: pueblo-food-map"    │
│       are green                                                       │
│    5. ONLY once step 4's commit/PR call succeeds: a single             │
│       db.batch() promotes the exact draft ids captured in step 1 to   │
│       'published' (stamping published_at/published_by) AND inserts    │
│       the audit_log row (action='publish') — atomic, and skipped      │
│       entirely if step 4 fails, so a failed commit leaves every draft │
│       a draft and D1 unchanged (this IS the ordering note in §8 —     │
│       NB1: promotion now happens strictly after the commit, not       │
│       before it, which is how it could previously mark drafts         │
│       'published' in D1 even when the commit failed)                  │
│    ▼                                                                  │
│  Merge lands on main (existing push-to-main trigger — no new hook)    │
│    ▼                                                                  │
│  Cloudflare Workers Builds (EXISTING pipeline, unmodified)             │
│    npx opennextjs-cloudflare build → npx wrangler deploy               │
│    ▼                                                                  │
│  Production Worker redeployed. ~10 minutes is the FLOOR, not the      │
│  typical case: the PR's required "Workers Builds" check and the       │
│  post-merge production build are two SERIAL builds sharing the same   │
│  single Free-plan concurrent build slot (§8, I5). A colliding human   │
│  PR queues behind it — that's a delay, not a failure.                 │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ PUBLIC READ PATH — unchanged from production today, EXCEPT one guard  │
│                                                                        │
│  Browser → pueblofoodmap.com                                          │
│    ▼                                                                  │
│  Client bundle imports venues from src/data/venues.ts (build-time      │
│  static ESM import — same mechanism as today, zero fetch, zero D1,    │
│  zero KV, zero new request-time dependency). The benefitFlags runtime │
│  overlay in venues.ts now maps over published-venues.ts's single      │
│  array instead of a three-way spread, AND (fixes NB4) only fills a    │
│  field the published D1 row left NULL — an admin's explicit SNAP/WIC  │
│  edit always wins over the benefit-flags.ts match, where today's      │
│  overlay would otherwise silently discard it (§7 step 1, §3.2).       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. D1 schema

```sql
-- migrations/0001_init_admin_schema.sql
--
-- venues: the single source of truth for EVERY venue on the public map —
-- hand-curated and auto-generated alike. Today: 108 rows (10 pfp + 60 osm +
-- 38 plentiful — verified by direct count against src/data/*.ts, 2026-07-01).
-- This is a scope change from v1.0 of this document, which scoped `venues`
-- to just the 10 pfpVenues records and left OSM/Plentiful as untouched,
-- script-owned static files. See §7 for the full-seed migration.

CREATE TABLE venues (
  id              TEXT PRIMARY KEY,             -- id: 'garden-*' /
                                                  -- 'landscape-*' (PFP),
                                                  -- 'osm-<type>-<id>' (OSM's
                                                  -- own node/way id — verified
                                                  -- in scripts/ingest-osm-
                                                  -- grocery.py), 'plentiful-
                                                  -- <url-slug>' (the LAST
                                                  -- SEGMENT of Plentiful's own
                                                  -- detail-page URL —
                                                  -- verified in scripts/
                                                  -- scrape-plentiful.py). All
                                                  -- three schemes are
                                                  -- collision-free by
                                                  -- construction today
                                                  -- (distinct prefixes,
                                                  -- source-native
                                                  -- identifiers); the seed
                                                  -- script's validation
                                                  -- report (§7 step 3) fails
                                                  -- loudly if that's ever
                                                  -- wrong. NOT claimed stable
                                                  -- under a Plentiful rename,
                                                  -- though (fixes
                                                  -- Important-1 — softened
                                                  -- from an earlier "verified
                                                  -- stable" claim): the slug
                                                  -- embeds the venue NAME
                                                  -- (e.g. 'plentiful-pueblo-
                                                  -- community-soup-kitchen-
                                                  -- 1bc98af5'), and the
                                                  -- committed data already
                                                  -- has a same-name/same-
                                                  -- coordinates/same-phone
                                                  -- pair under two DIFFERENT
                                                  -- ids ('...-1bc98af5' vs
                                                  -- '...-plentiful-3195') —
                                                  -- so a Plentiful-side
                                                  -- rename is expected to
                                                  -- surface as a remove+add
                                                  -- pair, not an update (same
                                                  -- failure class as an OSM
                                                  -- node→way remap). §6.6's
                                                  -- "possible rename" hint is
                                                  -- the mitigation; id
                                                  -- stability itself is not
                                                  -- claimed.
  name            TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN (
                    'pantry','grocery','convenience','farm','garden',
                    'edible_landscape','meal_site'
                  )),
  lat             REAL NOT NULL,
  lng             REAL NOT NULL,
  address         TEXT NOT NULL,
  hours_weekly    TEXT,      -- JSON-encoded WeeklyHours (nullable)
  accepts_snap    INTEGER,   -- tri-state: NULL=unknown, 0=no, 1=yes.
                                -- Publish-serializer mapping (one line, per
                                -- nit): NULL -> Venue.accepts_snap left
                                -- `undefined` (key omitted), 0 -> `false`,
                                -- 1 -> `true` — matches the optional
                                -- `boolean` the Venue type already declares
                                -- (src/types/venue.ts). NULL/`undefined` is
                                -- also exactly the signal the benefitFlags
                                -- overlay checks before falling back (fixes
                                -- NB4, §7 step 1) — a non-NULL value here is
                                -- an admin's explicit edit and always wins.
  accepts_wic     INTEGER,   -- same tri-state + serializer mapping as
                                -- accepts_snap, above.
  phone           TEXT,
  email           TEXT,
  url             TEXT,
  notes           TEXT,
  operator        TEXT,
  source          TEXT NOT NULL,   -- human-readable provenance citation,
                                     -- e.g. "OpenStreetMap (node/4041375052)"
                                     -- — same meaning as today's Venue.source.
  last_verified   TEXT NOT NULL,   -- ISO date, matches Venue.last_verified

  -- Admin/workflow columns — NOT part of the public Venue shape; stripped
  -- out by the publish serializer before a row becomes a static record.
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','published','archived')),
  source_type     TEXT NOT NULL CHECK (source_type IN (
                    'pfp','osm','plentiful','gtfs','manual'
                  )),               -- WHICH upstream feed owns this row, if
                                     -- any. Distinct from `source` (a free-
                                     -- text citation string) — this is the
                                     -- MACHINE key the refresh diff engine
                                     -- (§6.3) uses to know which existing
                                     -- rows a given run is responsible for.
                                     -- 'manual' = admin-created, no upstream
                                     -- feed. 'gtfs' is reserved for forward-
                                     -- compat — no GTFS feeder exists yet
                                     -- (#133: roadmap/post-demo).
  outside_county  INTEGER NOT NULL DEFAULT 0,  -- set when lat/lng fails the
                                                 -- PUEBLO_COUNTY_BBOX check
                                                 -- (src/data/pueblo-bbox.ts)
                                                 -- + admin explicitly
                                                 -- confirmed anyway

  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by      TEXT NOT NULL,   -- verified Access JWT email claim — for a
                                     -- row created by approving a change-
                                     -- proposal, this is the REVIEWING
                                     -- admin's email, not a bot identity
                                     -- (§6.7)
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_by      TEXT NOT NULL,
  published_at    TEXT,            -- NULL until first publish
  published_by    TEXT
);

CREATE INDEX idx_venues_status      ON venues(status);
CREATE INDEX idx_venues_category    ON venues(category);
CREATE INDEX idx_venues_source_type ON venues(source_type);

-- change_proposals: what an automated refresh run or a link-health check
-- thinks should change. NOTHING here touches `venues` until an admin
-- approves it (§6) — this table is the mechanism that lets #133's
-- ingestion and #234's freshness/drift monitoring propose changes without
-- ever writing directly to the live data. NEW in this revision.
CREATE TABLE change_proposals (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  source          TEXT NOT NULL CHECK (source IN (
                    'osm','plentiful','gtfs','link_health'
                  )),
  target_venue_id TEXT NOT NULL,   -- the stable id this proposal targets.
                                     -- For 'add', the id the record WOULD
                                     -- get (deterministic per source — see
                                     -- the `venues.id` comment above), so no
                                     -- separate fuzzy match-key concept is
                                     -- needed. For 'update'/'remove', an id
                                     -- that already exists in `venues`.
  change_type     TEXT NOT NULL CHECK (change_type IN ('add','update','remove')),
                                     -- No separate 'restore' value (Important-2):
                                     -- an 'add' whose target_venue_id already
                                     -- exists as an archived row applies as an
                                     -- upsert-that-revives instead of a plain
                                     -- INSERT (§6.3, §6.7) — the review UI
                                     -- detects and labels this case "Restore"
                                     -- by checking current archived-row
                                     -- existence, no schema distinction needed.
  proposed_diff   TEXT NOT NULL,   -- JSON, ONE shape for every source (fixes
                                     -- a §6.5 shape-mismatch nit): { before:
                                     -- Venue|null, after: Venue|null,
                                     -- fields_changed: string[], meta?:
                                     -- Record<string, unknown> }. `meta` is
                                     -- the extensibility valve for source-
                                     -- specific context that isn't a venue
                                     -- field itself — e.g. a link_health
                                     -- proposal sets meta: { http_status,
                                     -- checked_at } alongside a normal
                                     -- `after` with the url field cleared
                                     -- (§6.5). A link_health proposal's
                                     -- `after` only ever carries what the
                                     -- check can safely assert (e.g. url
                                     -- cleared) — it can't invent a
                                     -- replacement URL.
  diff_hash       TEXT NOT NULL,   -- stable hash (e.g. SHA-256) of the
                                     -- normalized { after, fields_changed }
                                     -- content, computed identically every
                                     -- run. Powers rejection memory (§6.10b)
                                     -- — an identical diff to one a human
                                     -- already rejected is not re-proposed.
                                     -- New in this revision (fixes NB3b).
  run_id          TEXT NOT NULL,   -- groups every proposal from one refresh
                                     -- run, so the review UI can show/
                                     -- approve/reject a run as a unit (§6.6)
                                     -- and the sanity guardrail (§6.4) can
                                     -- flag a run without a second table.
                                     -- Also doubles as an idempotency key
                                     -- (fixes NB3d, §6.10d): minted by the
                                     -- calling GitHub Action as `${{
                                     -- github.run_id }}`, stable across a
                                     -- retried POST for the same workflow
                                     -- run, so a retry can't duplicate a
                                     -- whole run's proposals.
  anomaly         INTEGER NOT NULL DEFAULT 0,  -- 1 if this run tripped the
                                                 -- sanity guardrail (§6.4) —
                                                 -- surfaced distinctly in the
                                                 -- review UI and EXCLUDED
                                                 -- from the default "approve
                                                 -- all" bulk action.
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected',
                    'superseded')),  -- 'superseded' (fixes NIT: distinguish
                                       -- from human rejection in the data):
                                       -- the proposal was made moot by
                                       -- something OTHER than an explicit
                                       -- human approve/reject click — a
                                       -- newer ingest run targeting the same
                                       -- (source, target_venue_id) (§6.10a),
                                       -- a hand-edit touching the same
                                       -- fields (§5 step 2), or the
                                       -- stale-apply guard finding the data
                                       -- moved since this proposal was
                                       -- written (§6.10c). 'rejected' means
                                       -- a human looked at it and said no;
                                       -- 'superseded' means the world moved
                                       -- on before anyone looked.
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  reviewed_by     TEXT,             -- verified Access JWT email claim of the
                                     -- admin who approved/rejected this —
                                     -- also this table's own audit trail for
                                     -- the review decision itself, so a
                                     -- rejection does not additionally write
                                     -- an audit_log row (§6.7).
  reviewed_at     TEXT,
  applied_at      TEXT              -- NULL until an 'approved' proposal's
                                     -- venues mutation actually lands (§6.7)
);

CREATE INDEX idx_change_proposals_status ON change_proposals(status);
CREATE INDEX idx_change_proposals_run    ON change_proposals(run_id);
CREATE INDEX idx_change_proposals_target ON change_proposals(target_venue_id);
-- Composite index for the two §6.10 lifecycle lookups: auto-supersede
-- (source, target_venue_id, status='pending') and rejection memory
-- (source, target_venue_id, diff_hash, status='rejected') — both query on
-- this same leading-column shape, so one index covers both (fixes NB3a/b).
CREATE INDEX idx_change_proposals_dedup  ON change_proposals(source, target_venue_id, diff_hash);

-- audit_log: append-only. No UPDATE/DELETE grant is ever exposed at the
-- app layer — enforced by omission (no route handler for it exists), not
-- by a DB permission (D1 has no per-table ACLs). Unchanged from v1.0 of
-- this document — approving a change-proposal reuses these exact same
-- action values (create/update/archive), so no new enum value is needed
-- here (§6.7).
CREATE TABLE audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_email   TEXT NOT NULL,
  entity        TEXT NOT NULL,    -- 'venue' (v1); 'banner' from #73 Phase 2
  entity_id     TEXT NOT NULL,
  action        TEXT NOT NULL CHECK (action IN ('create','update','publish','archive')),
  before_json   TEXT,             -- NULL on create
  after_json    TEXT NOT NULL,
  timestamp     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_audit_entity    ON audit_log(entity, entity_id);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);
```

```sql
-- migrations/0002_banners.sql — #73 Phase 2, NOT created in v1.
-- Documented here for forward-compatibility of the audit_log `entity` enum
-- and so the eventual migration is a known, reviewed shape rather than an
-- ad hoc addition.
CREATE TABLE banners (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  text_en       TEXT NOT NULL,
  text_es       TEXT NOT NULL,
  cta_url       TEXT,
  dismissible   INTEGER NOT NULL DEFAULT 1,
  severity      TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','urgent')),
  starts_at     TEXT,
  ends_at       TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by    TEXT NOT NULL
);
```

**No `admins`/`roles` table.** Single admin role in v1 (`#179` decision log
#2) is enforced entirely by the CF Access policy allowlist (§3.1) — adding a
DB-backed role table here would be a second, redundant, driftable source of
truth for a fact Cloudflare Access already owns. This applies equally to
`change_proposals.reviewed_by` — it's a record of *who* reviewed, not a role
grant.

`wrangler.jsonc` additions:

```jsonc
{
  // ...existing config unchanged...
  "d1_databases": [
    {
      "binding": "ADMIN_DB",
      "database_name": "pueblo-food-map-admin",
      "database_id": "<from `wrangler d1 create`>",
      "preview_database_id": "<from `wrangler d1 create pueblo-food-map-admin-preview`>"
    }
  ]
}
```

`preview_database_id` is a real, currently-supported field (verified against
the installed `wrangler` package's own `config-schema.json`, `^4.105.0`) — but
its documented purpose is narrower than it sounds: it governs which D1
database `wrangler dev` / `opennextjs-cloudflare preview` binds to **locally**,
not which database a Workers-Builds-generated PR preview URL — or a version
preview URL (§3.1) — binds to remotely. See the honest limitation this
creates in [§13](#13-tradeoffs-risks--open-questions).

---

## 5. Draft → publish workflow

1. **Create.** Admin fills the venue form (mirrors `/suggest`'s fields, plus
   admin-only fields: `status`, `source`, `source_type`, `last_verified` are
   directly editable rather than fixed — a manually-created venue gets
   `source_type='manual'`). `POST /api/admin/venues` inserts a row with
   `status='draft'` and writes a matching `audit_log` row (`action='create'`)
   in the same `db.batch()`. The public site is completely unaffected — this
   row isn't in any published snapshot yet. **A venue can also be created by
   approving an 'add' change-proposal (§6.7)** — same insert, same
   `status='draft'`, same audit row, just with the reviewing admin as
   `created_by` instead of a form-filling admin.
2. **Edit.** `PATCH /api/admin/venues/[id]` — "Save" updates the row in place
   (status untouched if already `published`; `#180` decision log #3 accepts
   last-write-wins, no optimistic locking in v1) and writes an `audit_log`
   row (`action='update'`) with `before_json`/`after_json` diffs, same
   transaction. If a pending `change_proposals` row targets the same venue
   and field(s) this edit touches, that proposal is superseded — its
   `status` flips to **`'superseded'`** (not `'rejected'`: no human reviewed
   and declined it, the hand-edit just made it moot — same distinction
   §6.10a draws for auto-supersede on a new ingest run) with `reviewed_by`
   set to the editing admin, so a stale flag doesn't keep nagging about
   something a human already fixed by hand (§6.5, §6.10a).
3. **Outside-county check.** Reuses the existing `PUEBLO_COUNTY_BBOX`
   constant (`src/data/pueblo-bbox.ts`) on both client and server. If lat/lng
   falls outside it, the form requires an explicit confirmation checkbox
   before Save succeeds; `outside_county` is persisted for visibility in the
   list view. Matches `#178` decision log #4 exactly.
4. **Archive (soft delete).** `POST /api/admin/venues/[id]/archive` sets
   `status='archived'`. No DELETE route exists anywhere in the admin API —
   hard delete is structurally impossible through the UI, matching `#180`'s
   "out of scope: hard delete." **An approved 'remove' change-proposal
   produces the exact same mutation** (§6.7) — a source reporting a venue
   is gone never results in a hard delete, only this same soft-archive.
5. **Publish.** A separate, explicit button — never bundled into Save (`#180`
   AC6). `POST /api/admin/publish` runs the 5-step sequence in §3.5:
   snapshot every draft+published row → validate + strip admin-only
   columns → serialize → commit/PR/auto-merge → **only once that commit/PR
   call succeeds**, a single `db.batch()` promotes those exact draft ids to
   `published` and writes the audit row. A failed commit leaves every draft
   a draft and touches nothing in D1 (§8's ordering note; fixes NB1 — this
   was previously reversed, with promotion happening *before* the commit
   attempt, which could mark drafts 'published' in D1 even when the commit
   failed). The admin UI shows the resulting PR URL and polls its merge
   state so "still publishing" vs. "merged, deploying" vs. "live" is visible
   rather than a static "~10 minutes" message (§8, I5). **A successful
   publish promotes every draft captured in that publish's snapshot** —
   both hand-edits and D1 rows staged by an approved change-proposal — not
   just the clicking admin's own changes. That's acceptable for a handful of
   trusted admins under the already-accepted last-write-wins model (`#180`
   decision log #3), but it's worth stating plainly rather than leaving
   implicit: **any admin's saved edit or approved proposal ships the next
   time *anyone*'s Publish click successfully commits** (I6). A draft saved
   *after* another admin's snapshot was already taken simply isn't in that
   commit — it ships on the next successful publish instead, via the same
   branch-reuse/last-snapshot-wins mechanism already accepted for concurrent
   publishes (§8, I5). Per-record publish granularity is a plausible v2
   refinement, noted in §11 and §13, not built here.
6. **Discard.** Because there's no separate draft-vs-published row (see the
   design note below), "discard" for a never-published venue is just `archive` (it
   was never live, so archiving removes it from the admin's active list with
   no visible effect); for a published venue, "discard" isn't a distinct
   operation — an admin simply re-edits the fields back, or does nothing
   (their unsaved changes were never Saved, so there's nothing to discard).

**Design note — one row, not two:** `#73`'s original Phase 1 language ("live
map keeps showing the published version" while a draft is edited) could be
read as requiring two representations per venue (a frozen published copy plus
a mutable draft copy). This spec uses one row with a `status` field instead,
because the public site never reads D1 live (§3.3) — it reads whatever was
baked in at the last successful Publish, however many edits have piled up in
D1 since. "The live map keeps showing the published version while a draft is
edited" is therefore automatically true: the public site is static and
doesn't change until Publish runs, full stop. The two-table model was
considered and rejected as unnecessary complexity for a single-admin-role tool
that has already accepted last-write-wins (`#180` decision log #3) — it would
be the correct upgrade if/when this ever needs true multi-editor concurrency.
This same one-row model is also what lets an approved change-proposal apply
as an ordinary field update with **zero new status semantics** — approving is
just another way an admin-authorized write reaches the same row (§6.7).

---

## 6. Auto-refresh & the change-approval queue

**This is the core new feature of this revision.** It exists because Part A
of Kyle's scope decision (§2) brings the auto-generated OSM and Plentiful
records into D1 alongside the hand-curated ones. Once they're admin-editable
in the same table, the next scrape re-run has to stop being able to silently
clobber a correction an admin just made — the old model (a script overwrites
a committed `.ts` file, full stop) is incompatible with that. The fix: an
automated refresh run never writes to `venues` directly. It computes what it
*thinks* should change, writes those as proposals, and a human decides.

### 6.1 Why this unifies `#133`, `#234`, and the admin CRUD work

Covered in full in [§1](#1-purpose--context). In short: `#133`'s ingestion
becomes this queue's feeder, `#234`'s freshness monitoring (sanity
guardrails, link-health checks, reconciliation review for removals) becomes
literal features of this queue, and the admin's own create/edit/archive
actions are just the human-initiated path to the same `venues` table this
queue's approved proposals also write to.

### 6.2 Refresh sources & cadence

| `source` value | Feeds from | Cadence (illustrative — tune with Kyle) | Status |
|---|---|---|---|
| `osm` | `scripts/ingest-osm-grocery.py` (Overpass) | Monthly — matches `#133` comment 4.1 | Scraper exists today; currently writes `grocery-osm.ts` directly — that write target changes (§6.3) |
| `plentiful` | `scripts/scrape-plentiful.py` | Weekly — pantries change more often than OSM groceries (per `#234`'s own guidance: "cadence matched to how often each source changes") | Scraper exists today; same write-target change as OSM |
| `gtfs` | none yet | n/a | Not built. `#133` lists GTFS as roadmap/post-demo. Reserved in the schema (§4) so adding it later doesn't require a design change — building the scraper itself is out of scope here (§2) |
| `link_health` | New: periodic check of every venue's stored `url` | Weekly (illustrative) | New in this design (§6.5) |

Both cadences are currently **manual** ("re-run `scripts/scrape-plentiful.py`"
/ "re-run `scripts/ingest-osm-grocery.py`" per the README's data-sources
table) — there is no scheduled GitHub Action running them today. Wiring that
schedule is part of this proposal's Phase 3 (§11), since a queue with no
feeder isn't testable end-to-end.

### 6.3 How a refresh run becomes proposals — the diffing mechanism

**Reality check performed against the committed data — this grounds fix
NB2, and corrects a false claim an earlier draft of this section made.**
`src/data/grocery-osm.ts` today carries **zero** remaining
`"Address not in OpenStreetMap"` placeholders and **~20** populated
`hours_weekly` fields across its 60 records. Neither comes from
`scripts/ingest-osm-grocery.py` as it exists today — that script emits the
placeholder string when OSM has no `addr:*` tags (verified: line ~97) and
dumps `opening_hours` into a free-text `notes` string, never into
`hours_weekly` (verified: line ~173). Both gaps were closed by two **one-off**
scripts run *after* the scraper — `scripts/scrub-osm-venues.ts` (parses the
`"Hours (OSM opening_hours): ..."` notes text into `hours_weekly`;
reverse-geocodes `"Address not in OpenStreetMap"` rows via
Nominatim/Mapbox) and `scripts/geocode-osm-missing.py` (the same
reverse-geocode, standalone) — neither of which is part of any repeatable
pipeline; both are "run once by hand, redirect stdout into the committed
file" tools. **The scraper's raw output is therefore not the same as what's
committed — the scrapers are not simply "untouched" feeders whose raw JSON
can be diffed directly against D1.** Wired to the ingest endpoint as-is,
every one of the ~20 `hours_weekly` records and every reverse-geocoded
address would show up as a field diff on the very first run, and — because
§6.4's sanity guardrail only gates *removals*, not *updates* — every one of
those would flow straight into the pending queue as an ordinary, ungated
`update` proposal. Approving any of them (or a careless bulk-approve) would
silently overwrite a real street address back to a placeholder string, or
blank real hours back to nothing — the exact "next scrape clobbers an admin
correction" failure this whole queue exists to prevent, except the
clobbering source here isn't even a real upstream change, it's the feeder
disagreeing with its own committed output.

**Fix — two parts:**

1. **Fold the one-off enrichment into the feeder so its output is
   reproducible.** The small new script that POSTs to
   `/api/admin/refresh/ingest` (below) runs the scraper, then runs the same
   parsing `scrub-osm-venues.ts` already does (notes → `hours_weekly`) and
   the same reverse-geocode fallback (`"Address not in OpenStreetMap"` →
   Nominatim/Mapbox lookup) as an in-pipeline step **before** posting — not
   two separate hand-run scripts whose output only ever landed in git once.
   This makes `hours_weekly` and a reverse-geocoded `address` genuinely
   source-owned again: the same OSM `opening_hours` tag and the same
   coordinates deterministically produce the same fields every run,
   comparable apples-to-apples against what's already in D1.
2. **Diff only source-owned fields, even after (1).** Reverse-geocoding
   calls a third-party API (Nominatim primary, Mapbox fallback) that isn't
   guaranteed to return byte-identical formatting run over run, and an admin
   may have hand-corrected a geocoded address to something more precise than
   any geocoder would produce. Per `source_type`, the diff engine compares
   only an explicit allowlist of source-owned fields — for `osm`: `name`,
   `category`, `lat`, `lng`, `phone`, `url`, `operator`, `hours_weekly` (now
   reproducible per (1)). **`address` is excluded from triggering an
   `update` proposal for OSM records** — it's enrichment, not something OSM
   itself authors, so a formatting difference from a re-geocode is never
   grounds to propose overwriting a value that may well be a hand
   correction. (A changed `address` is still visible to an admin on request
   — it's just not something the automated diff proposes on its own.) The
   same principle applies to Plentiful and any future source: only fields
   the source itself is authoritative for participate in `update` diffing.

**Authentication is a real design gap the old ingestion model never had to
solve, because it never talked to the admin surface at all.** A scheduled
GitHub Action is not a human — it cannot complete an interactive Google SSO
flow, so it cannot authenticate as a Cloudflare Access identity the way an
admin's browser does. This needs its own, narrowly-scoped credentials —
**two independent layers, edge and app (fixes Important-4b):**

- **Edge: a Cloudflare Access Service Token** (§3.1, I4) lets the Action's
  non-interactive request pass the `admin.pueblofoodmap.com` Access
  application without Google SSO — validated by Cloudflare before the
  request reaches the Worker at all.
- **App: `REFRESH_INGEST_TOKEN`** — a bearer secret, set via
  `wrangler secret put` (the same mechanism already used for
  `RESEND_API_KEY`/`TURNSTILE_SECRET_KEY`, AGENTS.md), stored in 1Password
  (1Password) and provided to the GitHub Action as a repo secret (same
  pattern as `MAPBOX_PREVIEW_TOKEN`, AGENTS.md). Checked inside the route
  handler itself, same as every other `/api/admin/*` check.
- Together they authenticate exactly **one** route —
  `POST /api/admin/refresh/ingest` — and nothing else; neither grants access
  to any other `/api/admin/*` route or `/admin/*` page. A leaked ingest
  token lets someone submit refresh proposals (which still require a human
  to approve before touching `venues`, and are now capped per run — §6.9) —
  it does not let them read or write a venue directly. Full credential
  summary in §6.8.

**Diffing mechanism.** The route handler does the actual diff:

1. Load current `venues` rows `WHERE source_type = <source> AND status IN
   ('draft', 'published')` — **archived rows are deliberately excluded**
   (fixes the §6.4 denominator inconsistency, and sets up the resurrection
   case below). An archived row is already "removed" as far as the public
   map is concerned; it shouldn't count against the active total, and it
   shouldn't be diffed as if it were still live.
2. For each incoming record (already enriched per fix (1) above): if its id
   isn't in the current active set, check whether a row with that id exists
   **at all**, regardless of status. Not found anywhere → propose
   `change_type='add'`. **Found, but `archived`** → this is a returning
   venue, not a new one; the review UI labels it a **Restore** (§6.6), and
   it applies as an upsert-to-draft, never a raw `INSERT` (§6.7 — fixes
   Important-2, where a plain `INSERT` would primary-key-violate against the
   still-present archived row). If the id IS in the current active set,
   diff only the source-owned field allowlist above; any difference →
   propose `change_type='update'` with a field-level diff (`fields_changed`)
   restricted to that allowlist.
3. After processing all incoming records: any row in the active base set
   from step 1 whose id was **not** seen in the incoming set → propose
   `change_type='remove'` — subject to the sanity guardrail (§6.4).
4. All proposals from one run share a `run_id` and start `status='pending'`
   — except where the lifecycle rules in §6.10 suppress or supersede them
   before they're written.

```
// illustrative, not final implementation
for (const incoming of freshRecords) {           // already enriched, source-owned fields only
  const current = activeCurrentById.get(incoming.id);
  if (!current) {
    const archived = archivedCurrentById.get(incoming.id);
    proposals.push(archived ? diffAsRestore(archived, incoming, runId)
                             : diffAsAdd(incoming, runId));
  } else if (sourceOwnedFieldsDiffer(current, incoming)) {
    proposals.push(diffAsUpdate(current, incoming, runId));
  }
  seenIds.add(incoming.id);
}
for (const current of activeCurrentRows) {
  if (!seenIds.has(current.id)) removalCandidates.push(current);
}
// removalCandidates go through the sanity guardrail (§6.4). All proposals
// then pass through the lifecycle rules in §6.10 (auto-supersede, rejection
// memory) before being written as change_proposals rows.
```

### 6.4 Sanity guardrail — abnormal mass-removal

This directly implements `#234`'s own acceptance criterion: *"if a source
returns 0 items or an abnormal drop... treat it as a likely upstream
failure — hold the change and alert, don't auto-remove."*

**Grounded against real scale, not the inflated figure in this revision's
brief.** The task that produced this document estimated "~1,340 auto-
generated records" — that number conflates *line counts* (841 + 499 lines)
with *record counts*. The actual counts, verified by direct grep against
`src/data/grocery-osm.ts` and `src/data/pantries-plentiful.ts`: **60 OSM
records, 38 Plentiful records** (98 combined, 108 with the 10 PFP records).
This matters concretely because the guardrail's threshold has to be
calibrated to the real scale, not an order of magnitude larger one — a rule
tuned for "flag if >200 of 1,340 disappear" would never trip at the actual
size of these sources.

**Illustrative default:** if a run's removal candidates **reach or exceed
20% of that source's current active row count** (`status IN
('draft','published')` for that `source_type` — NOT archived, and NOT just
`published`; §6.3 fixes the same denominator inconsistency in the diff
engine itself, which this guardrail's candidates are drawn from), **with a
floor of 5** (avoids tripping on noise at tiny counts) — e.g., ≥12 of 60 for
OSM, ≥8 of 38 for Plentiful — the run is marked `anomaly=1`. ("Reach or
exceed," not "exceed": 12 of 60 **is** exactly 20%, so the threshold has to
include the boundary value or its own worked example wouldn't trip it —
fixes a NIT.) **The floor raises the bar for small sources, it doesn't
lower it** — it's a minimum absolute count, not an alternate "or" trigger:
a 10-row source trips at **5** removals (50%), not at 2 (the raw 20%
figure) — worth spelling out because "floor" could otherwise be misread as
making a tiny source trip *more* easily (fixes a NIT). Removals from an
anomalous run are still written as individual `change_proposals` rows (an
admin needs to actually see what would be removed to make a judgment call),
but:

- They're visually distinct and sorted to the top of the review queue
  (§6.6).
- They're **excluded from the default "approve all" bulk action** — an admin
  has to open the anomalous run specifically to approve those removals,
  which is a deliberate speed bump against rubber-stamping a scraper glitch.
- Adds/updates from the *same* run are not automatically held — a partial-
  scrape failure typically manifests as apparent removals (records the
  scraper failed to find), not bad adds/updates, so gating only the removal
  batch matches the actual failure mode `#234` describes rather than
  freezing an entire run indiscriminately.

Both the threshold and the cadences in §6.2 are illustrative defaults, not
load-bearing numbers — real-world tuning after the queue has live data is
noted as an open question in §13.

### 6.5 Link-health checks

Also `#234`'s own scope: *"Outbound link-health checks: periodically verify
every displayed link... still resolves — flag 404s / dead links for fix, and
don't render a known-dead link."*

A periodic job (weekly, illustrative) checks every venue's `url` field.

**"Clear failure," defined (fixes a NIT — previously undefined, risking
transient-404/bot-block false positives):** a status of **404 or 410 on two
consecutive weekly checks**, or a DNS-resolution/connection failure
persisting across the same two checks. Requiring persistence across a run
boundary, not a single check, absorbs the common transient-blip case.
**Explicitly NOT a clear failure, and never proposed:** `403` (frequently a
bot-block/WAF response to the checker's own request, not evidence the page
is gone), `429` (rate-limited, not dead), any `5xx` (the *target* site
having a bad moment, not this venue's link being wrong), and a single-check
timeout. These are logged for visibility (so a pattern across many venues is
still discoverable) but never turn into a `change_proposals` row on their
own. `ponytail:` a 2-consecutive-check rule is a simple ceiling, not a
robust flakiness model — ratchet up (e.g. 3-of-4 checks) if false positives
show up in practice; ship the simple version first.

A dead link (per the definition above) produces a `change_proposals` row:
`source='link_health'`, `change_type='update'`, `target_venue_id` = that
venue, `proposed_diff` in the one shape every proposal uses (fixes a §4
shape-mismatch nit): `{ before: {...url: "<dead-url>"}, after: {...url:
null}, fields_changed: ["url"], meta: { http_status: 404, checked_at: "..."
} }`. It does **not** invent a replacement URL — it can't know one.
Approving it clears the dead link (applies `after.url: null`); if an admin
has a corrected URL in hand, the better move is to reject the flag and
hand-edit the venue directly with the fix, which — per §5 step 2 —
automatically supersedes the now-stale flag (§6.10a) rather than leaving it
to nag after the fact.

**Verification (live, not hypothetical):** `#235` — the "Center Toward Self
Reliance" venue's dead Plentiful link — is an intentional, currently-unfixed
canary for exactly this feature, decided 2026-07-01: *"This issue is verified
when the monitoring flags #235 automatically — not by hard-coding that
URL."* The concrete test for this feature, before it ships: confirm the
link-health checker generates a pending proposal for that venue's `url`
without the checker's code ever having referenced `#235` or that specific
URL. See §6.10's reconciliation note for how this same canary can
legitimately also produce a *second*, independent `plentiful` `remove`
proposal for the same venue without the two conflicting.

### 6.6 Admin review UI — the approval queue

A new route, `/admin/flags` — a queue/inbox of pending `change_proposals`:

- Grouped by `run_id` (collapsible), filterable by `source` /
  `change_type` / `status`.
- Anomalous runs (§6.4) are visually distinct (a warning treatment) and
  sorted first.
- Each item shows a before/after diff rendered from `proposed_diff`. This
  pulls forward — deliberately, and narrowly — a slice of what `#73`
  originally deferred wholesale as "audit-log viewer UI" (§2 non-goals):
  just enough diff-rendering to review a pending proposal, not the full
  paginated/filterable `audit_log` browser, which stays deferred.
- **Approve** / **Reject**, both per-item and bulk (multi-select checkboxes
  + "approve selected" / "reject selected"), executed as one `db.batch()`
  across the selected set. Per §6.4, a default "approve all pending" action
  excludes anomaly-flagged items — approving those requires opening that
  run specifically.
- **"Restore" labeling (fixes Important-2, §6.3/§6.7):** an `add` proposal
  whose `target_venue_id` already exists as an `archived` row is labeled
  **"Restore"** instead of "New," with a one-line note on when it was
  archived (pulled from that row's own `audit_log` history) so the admin
  isn't confused about why a "new" venue already has history.
- **"Possible rename" pairing hint (fixes Important-1):** a `remove`
  proposal and an `add`/`restore` proposal — from the same run, or recent
  runs of the same source — are cross-checked for name similarity and close
  lat/lng. A match is visually linked in the queue ("Possibly the same
  venue, renamed — review together") rather than shown as two unrelated
  items an admin might approve independently without noticing they're the
  same physical place. This is a hint, not an auto-merge — Plentiful's slug
  is not claimed stable (§4), so a genuine rename is expected to surface as
  a remove+add pair, and this isn't hypothetical: the committed data already
  contains one such pair under two different Plentiful ids — same name,
  same coordinates, same phone (`plentiful-pueblo-community-soup-kitchen-
  1bc98af5` and `...-plentiful-3195`) — that this hint would have caught.

### 6.7 Applying an approved proposal to D1

**The core design decision here: approving a proposal performs exactly the
same D1 mutation and `audit_log` write that a manual create/edit/archive
already makes (§5) — nothing new to `venues`' status semantics, nothing new
to `audit_log`'s action enum.** The only difference is where the field
values came from (a proposal's `proposed_diff` instead of a human typing
into a form) and who's recorded as the actor (the *reviewing* admin, not a
bot identity — they're the one authorizing this specific mutation, even
though the underlying data originated from an automated source):

| `change_type` | Mutation on approve | `venues.status` after | `audit_log.action` |
|---|---|---|---|
| `add` | `INSERT ... ON CONFLICT(id) DO UPDATE` (upsert, not a plain `INSERT` — fixes Important-2) — a fresh id inserts normally; an id that already exists as an `archived` row instead **restores** it (every field overwritten from `proposed_diff.after`, forced `status='draft'`) rather than primary-key-violating. The review UI detects this ahead of approval by checking whether `target_venue_id` already exists archived, and labels it "Restore" (§6.3, §6.6) | `'draft'` either way (a fresh add or a restore both need a Publish click, §5 step 1) | `'create'` for a genuinely new id; `'update'` for a restore (the row already existed — no new value needed, keeping this table's existing "zero new statuses" principle) |
| `update` | `UPDATE` existing row's fields in place, `updated_by` = reviewing admin | unchanged (matches `#180` decision log #3: "status untouched if already published") | `'update'` |
| `remove` | `UPDATE ... SET status='archived'`, `updated_by` = reviewing admin | `'archived'` | `'archive'` |

**Before any of these mutations runs, the stale-apply guard (§6.10c)
re-verifies the proposal's assumptions still hold against the current row**
— approval is refused, and the proposal flips to `'superseded'` instead of
being applied, if they don't (fixes NB3c).

Each approval runs as one `db.batch()`: the `venues` mutation, the
`change_proposals` row's `status='approved'` + `reviewed_by` + `reviewed_at`
+ `applied_at`, and the `audit_log` insert — atomic, same pattern already
used for every other admin write in this design (§3.5).

**Rejecting OR superseding a proposal does not write a separate
`audit_log` row.** `change_proposals` itself already carries
`reviewed_by`/`reviewed_at`/`status` (`'rejected'` for an explicit human
decision, `'superseded'` for auto-supersede/hand-edit/stale-apply — §6.10)
— that *is* the audit trail for an outcome that, by definition, never
touched `venues`. Adding a redundant `audit_log` entry for the same fact in
two tables was considered and rejected as unnecessary duplication (ponytail:
don't add a second copy of a fact one table already records durably).

### 6.8 Refresh-feeder authentication — summary

Covered in detail in §6.3; cross-referenced from §8 (Security) because
these are new credentials this revision introduces. Two independent layers,
edge and app — neither alone is trusted (fixes Important-4b):

- **Edge: a Cloudflare Access Service Token** (§3.1, I4) — lets the GitHub
  Action's non-interactive request pass the `admin.pueblofoodmap.com`
  Access application without Google SSO. `CF-Access-Client-Id` /
  `CF-Access-Client-Secret`, 1Password, GitHub Actions repo
  secrets. This is what lets the ingest route live on the protected admin
  hostname instead of one of the three bypass hostnames (§3.1, §8).
- **App: `REFRESH_INGEST_TOKEN`** — bearer secret, `wrangler secret put`,
  1Password, GitHub Actions repo secret. Checked inside the
  route handler itself, same as every other `/api/admin/*` check (§3.1).
  Scoped to exactly one route (`/api/admin/refresh/ingest`). Distinct from,
  and no more powerful than, the ability to propose changes a human still
  has to approve.
- **Exempt from the CSRF/Origin check (§8, fixes Important-4a):** that check
  exists to stop an authenticated browser's *ambient session cookie* from
  being weaponized cross-site. This route never carries that cookie and
  isn't called by a browser — it's a server-to-server call authenticated by
  the two credentials above — so `/api/admin/refresh/ingest` is explicitly
  carved out of the blanket "every non-`GET` `/api/admin/*` handler checks
  `Origin`" rule.

### 6.9 Ingest validation & per-run caps

`#234`'s own acceptance criteria require this and it was unspecced until
this revision (fixes Important-5): *"Validation on ingest: schema + dedupe
+ geocode-in-Pueblo-bounds + URL reachability, so bad records never land."*
Applied to every incoming record, **before** it reaches the diffing step
(§6.3):

- **Schema validation** — the incoming JSON is checked against the same
  `Venue`-derived shape the admin form itself validates against (reuse, not
  a second parallel schema, ponytail rung 2). A record missing a required
  field, or with a field of the wrong type, is dropped from the run and
  counted in the run's summary log — it does not become a `change_proposals`
  row at all.
- **Dedupe** — within a single incoming batch, two records that would
  resolve to the same `id` (§4) collapse to one (last-wins) before diffing,
  rather than racing to produce two conflicting proposals for the same
  target.
- **Geocode-in-Pueblo-bounds** — reuses the existing `PUEBLO_COUNTY_BBOX`
  check (`src/data/pueblo-bbox.ts`), the same constant the admin form and
  the seed-time validation report (§7 step 3) already use. A record outside
  the bbox is not silently dropped (an upstream source correctly listing a
  just-outside-county resource is legitimate, per the existing
  outside-county admin flow, §5 step 3) — it's flagged (`outside_county=1`
  on the proposal's `after`) so the reviewing admin sees the same warning an
  admin manually adding an outside-county venue would see.
- **URL reachability** — a `url` field is checked with a `HEAD` (falling
  back to `GET` if `HEAD` is disallowed) before being proposed; an
  unreachable URL is not dropped from the record, but isn't treated as
  "verified" either — it's proposed as-is, and picked up by the next
  scheduled link-health pass (§6.5) rather than duplicating that check
  inline here.

**Per-run proposal cap.** None of the above bounds *how many* proposals one
run can create — a leaked `REFRESH_INGEST_TOKEN`, a buggy scraper change, or
a genuinely enormous upstream change could otherwise flood the queue with
thousands of pending rows: a queue-DoS that buries real proposals, trains
admins to stop reading the queue (worsening the risk §13 already names), and
burns D1's write quota (§10) for no reason. **Illustrative default: a single
ingest run that would create more than 150 total proposals (add + restore +
update + remove combined) aborts before writing any of them**, logs
`event: "refresh_ingest_capped"` (via the existing `src/lib/logger.ts`
pattern, §8) with the attempted count, and surfaces as a failed run rather
than a silent partial apply. 150 is roughly 2.5× the current combined OSM +
Plentiful record count (98) — generous headroom for a legitimately large
first-time source addition (e.g., GTFS eventually), while still catching a
run that's obviously gone wrong. Like the §6.4 threshold, this is a starting
point to retune once the queue has live-run history, not a load-bearing
number.

### 6.10 Change-proposal lifecycle correctness across runs

§6.3 describes one run in isolation. Run after run, four more rules are
needed or the queue degrades — a still-pending proposal gets silently
orphaned by a newer one, a diff a human already rejected keeps nagging every
cycle, an approval applies against data that moved out from under it, or a
retried Action duplicates an entire run's proposals (fixes NB3):

**(a) Auto-supersede.** Before a run's freshly-computed proposals (§6.3) are
written, any existing `status='pending'` proposal for the same
`(source, target_venue_id)` — from an earlier run — is flipped to
`status='superseded'` (§4). This is a machine-vs-machine event, not a review
decision, which is exactly why it needs its own status rather than
overloading `'rejected'` — a `'rejected'` row means a human looked at it and
said no; a `'superseded'` row means the world moved on before anyone
looked. `reviewed_at` is stamped, `reviewed_by` stays `NULL` since no human
acted. Without this, an admin could open the queue and approve a week-old
proposal describing data a more recent run has already updated again.

**(b) Rejection memory.** Before writing a new `pending` proposal, the diff
engine checks whether a `status='rejected'` (explicitly human-rejected, not
`'superseded'`) proposal already exists for the same `(source,
target_venue_id, diff_hash)` (§4). If so, the new proposal is **not
written** — the run's summary log counts it as "suppressed: previously
rejected." This is what stops a source value the admin deliberately
declined (because they've hand-corrected it to something upstream-divergent
on purpose) from re-flagging every single cycle until it's rubber-stamped
out of fatigue. If the upstream value later changes to something *else*,
that's a new `diff_hash` and it proposes normally — this only suppresses an
exact repeat of a specific, already-reviewed-and-declined diff.

**(c) Stale-apply guard.** At approval time (§6.7), before executing the
mutation, the handler re-reads the current `venues` row for
`target_venue_id` and re-checks it against `proposed_diff.before` — but
**scoped to what that proposal actually asserts**, not the whole row: an
`update` proposal re-checks only its own `fields_changed`; a `remove`
proposal only re-checks that the row is still non-archived; an `add`/
restore proposal only re-checks that no conflicting non-archived row now
exists with that id. If the scoped check fails — the underlying data moved
since the proposal was generated — the mutation is skipped, the proposal is
marked `status='superseded'` (same reasoning as (a): reality changed the
facts out from under it, no human rejected it) rather than silently applied
against stale assumptions, and the admin sees an explanatory message ("this
venue changed since the proposal was generated — a fresh proposal will
appear on the next refresh run"). The **narrow, per-field/per-status scope
of this check is what keeps it from over-firing** — see the `#235` case
below for why a coarse whole-row check would misfire here.

**(d) Idempotency via `run_id`.** `change_proposals.run_id` (§4) doubles as
an idempotency key. The GitHub Action mints it — `${{ github.run_id }}` —
**not** the server, and specifically not per-HTTP-attempt: GitHub keeps
`run_id` stable across a re-run of the same workflow run (only
`run_attempt` increments), so a network blip that causes the Action's own
retry logic to re-POST the same payload carries the same `run_id` both
times. The route handler's first step is
`SELECT COUNT(*) FROM change_proposals WHERE run_id = ?`; a non-zero count
means this exact run already wrote its proposals, and the handler returns
the existing run's summary (200 OK) instead of writing duplicates.

**Reconciling `#235`'s canary case — no conflict, by design.** `#235` (the
"Center Toward Self Reliance" dead Plentiful link) can legitimately produce
**two independent proposals for the same venue from two different
sources**: a `link_health` `update` (clearing the dead `url`, §6.5) and, if
the org has genuinely been delisted from Plentiful, a `plentiful` `remove`
(§6.3 step 3) from the same or a later run. (a) doesn't merge these —
auto-supersede is scoped to the *same* `source`, and these are different
sources by design, so both proposals coexist in the queue legitimately; an
admin can approve either independently, in either order. Approving the
`link_health` update first (`url` → `NULL`) doesn't stale-out the
`plentiful` remove afterward, because (c)'s check for a `remove` proposal
only re-verifies the row is still non-archived — it doesn't care about
`url`. And approving the `remove` first doesn't break the `link_health`
update — applying `url = NULL` to an already-archived row is inert
(archived rows aren't published, §5 step 4). This is the concrete reason
the stale-apply guard in (c) is scoped per-proposal-type rather than a
blanket "does the whole row still match" check: a whole-row check would
have made these two legitimate, independently-approvable proposals falsely
conflict with each other.

---

## 7. Migration & cutover plan

**Scoping decision, corrected from v1.0 of this document:** the earlier draft
of this spec migrated only the 10 hand-curated `pfpVenues` records into D1,
leaving `groceryOsmVenues` (60 records) and `plentifulPantries` (38 records)
as untouched, script-owned static files — explicitly flagged there as "an
assumption to confirm with Kyle." Kyle has since confirmed the broader scope
(§2): **this migration seeds all 108 current venues into D1** — 10 PFP + 60
OSM + 38 Plentiful. The publish snapshot is now a direct `SELECT` of D1's
published rows, with no merge step against separate arrays (§3.5 step 4).

1. **One-time refactor.** Compute today's combined venue list exactly as
   `src/data/venues.ts` does today — `[...pfpVenues, ...groceryOsmVenues,
   ...plentifulPantries]`, before the `benefitFlags` overlay — and write it,
   byte-stable, to a new committed file, `src/data/published-venues.ts` (a
   one-time hand-authored snapshot at this point, *not yet* D1-generated).
   Point `venues.ts` at this file instead of the three-way spread, with the
   overlay logic itself byte-identical to today at this step (the NULL-guard
   below is Phase 2 work, once admins can actually set `accepts_snap`/
   `accepts_wic` — see the correction after this snippet):
   ```ts
   // src/data/venues.ts — after this step (Phase 1; matches today exactly)
   import type { Venue } from "@/types/venue";
   import { publishedVenues } from "@/data/published-venues";
   import { benefitFlags } from "@/data/benefit-flags";

   export const venues: Venue[] = publishedVenues.map((v) => {
     const f = benefitFlags[v.id];
     return f ? { ...v, accepts_snap: f.snap, accepts_wic: f.wic } : v;
   });
   // categoryLabels / categoryColors / categoryIcon unchanged below
   ```
   A behavior-preserving, low-risk change — verified by a snapshot test
   (old `venues` array output === new `venues` array output, byte for byte)
   — that ships alone, before any D1/admin code exists, exactly like v1.0's
   narrower `pfpVenues`-only extraction did. `published-venues.ts` becomes
   the publish handler's sole write target from here on, superseding both
   `pfp-venues.ts` (v1.0's narrower name, never implemented) and, eventually,
   direct writes to `grocery-osm.ts`/`pantries-plentiful.ts`.
   `benefit-flags.ts` itself is explicitly out of scope for *this* one-time
   refactor and stays a separately-refreshed file (`scripts/
   match-benefits.py`, excepted from the queue for the reasons in §2) — but
   **correcting a claim made elsewhere in this document: the overlay
   mechanism does NOT stay "exactly as today" once admin editing ships
   (fixes NB4).** Today's overlay unconditionally lets `benefit-flags.ts`
   win (`src/data/venues.ts:171-172`, verified: `return f ? { ...v,
   accepts_snap: f.snap, accepts_wic: f.wic } : v` — no guard). That's
   harmless today because nothing ever writes a competing value to those
   fields. Once D1 holds `accepts_snap`/`accepts_wic` as admin-editable
   tri-state columns (§4), the same unconditional overlay would silently
   discard every admin's SNAP/WIC edit on the very next `match-benefits.py`
   refresh — **Kyle's product decision: admin edits win.** Fix, shipped in
   Phase 2 alongside the rest of the admin write path (not this Phase 1
   refactor): the overlay applies **only when the published D1 value is
   `NULL`** (serialized as `undefined` — tri-state mapping note, §4):
   ```ts
   // src/data/venues.ts — Phase 2, once accepts_snap/accepts_wic are
   // admin-editable in D1 (fixes NB4)
   export const venues: Venue[] = publishedVenues.map((v) => {
     const f = benefitFlags[v.id];
     if (!f) return v;
     return {
       ...v,
       accepts_snap: v.accepts_snap === undefined ? f.snap : v.accepts_snap,
       accepts_wic: v.accepts_wic === undefined ? f.wic : v.accepts_wic,
     };
   });
   ```
   The admin venue editor (Phase 2) shows provenance for these two fields —
   whether the displayed value came from an explicit D1 edit or from the
   `benefit-flags.ts` fallback — so an admin can tell "I set this" apart
   from "the matcher guessed this."
2. **Provision.** `wrangler d1 create pueblo-food-map-admin` and
   `wrangler d1 create pueblo-food-map-admin-preview`. Apply
   `migrations/0001_init_admin_schema.sql` (now including `venues` with
   `source_type` and `change_proposals` — §4) with
   `wrangler d1 migrations apply pueblo-food-map-admin --local` (dev) and
   `--remote` (production — **do not skip this**; per the D1 gotcha already
   known from a sibling repo, `--local` migrations do not touch the deployed
   database, and a missing remote migration surfaces as a live 500, not a
   build failure).
3. **Seed script** (`scripts/seed-admin-db.mjs` or similar, run once, locally,
   by a human with `wrangler d1 execute` access): reads all 108 records
   across `pfpVenues`, `groceryOsmVenues`, and `plentifulPantries` (via
   `published-venues.ts` after step 1, or the three source arrays directly —
   either is equivalent at this point), inserts each with its existing
   stable `id` and the correct `source_type` per array
   (`'pfp'`/`'osm'`/`'plentiful'`) and `status='published'` (they're all
   already live today). Prints a **seed/validation report**: row count in
   vs. row count written **per source** (10/10, 60/60, 38/38 expected), any
   lat/lng values failing the `PUEBLO_COUNTY_BBOX` check (flagged, not
   blocked — some existing records may already be edge cases), and any
   duplicate-id collisions **across all three source namespaces combined** —
   this check is more valuable now than it was in v1.0: three previously-
   independent id schemes are being merged into one `PRIMARY KEY` space for
   the first time, and while all three are collision-free by construction
   (§4), this is exactly the kind of assumption a seed-time check should
   verify rather than trust. **The report also runs the same name/lat-lng
   similarity check §6.6's review-UI "possible rename" hint uses (fixes
   Important-1), against the full 108-record seed set** — not to block the
   seed (near-duplicates seed in as-is, matching "108 today"), but to
   surface candidates for a human look. Not hypothetical: the committed
   Plentiful data already contains a same-name/same-coordinates/same-phone
   pair under two different ids (`plentiful-pueblo-community-soup-kitchen-
   1bc98af5` / `...-plentiful-3195`) that this check would flag on the very
   first run.
4. **Preview vs. production separation.** Two D1 databases
   (`pueblo-food-map-admin` / `-preview`), matching `#181` AC3's "separate
   Firebase projects" requirement structurally. **Honest caveat, unchanged
   from v1.0:** this cleanly isolates *local* preview (`npm run preview`,
   `wrangler dev`) via `preview_database_id`, but Cloudflare Workers Builds'
   auto-generated PR preview URLs — and version preview URLs (§3.1) — do not
   have an equivalent isolation mechanism in this repo's current setup;
   AGENTS.md is explicit that Workers Builds has "ONE shared build-variable
   set and a single `production` environment," unlike Cloudflare Pages.
   Concretely: a live PR preview URL binds to the same D1 database as
   production unless further plumbing is added. Recommended v1 mitigation:
   admin-feature QA happens via `npm run preview` locally (safely isolated),
   not against live PR preview URLs; document this explicitly so nobody
   assumes preview-URL isolation that doesn't exist. **This is a Workers-
   Builds platform limitation, not something specific to this proposal** —
   see the fairness note in [§13](#13-tradeoffs-risks--open-questions).
5. **Wire the scheduled refresh feeder.** Add the GitHub Action that runs
   the OSM/Plentiful scrapers on the cadence in §6.2 and POSTs their output
   to `/api/admin/refresh/ingest` — this absorbs `#133` comment 4.1's own
   ask ("Monthly scheduled GitHub Action runs the Plentiful + OSM scrapers")
   and is new work v1.0 of this document didn't need, since it left the
   scrapers completely untouched.
6. **Phased overlay cutover.** Ship the D1-sourced `published-venues.ts`
   (still generated manually/once at this point, byte-identical to the
   pre-migration combined output) behind normal PR review first, to prove
   the extraction changed nothing. Only after that lands does the admin
   write/publish path go live. Once live, run the admin + publish pipeline
   in parallel with the existing file for a burn-in period; diff each
   publish's output against the previous file (venue-for-venue, across all
   108) before trusting it unattended. **This burn-in matters more now than
   in v1.0:** a 108-record full cutover has a materially larger blast radius
   than the old 10-record one — a mistake here can break pins across the
   whole map, not just the PFP subset. The mitigation is the same mechanism
   (byte-identical proof, parallel-run diffing, staged cutover), just now
   protecting more surface area; it's worth being explicit that the stakes,
   not the safeguard, went up.
7. **Stakeholder sign-off.** Before the admin UI is handed to non-developer
   PFP staff, Kyle (and, if applicable, a PFP stakeholder) reviews one full
   create → edit → publish cycle end to end, plus one full change-proposal
   review cycle (approve one, reject one), against the checklist in §8's
   verify-non-admin-is-blocked test plus a visual diff of the published map.
   Matches `#181` AC5.
8. **Backup.** No dedicated backup system in v1 (`#181` decision log #3,
   matched here). D1 supports `wrangler d1 export` for an on-demand SQL dump;
   given the entire `venues` table is ~108 rows in v1 (plus a small,
   naturally-bounded `change_proposals` table), a manual export before any
   risky operation is sufficient and free.

---

## 8. Security

- **Edge enforcement:** Cloudflare Access on `admin.pueblofoodmap.com`,
  Google SSO + email allowlist (§3.1, §9).
- **Defense in depth against ALL THREE bypass hostnames (fixes Important-3
  — was "both," undercounting):** every `/admin/*` and `/api/admin/*`
  handler independently verifies `Cf-Access-Jwt-Assertion` via `jose`
  against the Access team's JWKS (signature, issuer, audience, expiry)
  through the single `getAdminDb()`/`requireAccessIdentity()` path (§3.1,
  I2) — not just at the edge. This is exactly why the existing
  defense-in-depth design already carries the full weight here regardless
  of hostname count: `getAdminDb()` refuses to hand back the D1 binding to
  an unverified caller no matter which of the Worker's hostnames the
  request arrived on — the code needed no change, only the doc's count and
  test plan did. This Worker is reachable at three hostnames not
  automatically covered by an Access policy scoped to the custom admin
  subdomain: the bare `pueblo-food-map.kyle-boyd.workers.dev`, any Workers
  **version preview URL** (`<version-prefix>-pueblo-food-map.kyle-boyd.
  workers.dev` — easy to overlook because it's a different hostname
  pattern, and it binds **production** D1), and the **public apex
  `pueblofoodmap.com` itself** — the one most likely to actually be hit by
  accident, since the admin route group ships in the same Worker (§3.1).
- **Alternatives considered for the edge gate itself:** see §3.1 (I4) — the
  workers.dev-wide "Enable Cloudflare Access" toggle and `workers_dev =
  false` were rejected because they'd break the documented bypass-CDN curl
  practice in AGENTS.md; Cloudflare's own documentation recommends in-Worker
  token validation regardless of edge configuration.
- **CSRF on `/api/admin/*` mutations (I7).** The Access session cookie
  (`CF_Authorization`) is ambient — a browser attaches it automatically to
  same-site requests, so an authenticated admin's browser could be tricked
  into firing a cross-site mutating request without their intent. Two
  layers: (1) set the CF Access application's cookie `SameSite` attribute to
  `Lax` or `Strict` in the Zero Trust dashboard, so the cookie isn't sent on
  a cross-site request in the first place; (2) as defense in depth, every
  non-`GET` `/api/admin/*` handler **except `/api/admin/refresh/ingest`**
  checks the `Origin` header equals `https://admin.pueblofoodmap.com`,
  rejecting with 403 on a mismatch or absence. Since every *other* admin
  mutation is a same-origin `fetch()` call from the admin UI itself,
  `Origin` is reliably present on legitimate requests — an absent or foreign
  `Origin` is a real signal, not a false-positive risk there. **The
  refresh-ingest route is explicitly exempt (fixes Important-4a):** CSRF
  defends against a browser's ambient session cookie being replayed
  cross-site without the user's intent — `/api/admin/refresh/ingest` never
  carries that cookie (it's authenticated by a CF Access Service Token +
  `REFRESH_INGEST_TOKEN`, §6.8) and is called by a GitHub Actions runner,
  not a browser, so it wouldn't reliably send a matching `Origin` header in
  the first place. Applying the same Origin check there wouldn't add
  protection against anything CSRF-shaped — it would just 403 the
  legitimate feeder.
- **Audit log:** append-only by omission — no route handler ever issues an
  UPDATE or DELETE against `audit_log`. Every `venues` write (create, update,
  publish, archive — including one produced by approving a change-proposal,
  §6.7) writes its audit row in the *same* `db.batch()` transaction as the
  data change, so an audit entry can never be silently skipped by a partial
  failure **within D1**. That guarantee does not extend across systems — see
  the publish-specific note below.
- **The publish audit row cannot be atomic with the external GitHub commit
  (nit).** `db.batch()` gives atomicity *within* D1, but the GitHub Contents
  API commit (§3.3, §3.5) is a separate system with no shared transaction.
  This design commits to a specific ordering and is honest about the
  resulting failure mode — **this paragraph is the canonical statement of
  that ordering; §3.5 and §5 were fixed to match it rather than the other
  way around (NB1 — they previously described the reverse order)**: the
  GitHub commit/PR is attempted **first**; the
  `audit_log` row (and draft→published promotion) is written **after** it
  succeeds. If the GitHub call fails, nothing in D1 changes — no false
  "published" record, drafts stay drafts, the admin sees an error and can
  retry cleanly. If the GitHub call succeeds but the following D1 write
  fails (a transient blip immediately after), the static file/PR is already
  in flight while D1 hasn't yet recorded it as published — GitHub "wins" in
  that narrow window. This is recoverable rather than dangerous specifically
  *because* of the single-reused-branch mechanism below (I5): a retry after
  a partial failure updates the same PR rather than opening a duplicate one.
- **Two publishes in flight (I5).** Each publish triggers two serial
  Cloudflare Workers Builds — the PR's required "Workers Builds:
  pueblo-food-map" check, then the post-merge production build — sharing the
  single concurrent build slot on the Free plan (§3.3, §10). **~10 minutes
  is therefore the floor for a publish, not the typical case** — a v1.0
  claim of "often beats" that number was wrong and has been corrected
  throughout this document (§2, §3.5). A second human PR merging around the
  same time queues behind whichever build is running; that's a delay, not a
  failure. Two admins publishing close together is handled by **reusing a
  single bot branch and PR**: if a publish-generated PR is already open, a
  second "Publish" click force-pushes the fresh snapshot to that same
  branch/PR instead of opening a competing one — collapsing concurrent
  publishes into "last snapshot wins" rather than a silent conflict on the
  serialized data file (consistent with the already-accepted last-write-wins
  model, §5 step 5/I6). A dedicated D1 publish-lock row was considered and
  rejected for v1 as unnecessary complexity once branch-reuse already
  serializes the outcome (ponytail rung 2: reuse the PR itself as the
  serialization point). The admin UI polls the PR's state (open/merged) as
  the "publish landed" feedback signal, rather than a static time estimate.
- **Structured logging:** admin auth failures and publish outcomes log
  through the existing `src/lib/logger.ts` pattern (single-line JSON,
  typed fields only, no PII) — `event: "admin_auth_failure"` /
  `event: "publish_result"` /  `event: "refresh_ingest_result"` alongside the
  existing `form_submit_failure` convention, so Cloudflare Workers Logs
  filtering stays consistent app-wide.
- **Secrets** (all in Kyle's 1Password vault; most
  applied via `wrangler secret put`, the one exception noted below):
  - `CF_ACCESS_AUD` — the Access application's audience tag (not secret, but
    environment-scoped config, not hardcoded).
  - `GITHUB_PUBLISH_TOKEN` — a fine-grained PAT scoped to *only*
    `kr8vka0z/pueblo-food-map`, with **both Contents: Read/Write AND Pull
    requests: Read/Write** (fixes B3 — a fine-grained PAT needs the Pull
    requests permission to create a PR and enable auto-merge via the API;
    Contents alone covers only the commit/branch step). Used by the publish
    handler's Contents-API commit call and its PR creation/auto-merge call.
  - `REFRESH_INGEST_TOKEN` — bearer secret scoped to exactly one route
    (§6.3, §6.8). New in this revision.
  - **`CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`** (new in this
    revision, fixes Important-4b) — a Cloudflare Access Service Token pair,
    created in the Zero Trust dashboard against the
    `admin.pueblofoodmap.com` Access application, **not** via
    `wrangler secret put` — Cloudflare's edge validates these before a
    request reaches the Worker at all, so there's nothing for the Worker
    itself to check. Stored in 1Password and as GitHub Actions repo
    secrets, sent by the refresh-ingest Action as
    `CF-Access-Client-Id`/`CF-Access-Client-Secret` headers (§3.1 I4, §6.8).
  - No Firebase-style service-account JSON key, ever — there is no
    equivalent credential in this design because there is no third-party
    project to authenticate against.
- **New dependency — flagged per standing minimal-deps preference:**
  `jose` (~a few KB, zero sub-dependencies, purpose-built for edge/Workers
  JWT verification, and Cloudflare's own Access-verification documentation
  uses it — §3.1, I4). Hand-rolling RS256/JWKS verification via the raw Web
  Crypto API was considered and rejected — this is exactly the kind of
  security-critical low-level code where a small, audited, purpose-built
  library is correct even under a minimal-dependency default. Every other
  new piece of this design (GitHub Contents/PR API, D1 access,
  refresh-ingest) uses either plain `fetch()` (matching the existing
  Resend/Turnstile pattern) or the platform's own client — `jose` is the one
  genuinely new dependency in the whole spec.
- **Verify-non-admin-is-blocked test** (required before Phase 1 ships,
  re-run after any Access policy change):
  1. From a browser with no session against an allowlisted Google account,
     visit `admin.pueblofoodmap.com` → expect Cloudflare's own Access login
     wall, not the app.
  2. Authenticate with a **non-allowlisted** Google account → expect
     Cloudflare's "Access Denied" page. The Worker must never execute —
     confirm via Workers Logs showing zero requests to `/admin/*` for that
     attempt.
  3. `curl` the direct bypass URL with no assertion header:
     `curl -i https://pueblo-food-map.kyle-boyd.workers.dev/admin` → expect a
     403 **from the app itself** (this proves the defense-in-depth JWT check,
     not just the edge policy, is doing real work).
  4. `curl` the same URL with a garbage/expired `Cf-Access-Jwt-Assertion`
     header → expect 403 (signature/expiry rejection).
  5. **(I3):** `curl` a live **version preview URL**
     (`<version-prefix>-pueblo-food-map.kyle-boyd.workers.dev/admin`, no
     assertion header) → expect the same app-level 403 as step 3. This is a
     distinct hostname from step 3's, so it's worth testing separately
     rather than assuming "same code, so it's covered" — that's exactly the
     kind of untested assumption an adversarial review should catch.
  6. **New (fixes Important-3):** `curl` the **public apex**:
     `curl -i https://pueblofoodmap.com/admin` (and, for completeness,
     `https://www.pueblofoodmap.com/admin`) with no assertion header →
     expect the same app-level 403. This is the bypass surface with the
     lowest bar to stumble onto by accident — it's the site's own marketed
     domain — so it gets its own explicit test rather than being assumed
     covered by step 3's.

---

## 9. Ownership & accounts

This is the section the rest of the document exists to support.

| Piece of infrastructure | Under this proposal | Under the Firebase plan |
|---|---|---|
| Cloud account | Kyle's existing Cloudflare account (`8878836432b8b59274b8d0c711901d20`) — already hosts `pueblofoodmap.com` | A new Google Cloud / Firebase **project** — does not exist yet; someone has to create and permanently own it |
| Who can recover access if the owner disappears | Kyle — he already has full account access; nothing new to hand off | Whoever owns the Firebase project's Google account. If that's @rspraymond and he becomes unavailable, there is **no documented recovery path** — `#179`'s own "env fallback super admin recovery" is a workaround for exactly this class of risk, not a real ownership transfer mechanism |
| DNS | `admin.pueblofoodmap.com` added to the CF zone Kyle already controls | N/A directly, but the Firebase project's auth domain and any Firebase Hosting/Functions config would live under the new Google project |
| Identity/auth backend | Cloudflare Access (Zero Trust), same account, same dashboard as the rest of PFM's Cloudflare config | Firebase Authentication, inside the new Google Cloud project |
| Data store | D1, same Cloudflare account, `wrangler d1` tooling already installed (`wrangler ^4.105.0` is a project devDependency today) | Firestore, inside the new Google Cloud project |
| Secrets | Kyle's 1Password vault, same pattern as every other PFM credential (Mapbox, Resend, Turnstile) | A new Firebase service-account JSON key — a new *kind* of credential this project has never held before |
| Billing | Same Cloudflare account/billing already in place; free tier covers this (§10) | A new Google Cloud billing relationship, even if it stays on Firebase's free Spark plan |
| New account signups required | **Zero** | At least one: a Google Cloud project with Firestore/Auth enabled, owned by *someone's* Google identity |

**The Google SSO caveat, addressed directly:** this spec still uses Google as
the identity provider for CF Access login (per the brief), which means a
lightweight Google OAuth Client ID/Secret is needed to let Cloudflare Access
present a "Sign in with Google" button. This does **not** reintroduce
Firebase's ownership problem. An OAuth client used purely for login is a
**stateless, low-stakes credential** — it authenticates a login attempt and
holds no data; if it's ever lost or needs rotating, a new one is created in
minutes and the Access application is repointed at it, with zero data
migration. A Firebase/Firestore *project* is a **stateful data store** — it
*is* the admin database. Losing access to an OAuth client is an inconvenience;
losing access to a Firestore project is losing the actual venue records and
the only path to edit them. All stateful data in this proposal lives in D1,
under Kyle's account, regardless of which SSO button sits on the login
screen. (If even that lightweight Google dependency is unwanted, Cloudflare
Access also supports a pure email One-Time-PIN login method with **zero**
external identity provider — worth a look if Kyle wants literally nothing
outside Cloudflare touching the login path. Noted here as an option, not the
recommendation, since the brief specifies Google SSO.)

**The honest counter-risk:** Firebase/Firestore has a much larger community of
web developers already fluent in its console and SDKs than Cloudflare
D1/Access does. If Kyle becomes unavailable and a *different* future volunteer
picks this project up, a Cloudflare-native stack may have a slightly steeper
ramp-up than "here's a Firebase console link." This is real and worth naming
plainly rather than pretending the tradeoff is one-directional — see
[§13](#13-tradeoffs-risks--open-questions).

---

## 10. Cost

All figures below are Cloudflare's own documented free-tier limits as cited
in `#73`'s original research (Kyle/the blueprint author's own numbers,
sourced there rather than re-derived here) — **verify current figures before
relying on them for capacity planning; free-tier limits do change.**

| Component | Free-tier allowance (per `#73`) | Expected usage | Net cost |
|---|---|---|---|
| Cloudflare D1 | 5M reads + 100K writes/day | A handful of admin writes/day, occasional refresh-diff reads (~108 rows scanned per run), occasional publishes | $0 |
| Cloudflare Access | Free for up to 50 users | 1-3 named admins | $0 |
| Cloudflare Web Analytics | Free | N/A to this admin spec directly (Phase 3-equivalent, deferred) | $0 |
| GitHub Contents/PR API (publish commits) | GitHub's standard free API rate limits | A few commits/week at most | $0 |
| GitHub Actions (scheduled refresh workflow, §6.2) | Public repos get **unlimited free minutes** (verified: `kr8vka0z/pueblo-food-map` is public, `gh api ... -q '.private'` → `false`) | A few minutes/month (monthly OSM scrape + weekly Plentiful scrape) | $0 |
| Workers Builds | 1 concurrent build slot (Free plan); **3,000 build-minutes/month included** | Publish consumes it twice per publish (§3.5, §8) — trivial at expected publish volume | $0 (shared with existing usage) |

**Total net new recurring cost: $0**, assuming usage stays inside free-tier
limits — extremely likely for a single-county civic map with a handful of
admins, even with the larger dataset and the added refresh-ingest traffic.
Compare against the Firebase plan's Spark (free) tier, which is also $0 at
this scale — cost is not a differentiator between the two proposals;
ownership and static-runtime parity are.

---

## 11. Phased implementation plan

Sliced to mirror `#178`-`#181`'s own shape, so this is a drop-in alternative
rollout sequence rather than a different process to evaluate on top of the
technology choice — even though the total scope is larger than v1.0 of this
document, now that it also carries what used to be `#133` and `#234`.

### Phase 1 — Foundation (≈ `#179`; no public-facing change ships)

- Provision `pueblo-food-map-admin` (+ `-preview`) D1 databases; apply
  `migrations/0001_init_admin_schema.sql` locally and remotely — now
  including `venues` (with `source_type`) and `change_proposals`, not just
  `venues` and `audit_log`.
- Configure `admin.pueblofoodmap.com` DNS + CF Access application (Google SSO
  + email allowlist).
- One-time refactor: combine `pfpVenues` + `groceryOsmVenues` +
  `plentifulPantries` into `published-venues.ts` (§7 step 1) — ships as an
  ordinary, low-risk PR, byte-identical output.
- Ship `src/lib/cfAccess.ts` + `src/lib/adminDb.ts` (`getAdminDb()`, §3.1)
  and a bare `/admin` shell page that proves the whole chain: Access → JWT
  verify → "Signed in as you@example.com" — no CRUD yet.
- Run and pass the full verify-non-admin-is-blocked checklist (§8), including
  the version-preview-URL test (I3) and the public-apex test (Important-3).
- **T-shirt size:** comparable to `#73`'s own "several days" estimate for its
  Phase 0 — this is genuinely new plumbing, not a shortcut version.

### Phase 2 — Admin CRUD, draft/publish, and the change-approval queue (≈ `#180` + `#133` + `#234`)

This phase now carries what would have been three separate future efforts.

- Venue list (filter by category/status/source_type), create/edit form (full
  field set, `#180` decision log #1), archive action, outside-county
  confirmation. The SNAP/WIC fields show provenance (admin-set vs.
  benefit-flags.ts fallback) per the NULL-guard fix (NB4, §7 step 1).
- `POST /api/admin/publish` — the corrected 5-step sequence in §3.5 (no
  three-way merge — B2/§3.3 point 4; promotion strictly after the GitHub
  commit succeeds — NB1), including the GitHub Contents/PR API commit +
  auto-merge wiring with the corrected token scope (B3, §8).
- The refresh feeder itself: fold the one-off enrichment scripts
  (`scrub-osm-venues.ts`, `geocode-osm-missing.py`) into the scheduled
  pipeline so its output is reproducible (NB2), then
  `POST /api/admin/refresh/ingest` + the source-owned-fields diff engine +
  sanity guardrail with the corrected active-row denominator (§6.3, §6.4).
- Ingest validation (schema/dedupe/bbox/URL-reachability) and the per-run
  proposal cap (§6.9), and the queue lifecycle rules — auto-supersede,
  rejection memory, the stale-apply guard, and `run_id` idempotency (§6.10).
- CF Access Service Token wiring for the refresh-ingest route (provisioned
  against the Phase 1 Access application) + the CSRF/Origin exemption for
  that one route (§3.1 I4, §6.8, §8).
- `/admin/flags` review UI: queue, before/after diff view (one
  `proposed_diff` shape for every source, §4), approve/reject (per-item +
  bulk), anomaly handling, "Restore" labeling for a returning archived
  venue (Important-2), and the "possible rename" pairing hint (Important-1,
  §6.6).
- Link-health checker with a defined "clear failure" (two consecutive
  checks; excludes 403/429/5xx/timeout — §6.5).
- Minimal pending-age alert (Important-6): a daily (illustrative) Workers
  Cron Trigger queries `change_proposals` for `status='pending'` rows older
  than a hardcoded threshold (e.g. 7 days) and logs
  `event: "pending_proposals_stale"` via the existing `src/lib/logger.ts`
  pattern (§8) — closes the "queue nobody checks" gap named in §13 for the
  *queue itself*, distinct from the feeder-staleness alert `#234` already
  asks for (§6.9).
- Audit log wired to every write, same-transaction as documented in §8.
- **T-shirt size:** the largest phase, and larger than the equivalent phase
  in v1.0 of this document — new UI, new API surface, the publish pipeline,
  AND the entire approval-queue subsystem, now including the lifecycle and
  validation hardening an adversarial review added. Budget more sessions
  than a straightforward CRUD phase would otherwise need.

### Phase 3 — Migration, cutover, and wiring the refresh feeder (≈ `#181` + `#133`)

- Seed script + seed/validation report, now covering all 108 records across
  three sources, including the name/lat-lng similarity check for likely
  duplicate venues under different Plentiful ids (§7 step 3, Important-1) —
  not hypothetical: the committed data already has one such pair
  (`plentiful-pueblo-community-soup-kitchen-1bc98af5` /
  `...-plentiful-3195`) this check would flag on the first run.
- Wire the scheduled GitHub Action (monthly OSM / weekly Plentiful, §6.2)
  that calls the existing scrapers — now wrapped with the enrichment steps
  folded into the feeder (NB2, §6.3) — and POSTs to the ingest endpoint via
  the CF Access Service Token (Important-4) — absorbs `#133` comment 4.1.
- Burn-in period running the admin pipeline in parallel with the existing
  static file; venue-for-venue diff (all 108) before trusting it unattended.
  Higher-stakes than v1.0's equivalent step given the larger blast radius
  (§7 step 6).
- Stakeholder sign-off checklist, now including one full change-proposal
  review cycle (§7 step 7).
- **T-shirt size:** larger than v1.0's equivalent phase (108 records across
  three id namespaces vs. 10 in one), but still smaller than Phase 2 —
  mostly verification and one-time wiring, not new ongoing surface area.

### Deferred — optional, later (≈ `#73` Phases 2-4, unchanged scope, plus new v2 refinements)

- Notification banners (`banners` table already drafted in §4 for
  forward-compat).
- Site statistics (Cloudflare Web Analytics embed + optional custom event
  logging).
- The full, standalone, paginated/filterable **audit-log viewer UI** (the
  narrower per-proposal diff view ships in Phase 2 as part of the queue,
  §2/§6.6 — this is the bigger browsing feature, still deferred).
- **Per-source or per-change-type auto-apply** of refresh proposals (§2, §6)
  — a plausible v2 refinement once the queue has a track record; zero
  auto-apply in v1.
- **Per-record publish granularity** (§5 step 5, I6) — v1 publishes
  everything pending at once.
- GTFS ingestion itself (§2, §6.2) — the schema is ready; the scraper isn't
  built.

Every phase's PRs are gated by the same two required checks already
protecting `main`: **"Lint, typecheck, build"** and **"Workers Builds:
pueblo-food-map"**.

---

## 12. Firebase-plan parity table

Every product/UX decision already locked in `#178`-`#181` is preserved here —
this section exists so a side-by-side review doesn't have to hunt for gaps.

| Ray's decision (source) | How this spec delivers the same behavior |
|---|---|
| Draft then publish workflow (`#178` decision log 1) | D1 `status` lifecycle (draft → published) + explicit Publish action that regenerates the static snapshot (§5) |
| Record overrides static record on matching ID (`#178` decision log 2) | **Corrected from v1.0 (B1/B2):** there is no separate static baseline to override anymore. `venues.id TEXT PRIMARY KEY` is the single source of truth for every venue — the publish snapshot is a direct `SELECT` of published D1 rows (§3.5 step 2), which structurally guarantees `getVenueById` (`src/lib/venueSchema.ts`) can never return a duplicate id, because there's only one source left to collide with itself |
| Soft delete only via hidden status (`#178` decision log 3; `#180` decision log 2) | `status='archived'`; row stays in D1, excluded from the publish query; no DELETE route exists (§5 step 4). Applies identically whether the archive was manual or an approved 'remove' proposal (§6.7) |
| Outside-county entries allowed with warning + explicit confirmation (`#178` decision log 4) | Admin form reuses the existing `PUEBLO_COUNTY_BBOX` check; requires a confirmation checkbox before Save; `outside_county` persisted (§5 step 3) |
| Admin APIs reject requests without a valid Bearer token (`#179` AC1) | Every `/admin/*` and `/api/admin/*` route requires a verified `Cf-Access-Jwt-Assertion`, checked through a single gated data-access helper (§3.1, I2); missing header → 403 before any data access (§8) |
| Token verification checks issuer, audience, expiry, identity (`#179` AC2) | `jose`-based verification against the CF Access team JWKS: `iss`, `aud`, `exp`, and the `email` claim (§3.1) |
| Firestore role lookup w/ env fallback super-admin recovery (`#179` AC3) | CF Access email allowlist *is* the role store — dashboard-managed, no DB round-trip; "recovery" is Kyle editing his own Zero Trust policy, since he owns the account outright (§3.1, §9) |
| Sync script generates static output from published records; empty-fallback build (`#179` AC4/AC5) | Publish handler serializes D1's published rows directly to `published-venues.ts` — no aggregator/merge step remains as of this revision (§3.3 point 4); a D1 outage at publish-time fails the Publish action, not the build — structurally prevents an empty-map build (§3.3) |
| Structured logs for auth/sync, no sensitive data (`#179` AC6) | Reuses `src/lib/logger.ts`'s existing typed-field-only pattern (§8) |
| Admin can create/edit/hide via UI; full field set; category enum-limited; manual + map-pin coordinates (`#180` AC1-4) | `/admin/venues` list + form over the D1 table, now covering all 108 venues; category `<select>` sourced from the existing `VenueCategory` union; coordinate entry via numeric fields + a Mapbox click-to-pin picker (already a dependency) |
| Publish explicit + separate from Save; ~10-minute go-live (`#180` AC6/AC7) | Save = D1 write only; Publish = separate action → snapshot → commit → deploy. **Corrected from v1.0 (I5):** ~10 minutes is the honest floor (two serial Workers Builds on one concurrent slot), not a number the mechanism typically beats (§3.5, §8) |
| Audit fields for create/update/publish (`#180` AC8) | `created_by/at`, `updated_by/at`, `published_by/at` columns + full before/after JSON in `audit_log` (§4). Also covers changes applied via an approved proposal — the reviewing admin, not a bot identity, is the recorded actor (§6.7) |
| Last write wins in concurrent edits (`#180` decision log 3) | Same — no optimistic locking in v1, matching the accepted simplification (§5 design note). Explicitly extended in this revision to publish granularity too — a successful publish ships every draft/approved change captured in that publish's snapshot at once, stated plainly rather than left implicit (§5 step 5, I6; NB1 fixed the snapshot-vs-commit ordering underneath this) |
| Seed all current records w/ stable IDs; seed report; preview/prod separation; validation checklist; stakeholder sign-off (`#181` AC1-5) | **Corrected from v1.0 (B1):** the seed script now ingests all 108 current records across all three sources (source-native ids, collision-free by construction though not claimed stable under a Plentiful rename — §4, Important-1), not just the 10 PFP records; prints a count/mismatch report per source plus a name/lat-lng similarity check for likely duplicates (§7 step 3); separate `-preview` D1 database; burn-in diff; sign-off checklist (§7) |
| Full initial seed; phased overlay cutover; no dedicated backup system in v1 (`#181` decision log) | **Corrected from v1.0 (B1):** v1.0's "Same approach" claim here was a stretch — it only ever seeded 10 of 108 records, so "full initial seed" was approximate at best. This revision's 108-record seed makes the claim accurate rather than approximate. `wrangler d1 export` remains the free, built-in v1 backup mechanism (§7 step 8) |
| *(New in this revision — no Ray's-plan equivalent exists yet)* | Automated refresh proposes changes instead of writing directly; a human approves/rejects every one; sanity guardrails and link-health checks are built into the same queue (§6). This is new ground `#178`-`#181` don't cover — it comes from unifying `#133`/`#234` into this proposal (§1) |

---

## 13. Tradeoffs, risks & open questions

**Being honest about where this is weaker than the Firebase plan, or just
plain uncertain:**

- **D1 is younger than Firestore, platform-wide.** The schema here is
  deliberately small (3-4 tables, no exotic SQLite features) to minimize
  exposure to that immaturity, and D1 is already an exercised binding in this
  exact adapter version (§3.2) — but "verified in this one adapter's cache
  layer" is not the same as "battle-tested at PFM's admin-write scale over
  years." Low risk given the still-modest data volume (~108 venues, growing
  slowly via reviewed proposals), but not zero.
- **This reversed a decision made 12 days earlier (2026-06-19).** `#73`'s
  closure comment gave three reasons. One — shippable increments — isn't
  specific to either datastore (§11). One — "keeps the public site fully
  static" — was a *fair* critique of `#73`'s own original design (a live,
  edge-cached D1 read), but this proposal doesn't repeat that design; it
  fixes the exact flaw that made the critique valid (§1). The third —
  ownership — is the reason this document exists. Reopening a closed
  architectural decision had a real cost even with a sound argument behind
  it — Kyle weighed "the volunteer might still deliver this in week 3"
  against "rebuild the case now" and chose the latter: `#178`-`#181` closed
  not-planned 2026-07-01 in favor of this document.
- **Who actually builds this** is a real cost this document doesn't erase,
  and it's a bigger cost in this revision than in v1.0: the scope now
  includes the full-venue seed *and* the entire change-approval queue, not
  just a 10-record admin CRUD tool. Removing the ownership risk moves the
  implementation burden from @rspraymond's volunteer time onto Kyle's (or
  Atlas-as-implementer's) plate. `#73`'s own estimate — "Phase 0 alone is
  several days; full arc is multiple weeks" — was already a fair anchor for
  the narrower v1.0 scope; this revision's Phase 2 (§11) is larger than what
  that estimate priced in.
- **Community/ramp-up asymmetry (§9):** Firebase's ecosystem is larger and
  more familiar to a broader pool of potential future volunteers than
  Cloudflare D1/Access. A future contributor picking this project up cold may
  find Firebase's console more approachable than `wrangler` + the Zero Trust
  dashboard. Naming this plainly rather than one-sidedly selling Cloudflare.
- **Workers-Builds preview-environment gap (§7 step 4, §4) — and it's
  symmetric, not a Cloudflare-specific weakness.** Confirmed via the
  installed `wrangler` config schema and this repo's own AGENTS.md — PR
  preview URLs generated by Workers Builds do not automatically get an
  isolated D1 binding the way Cloudflare Pages preview environments do.
  `preview_database_id` solves *local* preview isolation only. **This same
  root cause — Workers Builds' single shared build-variable set, with no
  distinct Preview environment — would equally constrain Ray's `#181` AC3
  "separate Firebase projects" requirement**, if the Firebase-plan variant of
  this app is *also* hosted on Workers Builds (which nothing suggests it
  wouldn't be — it's the same Next.js app, just a different backend). Having
  two Firebase projects doesn't help a PR preview automatically select the
  right one without the same kind of extra plumbing this proposal would also
  need. This isn't a point in Firebase's favor; it's a shared platform
  constraint neither proposal escapes for free. Recommended v1 mitigation
  either way: admin-feature QA via `npm run preview` locally, not live PR
  URLs — a process discipline, not a platform guarantee.
- **Publish-via-redeploy is genuinely slower than Firestore→client-read could
  be**, by design choice (§3.3) — this spec trades latency for static-runtime
  purity and SEO-page safety. If Kyle's priority ordering is different from
  what's assumed here, option (b) is a documented, viable alternative.
- **OpenNext/Cloudflare-specific risk:** `getCloudflareContext()` and D1
  access from route handlers are verified to exist in the installed adapter
  (§3.2), but the *specific* combination this spec proposes — calling it from
  a CF-Access-gated route handler, alongside a `jose`-based JWT check, under
  `nodejs_compat` — has not been exercised in this codebase yet. `jose` is
  designed for edge runtimes generally and is very likely to run cleanly
  under this Worker's compatibility flags, but "very likely" should become
  "confirmed" in Phase 1, not assumed through to Phase 3. The Node-runtime
  middleware trap that killed two earlier attempts at routing logic on `/`
  (documented in AGENTS.md) is a standing reminder that a green build on this
  stack does not guarantee a working live route — curl the live homepage
  (or here, the live `/admin` shell) after the first real deploy, not just
  after a green CI run.
- **Scoping question from v1.0 — now resolved, not open.** v1.0 of this
  document flagged as an open question whether "admin managed locations" was
  meant to eventually cover the auto-generated OSM/Plentiful records too, or
  stay scoped to the 10 hand-curated ones. Kyle has since confirmed the
  broader scope explicitly (§2) — this is no longer an open question, and
  §4/§6/§7 are designed for the full 108-record scope throughout. Kept here,
  crossed off rather than silently deleted, so a reader comparing this
  revision against v1.0 can see what changed and why.
- **New risk this revision introduces: a review queue nobody checks is a
  new, quieter failure mode.** Under the old model, a script just silently
  regenerated a file — no worse than today, but no queue to neglect either.
  Under this design, if pending `change_proposals` pile up unreviewed for
  weeks, the map *looks* actively managed (there's a whole admin system) while
  actually drifting exactly as stale as an unmaintained static file would —
  arguably worse, because the existence of the queue could give false
  confidence that someone's watching it. `#234`'s own staleness-alerting
  acceptance criterion ("if a source hasn't successfully refreshed in N days,
  alert") covers the *feeder* going stale; it doesn't cover the *queue*
  going unreviewed while the feeder keeps working. **Addressed, not just
  flagged, as of this revision (fixes Important-6):** a minimal,
  hardcoded-threshold pending-age alert is now a Phase 2 acceptance item
  (§11) rather than a deferred gap — a daily Cron Trigger over
  `change_proposals`, logged through the existing `src/lib/logger.ts`
  pattern. The threshold itself (illustrative: 7 days) is still a guess with
  no live-data backing yet, and is expected to get retuned once the queue
  has real usage patterns — that part remains genuinely open.
- **Migration blast radius is larger than v1.0's.** A 108-record full seed
  and cutover (§7) can break pins across the *entire* map if something goes
  wrong, not just the 10-record PFP subset a mistake in v1.0 would have been
  contained to. The mitigations are the same mechanism (byte-identical
  extraction proof, burn-in parallel-run diffing, staged cutover, seed-time
  validation report) — they just now protect more surface area. Worth Kyle
  weighing this heightened stakes explicitly before Phase 3, even though
  nothing about the mitigation strategy itself needed to change.
- **Threshold and cadence tuning is genuinely illustrative, not load-bearing
  (§6.2, §6.4).** The 20%-with-a-floor-of-5 sanity guardrail and the
  monthly/weekly refresh cadences are reasonable starting points grounded in
  today's real record counts (60 OSM / 38 Plentiful), not numbers with any
  operational history behind them yet. Expect to retune both after the queue
  has run against live data for a few cycles.
- **Process question, not technical:** if this proposal is accepted, should
  `#133` and `#234` be formally closed as superseded, or kept open as
  sub-tracking issues under this one? §1 argues their acceptance criteria are
  satisfied by §6 rather than duplicated — but that's Kyle's call to make
  explicitly, not something this document can decide unilaterally.
- **Single point of failure, differently shaped:** this design removes the
  "one volunteer owns the Firebase project" risk but doesn't eliminate single
  points of failure altogether — Kyle's Cloudflare account becomes the one
  place all of this lives, now holding the *entire* venue dataset rather than
  a curated subset. That's the explicit goal (an account he already owns and
  controls, vs. one he doesn't), but it's worth being clear-eyed that
  "ownership concentrated with Kyle" and "no single point of failure" are not
  the same claim — and that claim now covers more of the product's actual
  data than it did in v1.0.
