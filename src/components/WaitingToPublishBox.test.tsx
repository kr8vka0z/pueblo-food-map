/**
 * WaitingToPublishBox tests (#673 pt.3) — presentational-only, so these
 * cover rendering off a plain `changes` prop; the D1 diff/attribution
 * computation itself is covered in src/lib/adminVenues.test.ts
 * (diffPublishedFields, attributeFieldChange).
 */

import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import WaitingToPublishBox from "@/components/WaitingToPublishBox";

describe("WaitingToPublishBox", () => {
  test("renders nothing when there are no changes", () => {
    const { container } = render(<WaitingToPublishBox changes={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("lists each field's on-map-now -> after-publish values and who changed it", () => {
    render(
      <WaitingToPublishBox
        changes={[
          { field: "name", label: "Name", onMapNow: "Eastside Pantry", afterPublish: "Eastside Food Pantry", who: "You" },
          { field: "phone", label: "Phone", onMapNow: "(not set)", afterPublish: "555-1234", who: "Automatic data refresh" },
        ]}
      />,
    );

    expect(screen.getByText("Waiting to publish")).toBeDefined();
    expect(screen.getByText("Eastside Pantry")).toBeDefined();
    expect(screen.getByText("Eastside Food Pantry")).toBeDefined();
    expect(screen.getByText("Changed by You")).toBeDefined();
    expect(screen.getByText("555-1234")).toBeDefined();
    expect(screen.getByText("Changed by Automatic data refresh")).toBeDefined();
  });

  // #926: raw values never reach a person, and a row that reads the same on both sides is no change.
  test.each([
    ["category", "(not set)", "meal_site", "Meal Site"],
    ["hours_weekly", "(not set)", '{"mon":["17:00-19:00"]}', /^Mon: /],
  ])("shows %s in plain words", (field, onMapNow, afterPublish, expected) => {
    render(<WaitingToPublishBox changes={[{ field, label: "X", onMapNow, afterPublish, who: "You" }]} />);
    expect(screen.getByText(expected)).toBeDefined();
    expect(screen.queryByText(afterPublish)).toBeNull();
  });

  test("leaves out a row whose two sides read the same, and renders nothing if that was the only one", () => {
    const { container } = render(
      <WaitingToPublishBox changes={[{ field: "accepts_wic", label: "WIC", onMapNow: "No", afterPublish: "No", who: "You" }]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
