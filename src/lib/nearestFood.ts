/**
 * nearestFood.ts — the payload of the `nearest_food` analytics event (#919),
 * sent once by MapWrapper when a visitor shares their location. Kept out of
 * analytics.ts because that file loads on every page and this one needs
 * hours.ts.
 */
import { computeVenueOpenStatus } from "@/lib/hours";
import type { Venue } from "@/types/venue";

/**
 * The `nearest_food` event's whole payload (#919): how far the nearest
 * open place is, rounded to the half mile, and how many places are within
 * a mile. Built from distances alone so no coordinate or place id can leave,
 * since a place plus a distance would draw a ring around the visitor.
 */
export function nearestFoodProps(
  venues: readonly (Pick<Venue, "hours_weekly" | "hours_irregular"> & { distanceMiles: number })[],
  now: Date = new Date(),
): { nearest_open_miles: number | null; within_1_mile: number } {
  let nearest = Infinity;
  let within = 0;
  for (const v of venues) {
    if (v.distanceMiles <= 1) within++;
    if (v.distanceMiles < nearest && computeVenueOpenStatus(v, now).state === "open") nearest = v.distanceMiles;
  }
  return { nearest_open_miles: nearest === Infinity ? null : Math.round(nearest * 2) / 2, within_1_mile: within };
}
