// adminRequest.ts — body parsing shared by the admin reject routes (submissions, proposals, box photos, box adopters).

/**
 * Optional `{ reason }` from the JSON body: trimmed, cut to `max` characters,
 * or null when absent, blank or not a string. Never throws: a reject can be a
 * plain button click with no body, which is not an error. Each route keeps
 * its own cap (500 for box photos and adopters, 1000 for submissions and proposals).
 */
export async function readOptionalReason(req: Request, max: number): Promise<string | null> {
  try {
    const raw = ((await req.json()) as { reason?: unknown } | null)?.reason;
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    return trimmed === "" ? null : trimmed.slice(0, max);
  } catch {
    return null; // no body / not JSON
  }
}
