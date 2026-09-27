/**
 * KpiCard.test.tsx — the delta math #680's Plan calls out by name ("KpiCard
 * delta math (including 0 -> n)"), plus a render smoke test for the "new"
 * and "—" labels.
 */

import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import KpiCard, { computeKpiDelta } from "@/components/KpiCard";

describe("computeKpiDelta", () => {
  test("0 -> n reads as 'new', never Infinity% or NaN", () => {
    const delta = computeKpiDelta(5, 0);
    expect(delta.isNew).toBe(true);
    expect(delta.pct).toBeNull();
    expect(Number.isFinite(delta.pct ?? 0)).toBe(true);
  });

  test("0 -> 0 reads as flat, no percentage at all", () => {
    expect(computeKpiDelta(0, 0)).toEqual({ pct: null, direction: "flat", isNew: false });
  });

  test("increase computes a positive rounded percentage", () => {
    const delta = computeKpiDelta(150, 100);
    expect(delta.pct).toBe(50);
    expect(delta.direction).toBe("up");
  });

  test("decrease computes a negative percentage", () => {
    const delta = computeKpiDelta(50, 100);
    expect(delta.pct).toBe(-50);
    expect(delta.direction).toBe("down");
  });

  test("no previous value at all -> flat, no comparison rendered", () => {
    expect(computeKpiDelta(10, undefined)).toEqual({ pct: null, direction: "flat", isNew: false });
  });

  test("unchanged value -> 0% flat, not 'new'", () => {
    const delta = computeKpiDelta(10, 10);
    expect(delta.pct).toBe(0);
    expect(delta.direction).toBe("flat");
    expect(delta.isNew).toBe(false);
  });
});

describe("KpiCard render", () => {
  test("shows 'new' for a 0 -> n jump", () => {
    render(<KpiCard label="Visitors" displayValue="42" value={42} previousValue={0} />);
    expect(screen.getByText("new")).toBeDefined();
  });

  test("both periods zero -> a dash, not '+0%' or 'new'", () => {
    render(<KpiCard label="Reported empty" displayValue="0" value={0} previousValue={0} />);
    expect(screen.getByText("—")).toBeDefined();
  });

  test("'about' prefix renders for sampled RUM numbers", () => {
    render(<KpiCard label="Mobile LCP" displayValue="1.8s" value={1800} approximate />);
    expect(screen.getByText("about")).toBeDefined();
  });
});
