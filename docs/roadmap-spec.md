# Public roadmap — spec

Status: draft for Kyle's review. Nothing here is built yet.

## Goal

A page at `/roadmap` (and `/es/roadmap`) where anyone can see what we're
considering, what's planned, what's being built and what recently shipped,
and suggest an idea without an account. Fully in-house: D1 + the existing
admin, no GitHub, no third-party service.

## Columns

| Status key    | Public label (en / es)          | Meaning |
|---------------|----------------------------------|---------|
| `considering` | Suggested / Sugerido             | An idea we've accepted onto the board but haven't committed to. |
| `planned`     | Planned / Planeado               | Committed; not started. |
| `in_progress` | Working on / En progreso         | Actively being built. |
| `done`        | Done / Listo                     | Shipped. Shows the month it shipped. |

- **Why a Done column:** it's the convention every public roadmap tool uses
  (Considering → Planned → In progress → Shipped), it shows the project is
  moving, and it closes the loop for the person whose suggestion shipped.
  It only lists the last 90 days (by `shipped_at`) so it doesn't grow forever.
  Older items stay in D1.
- **Raw suggestions never appear publicly.** They go to an admin inbox
  first (spam, personal details, duplicates). "Suggested" on the board means
  "an idea we've accepted as worth considering", not "anything anyone typed".
- **"Not planned"** is not a column. Declined ideas are dismissed in the
  inbox or archived from the board (archive, never DELETE).

## Data model — `migrations/0018_roadmap.sql`

New tables, not a new `public_submissions.kind`: that column has a CHECK
constraint, and widening it means an SQLite table rebuild.

```sql
CREATE TABLE roadmap_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title_en        TEXT NOT NULL,          -- ≤ 100 chars
  title_es        TEXT,                   -- NULL → page shows English with lang="en"
  description_en  TEXT,                   -- ≤ 500 chars, plain text
  description_es  TEXT,
  status          TEXT NOT NULL DEFAULT 'considering'
                    CHECK (status IN ('considering','planned','in_progress','done')),
  sort_order      INTEGER NOT NULL DEFAULT 0,   -- within a column, ascending
  shipped_at      TEXT,                   -- set when status → done, cleared if moved back
  source_suggestion_id INTEGER,           -- roadmap_suggestions.id it was promoted from (not a FK)
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  archived_at     TEXT
);
CREATE INDEX idx_roadmap_items_status ON roadmap_items(status, archived_at);

CREATE TABLE roadmap_suggestions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT NOT NULL,          -- ≤ 100 chars
  details         TEXT,                   -- ≤ 1000 chars
  submitter_email TEXT,                   -- optional; covered by 90-day email retention
  locale          TEXT NOT NULL CHECK (locale IN ('en','es')),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','promoted','dismissed')),
  promoted_item_id INTEGER,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  reviewed_at     TEXT,
  review_reason   TEXT
);
CREATE INDEX idx_roadmap_suggestions_status ON roadmap_suggestions(status);
```

The migration is additive, so re-running it is harmless. Prod still needs the
usual manual export-then-apply step before the release merges.

## Public page — `/roadmap`, `/es/roadmap`

- Server-rendered from D1 via `getCloudflareContext().env.ADMIN_DB` (public
  route exception), so admin edits show on the next load like Blessing
  Boxes, with no Publish step. Dynamic render; no `dynamicParams` involved.
- Layout: four columns on desktop; stacked sections on phones (Working on
  first, then Planned, Suggested, Done). Card = title + description (+
  "Shipped September 2026" on Done). Follows DESIGN.md tokens; no new ones.
- Empty column → a short friendly line, never a blank box.
- "Suggest an idea" form at the bottom (and a button in the header that
  scrolls to it):
  - Idea (required, ≤ 100), details (optional, ≤ 1000), email (optional, "if
    you'd like to hear back").
  - Turnstile, honeypot, `checkFormRateLimit` (5/hour per IP + site-wide
    cap), `logFormFailure`, server re-validation, `FIELD_LIMITS` entries.
  - Writes a `roadmap_suggestions` row. Best-effort Resend email to
    feedback@pueblofoodmap.com; an email failure never fails the submit.
  - Route: `POST /roadmap/submit`, same shape as `/feedback/submit`.
- `buildPageMetadata`, sitemap entries for both locales, footer link, and a
  link from the feedback form's "Feature request" option.
- i18n strings in `src/lib/i18n.ts` (en + es).

## Admin — `/admin/roadmap`

- **Board tab:** items grouped by status. Create, edit (both languages),
  change status, move up/down, archive. Moving to `done` sets `shipped_at`;
  moving out clears it.
- **Suggestions tab:** pending inbox with a nav count badge
  (`adminNavCounts.ts`). **Promote** opens the create form prefilled from
  the suggestion and, on save, marks it `promoted` with `promoted_item_id`
  in the same batch. **Dismiss** takes an optional reason.
- Routes under `/api/admin/roadmap/**`: `getAdminDb()`,
  `requireAdminOrigin()` on every non-GET, one `db.batch()` per write with
  an `audit_log` row carrying `identity.sessionId`, `updated_at`
  precondition → 409, server validation in `adminRoadmapValidation.ts`.

## Privacy and retention

- Add `roadmap_suggestions.submitter_email` to the 90-day cleanup in
  `emailRetention.ts` (null the email, keep the idea) with a `.sql.test.ts`.
- One line on `/privacy` (en + es) saying suggestion emails follow the same
  90-day rule.

## Deploy and ops

- Add `/roadmap` and `/es/roadmap` to `deploy-prod.yml`'s smoke tests (200,
  `lang="es"` on the Spanish one).
- ARCHITECTURE.md: a short section on the two tables and the "live, no
  Publish" rule. AGENTS.md: add `0018` to the migration list only if it
  turns out not to be idempotent (it should be).

## Tests

- Migration SQL test for both tables and their CHECK constraints.
- `POST /roadmap/submit`: Turnstile fail, honeypot, rate limit, validation
  limits, row written, email failure still returns ok.
- Admin routes: auth required, CSRF origin check, 409 on stale `updated_at`,
  audit row written, promote marks the suggestion in the same batch.
- Page: groups by status, hides archived, Done limited to 90 days, Spanish
  fallback renders English with `lang="en"`, empty-column copy.
- Retention: suggestion emails nulled after 90 days.

## Out of scope for v1 (possible v2)

- "I want this too" votes (D1 counter behind the rate limiter).
- Emailing the suggester when their idea is promoted or ships.
- Comments on items.

## Open questions for Kyle

1. Label for the first column: keep **Suggested**, or **Considering**
   (clearer that it isn't committed)?
2. Must every item have Spanish text before it goes live, or is the English
   fallback OK?
3. Done window: 90 days, or last N items?
4. Should a new suggestion email you, or is the admin nav badge enough?

## Shipping

One PR into `dev` (`feat(roadmap): public roadmap and idea suggestions`)
with code, migration, tests and docs. It includes a D1 migration, so prod
needs the manual migration step before the Sunday release merges.
