/**
 * #917 round 3 (Kyle: "these are dropping lines and look bad"): the row
 * under a place's name, distance and hours today, keeps each item on one line
 * and wraps as a unit, so a long Spanish item drops whole to the next line
 * instead of breaking in two. jsdom has no layout, so this pins the two
 * classes that do it; the 360 / 390 look is checked in a real browser.
 */

import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VenueCardBody from "@/components/VenueCardBody";
import { venues } from "@/data/venues";
import { t } from "@/lib/i18n";

// A place with no hours: its "Hours unknown — call ahead" is the longest item.
const noHours = venues.find((v) => v.category !== "blessing_box" && !v.hours_weekly && !v.hours_irregular)!;

describe.each(["sheet", "panel"] as const)("distance and hours row (%s)", (variant) => {
  test("each item stays on one line and the row wraps between items", () => {
    render(<VenueCardBody venue={{ ...noHours, distanceMiles: 1.2 }} variant={variant} locale="es" />);
    const hours = screen.getByText(t("badge.hoursUnknown", "es")).closest("span")!;
    const distance = screen.getAllByText(new RegExp(t("distance.fromYou", "es"))).map((el) => el.closest("span")).find(Boolean)!;
    for (const item of [hours, distance]) expect(item.className).toContain("whitespace-nowrap");
    expect(hours.parentElement).toBe(distance.parentElement);
    expect(hours.parentElement!.className).toContain("flex-wrap");
  });
});
