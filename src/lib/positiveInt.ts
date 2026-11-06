// positiveInt.ts — the one "is this a positive whole-number id?" check the API routes share.

/**
 * `v` when it is a number, a whole number and above 0; otherwise null.
 * Strings are never parsed here, so `"5"` in a JSON body stays invalid: a
 * route param (always a string) goes through `positiveInt(Number(rawId))`.
 */
export function positiveInt(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null;
}
