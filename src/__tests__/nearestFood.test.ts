/** nearestFoodProps (src/lib/nearestFood.ts): the nearest_food event must carry distances only (#919). */
import { describe, test, expect } from "vitest";
import { nearestFoodProps } from "@/lib/nearestFood";

describe("nearestFoodProps — distance, never position (#919)", () => {
  const ALL_DAY = ["00:00-23:59"];
  const open = { hours_weekly: { sun: ALL_DAY, mon: ALL_DAY, tue: ALL_DAY, wed: ALL_DAY, thu: ALL_DAY, fri: ALL_DAY, sat: ALL_DAY } };
  const noHours = {};
  // Each place carries its real coordinates, as venuesWithDistance's rows do.
  const at = { lat: 38.2544, lng: -104.6091 };

  test("only a 0.5-mile-rounded distance and a count leave: no coordinates, no place id", () => {
    const rows = [
      { ...at, id: "near-closed", distanceMiles: 0.3, ...noHours },
      { ...at, id: "open", distanceMiles: 0.8, ...open },
      { ...at, id: "far-open", distanceMiles: 3.2, ...open },
    ];
    const props = nearestFoodProps(rows, new Date(2026, 10, 13, 12, 0));
    expect(props).toEqual({ nearest_open_miles: 1, within_1_mile: 2 });
  });

  test("nothing open: the distance is null, the count still holds", () => {
    const rows = [{ ...at, id: "x", distanceMiles: 0.2, ...noHours }];
    expect(nearestFoodProps(rows)).toEqual({
      nearest_open_miles: null,
      within_1_mile: 1,
    });
  });
});
