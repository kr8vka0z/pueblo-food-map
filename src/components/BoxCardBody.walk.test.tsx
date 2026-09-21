/**
 * BoxCardBody — in-app walking directions (walk-restore pass, 2026-09-19).
 * See BoxCardBody.tsx's own header for the full rationale: Kyle approved the
 * address-as-directions-link redesign (PR #503) but asked to keep the
 * in-app walking route for boxes without bringing the three-button
 * DirectionButtons row back. A new file (not an edit to BoxCardBody.test.tsx)
 * — that file's own tests, unmodified, are the proof the map-absent /
 * BoxHistoryContent path (no walk props) kept its pre-restore link-only
 * behavior exactly.
 *
 * Covers: the address renders as a <button> (not an <a>) once `onWalkRoute`
 * is supplied and calls it on click; the active-route readout (distance ·
 * duration, collapsible steps, "Clear route", "Open in Google Maps") renders
 * only while `isWalkRouteActive`; the "share your location" hint (#207); and
 * that `BoxHistoryContent`'s own call shape (no walk props at all) still
 * renders the plain external link.
 */

import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocaleProvider } from "@/lib/LocaleContext";
import BoxCardBody from "@/components/BoxCardBody";
import { googleMapsUrl } from "@/components/DirectionButtons";
import type { PublicBlessingBox } from "@/lib/blessingBoxes";

const BASE_BOX: PublicBlessingBox = {
  id: "test-box-1",
  name: "Test Blessing Box",
  category: "blessing_box",
  lat: 38.27,
  lng: -104.61,
  address: "123 Test St, Pueblo, CO",
  source: "manual",
  last_verified: "2026-09-01T00:00:00.000Z",
  box: {
    hostName: null,
    hostNote: null,
    mostNeeded: null,
    installedOn: "2026-01-01",
    removedOn: null,
    status: "stocked",
    lastFilledAt: "2026-09-17T09:00:00.000Z",
    recentCheckins: [],
    latestPhoto: null,
    adopters: [],
  },
};

describe("BoxCardBody — address doubles as the in-app Walk trigger when onWalkRoute is supplied", () => {
  test("renders the address as a <button>, not an <a>, when onWalkRoute is present", () => {
    const onWalkRoute = vi.fn();
    render(
      <LocaleProvider initialLocale="en">
        <BoxCardBody box={BASE_BOX} onWalkRoute={onWalkRoute} />
      </LocaleProvider>,
    );
    const trigger = screen.getByText("123 Test St, Pueblo, CO");
    expect(trigger.tagName).toBe("BUTTON");
  });

  test("tapping the address calls onWalkRoute", async () => {
    const user = userEvent.setup();
    const onWalkRoute = vi.fn();
    render(
      <LocaleProvider initialLocale="en">
        <BoxCardBody box={BASE_BOX} onWalkRoute={onWalkRoute} />
      </LocaleProvider>,
    );
    await user.click(screen.getByText("123 Test St, Pueblo, CO"));
    expect(onWalkRoute).toHaveBeenCalledTimes(1);
  });

  test("accessible name contains the visible address text (WCAG 2.5.3 label-in-name)", () => {
    render(
      <LocaleProvider initialLocale="en">
        <BoxCardBody box={BASE_BOX} onWalkRoute={vi.fn()} />
      </LocaleProvider>,
    );
    const trigger = screen.getByText("123 Test St, Pueblo, CO");
    const label = trigger.getAttribute("aria-label") ?? "";
    expect(label).toContain("123 Test St, Pueblo, CO");
  });

  test("no active-route readout renders when isWalkRouteActive is false", () => {
    render(
      <LocaleProvider initialLocale="en">
        <BoxCardBody box={BASE_BOX} onWalkRoute={vi.fn()} isWalkRouteActive={false} />
      </LocaleProvider>,
    );
    expect(screen.queryByTestId("walking-route-info")).toBeNull();
    expect(screen.queryByTestId("walk-clear-route")).toBeNull();
    expect(screen.queryByTestId("walk-googlemaps-link")).toBeNull();
  });
});

describe("BoxCardBody — active-route readout (reused from DirectionButtons' WalkRouteStatus)", () => {
  test("renders distance · duration, the steps toggle, Clear route, and the Open in Google Maps link", async () => {
    const user = userEvent.setup();
    const onClearWalkRoute = vi.fn();
    render(
      <LocaleProvider initialLocale="en">
        <BoxCardBody
          box={BASE_BOX}
          onWalkRoute={vi.fn()}
          isWalkRouteActive
          onClearWalkRoute={onClearWalkRoute}
          walkRouteInfo={{ distance: "0.4", duration: "8 min" }}
          walkRouteSteps={[{ instruction: "Head north", distance: 200 }]}
        />
      </LocaleProvider>,
    );

    // Distance/duration readout.
    expect(screen.getByTestId("walking-route-distance").textContent).toContain("0.4");
    expect(screen.getByTestId("walking-route-duration").textContent).toContain("8 min");

    // Collapsible steps — collapsed by default, expands on toggle. #555 moved
    // this disclosure into WalkStepper ("All turns"); same behaviour, new id.
    const stepsToggle = screen.getByTestId("walk-stepper-all-turns-toggle");
    expect(screen.getByTestId("walk-steps-list")).toHaveProperty("hidden", true);
    await user.click(stepsToggle);
    expect(screen.getByTestId("walk-steps-list")).toHaveProperty("hidden", false);
    expect(screen.getByTestId("walk-steps-list").textContent).toContain("Head north");

    // Clear route — a standalone control here (the address itself never
    // relabels — see BoxCardBody's own header for why).
    const clearButton = screen.getByTestId("walk-clear-route");
    await user.click(clearButton);
    expect(onClearWalkRoute).toHaveBeenCalledTimes(1);

    // Open in Google Maps — walking mode, same handoff every ordinary venue gets.
    const gmapsLink = screen.getByTestId("walk-googlemaps-link") as HTMLAnchorElement;
    expect(gmapsLink.getAttribute("href")).toBe(googleMapsUrl(BASE_BOX.lat, BASE_BOX.lng, "walking"));
    expect(gmapsLink.getAttribute("target")).toBe("_blank");
  });

  test("the address itself stays labeled as the address, even while the route is active", () => {
    render(
      <LocaleProvider initialLocale="en">
        <BoxCardBody
          box={BASE_BOX}
          onWalkRoute={vi.fn()}
          isWalkRouteActive
          walkRouteInfo={{ distance: "0.4", duration: "8 min" }}
        />
      </LocaleProvider>,
    );
    expect(screen.getByText("123 Test St, Pueblo, CO").tagName).toBe("BUTTON");
  });
});

describe("BoxCardBody — location hint (#207)", () => {
  test("renders the 'share your location' hint when showWalkLocationHint is true and no route is active", () => {
    render(
      <LocaleProvider initialLocale="en">
        <BoxCardBody box={BASE_BOX} onWalkRoute={vi.fn()} showWalkLocationHint />
      </LocaleProvider>,
    );
    expect(screen.getByTestId("walk-location-hint")).toBeDefined();
  });

  test("the address button's aria-describedby points at the hint", () => {
    render(
      <LocaleProvider initialLocale="en">
        <BoxCardBody box={BASE_BOX} onWalkRoute={vi.fn()} showWalkLocationHint />
      </LocaleProvider>,
    );
    const trigger = screen.getByText("123 Test St, Pueblo, CO");
    const hint = screen.getByTestId("walk-location-hint");
    expect(trigger.getAttribute("aria-describedby")).toBe(hint.id);
  });
});

describe("BoxCardBody — no walk props (BoxHistoryContent's call shape) stays a plain external link", () => {
  test("renders an <a> to Google Maps with no travel mode, target=_blank, no walk readout ever", () => {
    render(
      <LocaleProvider initialLocale="en">
        <BoxCardBody box={BASE_BOX} />
      </LocaleProvider>,
    );
    const trigger = screen.getByText("123 Test St, Pueblo, CO");
    expect(trigger.tagName).toBe("A");
    expect(trigger.getAttribute("href")).toBe(googleMapsUrl(BASE_BOX.lat, BASE_BOX.lng));
    expect(trigger.getAttribute("href")).not.toContain("travelmode");
    expect(trigger.getAttribute("target")).toBe("_blank");
    expect(screen.queryByTestId("walking-route-info")).toBeNull();
    expect(screen.queryByTestId("walk-clear-route")).toBeNull();
  });
});
