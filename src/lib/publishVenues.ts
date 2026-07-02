/**
 * publishVenues.ts — the domain logic behind POST /api/admin/publish
 * (#237 checkpoint d; docs/admin/cloudflare-native-admin-spec.md §3.5
 * "PUBLISH PATH", §5 step 5, §8 NB1).
 *
 * Kept separate from src/app/api/admin/publish/route.ts (same pattern as
 * cfAccess.ts/adminDb.ts vs. whoami/route.ts) so the validation, D1, and
 * GitHub-commit logic are unit-testable with plain fixtures and mocked
 * fetch/D1, without needing a live D1 binding or a real GitHub token.
 *
 * WHAT THIS FILE DOES NOT DO: decide the NB1 ordering. That's the route
 * handler's job (call commitPublishedVenues() and only call
 * promotePublishedDrafts() if it resolves) — this file just provides the
 * pieces. See src/app/api/admin/publish/route.ts for the sequencing.
 */

import type { Venue, VenueCategory, WeeklyHours } from "@/types/venue";

// ─── D1 row shape ───────────────────────────────────────────────────────────
// Mirrors migrations/0001_init_admin_schema.sql's `venues` table exactly —
// including the admin-only columns (status, source_type, outside_county,
// audit columns), which SELECT * returns but the publish serializer strips.

export interface VenueRow {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string;
  hours_weekly: string | null;
  accepts_snap: number | null;
  accepts_wic: number | null;
  phone: string | null;
  email: string | null;
  url: string | null;
  notes: string | null;
  operator: string | null;
  source: string;
  last_verified: string;
  status: string;
  source_type: string;
  outside_county: number;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  published_at: string | null;
  published_by: string | null;
}

const VALID_CATEGORIES: ReadonlySet<string> = new Set<VenueCategory>([
  "pantry",
  "grocery",
  "convenience",
  "farm",
  "garden",
  "edible_landscape",
  "meal_site",
]);

// ─── Validate + strip: one D1 row -> one public Venue, or a named error ────

export interface RowValidationError {
  id: string;
  reason: string;
}

export type RowValidationResult =
  | { ok: true; venue: Venue }
  | { ok: false; error: RowValidationError };

/**
 * Validates a single D1 `venues` row against the public Venue shape and
 * strips the admin-only columns (status, source_type, outside_county, and
 * every audit column) — none of those are part of Venue, so simply never
 * copying them onto the output object IS the strip step.
 *
 * Tri-state mapping (schema §4 comment, spec §7 step 1 "NB4"): NULL ->
 * key omitted (Venue.accepts_snap/wic is `undefined`), 0 -> false, 1 -> true.
 */
export function validateAndMapRow(row: VenueRow): RowValidationResult {
  const idForError = typeof row?.id === "string" && row.id.length > 0 ? row.id : "(missing id)";

  if (typeof row.id !== "string" || row.id.length === 0) {
    return { ok: false, error: { id: idForError, reason: "missing or invalid id" } };
  }
  if (typeof row.name !== "string" || row.name.length === 0) {
    return { ok: false, error: { id: row.id, reason: "missing or invalid name" } };
  }
  if (!VALID_CATEGORIES.has(row.category)) {
    return { ok: false, error: { id: row.id, reason: `invalid category "${row.category}"` } };
  }
  if (typeof row.lat !== "number" || Number.isNaN(row.lat)) {
    return { ok: false, error: { id: row.id, reason: "invalid lat" } };
  }
  if (typeof row.lng !== "number" || Number.isNaN(row.lng)) {
    return { ok: false, error: { id: row.id, reason: "invalid lng" } };
  }
  if (typeof row.address !== "string" || row.address.length === 0) {
    return { ok: false, error: { id: row.id, reason: "missing or invalid address" } };
  }
  if (typeof row.source !== "string" || row.source.length === 0) {
    return { ok: false, error: { id: row.id, reason: "missing or invalid source" } };
  }
  if (typeof row.last_verified !== "string" || row.last_verified.length === 0) {
    return { ok: false, error: { id: row.id, reason: "missing or invalid last_verified" } };
  }
  if (row.accepts_snap !== null && row.accepts_snap !== 0 && row.accepts_snap !== 1) {
    return { ok: false, error: { id: row.id, reason: "accepts_snap must be NULL, 0, or 1" } };
  }
  if (row.accepts_wic !== null && row.accepts_wic !== 0 && row.accepts_wic !== 1) {
    return { ok: false, error: { id: row.id, reason: "accepts_wic must be NULL, 0, or 1" } };
  }

  let hoursWeekly: WeeklyHours | undefined;
  if (row.hours_weekly !== null && row.hours_weekly !== undefined) {
    try {
      hoursWeekly = JSON.parse(row.hours_weekly) as WeeklyHours;
    } catch {
      return { ok: false, error: { id: row.id, reason: "hours_weekly is not valid JSON" } };
    }
  }

  const venue: Venue = {
    id: row.id,
    name: row.name,
    category: row.category as VenueCategory,
    lat: row.lat,
    lng: row.lng,
    address: row.address,
    ...(hoursWeekly !== undefined ? { hours_weekly: hoursWeekly } : {}),
    ...(row.accepts_snap !== null ? { accepts_snap: row.accepts_snap === 1 } : {}),
    ...(row.accepts_wic !== null ? { accepts_wic: row.accepts_wic === 1 } : {}),
    ...(row.phone != null ? { phone: row.phone } : {}),
    ...(row.email != null ? { email: row.email } : {}),
    ...(row.url != null ? { url: row.url } : {}),
    ...(row.notes != null ? { notes: row.notes } : {}),
    ...(row.operator != null ? { operator: row.operator } : {}),
    source: row.source,
    last_verified: row.last_verified,
  };

  return { ok: true, venue };
}

export type ValidateSnapshotResult =
  | { ok: true; venues: Venue[] }
  | { ok: false; error: string };

/**
 * Validates every row in a publish snapshot. Aborts on the FIRST invalid
 * row rather than collecting all failures — spec's own wording is "abort +
 * return an error to the caller on ANY row that fails validation... never
 * write a bad file," which this satisfies; a full multi-error report is a
 * plausible UX upgrade but isn't what was asked for here.
 */
export function validateSnapshot(rows: VenueRow[]): ValidateSnapshotResult {
  // Safety floor (Fable review, checkpoint d): refuse to publish an EMPTY
  // snapshot. An empty set is technically "all rows valid," but committing an
  // empty published-venues.ts would blank the live public map through an
  // otherwise-green pipeline (valid file -> passes CI -> auto-merges). The
  // spec's "no window can silently produce an empty map" guarantee (§3.3)
  // covers build failures, not a legitimately-authenticated publish of zero
  // rows after D1 is emptied or mis-bound. There is no real scenario for this
  // civic map where publishing zero venues is intended, so failing closed here
  // — a structural guard, not a warning — is the safe default.
  if (rows.length === 0) {
    return {
      ok: false,
      error:
        "Publish aborted: the venue snapshot is empty. Refusing to publish an empty venue set (this would blank the public map). No file was written and no D1 row changed.",
    };
  }

  const venues: Venue[] = [];
  for (const row of rows) {
    const result = validateAndMapRow(row);
    if (!result.ok) {
      return {
        ok: false,
        error: `Publish aborted: row "${result.error.id}" failed validation (${result.error.reason}). No file was written and no D1 row changed.`,
      };
    }
    venues.push(result.venue);
  }
  return { ok: true, venues };
}

// ─── Serialize: Venue[] -> published-venues.ts source text ────────────────

export interface PublishFileMeta {
  /** ISO timestamp — embedded in the file's header comment only. */
  publishedAt: string;
}

/**
 * The array-literal portion only (no import/export wrapper) — JSON.stringify
 * output is valid TypeScript object-literal syntax here because every Venue
 * key is a bare identifier and every value is a JSON-representable type, so
 * this doubles as the exact text embedded in the full file AND as something
 * a test can JSON.parse() directly to prove a round-trip, with no need to
 * parse TypeScript syntax out of the full file text.
 */
export function venuesToLiteralArray(venues: Venue[]): string {
  return JSON.stringify(venues, null, 2);
}

/**
 * Builds the full published-venues.ts source text a successful publish
 * commits to GitHub. Deliberately excludes the publishing admin's email —
 * this file lands in a PUBLIC repo (kr8vka0z/pueblo-food-map); the admin
 * identity is already recorded where an audit trail belongs (D1's private
 * audit_log/venues.published_by, written by promotePublishedDrafts below),
 * not baked into permanent public git history.
 */
export function serializePublishedVenuesFile(venues: Venue[], meta: PublishFileMeta): string {
  const header = [
    "/**",
    " * published-venues.ts — auto-generated by POST /api/admin/publish (#237).",
    " * DO NOT hand-edit — the next publish overwrites this file entirely.",
    " *",
    " * Source of truth is Cloudflare D1 (`pueblo-food-map-admin`.venues); this",
    " * file is the build-time snapshot the public map imports at request time",
    " * (docs/admin/cloudflare-native-admin-spec.md §3.3, §3.5 step 3).",
    ` * Last published: ${meta.publishedAt}`,
    " */",
  ].join("\n");

  return (
    `${header}\n` +
    `import type { Venue } from "@/types/venue";\n\n` +
    `export const publishedVenues: Venue[] = ${venuesToLiteralArray(venues)};\n`
  );
}

// ─── D1: snapshot + promote (spec §3.5 steps 1 and 6) ──────────────────────

export interface PublishSnapshot {
  rows: VenueRow[];
  /** Ids with status='draft' at snapshot time — the ONLY ids step 6 promotes. */
  draftIds: string[];
}

/**
 * Step 1: snapshot every draft+published row. Drafts ARE included — they're
 * what's about to go live (spec NB1: the pre-fix version queried
 * status='published' only, silently dropping every pending draft).
 */
export async function fetchPublishSnapshot(db: D1Database): Promise<PublishSnapshot> {
  const result = await db
    .prepare("SELECT * FROM venues WHERE status IN ('draft','published') ORDER BY id")
    .all<VenueRow>();
  const rows = result.results;
  const draftIds = rows.filter((row) => row.status === "draft").map((row) => row.id);
  return { rows, draftIds };
}

export interface PublishAuditMeta {
  actorEmail: string;
  publishedAt: string;
  prUrl: string;
  snapshotCount: number;
}

/**
 * Step 6 (spec §5 step 5 / §8 NB1): promotes exactly the draft ids captured
 * at snapshot time to 'published' and writes ONE audit_log row for the
 * whole publish event, atomically via db.batch(). The caller (route.ts)
 * MUST NOT call this unless commitPublishedVenues() already resolved —
 * that ordering is what this function assumes, not what it enforces.
 *
 * `entity_id` on the audit row is the publish's own timestamp (same value
 * stamped onto every promoted venue's `published_at`) rather than a single
 * venue id — there's no one venue this bulk action is "about." Using the
 * shared timestamp instead of an arbitrary placeholder keeps it possible to
 * correlate later: `SELECT * FROM venues WHERE published_at = <this row's
 * entity_id>` finds every venue this specific publish touched.
 * `before_json` is NULL: unlike create/update/archive there's no single
 * natural "before" snapshot to serialize for a bulk publish; after_json
 * carries the full list of what changed instead.
 */
export async function promotePublishedDrafts(
  db: D1Database,
  draftIds: string[],
  meta: PublishAuditMeta,
): Promise<void> {
  const statements = draftIds.map((id) =>
    db
      .prepare(
        "UPDATE venues SET status = 'published', published_at = ?, published_by = ? WHERE id = ?",
      )
      .bind(meta.publishedAt, meta.actorEmail, id),
  );

  const afterJson = JSON.stringify({
    promotedIds: draftIds,
    promotedCount: draftIds.length,
    snapshotCount: meta.snapshotCount,
    prUrl: meta.prUrl,
  });

  statements.push(
    db
      .prepare(
        "INSERT INTO audit_log (actor_email, entity, entity_id, action, before_json, after_json, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(meta.actorEmail, "venue", meta.publishedAt, "publish", null, afterJson, meta.publishedAt),
  );

  await db.batch(statements);
}

// ─── GitHub: commit + branch + PR + auto-merge (spec §3.5 step 4) ─────────

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_OWNER = "kr8vka0z";
const GITHUB_REPO = "pueblo-food-map";
const GITHUB_MAIN_BRANCH = "main";
// ponytail: one FIXED bot-branch name (not a per-run unique name) is what
// makes "two publishes in flight" collapse into "last snapshot wins" (spec
// §8, I5) almost for free — every publish resets THIS SAME branch to main's
// current tip and force-pushes its own snapshot, so a second publish
// landing seconds after the first simply overwrites it. findOrCreatePublishPr
// below is the other half: creating a PR when one's already open fails with
// a 422 GitHub treats as "reuse" instead of a separate pre-check GET call
// before every publish. Known ceiling/upgrade path: that 422 detection is a
// substring match on the error body (see findOrCreatePublishPr) rather than
// a structured field check — swap in a pre-check GET (findOpenPublishPr,
// already written below) unconditionally if that ever proves fragile.
const PUBLISH_BOT_BRANCH = "publish-bot";
const PUBLISHED_VENUES_PATH = "src/data/published-venues.ts";
const GITHUB_API_VERSION = "2022-11-28";

/** Thrown by every GitHub REST helper below on a non-2xx response. */
export class GitHubApiError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
    this.body = body;
  }
}

function githubHeaders(token: string, extra?: Record<string, string>): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    ...extra,
  };
}

async function githubGet(path: string, token: string): Promise<Response> {
  return fetch(`${GITHUB_API_BASE}${path}`, { headers: githubHeaders(token) });
}

async function githubJson<T>(method: string, path: string, token: string, body: unknown): Promise<T> {
  const res = await fetch(`${GITHUB_API_BASE}${path}`, {
    method,
    headers: githubHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable)");
    throw new GitHubApiError(`GitHub API ${method} ${path} failed: ${res.status} ${text}`, res.status, text);
  }
  return res.json() as Promise<T>;
}

interface GitRefResponse {
  object: { sha: string };
}

/** Returns the branch's current commit sha, or null if the branch doesn't exist (404). */
async function getBranchSha(branch: string, token: string): Promise<string | null> {
  const res = await githubGet(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${branch}`, token);
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable)");
    throw new GitHubApiError(`GitHub ref lookup for "${branch}" failed: ${res.status} ${text}`, res.status, text);
  }
  const data = (await res.json()) as GitRefResponse;
  return data.object.sha;
}

/** Creates publish-bot at mainSha if absent, or force-resets it to mainSha if present. */
async function ensureBotBranchAtMain(mainSha: string, token: string): Promise<void> {
  const existingSha = await getBranchSha(PUBLISH_BOT_BRANCH, token);
  if (existingSha === null) {
    await githubJson("POST", `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`, token, {
      ref: `refs/heads/${PUBLISH_BOT_BRANCH}`,
      sha: mainSha,
    });
  } else {
    await githubJson(
      "PATCH",
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${PUBLISH_BOT_BRANCH}`,
      token,
      { sha: mainSha, force: true },
    );
  }
}

interface ContentsShaResponse {
  sha: string;
}

/** The current blob sha of published-venues.ts on `ref` — required by the Contents API to update (not create) the file. */
async function getFileSha(ref: string, token: string): Promise<string> {
  const res = await githubGet(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${PUBLISHED_VENUES_PATH}?ref=${ref}`,
    token,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable)");
    throw new GitHubApiError(
      `GitHub contents lookup for "${PUBLISHED_VENUES_PATH}"@${ref} failed: ${res.status} ${text}`,
      res.status,
      text,
    );
  }
  const data = (await res.json()) as ContentsShaResponse;
  return data.sha;
}

/** UTF-8-safe base64 encode — the Workers runtime has no Node Buffer. */
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function commitFileToBotBranch(
  fileText: string,
  fileSha: string,
  venueCount: number,
  token: string,
): Promise<void> {
  await githubJson("PUT", `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${PUBLISHED_VENUES_PATH}`, token, {
    message: `Publish venues (${venueCount} venues)`,
    content: toBase64(fileText),
    sha: fileSha,
    branch: PUBLISH_BOT_BRANCH,
  });
}

export interface PullRequestSummary {
  number: number;
  nodeId: string;
  htmlUrl: string;
}

interface PullRequestApiResponse {
  number: number;
  node_id: string;
  html_url: string;
}

async function findOpenPublishPr(token: string): Promise<PullRequestSummary | null> {
  const res = await githubGet(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls?head=${GITHUB_OWNER}:${PUBLISH_BOT_BRANCH}&state=open`,
    token,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable)");
    throw new GitHubApiError(`GitHub PR lookup failed: ${res.status} ${text}`, res.status, text);
  }
  const list = (await res.json()) as PullRequestApiResponse[];
  const found = list[0];
  if (!found) return null;
  return { number: found.number, nodeId: found.node_id, htmlUrl: found.html_url };
}

/**
 * Opens the publish PR, or reuses an already-open one for the same bot
 * branch (spec §8 I5 — "last snapshot wins" for concurrent publishes). See
 * the ponytail note on PUBLISH_BOT_BRANCH above for the known simplification
 * in how "already exists" is detected.
 */
async function findOrCreatePublishPr(
  token: string,
  venueCount: number,
): Promise<{ pr: PullRequestSummary; reused: boolean }> {
  try {
    const created = await githubJson<PullRequestApiResponse>(
      "POST",
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls`,
      token,
      {
        title: "Publish venues update",
        head: PUBLISH_BOT_BRANCH,
        base: GITHUB_MAIN_BRANCH,
        body:
          `Auto-generated by the Pueblo Food Map admin publish action. Regenerates ` +
          `${PUBLISHED_VENUES_PATH} (${venueCount} venues) from the current Cloudflare D1 admin database.`,
      },
    );
    return {
      pr: { number: created.number, nodeId: created.node_id, htmlUrl: created.html_url },
      reused: false,
    };
  } catch (err) {
    if (err instanceof GitHubApiError && err.status === 422 && /already exists/i.test(err.body)) {
      const existing = await findOpenPublishPr(token);
      if (existing) return { pr: existing, reused: true };
    }
    throw err;
  }
}

const ENABLE_AUTO_MERGE_MUTATION = `
  mutation EnableAutoMerge($pullRequestId: ID!, $mergeMethod: PullRequestMergeMethod!) {
    enablePullRequestAutoMerge(input: { pullRequestId: $pullRequestId, mergeMethod: $mergeMethod }) {
      clientMutationId
    }
  }
`;

/**
 * Enables auto-merge on the PR via the GraphQL API (the REST API has no
 * equivalent — it can only merge immediately, not arm a future auto-merge).
 * Requires the repo-level `allow_auto_merge` setting already verified on in
 * the spec (§3.3) — that's a prerequisite this call assumes, not one it checks.
 */
async function enableAutoMerge(nodeId: string, token: string): Promise<void> {
  const res = await fetch(`${GITHUB_API_BASE}/graphql`, {
    method: "POST",
    headers: githubHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      query: ENABLE_AUTO_MERGE_MUTATION,
      variables: { pullRequestId: nodeId, mergeMethod: "SQUASH" },
    }),
  });
  const data = (await res.json().catch(() => null)) as { errors?: unknown[] } | null;
  if (!res.ok || data?.errors) {
    throw new GitHubApiError(
      `GitHub enablePullRequestAutoMerge failed: ${res.status} ${JSON.stringify(data)}`,
      res.status,
      JSON.stringify(data),
    );
  }
}

export interface CommitResult {
  prUrl: string;
  prNumber: number;
  reused: boolean;
}

/**
 * Spec §3.5 step 4 in full: reset the bot branch to main's tip, commit the
 * regenerated file to it, open (or reuse) its PR, enable auto-merge.
 *
 * NB1 (spec §8): every sub-step here — branch reset, file commit, PR
 * create/reuse, AND enabling auto-merge — is part of the SAME "did the
 * GitHub call succeed" gate. If enabling auto-merge fails, the PR exists but
 * nothing will merge it automatically, breaking the "no click needed"
 * publish guarantee just as much as the file commit itself failing would —
 * so that counts as a publish failure too. The caller (route.ts) must not
 * promote drafts in D1 unless this whole function resolves.
 */
export async function commitPublishedVenues(
  fileText: string,
  venueCount: number,
  token: string,
): Promise<CommitResult> {
  const mainSha = await getBranchSha(GITHUB_MAIN_BRANCH, token);
  if (mainSha === null) {
    throw new Error(`GitHub: could not resolve "${GITHUB_MAIN_BRANCH}" branch HEAD`);
  }
  await ensureBotBranchAtMain(mainSha, token);

  const fileSha = await getFileSha(GITHUB_MAIN_BRANCH, token);
  await commitFileToBotBranch(fileText, fileSha, venueCount, token);

  const { pr, reused } = await findOrCreatePublishPr(token, venueCount);
  await enableAutoMerge(pr.nodeId, token);

  return { prUrl: pr.htmlUrl, prNumber: pr.number, reused };
}
