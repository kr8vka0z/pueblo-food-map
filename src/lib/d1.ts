/**
 * d1.ts — the one place D1's hard bound-parameter ceiling lives, so every
 * caller that needs to bind a variable-length id list into a `WHERE id IN
 * (...)` statement chunks it the same way instead of re-deriving the limit.
 *
 * Measured against the real API (#397), not docs: 100 bound parameters
 * succeed, 101 fail with `too many SQL variables at offset 235: SQLITE_ERROR`
 * (D1 error code 7500). Callers: POST /api/admin/proposals/approve-date-only
 * (#399) and boxAdopters.ts's loadApprovedAdopterNamesForVenues.
 */

/**
 * D1's hard ceiling on bound parameters in a single statement. Measured
 * against the real API on 2026-09-02 (see this file's own header) — not
 * taken from Cloudflare's docs.
 */
export const D1_MAX_BOUND_PARAMS = 100;

/** Splits `items` into consecutive slices of at most `size` each — the shape every `WHERE id IN (...)` batching loop in this codebase needs, generic over the item type so it works for both string venue ids and numeric proposal ids. */
export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
