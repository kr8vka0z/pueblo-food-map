/**
 * published-venues.ts — the single build-time data source for the public
 * map (#237 checkpoint d; spec §3.3 "public-static publish model", §3.5
 * step 3, §7 step 1).
 *
 * WHAT THIS FILE IS: the last-published snapshot. The public app imports
 * `publishedVenues` (via venues.ts's benefitFlags overlay, below) as a
 * build-time static ESM import — zero fetch, zero D1, zero KV on the public
 * request path (spec §3.3 option (a), the load-bearing static-public
 * decision). Rebuilding and redeploying THIS file is the entire publish
 * mechanism: POST /api/admin/publish (src/lib/publishVenues.ts) regenerates
 * it from D1 and commits it back to this exact path.
 *
 * TWO LIFETIMES for this file's content:
 *  1. Right now (this commit, #237 checkpoint d Part 1): a one-time
 *     hand-authored snapshot — exactly the combined spread venues.ts used to
 *     compute inline before any D1/admin code existed:
 *     `[...pfpVenues, ...groceryOsmVenues, ...plentifulPantries]`. Proved
 *     byte-identical to the pre-refactor venues.ts output by
 *     src/__tests__/publishedVenues.test.ts.
 *  2. After the first real publish: this file's ENTIRE CONTENT is
 *     regenerated from a direct D1 SELECT — a literal Venue[] array, no
 *     longer an import+spread of the three source arrays. D1 becomes the
 *     only source of truth from that point on (spec §3.3 point 4, "fixes
 *     B2" — the old three-array merge step goes away for good). That's
 *     expected, which is why this file carries no "generated, do not edit"
 *     banner the way grocery-osm.ts/pantries-plentiful.ts do: it starts
 *     hand-authored and becomes machine-authored the moment publishing goes
 *     live, same path either way (`export const publishedVenues: Venue[]`).
 */
import type { Venue } from "@/types/venue";
import { pfpVenues } from "@/data/pfp-venues";
import { groceryOsmVenues } from "@/data/grocery-osm";
import { plentifulPantries } from "@/data/pantries-plentiful";

export const publishedVenues: Venue[] = [
  ...pfpVenues,
  ...groceryOsmVenues,
  ...plentifulPantries,
];
