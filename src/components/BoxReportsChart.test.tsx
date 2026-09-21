/**
 * BoxReportsChart render tests (admin dashboard build) — fixture-props
 * coverage: empty-window message, one bar's accessible label carries its
 * OK/trouble split, and the legend always renders.
 */

import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import BoxReportsChart from "@/components/BoxReportsChart";
import type { WeeklyCheckinBucket } from "@/lib/adminDashboard";

function makeBuckets(overrides: Partial<WeeklyCheckinBucket>[] = []): WeeklyCheckinBucket[] {
  const base: WeeklyCheckinBucket[] = Array.from({ length: 8 }, (_, i) => ({
    weekStart: `2026-08-${String(i + 1).padStart(2, "0")}`,
    ok: 0,
    trouble: 0,
  }));
  overrides.forEach((o, i) => Object.assign(base[i], o));
  return base;
}

describe("BoxReportsChart", () => {
  test("all-zero window shows a plain 'no reports' message, no bars", () => {
    render(<BoxReportsChart buckets={makeBuckets()} />);
    expect(screen.getByText(/No box reports in the last 8 weeks/)).toBeDefined();
    expect(screen.queryByRole("img")).toBeNull();
  });

  test("a week with reports gets an accessible bar labeled with its OK/trouble counts", () => {
    render(<BoxReportsChart buckets={makeBuckets([{ ok: 3, trouble: 1 }])} />);
    const bar = screen.getByRole("img", { name: /3 OK, 1 needing attention/ });
    expect(bar).toBeDefined();
  });

  test("legend always renders both series", () => {
    render(<BoxReportsChart buckets={makeBuckets([{ ok: 1 }])} />);
    expect(screen.getByText("OK")).toBeDefined();
    expect(screen.getByText("Needs attention")).toBeDefined();
  });
});
