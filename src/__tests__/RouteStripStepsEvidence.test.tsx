/**
 * RouteStripStepsEvidence.test.tsx — #537 evidence, not reasoning. Kyle saw
 * no Steps control on a real walking route from a blessing box's address.
 * The issue named two candidates and required ruling one out with evidence:
 * (1) Mapbox's reply for the route genuinely has no usable steps, so
 * `hasSteps` is false and the control never renders, or (2) it renders but
 * is easy to miss.
 *
 * `REAL_MAPBOX_WALKING_RESPONSE` below is not synthesized — it's a real
 * `GET https://api.mapbox.com/directions/v5/mapbox/walking/...` response
 * captured 2026-09-19 for a short walk in downtown Pueblo (Arkansas River
 * Multi-Use Path -> Stanton Avenue, ~1226m), using this repo's own
 * production Mapbox public token (`Mapbox - Public Token - Pueblo Food
 * Map`, 1Password) and `steps=true` (the same param MapWrapper.tsx's
 * `buildWalkingRouteUrl` always sends — there is no code path that omits
 * it). Every `maneuver.instruction` and `distance` value below is verbatim
 * from that response; `intersections`/`geometry`/`mode`/etc. are trimmed
 * since `parseWalkSteps` never reads them (dead weight in a test fixture).
 *
 * Result: 7 of 7 steps parse. This rules out candidate 1 for the normal
 * case — a real Mapbox walking response reliably carries steps. Reading the
 * prop chain (MapWrapper.tsx:1678-1682/1714-1718, BottomSheet.tsx:350/376)
 * confirms there is no additional box-specific gate that could drop them
 * before RouteStrip ever sees them; both a plain venue and a blessing box
 * go through the same `handleWalkRoute` -> `walkingRouteVenueId ===
 * selectedVenueId` gate the strip itself already depends on to render at
 * all. So the fix (RouteStrip.tsx) targets candidate 2: promote the control
 * from a text link to a real, primary-looking button — plus a proof-line
 * fallback for the rare route that truly has no steps.
 */

import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RouteStrip from "@/components/RouteStrip";
import { parseWalkSteps } from "@/components/MapWrapper";

// Real captured response (see file header) — trimmed of fields
// parseWalkSteps doesn't read.
const REAL_MAPBOX_WALKING_RESPONSE = {
  distance: 1226.331,
  duration: 860.631,
  legs: [
    {
      steps: [
        { maneuver: { instruction: "Walk southeast on Arkansas River Multi-Use Path." }, distance: 321.178 },
        { maneuver: { instruction: "Turn right onto Arkansas River MUP." }, distance: 45.763 },
        { maneuver: { instruction: "Continue on Moffat Street." }, distance: 128.177 },
        { maneuver: { instruction: "Make a sharp right onto Santa Fe Drive/US 50 Bus. Continue on US 50 Bus." }, distance: 438.881 },
        { maneuver: { instruction: "Turn right onto Locust Street." }, distance: 203.152 },
        { maneuver: { instruction: "Turn left onto Stanton Avenue." }, distance: 89.179 },
        { maneuver: { instruction: "Your destination is on the left." }, distance: 0 },
      ],
    },
  ],
};

describe("#537 — real Mapbox walking response has usable steps", () => {
  test("parseWalkSteps keeps all 7 real steps (candidate 1 ruled out)", () => {
    const steps = parseWalkSteps(REAL_MAPBOX_WALKING_RESPONSE);
    expect(steps).toHaveLength(7);
    expect(steps[0].instruction).toBe("Walk southeast on Arkansas River Multi-Use Path.");
    expect(steps.at(-1)!.instruction).toBe("Your destination is on the left.");
  });
});

describe("#537 — RouteStrip renders the real chain's output (parseWalkSteps -> RouteStrip)", () => {
  test("a route with real steps shows the Steps button as a filled, primary-looking control", () => {
    const steps = parseWalkSteps(REAL_MAPBOX_WALKING_RESPONSE);
    render(
      <RouteStrip
        venueName="Test Venue"
        routeInfo={{ distance: "0.8 mi", duration: "14 min" }}
        locale="en"
        onShowCard={() => {}}
        walkSteps={steps}
      />,
    );
    const stepsButton = screen.getByTestId("route-strip-steps");
    // Real button (not a text link): filled sage-600 background, not just
    // colored/underlined text — the #537 fix.
    expect(stepsButton.className).toMatch(/bg-\[var\(--color-sage-600\)\]/);
    expect(screen.queryByTestId("route-strip-no-steps")).toBeNull();
  });

  test("a route with genuinely no steps shows a fallback line, not a silently missing control", () => {
    render(
      <RouteStrip
        venueName="Test Venue"
        routeInfo={{ distance: "0.1 mi", duration: "2 min" }}
        locale="en"
        onShowCard={() => {}}
        walkSteps={[]}
      />,
    );
    expect(screen.queryByTestId("route-strip-steps")).toBeNull();
    expect(screen.getByTestId("route-strip-no-steps")).toHaveTextContent(
      "No turn-by-turn steps for this route",
    );
  });
});
