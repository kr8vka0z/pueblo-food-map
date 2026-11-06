/**
 * sql.ts — the one SQL string-literal quoter for the refresh and seed
 * scripts. No imports on purpose: refresh-ingest.ts loads grocery-osm.ts
 * dynamically after re-running the OSM scraper, so nothing in its static
 * import graph may pull in a data module (Node's ESM cache would lock in the
 * stale copy).
 */

/** `'it''s'` for a string, `NULL` for null/undefined. */
export function sqlText(value: string | null | undefined): string {
  if (value === null || value === undefined) return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}
